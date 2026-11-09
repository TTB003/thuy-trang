/**
 * NGHIỆP VỤ NHÓM 6 — Quản lý nhập hàng (CN6.1 → CN6.5).
 * Mọi thao tác thay đổi nhiều bảng đều nằm trong một transaction.
 * Bảng: PHIEUNGUONHANG, CTPNH, SANPHAM, NHACUNGCAP, NHANVIEN.
 */
'use strict';

const db = require('../db');
const productService = require('./product.service');
const { TRANG_THAI_PNH } = require('../config');
const { badRequest, notFound, conflict } = require('../core/errors');
const { requiredInt, requiredNumber, optionalText, oneOf, asArray } = require('../core/validation');
const { nowSql } = require('../core/time');
const { FilterBuilder, parsePagination, paginate, executePaged } = require('../core/query');

const SELECT_SQL = `
  SELECT p.maPNH, p.maNCC, n.tenNCC, p.maNV, nv.hoTen AS tenNhanVien,
         p.ngayNhap, p.tongTien, p.trangThai, p.lyDoHuy,
         (SELECT COUNT(*) FROM CTPNH ct WHERE ct.maPNH = p.maPNH) AS soMatHang,
         (SELECT COALESCE(SUM(ct.soLuong), 0) FROM CTPNH ct WHERE ct.maPNH = p.maPNH) AS tongSoLuong
    FROM PHIEUNGUONHANG p
    JOIN NHACUNGCAP n ON n.maNCC = p.maNCC
    LEFT JOIN NHANVIEN nv ON nv.maNV = p.maNV`;
const COUNT_SQL = `
  SELECT COUNT(*) AS total
    FROM PHIEUNGUONHANG p
    JOIN NHACUNGCAP n ON n.maNCC = p.maNCC`;

/** CN6.4 — Tra cứu / xem danh sách phiếu nhập. */
function listPhieuNhap(query = {}) {
  const pagination = parsePagination(query);
  const filter = new FilterBuilder()
    .search(query.q, ['n.tenNCC', 'p.maPNH'])
    .equals('p.maNCC', query.maNCC ? Number(query.maNCC) : null)
    .equals('p.maNV', query.maNV ? Number(query.maNV) : null)
    .equals('p.trangThai', query.trangThai ? optionalText(query.trangThai, 30) : null);
  if (query.tuNgay) filter.raw('date(p.ngayNhap) >= date(:tuNgay)', { tuNgay: query.tuNgay });
  if (query.denNgay) filter.raw('date(p.ngayNhap) <= date(:denNgay)', { denNgay: query.denNgay });

  const { items, total } = executePaged({
    selectSql: SELECT_SQL,
    countSql: COUNT_SQL,
    filter,
    orderBy: 'ORDER BY p.ngayNhap DESC, p.maPNH DESC',
    pagination,
    runAll: db.all,
    runGet: db.get,
  });
  return paginate(items, total, pagination);
}

/** CN6.4/CN6.5 — Chi tiết phiếu nhập (dữ liệu đủ để in). */
function getPhieuNhap(maPNH) {
  const header = db.get(`${SELECT_SQL} WHERE p.maPNH = :maPNH`, { maPNH });
  if (!header) throw notFound(`Không tìm thấy phiếu nhập có mã ${maPNH}.`);
  const chiTiet = db.all(
    `SELECT ct.maSP, sp.tenSP, l.tenLoai, ct.soLuong, ct.donGia, ct.thanhTien
       FROM CTPNH ct
       JOIN SANPHAM sp ON sp.maSP = ct.maSP
       JOIN LOAISANPHAM l ON l.maLoai = sp.maLoai
      WHERE ct.maPNH = :maPNH
      ORDER BY sp.tenSP ASC`,
    { maPNH }
  );
  return { ...header, chiTiet };
}

/** Kiểm tra và chuẩn hóa danh sách mặt hàng của phiếu nhập. */
function chuanHoaChiTiet(chiTietRaw) {
  const danhSach = asArray(chiTietRaw);
  if (danhSach.length === 0) throw badRequest('Phiếu nhập phải có ít nhất một mặt hàng.');

  /** @type {Map<number, {maSP:number, soLuong:number, donGia:number}>} */
  const gom = new Map();
  danhSach.forEach((dong, index) => {
    const maSP = requiredInt(dong.maSP, `Mã sản phẩm dòng ${index + 1}`, 1);
    const soLuong = requiredInt(dong.soLuong, `Số lượng dòng ${index + 1}`, 1);
    const donGia = requiredNumber(dong.donGia, `Đơn giá dòng ${index + 1}`, 0);
    const sanPham = db.get('SELECT maSP, tenSP FROM SANPHAM WHERE maSP = :maSP', { maSP });
    if (!sanPham) throw badRequest(`Sản phẩm có mã ${maSP} không tồn tại.`);

    if (gom.has(maSP)) {
      const cu = gom.get(maSP);
      cu.soLuong += soLuong;
      cu.donGia = donGia;
    } else {
      gom.set(maSP, { maSP, soLuong, donGia });
    }
  });
  return [...gom.values()];
}

/** Ghi các dòng chi tiết và tính tổng tiền. */
function ghiChiTiet(maPNH, danhSach) {
  let tongTien = 0;
  danhSach.forEach((dong) => {
    const thanhTien = dong.soLuong * dong.donGia;
    tongTien += thanhTien;
    db.run(
      `INSERT INTO CTPNH (maPNH, maSP, soLuong, donGia, thanhTien)
       VALUES (:maPNH, :maSP, :soLuong, :donGia, :thanhTien)`,
      { maPNH, maSP: dong.maSP, soLuong: dong.soLuong, donGia: dong.donGia, thanhTien }
    );
  });
  return tongTien;
}

/**
 * CN6.1 — Lập phiếu nhập hàng.
 * @param {object} payload
 * @param {{maNV:number}} nguoiLap nhân viên đang đăng nhập
 */
function createPhieuNhap(payload, nguoiLap) {
  const maNCC = requiredInt(payload.maNCC, 'Nhà cung cấp', 1);
  const nhaCungCap = db.get('SELECT maNCC, trangThai FROM NHACUNGCAP WHERE maNCC = :maNCC', { maNCC });
  if (!nhaCungCap) throw badRequest(`Nhà cung cấp có mã ${maNCC} không tồn tại.`);
  if (nhaCungCap.trangThai !== 'Đang hợp tác') {
    throw conflict('Nhà cung cấp này đã ngừng hợp tác, không thể lập phiếu nhập.');
  }
  const maNV = requiredInt(payload.maNV ?? nguoiLap?.maNV, 'Nhân viên lập phiếu', 1);
  const nhanVien = db.get('SELECT maNV FROM NHANVIEN WHERE maNV = :maNV', { maNV });
  if (!nhanVien) throw badRequest(`Nhân viên có mã ${maNV} không tồn tại.`);

  const trangThai = oneOf(payload.trangThai ?? TRANG_THAI_PNH[1], ['Chờ duyệt', 'Hoàn thành'], 'Trạng thái phiếu');
  const danhSach = chuanHoaChiTiet(payload.chiTiet);

  return db.transaction(() => {
    const result = db.run(
      `INSERT INTO PHIEUNGUONHANG (maNCC, maNV, ngayNhap, tongTien, trangThai)
       VALUES (:maNCC, :maNV, :ngayNhap, 0, :trangThai)`,
      { maNCC, maNV, ngayNhap: nowSql(), trangThai }
    );
    const maPNH = result.lastInsertRowid;
    const tongTien = ghiChiTiet(maPNH, danhSach);
    db.run('UPDATE PHIEUNGUONHANG SET tongTien = :tongTien WHERE maPNH = :maPNH', {
      tongTien,
      maPNH,
    });
    if (trangThai === 'Hoàn thành') {
      danhSach.forEach((dong) => productService.dieuChinhTonKho(dong.maSP, dong.soLuong));
    }
    return getPhieuNhap(maPNH);
  });
}

/**
 * CN6.2 — Sửa phiếu nhập hàng.
 * Hoàn tác số lượng cũ rồi áp dụng số lượng mới để tồn kho luôn đúng.
 */
function updatePhieuNhap(maPNH, payload) {
  const current = getPhieuNhap(maPNH);
  if (current.trangThai === 'Đã hủy') {
    throw badRequest('Phiếu nhập đã hủy thì không thể sửa.');
  }
  const danhSach = chuanHoaChiTiet(payload.chiTiet ?? current.chiTiet);

  return db.transaction(() => {
    if (current.trangThai === 'Hoàn thành') {
      current.chiTiet.forEach((dong) => productService.dieuChinhTonKho(dong.maSP, -dong.soLuong));
    }
    db.run('DELETE FROM CTPNH WHERE maPNH = :maPNH', { maPNH });
    const tongTien = ghiChiTiet(maPNH, danhSach);
    db.run('UPDATE PHIEUNGUONHANG SET tongTien = :tongTien WHERE maPNH = :maPNH', {
      tongTien,
      maPNH,
    });
    if (current.trangThai === 'Hoàn thành') {
      danhSach.forEach((dong) => productService.dieuChinhTonKho(dong.maSP, dong.soLuong));
    }
    return getPhieuNhap(maPNH);
  });
}

/** Duyệt phiếu nhập đang ở trạng thái 'Chờ duyệt' → cộng tồn kho. */
function duyetPhieuNhap(maPNH) {
  const current = getPhieuNhap(maPNH);
  if (current.trangThai !== 'Chờ duyệt') {
    throw badRequest(`Chỉ có thể duyệt phiếu đang ở trạng thái "Chờ duyệt" (hiện tại: ${current.trangThai}).`);
  }
  return db.transaction(() => {
    current.chiTiet.forEach((dong) => productService.dieuChinhTonKho(dong.maSP, dong.soLuong));
    db.run(`UPDATE PHIEUNGUONHANG SET trangThai = N'Hoàn thành' WHERE maPNH = :maPNH`, { maPNH });
    return getPhieuNhap(maPNH);
  });
}

/**
 * CN6.3 — Hủy phiếu nhập hàng.
 * Nếu phiếu đã nhập kho thì phải trừ lại tồn kho tương ứng.
 */
function huyPhieuNhap(maPNH, lyDo) {
  const current = getPhieuNhap(maPNH);
  if (current.trangThai === 'Đã hủy') throw badRequest('Phiếu nhập này đã được hủy trước đó.');
  const lyDoHuy = optionalText(lyDo, 255) ?? 'Không nêu lý do';

  return db.transaction(() => {
    if (current.trangThai === 'Hoàn thành') {
      current.chiTiet.forEach((dong) => productService.dieuChinhTonKho(dong.maSP, -dong.soLuong));
    }
    db.run(
      `UPDATE PHIEUNGUONHANG SET trangThai = N'Đã hủy', lyDoHuy = :lyDoHuy WHERE maPNH = :maPNH`,
      { lyDoHuy, maPNH }
    );
    return getPhieuNhap(maPNH);
  });
}

module.exports = {
  listPhieuNhap,
  getPhieuNhap,
  createPhieuNhap,
  updatePhieuNhap,
  duyetPhieuNhap,
  huyPhieuNhap,
};
