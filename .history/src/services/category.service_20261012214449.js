/**
 * NGHIỆP VỤ NHÓM 1 — Quản lý loại sản phẩm (CN1.1 → CN1.4).
 * Bảng: LOAISANPHAM.
 */
'use strict';

const db = require('../db');
const { badRequest, notFound, conflict } = require('../core/errors');
const { requiredText, optionalText } = require('../core/validation');
const { FilterBuilder, parsePagination, paginate, executePaged } = require('../core/query');

const SELECT_SQL = `
  SELECT l.maLoai, l.tenLoai, l.moTa,
         (SELECT COUNT(*) FROM SANPHAM sp WHERE sp.maLoai = l.maLoai) AS soSanPham
    FROM LOAISANPHAM l`;
const COUNT_SQL = 'SELECT COUNT(*) AS total FROM LOAISANPHAM l';

/** CN1.4 — Xem / tìm kiếm loại sản phẩm. */
async function listLoaiSanPham(query = {}) {
  const pagination = parsePagination(query);
  const filter = new FilterBuilder().search(query.q, ['l.tenLoai', 'l.moTa']);
  const { items, total } = await executePaged({
    selectSql: SELECT_SQL,
    countSql: COUNT_SQL,
    filter,
    orderBy: 'ORDER BY l.tenLoai ASC',
    pagination,
    runAll: db.all,
    runGet: db.get,
  });
  return paginate(items, total, pagination);
}

/** Lấy một loại sản phẩm theo mã. */
async function getLoaiSanPham(maLoai) {
  const row = await db.get(`${SELECT_SQL} WHERE l.maLoai = :maLoai`, { maLoai });
  if (!row) throw notFound(`Không tìm thấy loại sản phẩm có mã ${maLoai}.`);
  return row;
}

/** Kiểm tra tên loại không trùng (bỏ qua chính bản ghi đang sửa). */
async function assertTenLoaiKhongTrung(tenLoai, excludeMaLoai = null) {
  const existed = await db.get(
    `SELECT maLoai FROM LOAISANPHAM
      WHERE UNACCENT(tenLoai) = UNACCENT(:tenLoai) AND maLoai <> :exclude`,
    { tenLoai, exclude: excludeMaLoai ?? -1 }
  );
  if (existed) throw conflict(`Loại sản phẩm "${tenLoai}" đã tồn tại.`);
}

/** CN1.1 — Thêm loại sản phẩm. */
async function createLoaiSanPham(payload) {
  const tenLoai = requiredText(payload.tenLoai, 'Tên loại sản phẩm', 100);
  const moTa = optionalText(payload.moTa, 255);
  await assertTenLoaiKhongTrung(tenLoai);
  const result = await db.run('INSERT INTO LOAISANPHAM (tenLoai, moTa) VALUES (:tenLoai, :moTa)', {
    tenLoai,
    moTa,
  });
  return getLoaiSanPham(result.lastInsertRowid);
}

/** CN1.2 — Sửa loại sản phẩm. */
async function updateLoaiSanPham(maLoai, payload) {
  const current = await getLoaiSanPham(maLoai);
  const tenLoai = requiredText(payload.tenLoai ?? current.tenLoai, 'Tên loại sản phẩm', 100);
  const moTa = optionalText(payload.moTa ?? current.moTa, 255);
  await assertTenLoaiKhongTrung(tenLoai, current.maLoai);
  await db.run('UPDATE LOAISANPHAM SET tenLoai = :tenLoai, moTa = :moTa WHERE maLoai = :maLoai', {
    tenLoai,
    moTa,
    maLoai: current.maLoai,
  });
  return getLoaiSanPham(current.maLoai);
}

/**
 * CN1.3 — Xóa loại sản phẩm.
 * Từ chối nếu vẫn còn sản phẩm thuộc loại này (ràng buộc khóa ngoại).
 */
async function deleteLoaiSanPham(maLoai) {
  const current = await getLoaiSanPham(maLoai);
  const soSanPham = await db.scalar('SELECT COUNT(*) FROM SANPHAM WHERE maLoai = :maLoai', {
    maLoai: current.maLoai,
  });
  if (Number(soSanPham) > 0) {
    throw badRequest(`Không thể xóa: còn ${soSanPham} sản phẩm thuộc loại "${current.tenLoai}".`);
  }
  await db.run('DELETE FROM LOAISANPHAM WHERE maLoai = :maLoai', { maLoai: current.maLoai });
  return { maLoai: current.maLoai, tenLoai: current.tenLoai };
}

module.exports = {
  listLoaiSanPham,
  getLoaiSanPham,
  createLoaiSanPham,
  updateLoaiSanPham,
  deleteLoaiSanPham,
};
