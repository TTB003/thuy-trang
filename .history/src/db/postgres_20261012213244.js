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
function chuanBi(sql) {
  const daDich = dialect.sangPostgres(sql);
  const { sql: sqlDanhSo, tenThamSo } = dialect.danhSoThamSo(daDich);
  return { sqlDanhSo, tenThamSo };
}

/** Có phải câu lệnh INSERT và chưa có RETURNING hay không. */
function canThemReturning(sql) {
  return /^\s*INSERT\s+/i.test(sql) && !/\bRETURNING\b/i.test(sql);
}

/** Chạy câu lệnh thay đổi dữ liệu. */
async function run(sql, params = {}) {
  await init();
  const themReturning = canThemReturning(sql);
  const { sqlDanhSo, tenThamSo } = chuanBi(themReturning ? `${sql} RETURNING *` : sql);
  const ketQua = await runner().query(sqlDanhSo, dialect.sapXepThamSo(tenThamSo, params));
  const dong = ketQua.rows?.[0];
  return {
    changes: Number(ketQua.rowCount ?? 0),
    lastInsertRowid: dong ? Number(Object.values(dong)[0]) : 0,
  };
}

/** Lấy một dòng. */
async function get(sql, params = {}) {
  await init();
  const { sqlDanhSo, tenThamSo } = chuanBi(sql);
  const ketQua = await runner().query(sqlDanhSo, dialect.sapXepThamSo(tenThamSo, params));
  return ketQua.rows?.[0] ? tenCot.chuanHoaDong(ketQua.rows[0]) : undefined;
}

/** Lấy nhiều dòng. */
async function all(sql, params = {}) {
  await init();
  const { sqlDanhSo, tenThamSo } = chuanBi(sql);
  const ketQua = await runner().query(sqlDanhSo, dialect.sapXepThamSo(tenThamSo, params));
  return tenCot.chuanHoaNhieuDong(ketQua.rows ?? []);
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
 * Nếu đang ở trong transaction thì chỉ chạy tiếp (không lồng nhau).
 * @template T
 * @param {() => Promise<T>} work
 * @returns {Promise<T>}
 */
async function transaction(work) {
  await init();
  if (soTangGiaoDich > 0) return work();

  soTangGiaoDich += 1;
  clientGiaoDich = await pool.connect();
  try {
    await clientGiaoDich.query('BEGIN');
    const ketQua = await work();
    await clientGiaoDich.query('COMMIT');
    return ketQua;
  } catch (error) {
    try {
      await clientGiaoDich.query('ROLLBACK');
    } catch {
      /* bỏ qua lỗi rollback thứ cấp */
    }
    throw error;
  } finally {
    soTangGiaoDich -= 1;
    clientGiaoDich.release();
    clientGiaoDich = null;
  }
}

/** Tạo bản sao lưu luận lý (script SQL) của toàn bộ CSDL. */
async function taoBanSaoLuu(duongDan) {
  await init();
  const bang = await all(
    `SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name`
  );
  const phan = [
    `-- Bản sao lưu luận lý CSDL ${database.postgres.database}`,
    `-- Thời điểm: ${new Date().toLocaleString('vi-VN')}`,
    '',
  ];
  for (const muc of bang) {
    const tenBang = muc.table_name ?? muc.tableName;
    const loi = await runner().query(`SELECT * FROM ${tenBang}`);
    phan.push(`-- Bảng ${tenBang} (${loi.rows.length} dòng)`);
    if (loi.rows.length === 0) {
      phan.push('');
      continue;
    }
    for (const dong of loi.rows) {
      const cot = Object.keys(dong);
      const giaTri = cot.map((ten) => chuyenThanhLiteral(dong[ten]));
      phan.push(`INSERT INTO ${tenBang} (${cot.join(', ')}) VALUES (${giaTri.join(', ')});`);
    }
    phan.push('');
  }
  fs.mkdirSync(path.dirname(duongDan), { recursive: true });
  fs.writeFileSync(duongDan, phan.join('\n'), 'utf8');
  return fs.statSync(duongDan).size;
}

/** Chuyển một giá trị JS thành literal SQL. */
function chuyenThanhLiteral(giaTri) {
  if (giaTri === null || giaTri === undefined) return 'NULL';
  if (typeof giaTri === 'number') return String(giaTri);
  if (typeof giaTri === 'boolean') return giaTri ? 'TRUE' : 'FALSE';
  if (giaTri instanceof Date) return `'${giaTri.toISOString().slice(0, 19)}'`;
  return `'${String(giaTri).replace(/'/g, "''")}'`;
}

/** Tên các bảng đang có trong CSDL. */
async function danhSachBang() {
  const bang = await all(
    `SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name`
  );
  return bang.map((muc) => muc.table_name ?? muc.tableName);
}

/** Kiểm tra kết nối CSDL còn hoạt động. */
async function kiemTraKetNoi() {
  const ketQua = await get('SELECT 1 AS ok');
  return Boolean(ketQua);
}

/** Đóng tất cả kết nối. */
async function closeDb() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

module.exports = {
  ten: 'postgres',
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
  chuyenThanhLiteral,
  duongDanFile: () => `postgresql://${database.postgres.user}@${database.postgres.host}:${database.postgres.port}/${database.postgres.database}`,
};
