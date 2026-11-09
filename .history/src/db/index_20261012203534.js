/**
 * Lớp truy cập cơ sở dữ liệu (SQLite thông qua module `node:sqlite`).
 * Cung cấp: kết nối dùng chung, truy vấn tham số hóa an toàn, transaction.
 */
'use strict';

const fs = require('node:fs');
const { DatabaseSync } = require('node:sqlite');
const { config } = require('../config');

/** @type {import('node:sqlite').DatabaseSync | null} */
let connection = null;

/** Mở (hoặc tạo mới) kết nối CSDL. */
function getDb() {
  if (connection) return connection;
  fs.mkdirSync(config.databaseDir, { recursive: true });
  connection = new DatabaseSync(config.databaseFile);
  connection.exec('PRAGMA foreign_keys = ON;');
  connection.exec('PRAGMA journal_mode = WAL;');
  return connection;
}

/** Chạy script SQL nhiều câu lệnh (dùng để nạp schema.sql). */
function execScript(sqlText) {
  const db = getDb();
  db.exec(sqlText);
}

/** Đọc file schema.sql và tạo toàn bộ bảng, view, chỉ mục. */
function initSchema() {
  const schemaSql = fs.readFileSync(config.schemaFile, 'utf8');
  execScript(schemaSql);
}

/** Chạy câu lệnh không trả về dữ liệu. */
function run(sql, params = {}) {
  const db = getDb();
  const statement = db.prepare(sql);
  const result = statement.run(params);
  return {
    changes: Number(result.changes),
    lastInsertRowid: Number(result.lastInsertRowid),
  };
}

/** Lấy một dòng đầu tiên (hoặc undefined). */
function get(sql, params = {}) {
  const db = getDb();
  return db.prepare(sql).get(params);
}

/** Lấy tất cả các dòng. */
function all(sql, params = {}) {
  const db = getDb();
  return db.prepare(sql).all(params);
}

/** Lấy một giá trị đơn (cột đầu của dòng đầu). */
function scalar(sql, params = {}) {
  const row = get(sql, params);
  if (!row) return null;
  const keys = Object.keys(row);
  return keys.length ? row[keys[0]] : null;
}

/**
 * Thực thi một hàm trong transaction. Tự động ROLLBACK nếu có lỗi.
 * @template T
 * @param {() => T} work
 * @returns {T}
 */
function transaction(work) {
  const db = getDb();
  db.exec('BEGIN');
  try {
    const result = work();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    try {
      db.exec('ROLLBACK');
    } catch {
      /* bỏ qua lỗi rollback thứ cấp */
    }
    throw error;
  }
}

/** Đóng kết nối (dùng khi tắt server / sao lưu). */
function closeDb() {
  if (connection) {
    connection.close();
    connection = null;
  }
}

module.exports = { getDb, initSchema, execScript, run, get, all, scalar, transaction, closeDb };
