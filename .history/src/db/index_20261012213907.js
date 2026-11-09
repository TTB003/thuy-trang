/**
 * Lớp truy cập cơ sở dữ liệu dùng chung cho toàn bộ ứng dụng.
 *
 * Tự động chọn driver theo cấu hình:
 *   - 'postgres' (mặc định): dữ liệu lưu trên PostgreSQL, xem được bằng pgAdmin.
 *   - 'sqlite'             : dữ liệu lưu trong file database/coffee_crm.db.
 *
 * Mọi hàm đều BẤT ĐỒNG BỘ. Câu lệnh SQL trong service được viết theo một dạng
 * chung (tham số `:ten`, `UNACCENT(...)`, `date('now','localtime')`...) và lớp
 * `dialect` sẽ dịch sang cú pháp của hệ CSDL đang dùng.
 */
'use strict';

const fs = require('node:fs');
const { config, database } = require('../config');
const dialect = require('./dialect');

/** Chọn driver theo cấu hình; nếu PostgreSQL không kết nối được thì báo rõ. */
function chonDriver() {
  const ten = database.client === 'sqlite' ? 'sqlite' : 'postgres';
  // eslint-disable-next-line global-require
  return ten === 'sqlite' ? require('./sqlite') : require('./postgres');
}

const driver = chonDriver();

/** Tên hệ CSDL đang dùng ('postgres' hoặc 'sqlite'). */
function getClient() {
  return driver.ten;
}

/** Khởi tạo kết nối (gọi một lần khi khởi động). */
async function init() {
  return driver.init();
}

/** Chạy script SQL nhiều câu lệnh. */
async function execScript(sqlText) {
  return driver.execScript(sqlText);
}

/** Chạy câu lệnh thay đổi dữ liệu (INSERT/UPDATE/DELETE). */
async function run(sql, params = {}) {
  return driver.run(sql, params);
}

/** Lấy một dòng đầu tiên. */
async function get(sql, params = {}) {
  return driver.get(sql, params);
}

/** Lấy tất cả các dòng. */
async function all(sql, params = {}) {
  return driver.all(sql, params);
}

/** Lấy một giá trị đơn (cột đầu của dòng đầu). */
async function scalar(sql, params = {}) {
  return driver.scalar(sql, params);
}

/**
 * Thực thi công việc trong transaction.
 * @template T
 * @param {() => Promise<T>} work
 * @returns {Promise<T>}
 */
async function transaction(work) {
  return driver.transaction(work);
}

/** Tạo bảng và các đối tượng CSDL theo kịch bản của hệ CSDL đang dùng. */
async function initSchema() {
  const fileSchema =
    driver.ten === 'postgres' ? config.schemaPostgresFile : config.schemaFile;
  if (!fs.existsSync(fileSchema)) {
    throw new Error(`Không tìm thấy file kịch bản CSDL: ${fileSchema}`);
  }
  await driver.execScript(fs.readFileSync(fileSchema, 'utf8'));
}

/** Danh sách bảng hiện có. */
async function danhSachBang() {
  return driver.danhSachBang();
}

/** Tạo bản sao lưu CSDL vào đường dẫn chỉ định; trả về kích thước file. */
async function taoBanSaoLuu(duongDan) {
  return driver.taoBanSaoLuu(duongDan);
}

/** Kiểm tra kết nối CSDL. */
async function kiemTraKetNoi() {
  return driver.kiemTraKetNoi();
}

/** Đóng kết nối. */
async function closeDb() {
  return driver.closeDb();
}

/** Thông tin mô tả kết nối đang dùng (hiển thị trên giao diện quản trị). */
function thongTinKetNoi() {
  if (driver.ten === 'postgres') {
    const { host, port, database: ten } = database.postgres;
    return {
      he: 'PostgreSQL',
      moTa: `${host}:${port}/${ten}`,
      nguoiDung: database.postgres.user,
    };
  }
  return { he: 'SQLite', moTa: `database/${config.databaseFile.split(/[\\/]/).pop()}`, nguoiDung: null };
}

/** Dịch một câu lệnh SQL sang cú pháp của hệ CSDL đang dùng. */
function dich(sql) {
  return dialect.dich(sql, driver.ten);
}

/** Đoạn SQL tính nhóm tuổi theo hệ CSDL đang dùng. */
function bieuThucNhomTuoi(columnSql) {
  return dialect.bieuThucNhomTuoi(columnSql, driver.ten);
}

/** Đoạn SQL nhóm theo mốc thời gian. */
function bieuThucMocThoiGian(columnSql, kieu) {
  return dialect.bieuThucMocThoiGian(columnSql, kieu, driver.ten);
}

/** Đoạn SQL nhóm theo tháng. */
function bieuThucThang(columnSql) {
  return dialect.bieuThucThang(columnSql, driver.ten);
}

module.exports = {
  getClient,
  driver,
  init,
  initSchema,
  execScript,
  run,
  get,
  all,
  scalar,
  transaction,
  danhSachBang,
  taoBanSaoLuu,
  kiemTraKetNoi,
  closeDb,
  thongTinKetNoi,
  dich,
  bieuThucNhomTuoi,
  bieuThucMocThoiGian,
  bieuThucThang,
};
