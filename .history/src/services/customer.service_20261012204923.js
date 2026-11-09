/**
 * NGHIỆP VỤ NHÓM 5 — Quản lý khách hàng (CN5.1 → CN5.4).
 * Bao gồm đăng ký tài khoản khách hàng (mục 4.3 - đồ án).
 * Bảng: KHACHHANG, TAIKHOAN, DONHANG, LICHSUDIEM, PHANHOI.
 */
'use strict';

const db = require('../db');
const auth = require('../core/auth');
const { ROLES } = require('../config');
const { badRequest, notFound, conflict } = require('../core/errors');
const { requiredText, optionalText, optionalEmail, phone, dateOnly, oneOf } = require('../core/validation');
const { ageFromBirthDate, nowSql } = require('../core/time');
const { FilterBuilder, parsePagination, paginate, executePaged, buildOrderBy } = require('../core/query');

const GIOI_TINH = ['Nam', 'Nữ', 'Khác'];
const TRANG_THAI_KH = ['Hoạt động', 'Bị khóa', 'Đã xóa'];
const NHOM_TUOI_CHUA_RO = 'Chưa rõ';

/** Xếp một độ tuổi vào nhóm tuổi phục vụ báo cáo (mục 4.1). */
function nhomTuoiCua(doTuoi) {
  if (doTuoi === null || doTuoi === undefined) return NHOM_TUOI_CHUA_RO;
  if (doTuoi < 18) return 'Dưới 18';
  if (doTuoi <= 24) return '18-24';
  if (doTuoi <= 34) return '25-34';
  if (doTuoi <= 44) return '35-44';
  if (doTuoi <= 54) return '45-54';
  return 'Trên 55';
}

/** Bổ sung độ tuổi và nhóm tuổi cho bản ghi khách hàng. */
function decorate(row) {
  if (!row) return row;
  const doTuoi = ageFromBirthDate(row.ngaySinh);
  return { ...row, doTuoi, nhomTuoi: nhomTuoiCua(doTuoi) };
}

const SELECT_SQL = `
  SELECT kh.maKH, kh.hoTen, kh.sdt, kh.email, kh.ngaySinh, kh.gioiTinh, kh.diaChi,
         kh.soThich, kh.diemTichLuy, kh.trangThai, kh.ngayDangKy,
         tk.maTK, tk.tenDangNhap, tk.trangThai AS trangThaiTaiKhoan,
         (SELECT COUNT(*) FROM DONHANG d WHERE d.maKH = kh.maKH) AS soDonHang,
         COALESCE((SELECT SUM(d.tongTien) FROM DONHANG d
                    WHERE d.maKH = kh.maKH AND d.trangThai = N'Hoàn thành'), 0) AS tongChiTieu
    FROM KHACHHANG kh
    LEFT JOIN TAIKHOAN tk ON tk.maKH = kh.maKH`;
const COUNT_SQL = 'SELECT COUNT(*) AS total FROM KHACHHANG kh';

const SORT_MAP = {
  maKH: 'kh.maKH',
  hoTen: 'kh.hoTen',
  diemTichLuy: 'kh.diemTichLuy',
  tongChiTieu: 'tongChiTieu',
  soDonHang: 'soDonHang',
  ngayDangKy: 'kh.ngayDangKy',
};

/** CN5.4 — Tìm kiếm / xem khách hàng. */
function listKhachHang(query = {}) {
  const pagination = parsePagination(query);
  const filter = new FilterBuilder()
    .search(query.q, ['kh.hoTen', 'kh.sdt', 'kh.email', 'kh.diaChi', 'kh.soThich'])
    .equals('kh.trangThai', query.trangThai ? optionalText(query.trangThai, 30) : null)
    .equals('kh.gioiTinh', query.gioiTinh ? optionalText(query.gioiTinh, 10) : null);
  if (query.nhomTuoi) {
    const nhom = optionalText(query.nhomTuoi, 20);
    filter.raw(`${sqlNhomTuoi('kh.ngaySinh')} = :nhomTuoi`, { nhomTuoi: nhom });
  }
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
  return paginate(items.map(decorate), total, pagination);
}

/** Biểu thức SQL tính nhóm tuổi từ ngày sinh. */
function sqlNhomTuoi(columnSql) {
  return `(CASE
      WHEN ${columnSql} IS NULL THEN N'Chưa rõ'
      WHEN CAST((julianday('now','localtime') - julianday(${columnSql})) / 365.25 AS INT) < 18 THEN N'Dưới 18'
      WHEN CAST((julianday('now','localtime') - julianday(${columnSql})) / 365.25 AS INT) <= 24 THEN N'18-24'
      WHEN CAST((julianday('now','localtime') - julianday(${columnSql})) / 365.25 AS INT) <= 34 THEN N'25-34'
      WHEN CAST((julianday('now','localtime') - julianday(${columnSql})) / 365.25 AS INT) <= 44 THEN N'35-44'
      WHEN CAST((julianday('now','localtime') - julianday(${columnSql})) / 365.25 AS INT) <= 54 THEN N'45-54'
      ELSE N'Trên 55' END)`;
}

/** CN5.4 — Hồ sơ chi tiết khách hàng: đơn hàng, lịch sử điểm, phản hồi. */
function getKhachHang(maKH) {
  const row = db.get(`${SELECT_SQL} WHERE kh.maKH = :maKH`, { maKH });
  if (!row) throw notFound(`Không tìm thấy khách hàng có mã ${maKH}.`);

  const donHang = db.all(
    `SELECT maDH, ngayDat, tongTien, trangThai, hinhThuc
       FROM DONHANG WHERE maKH = :maKH ORDER BY ngayDat DESC LIMIT 20`,
    { maKH }
  );
  const lichSuDiem = db.all(
    `SELECT maLS, maDH, soDiem, loaiGD, ghiChu, ngayGD
       FROM LICHSUDIEM WHERE maKH = :maKH ORDER BY ngayGD DESC LIMIT 30`,
    { maKH }
  );
  const phanHoi = db.all(
    `SELECT maPH, noiDung, danhGia, trangThai, ngayGui
       FROM PHANHOI WHERE maKH = :maKH ORDER BY ngayGui DESC LIMIT 10`,
    { maKH }
  );
  const soThichSanPham = db.all(
    `SELECT l.tenLoai, SUM(ct.soLuong) AS tongSoLuong
       FROM DONHANG d
       JOIN CHITIETDONHANG ct ON ct.maDH = d.maDH
       JOIN SANPHAM sp ON sp.maSP = ct.maSP
       JOIN LOAISANPHAM l ON l.maLoai = sp.maLoai
      WHERE d.maKH = :maKH AND d.trangThai = N'Hoàn thành'
      GROUP BY l.tenLoai
      ORDER BY tongSoLuong DESC`,
    { maKH }
  );
  return { ...decorate(row), donHang, lichSuDiem, phanhoi, soThichSanPham };
}

/** Kiểm tra số điện thoại khách hàng không trùng. */
function assertSdtKhongTrung(sdt, excludeMaKH = null) {
  const existed = db.get(
    'SELECT maKH, hoTen FROM KHACHHANG WHERE sdt = :sdt AND maKH <> :exclude',
    { sdt, exclude: excludeMaKH ?? -1 }
  );
  if (existed) throw conflict(`Số điện thoại ${sdt} đã được dùng bởi khách hàng ${existed.hoTen}.`);
}

/** Chuẩn hóa dữ liệu khách hàng từ payload. */
function chuanHoaKhachHang(payload, current = {}) {
  return {
    hoTen: requiredText(payload.hoTen ?? current.hoTen, 'Họ tên khách hàng', 100),
    sdt: phone(payload.sdt ?? current.sdt),
    email:
      payload.email === undefined ? current.email ?? null : optionalEmail(payload.email),
    ngaySinh:
      payload.ngaySinh === undefined
        ? current.ngaySinh ?? null
        : dateOnly(payload.ngaySinh, 'Ngày sinh', { allowNull: true }),
    gioiTinh:
      payload.gioiTinh === undefined
        ? current.gioiTinh ?? null
        : payload.gioiTinh
          ? oneOf(payload.gioiTinh, GIOI_TINH, 'Giới tính')
          : null,
    diaChi: optionalText(payload.diaChi ?? current.diaChi, 255),
    soThich: optionalText(payload.soThich ?? current.soThich, 150),
  };
}

/**
 * CN5.1 — Thêm khách hàng (do nhân viên/quản lý thực hiện).
 * Nếu có mật khẩu thì tạo luôn tài khoản đăng nhập cho khách.
 */
function createKhachHang(payload) {
  const data = chuanHoaKhachHang(payload);
  assertSdtKhongTrung(data.sdt);

  return db.transaction(() => {
    const result = db.run(
      `INSERT INTO KHACHHANG (hoTen, sdt, email, ngaySinh, gioiTinh, diaChi, soThich,
                              diemTichLuy, trangThai, ngayDangKy)
       VALUES (:hoTen, :sdt, :email, :ngaySinh, :gioiTinh, :diaChi, :soThich,
               0, N'Hoạt động', :ngayDangKy)`,
      { ...data, ngayDangKy: nowSql() }
    );
    const maKH = result.lastInsertRowid;
    if (payload.matKhau) {
      auth.createAccount({
        tenDangNhap: data.sdt,
        matKhau: String(payload.matKhau),
        vaiTro: ROLES.CUSTOMER,
        maKH,
      });
    }
    return getKhachHang(maKH);
  });
}

/** 4.3.1 — Khách hàng tự đăng ký tài khoản. */
function dangKyKhachHang(payload) {
  const matKhau = requiredText(payload.matKhau, 'Mật khẩu', 100);
  if (matKhau.length < 6) throw badRequest('Mật khẩu phải có ít nhất 6 ký tự.');
  const data = chuanHoaKhachHang(payload);
  assertSdtKhongTrung(data.sdt);
  const existedTaiKhoan = db.get('SELECT maTK FROM TAIKHOAN WHERE tenDangNhap = :ten', {
    ten: data.sdt,
  });
  if (existedTaiKhoan) throw conflict('Số điện thoại này đã được đăng ký tài khoản.');

  const maKH = db.transaction(() => {
    const result = db.run(
      `INSERT INTO KHACHHANG (hoTen, sdt, email, ngaySinh, gioiTinh, diaChi, soThich,
                              diemTichLuy, trangThai, ngayDangKy)
       VALUES (:hoTen, :sdt, :email, :ngaySinh, :gioiTinh, :diaChi, :soThich,
               0, N'Hoạt động', :ngayDangKy)`,
      { ...data, ngayDangKy: nowSql() }
    );
    const newMaKH = result.lastInsertRowid;
    auth.createAccount({
      tenDangNhap: data.sdt,
      matKhau,
      vaiTro: ROLES.CUSTOMER,
      maKH: newMaKH,
    });
    return newMaKH;
  });
  return getKhachHang(maKH);
}

/** CN5.2 — Sửa thông tin khách hàng (không cho sửa trực tiếp điểm tích lũy). */
function updateKhachHang(maKH, payload) {
  const current = getKhachHang(maKH);
  const data = chuanHoaKhachHang(payload, current);
  assertSdtKhongTrung(data.sdt, current.maKH);

  return db.transaction(() => {
    db.run(
      `UPDATE KHACHHANG
          SET hoTen = :hoTen, sdt = :sdt, email = :email, ngaySinh = :ngaySinh,
              gioiTinh = :gioiTinh, diaChi = :diaChi, soThich = :soThich
        WHERE maKH = :maKH`,
      { ...data, maKH: current.maKH }
    );
    if (current.maTK) {
      db.run('UPDATE TAIKHOAN SET tenDangNhap = :ten WHERE maTK = :maTK', {
        ten: data.sdt,
        maTK: current.maTK,
      });
    }
    return getKhachHang(current.maKH);
  });
}

/** CN5.3 — Khóa / mở khóa tài khoản khách hàng. */
function doiTrangThaiKhachHang(maKH, trangThaiMoi) {
  const current = getKhachHang(maKH);
  const trangThai = oneOf(trangThaiMoi, TRANG_THAI_KH, 'Trạng thái khách hàng');
  if (current.trangThai === trangThai) {
    throw badRequest(`Khách hàng đang ở trạng thái "${trangThai}".`);
  }

  return db.transaction(() => {
    db.run('UPDATE KHACHHANG SET trangThai = :trangThai WHERE maKH = :maKH', {
      trangThai,
      maKH: current.maKH,
    });
    if (current.maTK) {
      const trangThaiTK = trangThai === 'Hoạt động' ? 'Hoạt động' : 'Bị khóa';
      db.run('UPDATE TAIKHOAN SET trangThai = :trangThai WHERE maTK = :maTK', {
        trangThai: trangThaiTK,
        maTK: current.maTK,
      });
      if (trangThaiTK === 'Bị khóa') {
        db.run('DELETE FROM PHIENDANGNHAP WHERE maTK = :maTK', { maTK: current.maTK });
      }
    }
    return getKhachHang(current.maKH);
  });
}

/**
 * 4.1.2 — Xóa khách hàng.
 * Nếu khách đã phát sinh đơn hàng/điểm/phản hồi thì chuyển sang 'Đã xóa'
 * (ẩn khỏi danh sách) để bảo toàn dữ liệu báo cáo.
 */
function deleteKhachHang(maKH) {
  const current = getKhachHang(maKH);
  const rangBuoc =
    current.soDonHang > 0 ||
    current.lichSuDiem.length > 0 ||
    current.phanHoi.length > 0;

  if (rangBuoc) {
    db.transaction(() => {
      db.run(`UPDATE KHACHHANG SET trangThai = N'Đã xóa' WHERE maKH = :maKH`, { maKH: current.maKH });
      if (current.maTK) {
        db.run(`UPDATE TAIKHOAN SET trangThai = 'Bị khóa' WHERE maTK = :maTK`, { maTK: current.maTK });
        db.run('DELETE FROM PHIENDANGNHAP WHERE maTK = :maTK', { maTK: current.maTK });
      }
    });
    return {
      maKH: current.maKH,
      hoTen: current.hoTen,
      hanhDong: 'an',
      thongBao: 'Khách hàng đã phát sinh giao dịch nên được chuyển sang trạng thái "Đã xóa".',
    };
  }

  db.transaction(() => {
    db.run('DELETE FROM TAIKHOAN WHERE maKH = :maKH', { maKH: current.maKH });
    db.run('DELETE FROM KHACHHANG WHERE maKH = :maKH', { maKH: current.maKH });
  });
  return {
    maKH: current.maKH,
    hoTen: current.hoTen,
    hanhDong: 'xoa',
    thongBao: 'Đã xóa khách hàng.',
  };
}

/** Danh sách khách hàng đang hoạt động (dùng cho combobox, gửi khảo sát). */
function listKhachHangHoatDong() {
  return db.all(
    `SELECT maKH, hoTen, sdt, email, diemTichLuy FROM KHACHHANG
      WHERE trangThai = N'Hoạt động' ORDER BY hoTen ASC`
  );
}

/** Tìm khách hàng theo số điện thoại (tra cứu nhanh khi lập đơn). */
function timKhachHangTheoSdt(sdt) {
  return db.get(
    `SELECT maKH, hoTen, sdt, diemTichLuy, trangThai FROM KHACHHANG WHERE sdt = :sdt`,
    { sdt: String(sdt).trim() }
  );
}

module.exports = {
  listKhachHang,
  getKhachHang,
  createKhachHang,
  dangKyKhachHang,
  updateKhachHang,
  doiTrangThaiKhachHang,
  deleteKhachHang,
  listKhachHangHoatDong,
  timKhachHangTheoSdt,
  nhomTuoiCua,
  sqlNhomTuoi,
  decorate,
  GIOI_TINH,
  TRANG_THAI_KH,
  NHOM_TUOI_CHUA_RO,
};
