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
