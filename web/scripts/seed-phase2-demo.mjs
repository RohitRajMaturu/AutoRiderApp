import fs from "node:fs";
import path from "node:path";
import pg from "pg";
import argon2 from "argon2";

function readEnv() {
  const envPath = path.join(process.cwd(), ".env");
  return Object.fromEntries(
    fs.readFileSync(envPath, "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"))
      .map((line) => {
        const index = line.indexOf("=");
        return [line.slice(0, index), line.slice(index + 1)];
      }),
  );
}

const env = readEnv();
const pool = new pg.Pool({ connectionString: env.DATABASE_URL });
const passwordHash = await argon2.hash("12345");
const client = await pool.connect();

async function one(text, params = []) {
  const result = await client.query(text, params);
  return result.rows[0];
}

try {
  await client.query("BEGIN");

  const institutionAdmin = await one(
    `INSERT INTO auth_users (name, email, phone, role, "emailVerified")
     VALUES ('Ananya Rao', 'admin@greenfield.demo', '9876501001', 'institution_admin', CURRENT_TIMESTAMP)
     ON CONFLICT (email) DO UPDATE SET
       name=EXCLUDED.name, phone=EXCLUDED.phone, role='institution_admin', updated_at=CURRENT_TIMESTAMP
     RETURNING id, name, email, phone`,
  );
  await client.query(
    `INSERT INTO auth_accounts ("userId", provider, type, "providerAccountId", password)
     VALUES ($1::uuid, 'credentials', 'credentials', $1::text, $2)
     ON CONFLICT (provider, "providerAccountId") DO UPDATE SET password=EXCLUDED.password`,
    [institutionAdmin.id, passwordHash],
  );

  let institution = await one(
    "SELECT * FROM institutions WHERE contact_email='transport@greenfield.demo' LIMIT 1",
  );
  if (institution) {
    institution = await one(
      `UPDATE institutions SET
         name='Greenfield International School', institution_type='SCHOOL',
         address='Kondapur, Hyderabad', contact_name='Ananya Rao',
         contact_phone='9876501001', admin_user_id=$1, subscription_plan='PREMIUM',
         monthly_fee=25000, status='ACTIVE', active_since=CURRENT_DATE - 60,
         trial_ends_at=CURRENT_DATE - 61, updated_at=CURRENT_TIMESTAMP
       WHERE id=$2 RETURNING *`,
      [institutionAdmin.id, institution.id],
    );
  } else {
    institution = await one(
      `INSERT INTO institutions
       (name, institution_type, address, contact_name, contact_email, contact_phone,
        admin_user_id, subscription_plan, monthly_fee, trial_ends_at, active_since, status)
       VALUES
       ('Greenfield International School', 'SCHOOL', 'Kondapur, Hyderabad', 'Ananya Rao',
        'transport@greenfield.demo', '9876501001', $1, 'PREMIUM', 25000,
        CURRENT_DATE - 61, CURRENT_DATE - 60, 'ACTIVE') RETURNING *`,
      [institutionAdmin.id],
    );
  }
  await client.query(
    `INSERT INTO institution_admin_users (institution_id, user_id) VALUES ($1, $2)
     ON CONFLICT (user_id) DO UPDATE SET institution_id=EXCLUDED.institution_id`,
    [institution.id, institutionAdmin.id],
  );

  const driver = await one(
    `SELECT d.id FROM drivers d JOIN auth_users u ON u.id=d.user_id
     WHERE regexp_replace(coalesce(u.phone,''), '\\D', '', 'g')='9885553312' LIMIT 1`,
  );
  const passenger = await one(
    `SELECT id FROM auth_users
     WHERE regexp_replace(coalesce(phone,''), '\\D', '', 'g')='9908027984' LIMIT 1`,
  );
  if (!driver || !passenger) {
    throw new Error("Run `node scripts/seed-test-users.mjs` before the Phase 2 demo seed");
  }

  async function upsertRoute(name, direction, time, capacity) {
    const existing = await one(
      "SELECT id FROM institution_routes WHERE institution_id=$1 AND route_name=$2 AND direction=$3 LIMIT 1",
      [institution.id, name, direction],
    );
    if (existing) {
      return one(
        `UPDATE institution_routes SET driver_id=$1, scheduled_days=ARRAY['MON','TUE','WED','THU','FRI'],
         scheduled_time=$2::time, max_capacity=$3, status='ACTIVE', updated_at=CURRENT_TIMESTAMP
         WHERE id=$4 RETURNING *`,
        [driver.id, time, capacity, existing.id],
      );
    }
    return one(
      `INSERT INTO institution_routes
       (institution_id, route_name, driver_id, scheduled_days, scheduled_time, direction, max_capacity, status)
       VALUES ($1,$2,$3,ARRAY['MON','TUE','WED','THU','FRI'],$4::time,$5,$6,'ACTIVE') RETURNING *`,
      [institution.id, name, driver.id, time, direction, capacity],
    );
  }

  const morningRoute = await upsertRoute("Kondapur Morning Loop", "PICKUP", "07:30", 12);
  const eveningRoute = await upsertRoute("Kondapur Evening Loop", "DROPOFF", "15:45", 12);

  const memberSpecs = [
    ["Aarav Mehta", morningRoute.id, 1, "Ritika Mehta", "9876501101", "Botanical Garden Road"],
    ["Diya Sharma", morningRoute.id, 2, "Karan Sharma", "9876501102", "Raghavendra Colony"],
    ["Ishaan Reddy", eveningRoute.id, 1, "Sneha Reddy", "9876501103", "Kondapur Main Road"],
    ["Meera Nair", eveningRoute.id, 2, "Arun Nair", "9876501104", "Masjid Banda"],
  ];
  const members = [];
  for (const [name, routeId, stopOrder, guardian, phone, address] of memberSpecs) {
    let member = await one(
      "SELECT id FROM institution_members WHERE institution_id=$1 AND member_name=$2 LIMIT 1",
      [institution.id, name],
    );
    if (member) {
      member = await one(
        `UPDATE institution_members SET route_id=$1, stop_order=$2, guardian_name=$3,
         guardian_phone=$4, pickup_address=$5, pickup_lat=17.4698, pickup_lng=78.3671, active=true
         WHERE id=$6 RETURNING *`,
        [routeId, stopOrder, guardian, phone, address, member.id],
      );
    } else {
      member = await one(
        `INSERT INTO institution_members
         (institution_id, route_id, member_name, member_type, pickup_address, pickup_lat, pickup_lng,
          stop_order, guardian_name, guardian_phone, active)
         VALUES ($1,$2,$3,'STUDENT',$4,17.4698,78.3671,$5,$6,$7,true) RETURNING *`,
        [institution.id, routeId, name, address, stopOrder, guardian, phone],
      );
    }
    members.push(member);
  }
  await client.query(
    "UPDATE institution_routes SET current_member_count=2 WHERE id = ANY($1::uuid[])",
    [[morningRoute.id, eveningRoute.id]],
  );

  await client.query(
    `INSERT INTO institution_trips
     (route_id, institution_id, scheduled_date, driver_id, status, actual_start_time,
      driver_assigned_at, members_expected, members_picked_up)
     VALUES ($1,$2,CURRENT_DATE,$3,'IN_PROGRESS',CURRENT_TIMESTAMP - INTERVAL '20 minutes',
       CURRENT_TIMESTAMP - INTERVAL '1 day',$4::uuid[],$5::uuid[])
     ON CONFLICT (route_id, scheduled_date) DO UPDATE SET
       driver_id=EXCLUDED.driver_id, status='IN_PROGRESS', actual_start_time=EXCLUDED.actual_start_time,
       members_expected=EXCLUDED.members_expected, members_picked_up=EXCLUDED.members_picked_up,
       updated_at=CURRENT_TIMESTAMP`,
    [morningRoute.id, institution.id, driver.id, [members[0].id, members[1].id], [members[0].id]],
  );
  await client.query(
    `INSERT INTO institution_trips
     (route_id, institution_id, scheduled_date, driver_id, status, driver_assigned_at, members_expected)
     VALUES ($1,$2,CURRENT_DATE,$3,'SCHEDULED',CURRENT_TIMESTAMP - INTERVAL '1 day',$4::uuid[])
     ON CONFLICT (route_id, scheduled_date) DO UPDATE SET
       driver_id=EXCLUDED.driver_id, status='SCHEDULED', members_expected=EXCLUDED.members_expected,
       actual_start_time=NULL, actual_end_time=NULL, updated_at=CURRENT_TIMESTAMP`,
    [eveningRoute.id, institution.id, driver.id, [members[2].id, members[3].id]],
  );

  await client.query(
    `INSERT INTO institution_invoices
     (institution_id, billing_month, total_routes, total_trips_completed, total_trips_scheduled, amount, status, sent_at, paid_at)
     VALUES ($1,date_trunc('month',CURRENT_DATE - INTERVAL '1 month')::date,2,38,40,25000,'PAID',CURRENT_TIMESTAMP - INTERVAL '35 days',CURRENT_TIMESTAMP - INTERVAL '30 days')
     ON CONFLICT (institution_id,billing_month) DO UPDATE SET amount=25000,status='PAID',paid_at=EXCLUDED.paid_at`,
    [institution.id],
  );

  async function upsertPass(label, dropoff, status, assignedDriver) {
    const existing = await one(
      "SELECT id FROM commuter_passes WHERE passenger_id=$1 AND pickup_label=$2 LIMIT 1",
      [passenger.id, label],
    );
    const values = [passenger.id, assignedDriver, label, dropoff];
    if (existing) {
      await client.query(
        `UPDATE commuter_passes SET driver_id=$1, pickup_label=$2, dropoff_label=$3,
         pickup_lat=17.4399,pickup_lng=78.4983,dropoff_lat=17.4435,dropoff_lng=78.3772,
         scheduled_days=ARRAY['MON','WED','FRI'],scheduled_time='09:15',duration_type='MONTHLY',
         agreed_fare=3600,platform_fee=360,driver_payout=3240,payment_status='PAID',status=$4,
         start_date=CURRENT_DATE-7,end_date=CURRENT_DATE+23,updated_at=CURRENT_TIMESTAMP WHERE id=$5`,
        [assignedDriver, label, dropoff, status, existing.id],
      );
      return;
    }
    await client.query(
      `INSERT INTO commuter_passes
       (passenger_id,driver_id,pickup_location,dropoff_location,pickup_lat,pickup_lng,dropoff_lat,dropoff_lng,
        pickup_label,dropoff_label,scheduled_days,scheduled_time,duration_type,agreed_fare,platform_fee,
        driver_payout,payment_status,status,start_date,end_date)
       VALUES ($1,$2,ST_SetSRID(ST_MakePoint(78.4983,17.4399),4326)::geography,
        ST_SetSRID(ST_MakePoint(78.3772,17.4435),4326)::geography,17.4399,78.4983,17.4435,78.3772,
        $3,$4,ARRAY['MON','WED','FRI'],'09:15','MONTHLY',3600,360,3240,'PAID',$5,CURRENT_DATE-7,CURRENT_DATE+23)`,
      [...values, status],
    );
  }
  await upsertPass("Secunderabad Station", "HITEC City", "ACTIVE", driver.id);
  await upsertPass("Kukatpally Metro", "Financial District", "PENDING_MATCH", null);

  const slaExists = await one(
    `SELECT id FROM driver_sla_events WHERE driver_id=$1 AND reference_type='DEMO_ROUTE' AND reference_id=$2 LIMIT 1`,
    [driver.id, morningRoute.id],
  );
  if (!slaExists) {
    await client.query(
      `INSERT INTO driver_sla_events
       (driver_id,event_type,reference_type,reference_id,points_delta,metadata)
       VALUES ($1,'ON_TIME_INSTITUTION_PICKUP','DEMO_ROUTE',$2,5,'{"demo":true}'::jsonb)`,
      [driver.id, morningRoute.id],
    );
  }

  await client.query("COMMIT");
  console.log("Pass & Institution demo data is ready.");
  console.log("Institution admin: admin@greenfield.demo / 12345");
  console.log(`Institution: ${institution.name}`);
  console.log("Created/updated: 2 routes, 4 members, 2 trips, 1 invoice, 2 passes, 1 SLA event");
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  client.release();
  await pool.end();
}
