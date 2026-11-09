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
  const noiDung = requiredText(payload.noiDung, 'Nội dung phản hồi', 1000);
  const danhGia = requiredInt(payload.danhGia, 'Đánh giá (số sao)', 1);
  if (danhGia > 5) throw badRequest('Đánh giá chỉ nhận giá trị từ 1 đến 5 sao.');
  const maSP = payload.maSP ? Number(payload.maSP) : null;
  if (maSP) {
    const sanPham = db.get('SELECT maSP FROM SANPHAM WHERE maSP = :maSP', { maSP });
    if (!sanPham) throw badRequest(`Sản phẩm có mã ${maSP} không tồn tại.`);
  }

  const result = db.run(
    `INSERT INTO PHANHOI (maKH, maNV, maSP, noiDung, danhGia, trangThai, ngayGui)
     VALUES (:maKH, NULL, :maSP, :noiDung, :danhGia, N'Chờ xử lý', :ngayGui)`,
    { maKH, maSP, noiDung, danhGia, ngayGui: nowSql() }
  );
  const phanHoi = getPhanHoi(result.lastInsertRowid);
  return { ...phanHoi, thongBao: 'Cảm ơn bạn đã gửi phản hồi. Chúng tôi sẽ sớm liên hệ lại.' };
}

/**
 * CN10.2 — Nhân viên tiếp nhận và xử lý phản hồi.
 * Gán nhân viên xử lý, ghi nội dung trả lời và đánh dấu đã xử lý.
 */
function xuLyPhanHoi(maPH, payload, user) {
  const current = getPhanHoi(maPH);
  const maNV = requiredInt(payload.maNV ?? user?.maNV, 'Nhân viên xử lý', 1);
  const nhanVien = db.get('SELECT maNV, hoTen FROM NHANVIEN WHERE maNV = :maNV', { maNV });
  if (!nhanVien) throw badRequest(`Nhân viên có mã ${maNV} không tồn tại.`);
  const phanHoiLai = requiredText(payload.phanHoiLai, 'Nội dung phản hồi lại', 1000);

  db.run(
    `UPDATE PHANHOI
        SET maNV = :maNV, phanHoiLai = :phanHoiLai, trangThai = N'Đã xử lý', ngayXuLy = :ngayXuLy
      WHERE maPH = :maPH`,
    { maNV, phanHoiLai, ngayXuLy: nowSql(), maPH: current.maPH }
  );
  return getPhanHoi(current.maPH);
}

/** CN10.4 — Thống kê mức độ hài lòng theo khoảng thời gian. */
function thongKeHaiLong(query = {}) {
  const filter = new FilterBuilder();
  if (query.tuNgay) filter.raw('date(ph.ngayGui) >= date(:tuNgay)', { tuNgay: query.tuNgay });
  if (query.denNgay) filter.raw('date(ph.ngayGui) <= date(:denNgay)', { denNgay: query.denNgay });
  const { sql: whereSql, params } = filter.toWhere();

  const tongQuan = db.get(
    `SELECT COUNT(*) AS tongPhanHoi,
            ROUND(AVG(ph.danhGia), 2) AS diemTrungBinh,
            SUM(CASE WHEN ph.trangThai = N'Chờ xử lý' THEN 1 ELSE 0 END) AS chuaXuLy,
            SUM(CASE WHEN ph.trangThai = N'Đã xử lý' THEN 1 ELSE 0 END) AS daXuLy
       FROM PHANHOI ph ${whereSql}`,
    params
  );

  const theoSoSao = db.all(
    `SELECT ph.danhGia, COUNT(*) AS soLuong
       FROM PHANHOI ph ${whereSql}
      GROUP BY ph.danhGia
      ORDER BY ph.danhGia DESC`,
    params
  );

  const tongPhanHoi = Number(tongQuan?.tongPhanHoi ?? 0);
  const phanBo = [5, 4, 3, 2, 1].map((sao) => {
    const found = theoSoSao.find((row) => Number(row.danhGia) === sao);
    const soLuong = Number(found?.soLuong ?? 0);
    return {
      danhGia: sao,
      soLuong,
      tyLe: tongPhanHoi > 0 ? Math.round((soLuong / tongPhanHoi) * 1000) / 10 : 0,
    };
  });

  const theoSanPham = db.all(
    `SELECT sp.maSP, sp.tenSP, COUNT(*) AS soPhanHoi, ROUND(AVG(ph.danhGia), 2) AS diemTrungBinh
       FROM PHANHOI ph
       JOIN SANPHAM sp ON sp.maSP = ph.maSP
       ${whereSql ? `${whereSql} AND` : 'WHERE'} ph.maSP IS NOT NULL
      GROUP BY sp.maSP, sp.tenSP
      ORDER BY diemTrungBinh DESC`,
    params
  );

  return {
    tongQuan: {
      tongPhanHoi,
      diemTrungBinh: Number(tongQuan?.diemTrungBinh ?? 0),
      chuaXuLy: Number(tongQuan?.chuaXuLy ?? 0),
      daXuLy: Number(tongQuan?.daXuLy ?? 0),
    },
    phanBo,
    theoSanPham,
  };
}

/** Đếm số phản hồi chưa xử lý (dùng cho huy hiệu thông báo trên giao diện). */
function demPhanHoiChuaXuLy() {
  return Number(
    db.scalar(`SELECT COUNT(*) FROM PHANHOI WHERE trangThai = N'Chờ xử lý'`)
  );
}

module.exports = {
  listPhanHoi,
  getPhanHoi,
  createPhanHoi,
  xuLyPhanHoi,
  thongKeHaiLong,
  demPhanHoiChuaXuLy,
};
