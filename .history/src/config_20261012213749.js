/**
 * Cấu hình hệ thống & hằng số nghiệp vụ.
 * Mọi giá trị "ma thuật" (magic number/value) tập trung tại đây.
 */
'use strict';

const path = require('node:path');

const ROOT_DIR = path.resolve(__dirname, '..');

const config = {
  port: Number(process.env.PORT) || 3000,
  host: process.env.HOST || '127.0.0.1',
  rootDir: ROOT_DIR,
  publicDir: path.join(ROOT_DIR, 'public'),
  databaseDir: path.join(ROOT_DIR, 'database'),
  databaseFile: path.join(ROOT_DIR, 'database', 'coffee_crm.db'),
  schemaFile: path.join(ROOT_DIR, 'database', 'schema.sql'),
  schemaPostgresFile: path.join(ROOT_DIR, 'database', 'schema-pg.sql'),
  codeSqlFile: path.join(ROOT_DIR, 'database', 'code.sql'),
  backupDir: path.join(ROOT_DIR, 'database', 'backups'),
  sessionHours: 12,
};

/**
 * Cấu hình cơ sở dữ liệu.
 * - client = 'postgres': dùng PostgreSQL (mặc định) — dữ liệu xem được trên pgAdmin.
 * - client = 'sqlite'  : dùng file SQLite cục bộ (không cần cài máy chủ).
 */
const database = {
  client: (process.env.DB_CLIENT || 'postgres').toLowerCase(),
  postgres: {
    host: process.env.PGHOST || '127.0.0.1',
    port: Number(process.env.PGPORT) || 5432,
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD || '123456',
    database: process.env.PGDATABASE || 'DAS',
    connectionTimeoutMillis: 8000,
    max: 8,
  },
};

/** Vai trò người dùng (phân quyền CN4.5 / mục II - giao diện ADMIN). */
const ROLES = {
  ADMIN: 'Admin',
  MANAGER: 'Quản lý',
  STAFF: 'Nhân viên',
  CUSTOMER: 'Khách hàng',
};

/** Chức vụ nhân viên. */
const CHUC_VU = ['Quản lý', 'Nhân viên bán hàng', 'Nhân viên kho', 'Nhân viên CSKH'];

/** Trạng thái nhân viên (CN4.3 - vô hiệu hóa thay vì xóa cứng). */
const TRANG_THAI_NV = ['Đang làm việc', 'Đã vô hiệu hóa'];

/** Trạng thái khách hàng (CN5.3 - khóa / mở khóa). */
const TRANG_THAI_KH = ['Hoạt động', 'Bị khóa'];

/** Trạng thái tài khoản. */
const TRANG_THAI_TK = ['Hoạt động', 'Bị khóa'];

/** Trạng thái sản phẩm (CN2.3). */
const TRANG_THAI_SP = ['Đang bán', 'Ngừng bán', 'Hết hàng'];

/** Trạng thái đơn hàng + luồng chuyển hợp lệ (CN7.2). */
const TRANG_THAI_DH = ['Chờ xử lý', 'Đã xác nhận', 'Đang giao', 'Hoàn thành', 'Đã hủy'];
const LUONG_DON_HANG = {
  'Chờ xử lý': ['Đã xác nhận', 'Đã hủy'],
  'Đã xác nhận': ['Đang giao', 'Hoàn thành', 'Đã hủy'],
  'Đang giao': ['Hoàn thành', 'Đã hủy'],
  'Hoàn thành': [],
  'Đã hủy': [],
};

/** Trạng thái phiếu nhập (CN6.x). */
const TRANG_THAI_PNH = ['Chờ duyệt', 'Hoàn thành', 'Đã hủy'];

/** Trạng thái phản hồi (CN10.2). */
const TRANG_THAI_PH = ['Chờ xử lý', 'Đã xử lý'];

/** Trạng thái khảo sát. */
const TRANG_THAI_KS = ['Đang mở', 'Đã đóng'];

/** Loại khảo sát. */
const LOAI_KHAO_SAT = ['Sản phẩm mới', 'Mức độ hài lòng', 'Khác'];

/** Loại câu hỏi khảo sát. */
const LOAI_CAU_HOI = ['Trả lời ngắn', 'Một lựa chọn', 'Nhiều lựa chọn', 'Thang điểm'];

/** Loại giao dịch điểm (CN8.x). */
const LOAI_GIAO_DICH_DIEM = ['Cộng', 'Trừ', 'Hoàn', 'Thu hồi'];

/** Hình thức đặt hàng. */
const HINH_THUC_DH = ['Tại quán', 'Giao hàng'];

/** Quy tắc quy đổi điểm: 10.000đ = 1 điểm (CN8.1). */
const VND_PER_POINT = 10000;
/** Giá trị quy đổi khi dùng điểm: 1 điểm = 1.000đ (CN8.2). */
const VND_PER_POINT_REDEEM = 1000;
/** Ngưỡng cảnh báo sắp hết hàng (CN2.7). */
const NGUONG_SAP_HET = 20;
/** Số dòng mặc định mỗi trang. */
const PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 100;

module.exports = {
  config,
  database,
  ROLES,
  CHUC_VU,
  TRANG_THAI_NV,
  TRANG_THAI_KH,
  TRANG_THAI_TK,
  TRANG_THAI_SP,
  TRANG_THAI_DH,
  LUONG_DON_HANG,
  TRANG_THAI_PNH,
  TRANG_THAI_PH,
  TRANG_THAI_KS,
  LOAI_KHAO_SAT,
  LOAI_CAU_HOI,
  LOAI_GIAO_DICH_DIEM,
  HINH_THUC_DH,
  VND_PER_POINT,
  VND_PER_POINT_REDEEM,
  NGUONG_SAP_HET,
  PAGE_SIZE,
  MAX_PAGE_SIZE,
};
