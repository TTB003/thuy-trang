/**
 * Driver PostgreSQL.
 *
 * Đặc điểm cần xử lý:
 *  - Định danh không trích dẫn bị chuyển thành chữ thường -> dùng `ten-cot.js`
 *    để trả khóa kết quả về đúng dạng camelCase của ứng dụng.
 *  - `COUNT(*)` (int8) và `NUMERIC` trả về chuỗi -> đăng ký type parser.
 *  - `DATE`/`TIMESTAMP` mặc định trả về đối tượng Date -> chuyển thành chuỗi
 *    'YYYY-MM-DD' / 'YYYY-MM-DD HH:MM:SS' cho đồng nhất với SQLite.
 *  - Cần `RETURNING` để lấy khóa vừa sinh (thay cho lastInsertRowid).
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { Pool, types } = require('pg');
const { database, config } = require('../config');
const dialect = require('./dialect');
const tenCot = require('./ten-cot');

/** Đăng ký cách đọc kiểu dữ liệu của PostgreSQL. */
function dangKyKieuDuLieu() {
  // int8 (bigint) -> number, ví dụ COUNT(*)
  types.setTypeParser(20, (giaTri) => Number(giaTri));
  // numeric -> number, ví dụ DECIMAL(18,2), SUM, AVG, ROUND
  types.setTypeParser(1700, (giaTri) => Number(giaTri));
  // date -> giữ nguyên chuỗi 'YYYY-MM-DD'
  types.setTypeParser(1082, (giaTri) => String(giaTri));
  // timestamp without time zone -> 'YYYY-MM-DD HH:MM:SS'
  types.setTypeParser(1114, (giaTri) => String(giaTri).replace('T', ' ').slice(0, 19));
  // timestamp with time zone -> giờ địa phương 'YYYY-MM-DD HH:MM:SS'
  types.setTypeParser(1184, (giaTri) => {
    const date = new Date(giaTri);
    const pad = (so) => String(so).padStart(2, '0');
    return (
      `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
      `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
    );
  });
}

/** @type {import('pg').Pool | null} */
let pool = null;
/** Kết nối đang giữ transaction (nếu có). */
let clientGiaoDich = null;

/** Đối tượng dùng để chạy truy vấn: client trong transaction, ngược lại là pool. */
function runner() {
  return clientGiaoDich ?? pool;
}

/** Mở kết nối và bảo đảm các thành phần phụ trợ đã tồn tại. */
async function init() {
  if (pool) return pool;
  dangKyKieuDuLieu();
  pool = new Pool(database.postgres);
  await pool.query('SELECT 1');
  await pool.query(dialect.TAO_HAM_UNACCENT);
  return pool;
}

/** Chạy script SQL nhiều câu lệnh (không tham số). */
async function execScript(sqlText) {
  await init();
  await pool.query(sqlText);
}

/** Dịch SQL và chuẩn bị tham số cho PostgreSQL. */
