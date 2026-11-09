/**
 * NGHIỆP VỤ NHÓM 2 — Quản lý sản phẩm (CN2.1 → CN2.7).
 * Bảng: SANPHAM, LOAISANPHAM, CTKM, KHUYENMAI, CHITIETDONHANG, CTPNH.
 */
'use strict';

const db = require('../db');
const { NGUONG_SAP_HET, TRANG_THAI_SP } = require('../config');
const { badRequest, notFound, conflict } = require('../core/errors');
const { requiredText, optionalText, requiredNumber, requiredInt, oneOf } = require('../core/validation');
const { FilterBuilder, parsePagination, paginate, executePaged, buildOrderBy } = require('../core/query');

/** Biểu thức con: số tiền giảm giá còn hiệu lực của một sản phẩm. */
const PROMO_SUBQUERY = `COALESCE((
    SELECT MAX(km.giaTriGiam)
      FROM CTKM c
      JOIN KHUYENMAI km ON km.maKM = c.maKM
     WHERE c.maSP = sp.maSP
       AND km.trangThai = 'Đang diễn ra'
       AND date('now','localtime') BETWEEN km.ngayBatDau AND km.ngayKetThuc
  ), 0)`;

const SELECT_SQL = `
  SELECT sp.maSP, sp.maLoai, l.tenLoai, sp.tenSP, sp.moTa, sp.gia, sp.soLuong,
         sp.hinhAnh, sp.trangThai, ${PROMO_SUBQUERY} AS giamGia
    FROM SANPHAM sp
    JOIN LOAISANPHAM l ON l.maLoai = sp.maLoai`;
const COUNT_SQL = `
  SELECT COUNT(*) AS total
    FROM SANPHAM sp
    JOIN LOAISANPHAM l ON l.maLoai = sp.maLoai`;

const SORT_MAP = {
  maSP: 'sp.maSP',
  tenSP: 'sp.tenSP',
  gia: 'sp.gia',
  soLuong: 'sp.soLuong',
  tenLoai: 'l.tenLoai',
  trangThai: 'sp.trangThai',
};

/** Bổ sung các trường tính toán cho một sản phẩm. */
function decorate(row) {
  if (!row) return row;
  const giamGia = Number(row.giamGia ?? 0);
  const gia = Number(row.gia ?? 0);
  return {
    ...row,
    gia: gia,
    giamGia,
    giaSauGiam: Math.max(0, gia - giamGia),
    coKhuyenMai: giamGia > 0,
    sapHetHang: Number(row.soLuong) > 0 && Number(row.soLuong) <= NGUONG_SAP_HET,
  };
}

/** CN2.4 — Tìm kiếm, lọc, sắp xếp, phân trang sản phẩm. */
function listSanPham(query = {}) {
  const pagination = parsePagination(query);
  const filter = new FilterBuilder()
    .search(query.q, ['sp.tenSP', 'sp.moTa', 'l.tenLoai'])
    .equals('sp.maLoai', query.maLoai ? Number(query.maLoai) : null)
    .equals('l.tenLoai', query.tenLoai ? optionalText(query.tenLoai, 100) : null)
    .equals('sp.trangThai', query.trangThai ? optionalText(query.trangThai, 30) : null)
    .between('sp.gia', query.giaFrom === '' ? null : query.giaFrom, query.giaTo === '' ? null : query.giaTo);

  if (String(query.chiKhuyenMai) === 'true') filter.raw(`${PROMO_SUBQUERY} > 0`);
  if (String(query.sapHet) === 'true') {
    filter.raw(`sp.soLuong <= :nguongSapHet`, { nguongSapHet: NGUONG_SAP_HET });
  }
  if (String(query.conHang) === 'true') filter.raw(`sp.soLuong > 0 AND sp.trangThai = N'Đang bán'`);

  const orderBy = buildOrderBy(query, SORT_MAP, 'tenSP');
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

/** CN2.5 — Xem chi tiết sản phẩm kèm khuyến mãi đang áp dụng. */
function getSanPham(maSP) {
  const row = db.get(`${SELECT_SQL} WHERE sp.maSP = :maSP`, { maSP });
  if (!row) throw notFound(`Không tìm thấy sản phẩm có mã ${maSP}.`);

  const khuyenMai = db.all(
    `SELECT km.maKM, km.tenKM, km.giaTriGiam, km.ngayBatDau, km.ngayKetThuc
       FROM CTKM c
       JOIN KHUYENMAI km ON km.maKM = c.maKM
      WHERE c.maSP = :maSP
        AND km.trangThai = 'Đang diễn ra'
        AND date('now','localtime') BETWEEN km.ngayBatDau AND km.ngayKetThuc`,
    { maSP }
  );

  const danhGia = db.get(
    `SELECT COUNT(*) AS soPhanHoi, ROUND(AVG(danhGia), 2) AS diemTrungBinh
       FROM PHANHOI WHERE maSP = :maSP`,
    { maSP }
  );

  return { ...decorate(row), khuyenMai, danhGia: danhGia ?? { soPhanHoi: 0, diemTrungBinh: null } };
}

/** Kiểm tra loại sản phẩm tồn tại. */
function assertLoaiTonTai(maLoai) {
  const loai = db.get('SELECT maLoai FROM LOAISANPHAM WHERE maLoai = :maLoai', { maLoai });
  if (!loai) throw badRequest(`Loại sản phẩm có mã ${maLoai} không tồn tại.`);
}

/** CN2.1 — Thêm sản phẩm. */
function createSanPham(payload) {
  const maLoai = requiredInt(payload.maLoai, 'Loại sản phẩm', 1);
  assertLoaiTonTai(maLoai);
  const tenSP = requiredText(payload.tenSP, 'Tên sản phẩm', 150);
  const moTa = optionalText(payload.moTa, 255);
  const gia = requiredNumber(payload.gia, 'Giá bán', 0);
  const soLuong = requiredInt(payload.soLuong ?? 0, 'Số lượng tồn', 0);
  const trangThai = oneOf(payload.trangThai ?? TRANG_THAI_SP[0], TRANG_THAI_SP, 'Trạng thái');
  const hinhAnh = optionalText(payload.hinhAnh, 255);

  const result = db.run(
    `INSERT INTO SANPHAM (maLoai, tenSP, moTa, gia, soLuong, hinhAnh, trangThai)
     VALUES (:maLoai, :tenSP, :moTa, :gia, :soLuong, :hinhAnh, :trangThai)`,
    { maLoai, tenSP, moTa, gia, soLuong, hinhAnh, trangThai }
  );
  return getSanPham(result.lastInsertRowid);
}

/** CN2.2 — Sửa thông tin sản phẩm. */
function updateSanPham(maSP, payload) {
  const current = getSanPham(maSP);
  const maLoai = requiredInt(payload.maLoai ?? current.maLoai, 'Loại sản phẩm', 1);
  assertLoaiTonTai(maLoai);
  const tenSP = requiredText(payload.tenSP ?? current.tenSP, 'Tên sản phẩm', 150);
  const moTa = optionalText(payload.moTa ?? current.moTa, 255);
  const gia = requiredNumber(payload.gia ?? current.gia, 'Giá bán', 0);
  const soLuong = requiredInt(payload.soLuong ?? current.soLuong, 'Số lượng tồn', 0);
  const trangThai = oneOf(payload.trangThai ?? current.trangThai, TRANG_THAI_SP, 'Trạng thái');
  const hinhAnh = optionalText(payload.hinhAnh ?? current.hinhAnh, 255);

  db.run(
    `UPDATE SANPHAM
        SET maLoai = :maLoai, tenSP = :tenSP, moTa = :moTa, gia = :gia,
            soLuong = :soLuong, hinhAnh = :hinhAnh, trangThai = :trangThai
      WHERE maSP = :maSP`,
    { maLoai, tenSP, moTa, gia, soLuong, hinhAnh, trangThai, maSP: current.maSP }
  );
  return getSanPham(current.maSP);
}

/** Đếm số lần sản phẩm đã xuất hiện trong đơn hàng / phiếu nhập / khuyến mãi. */
function demRangBuocSanPham(maSP) {
  return {
    trongDonHang: Number(
      db.scalar('SELECT COUNT(*) FROM CHITIETDONHANG WHERE maSP = :maSP', { maSP })
    ),
    trongPhieuNhap: Number(
      db.scalar('SELECT COUNT(*) FROM CTPNH WHERE maSP = :maSP', { maSP })
    ),
    trongKhuyenMai: Number(db.scalar('SELECT COUNT(*) FROM CTKM WHERE maSP = :maSP', { maSP })),
  };
}

/**
