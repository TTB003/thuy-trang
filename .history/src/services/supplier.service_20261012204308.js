/**
 * NGHIỆP VỤ NHÓM 3 — Quản lý nhà cung cấp (CN3.1 → CN3.4).
 * Bảng: NHACUNGCAP, PHIEUNGUONHANG.
 */
'use strict';

const db = require('../db');
const { badRequest, notFound, conflict } = require('../core/errors');
const { requiredText, optionalText, optionalEmail, phone, oneOf } = require('../core/validation');
const { FilterBuilder, parsePagination, paginate, executePaged, buildOrderBy } = require('../core/query');

const TRANG_THAI_NCC = ['Đang hợp tác', 'Ngừng hợp tác'];

const SELECT_SQL = `
  SELECT n.maNCC, n.tenNCC, n.sdt, n.diaChi, n.email, n.trangThai,
         (SELECT COUNT(*) FROM PHIEUNGUONHANG p WHERE p.maNCC = n.maNCC) AS soPhieuNhap,
         COALESCE((SELECT SUM(p.tongTien) FROM PHIEUNGUONHANG p
                    WHERE p.maNCC = n.maNCC AND p.trangThai = N'Hoàn thành'), 0) AS tongChiPhi
    FROM NHACUNGCAP n`;
const COUNT_SQL = 'SELECT COUNT(*) AS total FROM NHACUNGCAP n';

const SORT_MAP = {
  maNCC: 'n.maNCC',
  tenNCC: 'n.tenNCC',
  soPhieuNhap: 'soPhieuNhap',
  tongChiPhi: 'tongChiPhi',
};

/** CN3.4 — Tìm kiếm / xem nhà cung cấp (lọc theo trạng thái, sắp xếp). */
function listNhaCungCap(query = {}) {
  const pagination = parsePagination(query);
  const filter = new FilterBuilder()
    .search(query.q, ['n.tenNCC', 'n.sdt', 'n.email', 'n.diaChi'])
    .equals('n.trangThai', query.trangThai ? optionalText(query.trangThai, 30) : null);
  const orderBy = buildOrderBy(query, SORT_MAP, 'tenNCC');
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

/** Lấy nhà cung cấp kèm lịch sử cung cấp. */
function getNhaCungCap(maNCC) {
  const row = db.get(`${SELECT_SQL} WHERE n.maNCC = :maNCC`, { maNCC });
  if (!row) throw notFound(`Không tìm thấy nhà cung cấp có mã ${maNCC}.`);
  const lichSuCungCap = db.all(
    `SELECT p.maPNH, p.ngayNhap, p.tongTien, p.trangThai, nv.hoTen AS tenNhanVien
       FROM PHIEUNGUONHANG p
       LEFT JOIN NHANVIEN nv ON nv.maNV = p.maNV
      WHERE p.maNCC = :maNCC
      ORDER BY p.ngayNhap DESC
      LIMIT 20`,
