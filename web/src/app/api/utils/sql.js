import pg from "pg";

const { Pool } = pg;

function createMissingDatabaseUrlError() {
  return new Error(
    "DATABASE_URL is missing. Set it in web/.env or the server environment.",
  );
}

function buildParameterizedQuery(strings, values) {
  let text = strings[0];
  for (let i = 0; i < values.length; i += 1) {
    text += `$${i + 1}${strings[i + 1]}`;
  }
  return { text, values };
}

const pool = process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL, max: 10 })
  : null;

async function query(text, values = []) {
  if (!pool) {
    throw createMissingDatabaseUrlError();
  }
  const result = await pool.query(text, values);
  return result.rows;
}

function createSqlExecutor(client) {
  return function scopedSql(stringsOrText, ...values) {
    if (Array.isArray(stringsOrText) && "raw" in stringsOrText) {
      const { text, values: queryValues } = buildParameterizedQuery(
        stringsOrText,
        values,
      );
      return client.query(text, queryValues).then((result) => result.rows);
    }

    return client
      .query(stringsOrText, values[0] || [])
      .then((result) => result.rows);
  };
}

function sql(stringsOrText, ...values) {
  if (Array.isArray(stringsOrText) && "raw" in stringsOrText) {
    const { text, values: queryValues } = buildParameterizedQuery(
      stringsOrText,
      values,
    );
    return query(text, queryValues);
  }

  return query(stringsOrText, values[0] || []);
}

sql.transaction = async (callback) => {
  if (!pool) {
    throw createMissingDatabaseUrlError();
  }
  if (typeof callback !== "function") {
    throw new Error("sql.transaction requires a callback that receives a transaction-scoped sql helper.");
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await callback(createSqlExecutor(client));
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
};

export default sql;
