/**
 * NGHIỆP VỤ NHÓM 8 — Tích lũy điểm khách hàng (CN8.1 → CN8.4).
 * Quy tắc quy đổi: 10.000đ chi tiêu = 1 điểm; 1 điểm = 1.000đ khi sử dụng.
 * Bảng: LICHSUDIEM, KHACHHANG, DONHANG.
 */
'use strict';

const db = require('../db');
const { VND_PER_POINT, VND_PER_POINT_REDEEM } = require('../config');
const { badRequest, notFound, conflict } = require('../core/errors');
const { nowSql } = require('../core/time');
const { FilterBuilder, parsePagination, paginate, executePaged } = require('../core/query');

/** Số điểm được cộng từ một hoá đơn (làm tròn xuống). */
function tinhDiemTuHoaDon(tongTien) {
  return Math.floor(Number(tongTien) / VND_PER_POINT);
}

/** Số tiền được giảm khi dùng điểm. */
function tinhTienGiamTuDiem(soDiem) {
  return Number(soDiem) * VND_PER_POINT_REDEEM;
}

/** Lấy số điểm hiện có của khách hàng. */
async function layDiemHienTai(maKH) {
  const row = await db.get(
    'SELECT maKH, diemTichLuy, trangThai FROM KHACHHANG WHERE maKH = :maKH',
    { maKH }
  );
  if (!row) throw notFound(`Không tìm thấy khách hàng có mã ${maKH}.`);
  return row;
}

/** Ghi một giao dịch điểm và cập nhật điểm tích lũy. */
async function ghiGiaoDichDiem({ maKH, maDH, soDiem, loaiGD, ghiChu }) {
  const khachHang = await layDiemHienTai(maKH);
  const diem = Math.abs(Number(soDiem));
  const laTang = loaiGD === 'Cộng' || loaiGD === 'Hoàn';
  const diemMoi = laTang
    ? Number(khachHang.diemTichLuy) + diem
    : Math.max(0, Number(khachHang.diemTichLuy) - diem);

  await db.run(
    `INSERT INTO LICHSUDIEM (maKH, maDH, soDiem, loaiGD, ghiChu, ngayGD)
     VALUES (:maKH, :maDH, :soDiem, :loaiGD, :ghiChu, :ngayGD)`,
    { maKH, maDH: maDH ?? null, soDiem: diem, loaiGD, ghiChu: ghiChu ?? null, ngayGD: nowSql() }
  );
  await db.run('UPDATE KHACHHANG SET diemTichLuy = :diemMoi WHERE maKH = :maKH', {
    diemMoi,
    maKH,
  });
  return {
    soDiem: diem,
    loaiGD,
    diemTruoc: Number(khachHang.diemTichLuy),
    diemSau: diemMoi,
  };
}

/**
 * CN8.1 — Cộng điểm tích lũy khi đơn hàng 'Hoàn thành'.
 * Mỗi đơn chỉ được cộng điểm một lần.
 */
async function congDiemChoDonHang(maDH) {
  const donHang = await db.get(
    `SELECT maDH, maKH, tongTien, trangThai FROM DONHANG WHERE maDH = :maDH`,
    { maDH }
  );
  if (!donHang) throw notFound(`Không tìm thấy đơn hàng ${maDH}.`);

  const daCong = await db.get(
    `SELECT maLS FROM LICHSUDIEM WHERE maDH = :maDH AND loaiGD = N'Cộng'`,
    { maDH }
  );
  if (daCong) {
    return { daCongTruoc: true, soDiem: 0, thongBao: 'Đơn hàng này đã được cộng điểm.' };
  }

  const soDiem = tinhDiemTuHoaDon(donHang.tongTien);
  if (soDiem <= 0) {
    return { daCongTruoc: false, soDiem: 0, thongBao: 'Hoá đơn chưa đủ mức để cộng điểm.' };
  }
  const ketQua = await ghiGiaoDichDiem({
    maKH: donHang.maKH,
    maDH: donHang.maDH,
    soDiem,
    loaiGD: 'Cộng',
    ghiChu: `Cộng điểm từ đơn hàng #${donHang.maDH}`,
  });
  return { daCongTruoc: false, ...ketQua, thongBao: `Đã cộng ${soDiem} điểm cho khách hàng.` };
}

/**
 * CN8.2 — Sử dụng (trừ) điểm cho một đơn hàng.
 * Trả về số điểm đã dùng và số tiền được giảm.
 */
async function suDungDiem(maKH, maDH, soDiemYeuCau) {
  const soDiem = Number(soDiemYeuCau);
  if (!Number.isInteger(soDiem) || soDiem <= 0) {
    throw badRequest('Số điểm sử dụng phải là số nguyên dương.');
  }
  const khachHang = await layDiemHienTai(maKH);
  if (khachHang.trangThai !== 'Hoạt động') {
    throw badRequest('Khách hàng đang bị khóa, không thể sử dụng điểm.');
  }
  if (soDiem > Number(khachHang.diemTichLuy)) {
    throw conflict(
      `Khách hàng chỉ có ${khachHang.diemTichLuy} điểm, không đủ để dùng ${soDiem} điểm.`
    );
  }
  await ghiGiaoDichDiem({
    maKH,
    maDH,
    soDiem,
    loaiGD: 'Trừ',
    ghiChu: `Sử dụng điểm cho đơn hàng #${maDH}`,
  });
  return { soDiem, tienGiam: tinhTienGiamTuDiem(soDiem) };
}

/**
 * CN8.3 — Hoàn / thu hồi điểm khi hủy đơn hàng.
 * - Điểm đã dùng cho đơn  → hoàn lại cho khách.
 * - Điểm đã cộng từ đơn   → thu hồi lại.
 */
async function hoanDiemKhiHuyDon(maDH) {
  const giaoDich = await db.all(
    `SELECT maLS, maKH, soDiem, loaiGD FROM LICHSUDIEM WHERE maDH = :maDH`,
    { maDH }
  );
  if (giaoDich.length === 0) {
    return { soGiaoDich: 0, thongBao: 'Đơn hàng chưa phát sinh giao dịch điểm.' };
  }

  let soHoan = 0;
  let soThuHoi = 0;
  for (const gd of giaoDich) {
    if (gd.loaiGD === 'Trừ') {
      await ghiGiaoDichDiem({
        maKH: gd.maKH,
        maDH,
        soDiem: gd.soDiem,
        loaiGD: 'Hoàn',
        ghiChu: `Hoàn điểm do hủy đơn hàng #${maDH}`,
      });
      soHoan += Number(gd.soDiem);
    } else if (gd.loaiGD === 'Cộng') {
      await ghiGiaoDichDiem({
        maKH: gd.maKH,
        maDH,
        soDiem: gd.soDiem,
        loaiGD: 'Thu hồi',
        ghiChu: `Thu hồi điểm do hủy đơn hàng #${maDH}`,
      });
      soThuHoi += Number(gd.soDiem);
    }
  }
  return {
    soGiaoDich: giaoDich.length,
    soDiemHoan: soHoan,
    soDiemThuHoi: soThuHoi,
    thongBao: `Đã hoàn ${soHoan} điểm và thu hồi ${soThuHoi} điểm.`,
  };
}

/** CN8.4 — Xem lịch sử điểm của khách hàng. */
async function xemLichSuDiem(maKH, query = {}) {
  const khachHang = await layDiemHienTai(maKH);
  const pagination = parsePagination(query);
  const filter = new FilterBuilder().equals('l.maKH', Number(maKH));
  if (query.loaiGD) filter.equals('l.loaiGD', query.loaiGD);
  if (query.tuNgay) filter.raw('date(l.ngayGD) >= date(:tuNgay)', { tuNgay: query.tuNgay });
  if (query.denNgay) filter.raw('date(l.ngayGD) <= date(:denNgay)', { denNgay: query.denNgay });

  const { items, total } = await executePaged({
    selectSql: `SELECT l.maLS, l.maKH, l.maDH, l.soDiem, l.loaiGD, l.ghiChu, l.ngayGD,
                       CASE WHEN l.loaiGD IN (N'Cộng', N'Hoàn') THEN l.soDiem ELSE -l.soDiem END AS bienDong
                  FROM LICHSUDIEM l`,
    countSql: 'SELECT COUNT(*) AS total FROM LICHSUDIEM l',
    filter,
    orderBy: 'ORDER BY l.ngayGD DESC, l.maLS DESC',
    pagination,
    runAll: db.all,
    runGet: db.get,
  });

  return {
    maKH: khachHang.maKH,
    diemTichLuy: Number(khachHang.diemTichLuy),
    quyDoi: { vndPerPoint: VND_PER_POINT, vndPerPointRedeem: VND_PER_POINT_REDEEM },
    ...paginate(items, total, pagination),
  };
}

/** CN8.4 (giao diện quản lý) — Lịch sử điểm toàn hệ thống. */
async function xemLichSuDiemToanHeThong(query = {}) {
  const pagination = parsePagination(query);
  const filter = new FilterBuilder().search(query.q, ['kh.hoTen', 'kh.sdt']);
  if (query.loaiGD) filter.equals('l.loaiGD', query.loaiGD);

  const { items, total } = await executePaged({
    selectSql: `SELECT l.maLS, l.maKH, kh.hoTen, kh.sdt, l.maDH, l.soDiem, l.loaiGD, l.ghiChu, l.ngayGD,
                       CASE WHEN l.loaiGD IN (N'Cộng', N'Hoàn') THEN l.soDiem ELSE -l.soDiem END AS bienDong
                  FROM LICHSUDIEM l
                  JOIN KHACHHANG kh ON kh.maKH = l.maKH`,
    countSql: `SELECT COUNT(*) AS total FROM LICHSUDIEM l JOIN KHACHHANG kh ON kh.maKH = l.maKH`,
    filter,
    orderBy: 'ORDER BY l.ngayGD DESC, l.maLS DESC',
    pagination,
    runAll: db.all,
    runGet: db.get,
  });
  return paginate(items, total, pagination);
}

/** Thống kê điểm: tổng điểm đã cộng / đã dùng trong khoảng thời gian. */
async function thongKeDiem(query = {}) {
  const filter = new FilterBuilder();
  if (query.tuNgay) filter.raw('date(l.ngayGD) >= date(:tuNgay)', { tuNgay: query.tuNgay });
  if (query.denNgay) filter.raw('date(l.ngayGD) <= date(:denNgay)', { denNgay: query.denNgay });
  const { sql: whereSql, params } = filter.toWhere();
  const rows = await db.all(
    `SELECT l.loaiGD, COUNT(*) AS soGiaoDich, SUM(l.soDiem) AS tongDiem
       FROM LICHSUDIEM l ${whereSql}
      GROUP BY l.loaiGD
      ORDER BY l.loaiGD ASC`,
    params
  );
  const tongDiemDaCap = await db.scalar('SELECT COALESCE(SUM(diemTichLuy), 0) FROM KHACHHANG');
  return { theoLoai: rows, tongDiemHienCo: Number(tongDiemDaCap) };
}

module.exports = {
  tinhDiemTuHoaDon,
  tinhTienGiamTuDiem,
  layDiemHienTai,
  ghiGiaoDichDiem,
  congDiemChoDonHang,
  suDungDiem,
  hoanDiemKhiHuyDon,
  xemLichSuDiem,
  xemLichSuDiemToanHeThong,
  thongKeDiem,
};
