/**
 * Khởi tạo cơ sở dữ liệu: tạo database (nếu chưa có) và chạy kịch bản tạo bảng.
 *
 * Cách chạy: node scripts/init-db.js
 * Tuỳ chọn:  DB_CLIENT=sqlite node scripts/init-db.js   (dùng SQLite dự phòng)
 */
'use strict';

const db = require('../src/db');
const { database } = require('../src/config');

/** Tạo database PostgreSQL nếu chưa tồn tại. */
async function baoDamDatabasePostgres() {
  if (db.getClient() !== 'postgres') return;
  const { Client } = require('pg');
  const client = new Client({ ...database.postgres, database: 'postgres' });
  await client.connect();
  const ten = database.postgres.database;
  const daCo = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [ten]);
  if (daCo.rowCount === 0) {
    await client.query(`CREATE DATABASE "${ten}" ENCODING 'UTF8'`);
    console.log(`Đã tạo database "${ten}".`);
  } else {
    console.log(`Database "${ten}" đã tồn tại.`);
  }
  await client.end();
}

async function main() {
  const thongTin = db.thongTinKetNoi();
  console.log(`Hệ CSDL: ${thongTin.he} — ${thongTin.moTa}`);

  await baoDamDatabasePostgres();
  await db.init();
  await db.initSchema();

  const bang = await db.danhSachBang();
  console.log(`Đã tạo ${bang.length} bảng: ${bang.join(', ')}`);
  console.log('Khởi tạo cơ sở dữ liệu thành công.');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('LỖI KHỞI TẠO CSDL:', error.message);
    process.exit(1);
  });
