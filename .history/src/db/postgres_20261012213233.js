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
