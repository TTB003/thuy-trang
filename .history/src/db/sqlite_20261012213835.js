/**
 * Driver SQLite (chế độ dự phòng khi không có PostgreSQL).
 * Cung cấp cùng giao diện với driver PostgreSQL nhưng tất cả hàm đều bất đồng bộ
 * để lớp nghiệp vụ chỉ cần viết một kiểu gọi duy nhất.
 */
'use strict';

const fs = require('node:fs');
const { DatabaseSync } = require('node:sqlite');
const { config } = require('../config');
const { unaccent } = require('../core/text');

/** @type {import('node:sqlite').DatabaseSync | null} */
let connection = null;

/** Mở kết nối, đăng ký hàm bỏ dấu. */
async function init() {
  if (connection) return connection;
  fs.mkdirSync(config.databaseDir, { recursive: true });
  connection = new DatabaseSync(config.databaseFile);
  connection.exec('PRAGMA foreign_keys = ON;');
  connection.exec('PRAGMA journal_mode = WAL;');
  connection.function('UNACCENT', { deterministic: true }, unaccent);
  return connection;
}

/** Chạy script nhiều câu lệnh. */
async function execScript(sqlText) {
  const db = await init();
  db.exec(sqlText);
}

/** Chạy câu lệnh thay đổi dữ liệu. */
async function run(sql, params = {}) {
  const db = await init();
  const ketQua = db.prepare(sql).run(params);
  return {
    changes: Number(ketQua.changes),
    lastInsertRowid: Number(ketQua.lastInsertRowid),
  };
}

/** Lấy một dòng. */
async function get(sql, params = {}) {
  const db = await init();
  return db.prepare(sql).get(params);
}

/** Lấy nhiều dòng. */
async function all(sql, params = {}) {
  const db = await init();
  return db.prepare(sql).all(params);
}

/** Lấy một giá trị đơn. */
async function scalar(sql, params = {}) {
  const dong = await get(sql, params);
  if (!dong) return null;
  const khoa = Object.keys(dong);
  return khoa.length ? dong[khoa[0]] : null;
}

/** Số tầng transaction đang mở. */
let soTangGiaoDich = 0;

/**
 * Thực thi công việc trong một transaction.
 * @template T
 * @param {() => Promise<T>} work
 * @returns {Promise<T>}
 */
async function transaction(work) {
  const db = await init();
  if (soTangGiaoDich > 0) return work();

  soTangGiaoDich += 1;
  db.exec('BEGIN');
  try {
    const ketQua = await work();
    db.exec('COMMIT');
    return ketQua;
  } catch (error) {
    try {
      db.exec('ROLLBACK');
    } catch {
      /* bỏ qua lỗi rollback thứ cấp */
    }
    throw error;
  } finally {
    soTangGiaoDich -= 1;
  }
}

/** Danh sách bảng hiện có. */
async function danhSachBang() {
  const rows = await all(
    `SELECT name AS ten FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name`
  );
  return rows.map((dong) => dong.ten);
}

/** Tạo bản sao lưu bằng VACUUM INTO. */
async function taoBanSaoLuu(duongDan) {
  const db = await init();
  fs.mkdirSync(require('node:path').dirname(duongDan), { recursive: true });
  if (fs.existsSync(duongDan)) fs.unlinkSync(duongDan);
  db.exec(`VACUUM INTO '${duongDan.replace(/'/g, "''")}'`);
  return fs.statSync(duongDan).size;
}

/** Kiểm tra kết nối CSDL. */
async function kiemTraKetNoi() {
  const ketQua = await get('SELECT 1 AS ok');
  return Boolean(ketQua);
}

/** Đóng kết nối. */
async function closeDb() {
  if (connection) {
    connection.close();
    connection = null;
  }
}

module.exports = {
  ten: 'sqlite',
  hoTroTaoBang: true,
  init,
  execScript,
  run,
  get,
  all,
  scalar,
  transaction,
  taoBanSaoLuu,
  danhSachBang,
  kiemTraKetNoi,
  closeDb,
};
