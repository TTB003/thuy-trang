const { Client } = require('pg');

const CAU_HINH = {
  host: '127.0.0.1',
  port: 5432,
  user: 'postgres',
  password: '123456',
};

async function taoDatabase(name) {
  const client = new Client({ ...CAU_HINH, database: 'postgres' });
  await client.connect();
  const da = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [name]);
  if (da.rowCount === 0) {
    await client.query(`CREATE DATABASE "${name}" ENCODING 'UTF8'`);
    console.log(`DA_TAO_DATABASE: ${name}`);
  } else {
    console.log(`DA_CO_SAN: ${name}`);
  }
  const ds = await client.query('SELECT datname FROM pg_database WHERE datistemplate = false ORDER BY datname');
  console.log('danh sach database:', ds.rows.map((r) => r.datname).join(', '));
  await client.end();
}

async function thu(client, nhan, sql) {
  try {
    const ketQua = await client.query(sql);
    console.log(`[OK ] ${nhan} -> ${JSON.stringify(ketQua.rows[0] ?? null).slice(0, 150)}`);
  } catch (error) {
    console.log(`[LOI] ${nhan} -> ${error.message}`);
  }
}

async function kiemTraCuPhap() {
  const client = new Client({ ...CAU_HINH, database: 'DA' });
  await client.connect();
  await thu(client, "chuoi N'...'", "SELECT N'Đang bán' AS x");
  await thu(client, "date('now','localtime')", "SELECT date('now','localtime') AS x");
  await thu(client, 'CURRENT_DATE', 'SELECT CURRENT_DATE AS x');
  await thu(client, 'to_char thang', "SELECT to_char(CURRENT_DATE, 'YYYY-MM') AS x");
  await thu(client, 'date(timestamp)', "SELECT date(TIMESTAMP '2026-01-05 08:30:00') AS x");
  await thu(client, 'COUNT(*) kieu', 'SELECT COUNT(*) AS x FROM (VALUES (1),(2)) t');
  await thu(client, 'NUMERIC kieu', 'SELECT CAST(1000 AS NUMERIC(18,2)) AS x');
  await thu(client, 'ROUND AVG', 'SELECT ROUND(AVG(v), 2) AS x FROM (VALUES (4),(5)) t(v)');
  await thu(client, 'escape nhay don', "SELECT 'O''Brien' AS x");

  await thu(
    client,
    'tao ham unaccent_vn',
    `CREATE OR REPLACE FUNCTION unaccent_vn(txt text) RETURNS text AS $$
     SELECT translate(lower(coalesce(txt, '')),
       'áàảãạăắằẳẵặâấầẩẫậéèẻẽẹêếềểễệíìỉĩịóòỏõọôốồổỗộơớờởỡợúùủũụưứừửữựýỳỷỹỵđ',
       'aaaaaaaaaaaaaaaaaaeeeeeeeeeeeiiiiiooooooooooooooooouuuuuuuuuuuyyyyyd')
     $$ LANGUAGE SQL IMMUTABLE`
  );
  await thu(client, 'dung ham unaccent_vn', "SELECT unaccent_vn('Cà phê sữa đá') AS x");
  await thu(
    client,
    'so sanh khong dau',
    "SELECT ('%ca phe%' = '%' || unaccent_vn('Cà phê') || '%') AS x"
  );
  await client.end();
}

async function main() {
  await taoDatabase('DA');
  await kiemTraCuPhap();
}

main().catch((error) => console.log('LOI_TONG:', error.message));
