/**
 * Xác thực (đăng nhập/đăng xuất) và phân quyền theo vai trò — CN4.5.
 * Vai trò: Admin | Quản lý | Nhân viên | Khách hàng.
 */
'use strict';

const db = require('../db');
const { config, ROLES } = require('../config');
const { hashPassword, verifyPassword, generateToken } = require('./security');
const { unauthorized, forbidden, badRequest } = require('./errors');
const { nowSql, hoursFromNow, parseSqlDateTime } = require('./time');

/**
 * Ma trận phân quyền: mỗi vai trò được cấp một tập "quyền" (capability).
 * Các route chỉ cần khai báo quyền, không cần kiểm tra vai trò thủ công.
 */
const CAPABILITIES = {
  [ROLES.ADMIN]: [
    'system.account.view',
    'system.account.manage',
    'system.backup',
    'catalog.view',
    'catalog.manage',
    'supplier.view',
    'supplier.select',
    'supplier.manage',
    'employee.view',
    'employee.manage',
    'customer.view',
    'customer.manage',
    'purchase.view',
    'purchase.manage',
    'order.view.all',
    'order.manage',
    'loyalty.manage',
    'promotion.view',
    'promotion.manage',
    'voucher.manage',
    'feedback.view',
    'feedback.handle',
    'survey.view',
    'survey.manage',
    'report.view',
    'report.inventory',
  ],
  [ROLES.MANAGER]: [
    'catalog.view',
    'catalog.manage',
    'supplier.view',
    'supplier.select',
    'supplier.manage',
    'employee.view',
    'employee.manage',
    'customer.view',
    'customer.manage',
    'purchase.view',
    'purchase.manage',
    'order.view.all',
    'order.manage',
    'loyalty.manage',
    'promotion.view',
    'promotion.manage',
    'voucher.manage',
    'feedback.view',
    'feedback.handle',
    'survey.view',
    'survey.manage',
    'report.view',
    'report.inventory',
  ],
  [ROLES.STAFF]: [
    // Quyền thực tế được xác định theo chức vụ ở STAFF_CAPABILITIES.
  ],
  [ROLES.CUSTOMER]: ['self.profile', 'self.order', 'self.feedback', 'self.survey', 'catalog.view'],
};

/** Quyền theo nghiệp vụ của từng chức vụ nhân viên. */
const STAFF_CAPABILITIES = {
  'Nhân viên bán hàng': [
    'catalog.view', 'customer.view', 'order.view.all', 'order.manage', 'loyalty.manage',
  ],
  'Nhân viên kho': [
    'catalog.view', 'purchase.view', 'purchase.manage', 'supplier.select', 'report.inventory',
  ],
  'Nhân viên CSKH': [
    'customer.view', 'customer.manage', 'order.view.all', 'feedback.view', 'feedback.handle', 'survey.view', 'voucher.manage',
    'survey.manage',
  ],
};

function capabilitiesFor(user) {
  if (!user) return [];
  if (user.vaiTro === ROLES.STAFF) return STAFF_CAPABILITIES[user.chucVu] || [];
  return CAPABILITIES[user.vaiTro] || [];
}

/** Kiểm tra vai trò có quyền cụ thể hay không. */
function hasCapability(user, capability) {
  if (!user) return false;
  const granted = capabilitiesFor(user);
  return granted.includes(capability);
}

/** Ném lỗi 403 nếu vai trò không có quyền. */
function assertCapability(user, capability) {
  if (!hasCapability(user, capability)) {
    throw forbidden('Bạn không có quyền thực hiện chức năng này.');
  }
}

/** Chỉ cho phép vai trò Admin (mục II — giao diện ADMIN tách biệt). */
function assertAdmin(user) {
  if (!user || user.vaiTro !== ROLES.ADMIN) {
    throw forbidden('Chức năng này chỉ dành cho quản trị viên (Admin).');
  }
}

/** Là tài khoản nội bộ (Admin / Quản lý / Nhân viên). */
function isInternalUser(user) {
  return Boolean(user) && user.vaiTro !== ROLES.CUSTOMER;
}

/** Xóa các phiên đã hết hạn. */
async function purgeExpiredSessions() {
  await db.run('DELETE FROM PHIENDANGNHAP WHERE hetHan < :now', { now: nowSql() });
}

/**
 * Đăng nhập bằng tên đăng nhập (email hoặc số điện thoại) + mật khẩu.
 * @returns {{ token: string, user: object }}
 */
async function login(tenDangNhap, matKhau, { adminPortal = false } = {}) {
  const ten = String(tenDangNhap || '').trim();
  const pass = String(matKhau || '');
  if (!ten || !pass) throw badRequest('Vui lòng nhập tên đăng nhập và mật khẩu.');

  const account = await db.get(
    `SELECT tk.maTK, tk.tenDangNhap, tk.matKhau, tk.vaiTro,
            COALESCE(tk.maNV, (SELECT nv2.maNV FROM NHANVIEN nv2
                                WHERE LOWER(nv2.email) = LOWER(tk.tenDangNhap) OR nv2.sdt = tk.tenDangNhap
                                ORDER BY nv2.maNV ASC LIMIT 1)) AS maNV,
            tk.maKH, tk.trangThai,
            nv.hoTen AS hoTenNV, nv.chucVu AS chucVu, nv.email AS emailNV,
            kh.hoTen AS hoTenKH, kh.trangThai AS trangThaiKH, kh.email AS emailKH
       FROM TAIKHOAN tk
       LEFT JOIN NHANVIEN nv ON nv.maNV = COALESCE(tk.maNV,
         (SELECT nv2.maNV FROM NHANVIEN nv2
           WHERE LOWER(nv2.email) = LOWER(tk.tenDangNhap) OR nv2.sdt = tk.tenDangNhap
           ORDER BY nv2.maNV ASC LIMIT 1))
       LEFT JOIN KHACHHANG kh ON kh.maKH = tk.maKH
      WHERE tk.tenDangNhap = :ten`,
    { ten }
  );

  if (!account || !verifyPassword(pass, account.matKhau)) {
    throw unauthorized('Tên đăng nhập hoặc mật khẩu không đúng.');
  }
  if (adminPortal && account.vaiTro !== ROLES.ADMIN) {
    throw forbidden('Tài khoản này không có quyền Admin. Hãy đăng nhập bằng tài khoản Admin tại /admin.');
  }
  if (!adminPortal && account.vaiTro === ROLES.ADMIN) {
    throw forbidden('Tài khoản Admin đăng nhập tại /admin. Trang chính dành cho Quản lý, Nhân viên và Khách hàng.');
  }
  if (account.trangThai === 'Bị khóa') {
    throw forbidden('Tài khoản của bạn đang bị khóa, vui lòng liên hệ quản lý hoặc sđt 00000000 để được giải quyết.');
  }
  if (account.vaiTro !== ROLES.ADMIN && account.trangThaiKH === 'Bị khóa') {
    throw forbidden('Tài khoản của bạn đang bị khóa, vui lòng liên hệ quản lý hoặc sđt 00000000 để được giải quyết.');
  }

  await purgeExpiredSessions();
  const token = generateToken();
  await db.run(
    `INSERT INTO PHIENDANGNHAP (token, maTK, ngayTao, hetHan)
     VALUES (:token, :maTK, :ngayTao, :hetHan)`,
    {
      token,
      maTK: account.maTK,
      ngayTao: nowSql(),
      hetHan: hoursFromNow(config.sessionHours),
    }
  );
  await db.run('UPDATE TAIKHOAN SET lanDangNhapCuoi = :now WHERE maTK = :maTK', {
    now: nowSql(),
    maTK: account.maTK,
  });

  return { token, user: toUserContext(account) };
}

/** Chuẩn hóa bản ghi tài khoản thành đối tượng người dùng dùng cho phiên. */
function toUserContext(account) {
  const isCustomer = account.vaiTro === ROLES.CUSTOMER;
  return {
    maTK: account.maTK,
    tenDangNhap: account.tenDangNhap,
    vaiTro: account.vaiTro,
    maNV: account.maNV ?? null,
    maKH: account.maKH ?? null,
    hoTen: isCustomer ? account.hoTenKH || '' : account.hoTenNV || 'Quản trị hệ thống',
    chucVu: isCustomer ? null : account.chucVu || null,
    email: isCustomer ? account.emailKH || null : account.emailNV || null,
    capabilities: capabilitiesFor({ vaiTro: account.vaiTro, chucVu: isCustomer ? null : account.chucVu || null }),
  };
}

/** Đăng xuất — hủy phiên hiện tại. */
async function logout(token) {
  if (!token) return;
  await db.run('DELETE FROM PHIENDANGNHAP WHERE token = :token', { token });
}

/**
 * Lấy người dùng từ token phiên. Trả null nếu token sai/hết hạn.
 * @returns {object|null}
 */
async function resolveUser(token) {
  if (!token) return null;
  const row = await db.get(
    `SELECT tk.maTK, tk.tenDangNhap, tk.vaiTro,
            COALESCE(tk.maNV, (SELECT nv2.maNV FROM NHANVIEN nv2
                                WHERE LOWER(nv2.email) = LOWER(tk.tenDangNhap) OR nv2.sdt = tk.tenDangNhap
                                ORDER BY nv2.maNV ASC LIMIT 1)) AS maNV,
            tk.maKH, tk.trangThai,
            p.hetHan,
            nv.hoTen AS hoTenNV, nv.chucVu AS chucVu, nv.email AS emailNV,
            kh.hoTen AS hoTenKH, kh.trangThai AS trangThaiKH, kh.email AS emailKH
       FROM PHIENDANGNHAP p
       JOIN TAIKHOAN tk ON tk.maTK = p.maTK
       LEFT JOIN NHANVIEN nv ON nv.maNV = COALESCE(tk.maNV,
         (SELECT nv2.maNV FROM NHANVIEN nv2
           WHERE LOWER(nv2.email) = LOWER(tk.tenDangNhap) OR nv2.sdt = tk.tenDangNhap
           ORDER BY nv2.maNV ASC LIMIT 1))
       LEFT JOIN KHACHHANG kh ON kh.maKH = tk.maKH
      WHERE p.token = :token`,
    { token }
  );
  if (!row) return null;

  const expired = parseSqlDateTime(row.hetHan);
  if (!expired || expired.getTime() < Date.now()) {
    await db.run('DELETE FROM PHIENDANGNHAP WHERE token = :token', { token });
    return null;
  }
  if (row.trangThai === 'Bị khóa') return null;
  return toUserContext(row);
}

/** Tạo tài khoản mới (dùng cho Admin, đăng ký khách hàng, tạo nhân viên). */
async function createAccount({ tenDangNhap, matKhau, vaiTro, maNV = null, maKH = null }) {
  const existed = await db.get('SELECT maTK FROM TAIKHOAN WHERE tenDangNhap = :ten', {
    ten: tenDangNhap,
  });
  if (existed) throw badRequest(`Tên đăng nhập "${tenDangNhap}" đã được sử dụng.`);
  const result = await db.run(
    `INSERT INTO TAIKHOAN (tenDangNhap, matKhau, vaiTro, maNV, maKH, trangThai, ngayTao)
     VALUES (:tenDangNhap, :matKhau, :vaiTro, :maNV, :maKH, 'Hoạt động', :ngayTao)`,
    {
      tenDangNhap,
      matKhau: hashPassword(matKhau),
      vaiTro,
      maNV,
      maKH,
      ngayTao: nowSql(),
    }
  );
  return result.lastInsertRowid;
}

/** Đổi mật khẩu tài khoản. */
async function changePassword(maTK, matKhauMoi) {
  await db.run('UPDATE TAIKHOAN SET matKhau = :matKhau WHERE maTK = :maTK', {
    matKhau: hashPassword(matKhauMoi),
    maTK,
  });
  await db.run('DELETE FROM PHIENDANGNHAP WHERE maTK = :maTK', { maTK });
}

module.exports = {
  CAPABILITIES,
  STAFF_CAPABILITIES,
  capabilitiesFor,
  hasCapability,
  assertCapability,
  assertAdmin,
  isInternalUser,
  login,
  logout,
  resolveUser,
  createAccount,
  changePassword,
  purgeExpiredSessions,
};
