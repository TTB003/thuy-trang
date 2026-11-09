/**
 * NGHIỆP VỤ NHÓM 10 — Quản lý phản hồi khách hàng (CN10.1 → CN10.4).
 * Bảng: PHANHOI, KHACHHANG, NHANVIEN, SANPHAM.
 */
'use strict';

const db = require('../db');
const { ROLES } = require('../config');
const { badRequest, notFound, conflict } = require('../core/errors');
const { requiredText, optionalText, requiredInt, optionalInt } = require('../core/validation');
const { nowSql } = require('../core/time');
const { FilterBuilder, parsePagination, paginate, executePaged } = require('../core/query');

const SELECT_SQL = `
  SELECT ph.maPH, ph.maKH, kh.hoTen AS tenKhachHang, kh.sdt AS sdtKhachHang,
         ph.maNV, nv.hoTen AS tenNhanVien, ph.maSP, sp.tenSP,
         ph.noiDung, ph.danhGia, ph.phanHoiLai, ph.trangThai, ph.ngayGui, ph.ngayXuLy
    FROM PHANHOI ph
    JOIN KHACHHANG kh ON kh.maKH = ph.maKH
    LEFT JOIN NHANVIEN nv ON nv.maNV = ph.maNV
    LEFT JOIN SANPHAM sp ON sp.maSP = ph.maSP`;
const COUNT_SQL = `
  SELECT COUNT(*) AS total
    FROM PHANHOI ph
    JOIN KHACHHANG kh ON kh.maKH = ph.maKH`;

/**
 * CN10.3 — Xem / lọc danh sách phản hồi.
 * Khách hàng chỉ thấy phản hồi của chính mình.
 */
function listPhanHoi(query = {}, user = null) {
  const pagination = parsePagination(query);
  const filter = new FilterBuilder()
    .search(query.q, ['kh.hoTen', 'kh.sdt', 'ph.noiDung', 'ph.phanHoiLai'])
    .equals('ph.trangThai', query.trangThai ? optionalText(query.trangThai, 30) : null)
    .equals('ph.danhGia', query.danhGia ? Number(query.danhGia) : null)
    .equals('ph.maKH', query.maKH ? Number(query.maKH) : null)
    .equals('ph.maNV', query.maNV ? Number(query.maNV) : null);

  if (user?.vaiTro === ROLES.CUSTOMER) filter.equals('ph.maKH', user.maKH);
  if (query.tuNgay) filter.raw('date(ph.ngayGui) >= date(:tuNgay)', { tuNgay: query.tuNgay });
  if (query.denNgay) filter.raw('date(ph.ngayGui) <= date(:denNgay)', { denNgay: query.denNgay });

  const { items, total } = executePaged({
    selectSql: SELECT_SQL,
    countSql: COUNT_SQL,
    filter,
    orderBy: 'ORDER BY ph.ngayGui DESC, ph.maPH DESC',
    pagination,
    runAll: db.all,
    runGet: db.get,
  });
  return paginate(items, total, pagination);
}

/** Lấy chi tiết một phản hồi. */
function getPhanHoi(maPH, user = null) {
  const row = db.get(`${SELECT_SQL} WHERE ph.maPH = :maPH`, { maPH });
  if (!row) throw notFound(`Không tìm thấy phản hồi có mã ${maPH}.`);
  if (user?.vaiTro === ROLES.CUSTOMER && Number(row.maKH) !== Number(user.maKH)) {
    throw notFound(`Không tìm thấy phản hồi có mã ${maPH}.`);
  }
  return row;
}

/** CN10.1 — Khách hàng gửi phản hồi / đánh giá. */
function createPhanHoi(payload, user = null) {
  const laKhachHang = user?.vaiTro === ROLES.CUSTOMER;
  const maKH = laKhachHang ? Number(user.maKH) : requiredInt(payload.maKH, 'Khách hàng', 1);
  const khachHang = db.get('SELECT maKH, hoTen, trangThai FROM KHACHHANG WHERE maKH = :maKH', { maKH });
  if (!khachHang) throw badRequest(`Khách hàng có mã ${maKH} không tồn tại.`);
  if (khachHang.trangThai !== 'Hoạt động') {
    throw conflict(`Khách hàng đang ở trạng thái "${khachHang.trangThai}", không thể gửi phản hồi.`);
  }
