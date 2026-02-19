const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL;

const pool = new Pool(
  connectionString
    ? { connectionString }
    : {
        host: process.env.PGHOST || 'localhost',
        port: Number(process.env.PGPORT || 5432),
        user: process.env.PGUSER || 'postgres',
        password: process.env.PGPASSWORD || '',
        database: process.env.PGDATABASE || 'po_requester'
      }
);

async function init() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS po_requests (
      id SERIAL PRIMARY KEY,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      user_name TEXT,
      user_email TEXT,
      user_role TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      payload JSONB NOT NULL
    )
  `);
}

async function createPoRequest({ user, payload }) {
  const result = await pool.query(
    `
      INSERT INTO po_requests (user_name, user_email, user_role, payload)
      VALUES ($1, $2, $3, $4)
      RETURNING id, created_at, status
    `,
    [user.displayName, user.email, user.role, payload]
  );

  return result.rows[0];
}

async function listPoRequests() {
  const result = await pool.query(
    `
      SELECT id,
             created_at,
             user_name,
             user_email,
             user_role,
             status,
             payload
      FROM po_requests
      ORDER BY created_at DESC
    `
  );
  return result.rows;
}

async function updatePoRequestStatus(id, status) {
  const result = await pool.query(
    `
      UPDATE po_requests
      SET status = $2
      WHERE id = $1
      RETURNING id, created_at, user_name, user_email, user_role, status, payload
    `,
    [id, status]
  );

  return result.rows[0] || null;
}

module.exports = {
  pool,
  init,
  createPoRequest,
  listPoRequests,
  updatePoRequestStatus
};

