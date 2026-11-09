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
async function listNhaCungCap(query = {}) {
  const pagination = parsePagination(query);
  const filter = new FilterBuilder()
    .search(query.q, ['n.tenNCC', 'n.sdt', 'n.email', 'n.diaChi'])
    .equals('n.trangThai', query.trangThai ? optionalText(query.trangThai, 30) : null);
  const orderBy = buildOrderBy(query, SORT_MAP, 'tenNCC');
  const { items, total } = await executePaged({
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
async function getNhaCungCap(maNCC) {
  const row = await db.get(`${SELECT_SQL} WHERE n.maNCC = :maNCC`, { maNCC });
  if (!row) throw notFound(`Không tìm thấy nhà cung cấp có mã ${maNCC}.`);

  const lichSuCungCap = await db.all(
    `SELECT p.maPNH, p.ngayNhap, p.tongTien, p.trangThai, nv.hoTen AS tenNhanVien
       FROM PHIEUNGUONHANG p
       LEFT JOIN NHANVIEN nv ON nv.maNV = p.maNV
      WHERE p.maNCC = :maNCC
      ORDER BY p.ngayNhap DESC
      LIMIT 20`,
    { maNCC }
  );

  const sanPhamCungCap = await db.all(
    `SELECT sp.maSP, sp.tenSP, SUM(ct.soLuong) AS tongSoLuong, AVG(ct.donGia) AS donGiaTrungBinh
       FROM CTPNH ct
       JOIN PHIEUNGUONHANG p ON p.maPNH = ct.maPNH
       JOIN SANPHAM sp ON sp.maSP = ct.maSP
      WHERE p.maNCC = :maNCC AND p.trangThai = N'Hoàn thành'
      GROUP BY sp.maSP, sp.tenSP
      ORDER BY tongSoLuong DESC`,
    { maNCC }
  );

  return { ...row, lichSuCungCap, sanPhamCungCap };
}

/** Kiểm tra trùng nhà cung cấp theo tên hoặc số điện thoại. */
async function assertKhongTrung(tenNCC, sdt, excludeMaNCC = null) {
  const existed = await db.get(
    `SELECT maNCC, tenNCC FROM NHACUNGCAP
      WHERE (UNACCENT(tenNCC) = UNACCENT(:tenNCC) OR sdt = :sdt)
        AND maNCC <> :exclude`,
    { tenNCC, sdt, exclude: excludeMaNCC ?? -1 }
  );
  if (existed) throw conflict(`Nhà cung cấp "${existed.tenNCC}" đã tồn tại trong hệ thống.`);
}

/** CN3.1 — Thêm nhà cung cấp. */
async function createNhaCungCap(payload) {
  const tenNCC = requiredText(payload.tenNCC, 'Tên nhà cung cấp', 150);
  const sdt = payload.sdt ? phone(payload.sdt) : null;
  const diaChi = optionalText(payload.diaChi, 255);
  const emailValue = optionalEmail(payload.email);
  const trangThai = oneOf(payload.trangThai ?? TRANG_THAI_NCC[0], TRANG_THAI_NCC, 'Trạng thái');
  await assertKhongTrung(tenNCC, sdt);
  const result = await db.run(
    `INSERT INTO NHACUNGCAP (tenNCC, sdt, diaChi, email, trangThai)
     VALUES (:tenNCC, :sdt, :diaChi, :email, :trangThai)`,
    { tenNCC, sdt, diaChi, email: emailValue, trangThai }
  );
  return getNhaCungCap(result.lastInsertRowid);
}

/** CN3.2 — Sửa nhà cung cấp. */
async function updateNhaCungCap(maNCC, payload) {
  const current = await getNhaCungCap(maNCC);
  const tenNCC = requiredText(payload.tenNCC ?? current.tenNCC, 'Tên nhà cung cấp', 150);
  const sdt = payload.sdt === undefined ? current.sdt : payload.sdt ? phone(payload.sdt) : null;
  const diaChi = optionalText(payload.diaChi ?? current.diaChi, 255);
  const emailValue = payload.email === undefined ? current.email : optionalEmail(payload.email);
  const trangThai = oneOf(payload.trangThai ?? current.trangThai, TRANG_THAI_NCC, 'Trạng thái');
  await assertKhongTrung(tenNCC, sdt, current.maNCC);
  await db.run(
    `UPDATE NHACUNGCAP
        SET tenNCC = :tenNCC, sdt = :sdt, diaChi = :diaChi, email = :email, trangThai = :trangThai
      WHERE maNCC = :maNCC`,
    { tenNCC, sdt, diaChi, email: emailValue, trangThai, maNCC: current.maNCC }
  );
  return getNhaCungCap(current.maNCC);
}

/** CN3.3 — Xóa nhà cung cấp (từ chối nếu đã có phiếu nhập hàng). */
async function deleteNhaCungCap(maNCC) {
  const current = await getNhaCungCap(maNCC);
  if (current.soPhieuNhap > 0) {
    throw badRequest(
      `Không thể xóa: nhà cung cấp "${current.tenNCC}" đã có ${current.soPhieuNhap} phiếu nhập hàng. Hãy chuyển sang trạng thái "Ngừng hợp tác".`
    );
  }
  await db.run('DELETE FROM NHACUNGCAP WHERE maNCC = :maNCC', { maNCC: current.maNCC });
  return { maNCC: current.maNCC, tenNCC: current.tenNCC };
}

/** Danh sách nhà cung cấp đang hợp tác (dùng cho combobox phiếu nhập). */
async function listNhaCungCapDangHopTac() {
  return db.all(
    `SELECT maNCC, tenNCC, sdt, diaChi, email FROM NHACUNGCAP
      WHERE trangThai = N'Đang hợp tác' ORDER BY tenNCC ASC`
  );
}

module.exports = {
  listNhaCungCap,
  getNhaCungCap,
  createNhaCungCap,
  updateNhaCungCap,
  deleteNhaCungCap,
  listNhaCungCapDangHopTac,
  TRANG_THAI_NCC,
};
