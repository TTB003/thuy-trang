const { Client, types } = require('pg');

async function thu(client, nhan, sql) {
  try {
    const ketQua = await client.query(sql);
    console.log(`[OK] ${nhan} ->`, JSON.stringify(ketQua.rows[0] ?? null).slice(0, 160));
  } catch (error) {
    console.log(`[LOI] ${nhan} -> ${error.message}`);
  }
}

async function main() {
  const client = new Client({
    host: '127.0.0.1',
    port: 5432,
    user: 'postgres',
    password: '123456',
    database: 'postgres',
  });
  await client.connect();

  await thu(client, "chuoi N'...'", "SELECT N'Đang bán' AS x");
  await thu(client, "date('now','localtime')", "SELECT date('now','localtime') AS x");
  await thu(client, 'CURRENT_DATE', 'SELECT CURRENT_DATE AS x');
  await thu(client, 'to_char thang', "SELECT to_char(CURRENT_DATE, 'YYYY-MM') AS x");
  await thu(client, 'date(timestamp)', "SELECT date(TIMESTAMP '2026-01-05 08:30:00') AS x");
  await thu(
    client,
    'so sanh chuoi co dau',
    "SELECT (N'Đang bán' = N'Đang bán') AS x"
  );
  await thu(client, 'COUNT(*) kieu du lieu', 'SELECT COUNT(*) AS x FROM (VALUES (1),(2)) t');
  await thu(client, 'NUMERIC kieu du lieu', 'SELECT CAST(1000 AS NUMERIC(18,2)) AS x');
  await thu(client, 'ROUND AVG', 'SELECT ROUND(AVG(v), 2) AS x FROM (VALUES (4),(5)) t(v)');
  await thu(client, 'LIMIT OFFSET tham so', 'SELECT $1::int AS a');
  await thu(client, 'insert returning', 'SELECT 1 AS a');
  await thu(client, "chuoi escape nhay don", "SELECT 'O''Brien' AS x");
  await thu(client, 'tim khong dau bang lower', "SELECT lower('CÀ PHÊ') AS x");

  // Thử tạo hàm bỏ dấu tiếng Việt
  await thu(
    client,
    'tao ham unaccent_vn',
    `CREATE OR REPLACE FUNCTION unaccent_vn(txt text) RETURNS text AS $$
     SELECT translate(
       lower(coalesce(txt, '')),
       'áàảãạăắằẳẵặâấầẩẫậéèẻẽẹêếềểễệíìỉĩịóòỏõọôốồổỗộơớờởỡợúùủũụưứừửữựýỳỷỹỵđ',
       'aaaaaaaaaaaaaaaaaaeeeeeeeeeeeiiiiiooooooooooooooooouuuuuuuuuuuyyyyyd'
     );
     $$ LANGUAGE SQL IMMUTABLE`
  );
  await thu(client, 'dung ham unaccent_vn', "SELECT unaccent_vn('Cà phê sữa đá') AS x");

  await client.query('DROP FUNCTION IF EXISTS unaccent_vn(text)');
  await client.end();
}

main().catch((error) => console.log('LOI_TONG:', error.message));
