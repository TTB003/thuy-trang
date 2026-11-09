/**
 * NGHIỆP VỤ NHÓM 4 — Quản lý nhân viên và tài khoản (CN4.1 → CN4.5).
 * Bảng: NHANVIEN, TAIKHOAN, PHIEUNGUONHANG, PHANHOI, KHAOSAT.
 */
'use strict';

const db = require('../db');
const auth = require('../core/auth');
const { ROLES, CHUC_VU, TRANG_THAI_NV } = require('../config');
const { badRequest, notFound, conflict } = require('../core/errors');
const { requiredText, optionalText, email, phone, dateOnly, oneOf } = require('../core/validation');
const { FilterBuilder, parsePagination, paginate, executePaged, buildOrderBy } = require('../core/query');

const MAT_KHAU_MAC_DINH = 'Coffee@123';

/** Suy ra vai trò hệ thống từ chức vụ. */
function vaiTroTheoChucVu(chucVu) {
  return chucVu === 'Quản lý' ? ROLES.MANAGER : ROLES.STAFF;
}

const SELECT_SQL = `
  SELECT nv.maNV, nv.hoTen, nv.email, nv.chucVu, nv.sdt, nv.ngayVao, nv.trangThai,
         tk.maTK, tk.tenDangNhap, tk.vaiTro, tk.trangThai AS trangThaiTaiKhoan,
         tk.lanDangNhapCuoi,
         (SELECT COUNT(*) FROM PHIEUNGUONHANG p WHERE p.maNV = nv.maNV) AS soPhieuNhap,
         (SELECT COUNT(*) FROM DONHANG d WHERE d.maNV = nv.maNV) AS soDonHang,
         (SELECT COUNT(*) FROM PHANHOI ph WHERE ph.maNV = nv.maNV) AS soPhanHoiXuLy,
         (SELECT COUNT(*) FROM KHAOSAT k WHERE k.maNV = nv.maNV) AS soKhaoSat
    FROM NHANVIEN nv
    LEFT JOIN TAIKHOAN tk ON tk.maNV = nv.maNV`;
const COUNT_SQL = 'SELECT COUNT(*) AS total FROM NHANVIEN nv';

const SORT_MAP = {
  maNV: 'nv.maNV',
  hoTen: 'nv.hoTen',
  chucVu: 'nv.chucVu',
  ngayVao: 'nv.ngayVao',
  trangThai: 'nv.trangThai',
};

/** CN4.4 — Tìm kiếm / xem nhân viên. */
function listNhanVien(query = {}) {
  const pagination = parsePagination(query);
  const filter = new FilterBuilder()
    .search(query.q, ['nv.hoTen', 'nv.email', 'nv.sdt', 'nv.chucVu'])
    .equals('nv.chucVu', query.chucVu ? optionalText(query.chucVu, 50) : null)
    .equals('nv.trangThai', query.trangThai ? optionalText(query.trangThai, 30) : null);
  const orderBy = buildOrderBy(query, SORT_MAP, 'hoTen');
  const { items, total } = executePaged({
    selectSql: SELECT_SQL,
    countSql: COUNT_SQL,
    filter,
    orderBy,
    pagination,
    runAll: db.all,
    runGet: db.get,
  });
  return paginate(items, total, pagination);
}

/** Lấy chi tiết nhân viên. */
function getNhanVien(maNV) {
  const row = db.get(`${SELECT_SQL} WHERE nv.maNV = :maNV`, { maNV });
  if (!row) throw notFound(`Không tìm thấy nhân viên có mã ${maNV}.`);
  return row;
}

/** Kiểm tra email không trùng. */
function assertEmailKhongTrung(emailValue, excludeMaNV = null) {
  const existed = db.get(
    'SELECT maNV, hoTen FROM NHANVIEN WHERE email = :email AND maNV <> :exclude',
    { email: emailValue, exclude: excludeMaNV ?? -1 }
  );
  if (existed) throw conflict(`Email "${emailValue}" đã được dùng bởi nhân viên ${existed.hoTen}.`);
}

/**
 * CN4.1 — Thêm nhân viên.
 * Đồng thời tạo tài khoản đăng nhập với vai trò suy ra từ chức vụ.
 */
function createNhanVien(payload) {
  const hoTen = requiredText(payload.hoTen, 'Họ tên nhân viên', 100);
  const emailValue = email(payload.email);
  const chucVu = oneOf(payload.chucVu, CHUC_VU, 'Chức vụ');
  const sdt = payload.sdt ? phone(payload.sdt) : null;
  const ngayVao = dateOnly(payload.ngayVao, 'Ngày vào làm', { allowNull: true });
  const matKhau = payload.matKhau ? String(payload.matKhau) : MAT_KHAU_MAC_DINH;
  assertEmailKhongTrung(emailValue);

  return db.transaction(() => {
    const result = db.run(
      `INSERT INTO NHANVIEN (hoTen, email, chucVu, sdt, ngayVao, trangThai)
       VALUES (:hoTen, :email, :chucVu, :sdt, :ngayVao, N'Đang làm việc')`,
      { hoTen, email: emailValue, chucVu, sdt, ngayVao }
    );
    const maNV = result.lastInsertRowid;
    auth.createAccount({
      tenDangNhap: emailValue,
      matKhau,
      vaiTro: vaiTroTheoChucVu(chucVu),
      maNV,
    });
    return getNhanVien(maNV);
  });
}

/** CN4.2 — Sửa thông tin nhân viên (kèm đồng bộ vai trò tài khoản). */
function updateNhanVien(maNV, payload) {
  const current = getNhanVien(maNV);
  const hoTen = requiredText(payload.hoTen ?? current.hoTen, 'Họ tên nhân viên', 100);
  const emailValue = email(payload.email ?? current.email);
  const chucVu = oneOf(payload.chucVu ?? current.chucVu, CHUC_VU, 'Chức vụ');
  const sdt = payload.sdt === undefined ? current.sdt : payload.sdt ? phone(payload.sdt) : null;
  const ngayVao =
    payload.ngayVao === undefined
      ? current.ngayVao
      : dateOnly(payload.ngayVao, 'Ngày vào làm', { allowNull: true });
  const trangThai = oneOf(payload.trangThai ?? current.trangThai, TRANG_THAI_NV, 'Trạng thái');
  assertEmailKhongTrung(emailValue, current.maNV);

  return db.transaction(() => {
    db.run(
      `UPDATE NHANVIEN
          SET hoTen = :hoTen, email = :email, chucVu = :chucVu, sdt = :sdt,
              ngayVao = :ngayVao, trangThai = :trangThai
        WHERE maNV = :maNV`,
      { hoTen, email: emailValue, chucVu, sdt, ngayVao, trangThai, maNV: current.maNV }
    );
    if (current.maTK) {
      db.run(
        `UPDATE TAIKHOAN SET tenDangNhap = :tenDangNhap, vaiTro = :vaiTro,
                             trangThai = :trangThai
          WHERE maTK = :maTK`,
        {
          tenDangNhap: emailValue,
          vaiTro: vaiTroTheoChucVu(chucVu),
          trangThai: trangThai === 'Đã vô hiệu hóa' ? 'Bị khóa' : 'Hoạt động',
          maTK: current.maTK,
        }
      );
    }
    return getNhanVien(current.maNV);
  });
}

/**
 * CN4.3 — Xóa / vô hiệu hóa nhân viên.
 * Nếu đã tham gia nghiệp vụ (lập phiếu nhập, xử lý phản hồi, tạo khảo sát,
 * lập đơn hàng) thì chỉ vô hiệu hóa để bảo toàn dữ liệu lịch sử.
 */
function deleteNhanVien(maNV) {
  const current = getNhanVien(maNV);
  const daThamGia =
    current.soPhieuNhap > 0 || current.soPhanHoiXuLy > 0 || current.soKhaoSat > 0 || current.soDonHang > 0;

  return db.transaction(() => {
    if (daThamGia) {
      db.run(`UPDATE NHANVIEN SET trangThai = N'Đã vô hiệu hóa' WHERE maNV = :maNV`, {
        maNV: current.maNV,
      });
      db.run(`UPDATE TAIKHOAN SET trangThai = 'Bị khóa' WHERE maNV = :maNV`, { maNV: current.maNV });
      db.run('DELETE FROM PHIENDANGNHAP WHERE maTK IN (SELECT maTK FROM TAIKHOAN WHERE maNV = :maNV)', {
        maNV: current.maNV,
      });
      return {
        maNV: current.maNV,
        hoTen: current.hoTen,
        hanhDong: 'vo-hieu-hoa',
        thongBao: 'Nhân viên đã tham gia nghiệp vụ nên được vô hiệu hóa thay vì xóa.',
      };
    }
    db.run('DELETE FROM TAIKHOAN WHERE maNV = :maNV', { maNV: current.maNV });
    db.run('DELETE FROM NHANVIEN WHERE maNV = :maNV', { maNV: current.maNV });
    return {
      maNV: current.maNV,
      hoTen: current.hoTen,
      hanhDong: 'xoa',
      thongBao: 'Đã xóa nhân viên và tài khoản liên quan.',
    };
  });
}

/** Cấp lại / đặt lại mật khẩu cho tài khoản nhân viên. */
function datLaiMatKhau(maNV, matKhauMoi) {
  const current = getNhanVien(maNV);
  if (!current.maTK) throw badRequest('Nhân viên này chưa có tài khoản đăng nhập.');
  const matKhau = requiredText(matKhauMoi ?? MAT_KHAU_MAC_DINH, 'Mật khẩu', 100);
  auth.changePassword(current.maTK, matKhau);
  return { maNV: current.maNV, matKhau, thongBao: 'Đã đặt lại mật khẩu. Phiên đăng nhập cũ bị hủy.' };
}

/** Danh sách nhân viên đang làm việc (dùng cho combobox). */
function listNhanVienDangLamViec() {
  return db.all(
    `SELECT maNV, hoTen, chucVu, email FROM NHANVIEN
      WHERE trangThai = N'Đang làm việc' ORDER BY hoTen ASC`
  );
}

module.exports = {
  listNhanVien,
  getNhanVien,
  createNhanVien,
  updateNhanVien,
  deleteNhanVien,
  datLaiMatKhau,
  listNhanVienDangLamViec,
  MAT_KHAU_MAC_DINH,
};
