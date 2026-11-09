/**
 * NGHIỆP VỤ NHÓM 2 — Quản lý sản phẩm (CN2.1 → CN2.7).
 * Bảng: SANPHAM, LOAISANPHAM, CTKM, KHUYENMAI, CHITIETDONHANG, CTPNH.
 */
'use strict';

const db = require('../db');
const { NGUONG_SAP_HET, TRANG_THAI_SP, ROLES } = require('../config');
const { badRequest, notFound, conflict } = require('../core/errors');
const {
  requiredText,
  optionalText,
  requiredNumber,
  requiredInt,
  oneOf,
} = require('../core/validation');
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
const PROMO_NAME_SUBQUERY = `(
    SELECT km.tenKM
      FROM CTKM c
      JOIN KHUYENMAI km ON km.maKM = c.maKM
     WHERE c.maSP = sp.maSP
       AND km.trangThai = 'Đang diễn ra'
       AND date('now','localtime') BETWEEN km.ngayBatDau AND km.ngayKetThuc
     ORDER BY km.giaTriGiam DESC, km.maKM DESC
     LIMIT 1
  )`;

const SELECT_SQL = `
  SELECT sp.maSP, sp.maLoai, l.tenLoai, sp.tenSP, sp.moTa, sp.gia, sp.soLuong,
         sp.hinhAnh, sp.trangThai, ${PROMO_SUBQUERY} AS giamGia,
         ${PROMO_NAME_SUBQUERY} AS tenKhuyenMai
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

/** Cho phép lưu ảnh JPEG/PNG/WebP đã nén dạng data URL trong cột TEXT. */
function chuanHoaHinhAnh(value) {
  const hinhAnh = optionalText(value, 180_000);
  if (hinhAnh?.startsWith('data:') && !/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(hinhAnh)) {
    throw badRequest('Ảnh sản phẩm phải là tệp JPEG, PNG hoặc WebP hợp lệ.');
  }
  return hinhAnh;
}

/** Bổ sung các trường tính toán cho một sản phẩm. */
function decorate(row) {
  if (!row) return row;
  const giamGia = Number(row.giamGia ?? 0);
  const gia = Number(row.gia ?? 0);
  return {
    ...row,
    gia,
    giamGia,
    giaSauGiam: Math.max(0, gia - giamGia),
    coKhuyenMai: giamGia > 0,
    sapHetHang: Number(row.soLuong) > 0 && Number(row.soLuong) <= NGUONG_SAP_HET,
  };
}

/** CN2.4 — Tìm kiếm, lọc, sắp xếp, phân trang sản phẩm. */
async function listSanPham(query = {}, user = null) {
  const pagination = parsePagination(query);
  const filter = new FilterBuilder()
    .search(query.q, ['sp.tenSP', 'sp.moTa', 'l.tenLoai'])
    .equals('sp.maLoai', query.maLoai ? Number(query.maLoai) : null)
    .equals('l.tenLoai', query.tenLoai ? optionalText(query.tenLoai, 100) : null)
    .equals('sp.trangThai', query.trangThai ? optionalText(query.trangThai, 30) : null)
    .between(
      'sp.gia',
      query.giaFrom === '' ? null : query.giaFrom,
      query.giaTo === '' ? null : query.giaTo
    );

  if (String(query.chiKhuyenMai) === 'true') filter.raw(`${PROMO_SUBQUERY} > 0`);
  if (String(query.sapHet) === 'true') {
    filter.raw('sp.soLuong <= :nguongSapHet', { nguongSapHet: NGUONG_SAP_HET });
  }
  if (String(query.conHang) === 'true') filter.raw(`sp.soLuong > 0 AND sp.trangThai = N'Đang bán'`);
  if (user?.vaiTro === ROLES.CUSTOMER) {
    filter.raw(`sp.soLuong > 0 AND sp.trangThai = N'Đang bán'`);
  }

  const orderBy = buildOrderBy(query, SORT_MAP, 'tenSP');
  const { items, total } = await executePaged({
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
async function getSanPham(maSP, user = null) {
  const row = await db.get(`${SELECT_SQL} WHERE sp.maSP = :maSP`, { maSP });
  if (!row) throw notFound(`Không tìm thấy sản phẩm có mã ${maSP}.`);
  if (user?.vaiTro === ROLES.CUSTOMER && (row.trangThai !== 'Đang bán' || Number(row.soLuong) < 1)) {
    throw notFound('Sản phẩm này hiện không có sẵn để mua.');
  }

  const khuyenMai = await db.all(
    `SELECT km.maKM, km.tenKM, km.giaTriGiam, km.ngayBatDau, km.ngayKetThuc
       FROM CTKM c
       JOIN KHUYENMAI km ON km.maKM = c.maKM
      WHERE c.maSP = :maSP
        AND km.trangThai = 'Đang diễn ra'
        AND date('now','localtime') BETWEEN km.ngayBatDau AND km.ngayKetThuc`,
    { maSP }
  );

  const danhGia = await db.get(
    `SELECT COUNT(*) AS soPhanHoi, ROUND(AVG(danhGia), 2) AS diemTrungBinh
       FROM PHANHOI WHERE maSP = :maSP`,
    { maSP }
  );

  return { ...decorate(row), khuyenMai, danhGia: danhGia ?? { soPhanHoi: 0, diemTrungBinh: null } };
}

/** Kiểm tra loại sản phẩm tồn tại. */
async function assertLoaiTonTai(maLoai) {
  const loai = await db.get('SELECT maLoai FROM LOAISANPHAM WHERE maLoai = :maLoai', { maLoai });
  if (!loai) throw badRequest(`Loại sản phẩm có mã ${maLoai} không tồn tại.`);
}

/** CN2.1 — Thêm sản phẩm. */
async function createSanPham(payload) {
  const maLoai = requiredInt(payload.maLoai, 'Loại sản phẩm', 1);
  await assertLoaiTonTai(maLoai);
  const tenSP = requiredText(payload.tenSP, 'Tên sản phẩm', 150);
  const moTa = optionalText(payload.moTa, 255);
  const gia = requiredNumber(payload.gia, 'Giá bán', 0);
  const soLuong = requiredInt(payload.soLuong ?? 0, 'Số lượng tồn', 0);
  const trangThai = oneOf(payload.trangThai ?? TRANG_THAI_SP[0], TRANG_THAI_SP, 'Trạng thái');
  const hinhAnh = chuanHoaHinhAnh(payload.hinhAnh);

  const result = await db.run(
    `INSERT INTO SANPHAM (maLoai, tenSP, moTa, gia, soLuong, hinhAnh, trangThai)
     VALUES (:maLoai, :tenSP, :moTa, :gia, :soLuong, :hinhAnh, :trangThai)`,
    { maLoai, tenSP, moTa, gia, soLuong, hinhAnh, trangThai }
  );
  return getSanPham(result.lastInsertRowid);
}

/** CN2.2 — Sửa thông tin sản phẩm. */
async function updateSanPham(maSP, payload) {
  const current = await getSanPham(maSP);
  const maLoai = requiredInt(payload.maLoai ?? current.maLoai, 'Loại sản phẩm', 1);
  await assertLoaiTonTai(maLoai);
  const tenSP = requiredText(payload.tenSP ?? current.tenSP, 'Tên sản phẩm', 150);
  const moTa = optionalText(payload.moTa ?? current.moTa, 255);
  const gia = requiredNumber(payload.gia ?? current.gia, 'Giá bán', 0);
  const soLuong = requiredInt(payload.soLuong ?? current.soLuong, 'Số lượng tồn', 0);
  const trangThai = oneOf(payload.trangThai ?? current.trangThai, TRANG_THAI_SP, 'Trạng thái');
  const hinhAnh = chuanHoaHinhAnh(payload.hinhAnh ?? current.hinhAnh);

  await db.run(
    `UPDATE SANPHAM
        SET maLoai = :maLoai, tenSP = :tenSP, moTa = :moTa, gia = :gia,
            soLuong = :soLuong, hinhAnh = :hinhAnh, trangThai = :trangThai
      WHERE maSP = :maSP`,
    { maLoai, tenSP, moTa, gia, soLuong, hinhAnh, trangThai, maSP: current.maSP }
  );
  return getSanPham(current.maSP);
}

/** Đếm số lần sản phẩm đã xuất hiện trong đơn hàng / phiếu nhập / khuyến mãi. */
async function demRangBuocSanPham(maSP) {
  const trongDonHang = await db.scalar('SELECT COUNT(*) FROM CHITIETDONHANG WHERE maSP = :maSP', {
    maSP,
  });
  const trongPhieuNhap = await db.scalar('SELECT COUNT(*) FROM CTPNH WHERE maSP = :maSP', { maSP });
  const trongKhuyenMai = await db.scalar('SELECT COUNT(*) FROM CTKM WHERE maSP = :maSP', { maSP });
  return {
    trongDonHang: Number(trongDonHang),
    trongPhieuNhap: Number(trongPhieuNhap),
    trongKhuyenMai: Number(trongKhuyenMai),
  };
}

/**
 * CN2.3 — Xóa hoặc ngừng bán sản phẩm.
 * Nếu đã phát sinh giao dịch thì chỉ chuyển sang 'Ngừng bán' để giữ lịch sử.
 */
async function deleteSanPham(maSP) {
  const current = await getSanPham(maSP);
  const rangBuoc = await demRangBuocSanPham(current.maSP);
  const daPhatSinh =
    rangBuoc.trongDonHang > 0 || rangBuoc.trongPhieuNhap > 0 || rangBuoc.trongKhuyenMai > 0;

  if (daPhatSinh) {
    await db.run(`UPDATE SANPHAM SET trangThai = 'Ngừng bán' WHERE maSP = :maSP`, {
      maSP: current.maSP,
    });
    return {
      maSP: current.maSP,
      tenSP: current.tenSP,
      hanhDong: 'ngung-ban',
      thongBao: 'Sản phẩm đã phát sinh giao dịch nên được chuyển sang trạng thái "Ngừng bán".',
    };
  }
  await db.run('DELETE FROM SANPHAM WHERE maSP = :maSP', { maSP: current.maSP });
  return {
    maSP: current.maSP,
    tenSP: current.tenSP,
    hanhDong: 'xoa',
    thongBao: 'Đã xóa sản phẩm.',
  };
}

/**
 * CN2.6 — Cập nhật tồn kho (dùng nội bộ, luôn nằm trong transaction của
 * nghiệp vụ gốc). delta âm là trừ kho, dương là nhập kho.
 */
async function dieuChinhTonKho(maSP, delta) {
  const thayDoi = Number(delta);
  const capNhat = await db.run(
    `UPDATE SANPHAM
        SET soLuong = soLuong + :delta,
            trangThai = CASE WHEN soLuong + :delta = 0 AND trangThai = N'Đang bán' THEN N'Hết hàng'
                             WHEN soLuong + :delta > 0 AND trangThai = N'Hết hàng' THEN N'Đang bán'
                             ELSE trangThai END
      WHERE maSP = :maSP AND soLuong + :delta >= 0`,
    { delta: thayDoi, maSP }
  );
  if (capNhat.changes === 0) {
    const sanPham = await db.get('SELECT maSP, tenSP, soLuong FROM SANPHAM WHERE maSP = :maSP', {
      maSP,
    });
    if (!sanPham) throw notFound(`Không tìm thấy sản phẩm có mã ${maSP}.`);
    throw conflict(
      `Sản phẩm "${sanPham.tenSP}" chỉ còn ${sanPham.soLuong} trong kho, không đủ để xuất ${Math.abs(thayDoi)}.`
    );
  }
  return Number(await db.scalar('SELECT soLuong FROM SANPHAM WHERE maSP = :maSP', { maSP }));
}

/** CN2.7 — Danh sách sản phẩm sắp hết hoặc đã hết hàng. */
async function canhBaoTonKho() {
  const rows = await db.all(
    `${SELECT_SQL}
      WHERE sp.soLuong <= :nguong
      ORDER BY sp.soLuong ASC, sp.tenSP ASC`,
    { nguong: NGUONG_SAP_HET }
  );
  const items = rows.map((row) => ({
    ...decorate(row),
    mucDo: Number(row.soLuong) === 0 ? 'Hết hàng' : 'Sắp hết',
  }));
  return { nguong: NGUONG_SAP_HET, soLuongCanhBao: items.length, items };
}

/** Đồng bộ trạng thái 'Hết hàng' theo tồn kho thực tế. */
async function dongBoTrangThaiTonKho() {
  await db.run(
    `UPDATE SANPHAM SET trangThai = N'Hết hàng'
      WHERE soLuong = 0 AND trangThai = N'Đang bán'`
  );
}

module.exports = {
  listSanPham,
  getSanPham,
  createSanPham,
  updateSanPham,
  deleteSanPham,
  dieuChinhTonKho,
  canhBaoTonKho,
  dongBoTrangThaiTonKho,
  demRangBuocSanPham,
  decorate,
};
