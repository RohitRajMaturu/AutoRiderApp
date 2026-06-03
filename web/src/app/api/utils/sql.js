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
  ? new Pool({ connectionString: process.env.DATABASE_URL })
  : null;

async function query(text, values = []) {
  if (!pool) {
    throw createMissingDatabaseUrlError();
  }
  const result = await pool.query(text, values);
  return result.rows;
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

sql.transaction = async (queries) => {
  return Promise.all(queries);
};

export default sql;
