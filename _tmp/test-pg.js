const { Client } = require('pg');

async function main() {
  const client = new Client({
    host: '127.0.0.1',
    port: 5432,
    user: 'postgres',
    password: '123456',
    database: 'postgres',
    connectionTimeoutMillis: 5000,
  });
  try {
    await client.connect();
    const version = await client.query('SELECT version() AS v');
    const db = await client.query('SELECT current_database() AS d, current_user AS u');
    console.log('PG_OK');
    console.log('version:', version.rows[0].v.slice(0, 60));
    console.log('database:', db.rows[0].d, '| user:', db.rows[0].u);
    const bang = await client.query(
      "SELECT datname FROM pg_database WHERE datistemplate = false ORDER BY datname"
    );
    console.log('danh sach database:', bang.rows.map((r) => r.datname).join(', '));
  } catch (error) {
    console.log('PG_LOI:', error.message);
  } finally {
    await client.end().catch(() => {});
  }
}

main();
