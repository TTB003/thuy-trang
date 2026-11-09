/**
 * PHIẾU GIẢM GIÁ CỦA KHÁCH HÀNG — bảng PHIEUGIAMGIA.
 *
 * Phiếu sinh nhật: giảm 50% cho 1 ly, hiệu lực 3 ngày kể từ ngày sinh nhật.
 * Cấu hình chương trình (phần trăm giảm, số ngày hiệu lực, số lần dùng) nằm
 * trong bảng UUDAI với mã chương trình SINHNHAT — xem `layCauHinhSinhNhat()`.
 * Phiếu được tạo tự động bởi dịch vụ ƯU ĐÃI SINH NHẬT (uu-dai-sinh-nhat.service.js).
 */
'use strict';

const db = require('../db');
const { notFound } = require('../core/errors');
const { FilterBuilder, parsePagination, paginate, executePaged, buildOrderBy } = require('../core/query');
const { nowSql, daysFromToday, todaySql } = require('../core/time');

/** Mã chương trình ưu đãi sinh nhật trong bảng UUDAI. */
const MA_UU_DAI_SINH_NHAT = 'SINHNHAT';
/** Phần trăm giảm mặc định nếu bảng UUDAI chưa có cấu hình. */
const PHAN_TRAM_SINH_NHAT = 50;
/** Số ngày hiệu lực mặc định kể từ ngày sinh nhật. */
const SO_NGAY_HIEU_LUC = 3;
/** Loại phiếu dành cho sinh nhật. */
const LOAI_SINH_NHAT = 'Sinh nhật';
/** Trạng thái phiếu giảm giá. */
const TRANG_THAI_PHIEU = ['Chưa dùng', 'Đã dùng', 'Hết hạn'];
const CHUA_DUNG = 'Chưa dùng';
const HET_HAN = 'Hết hạn';

const SELECT_SQL = `
  SELECT pg.maPG, pg.maKH, pg.maCode, pg.maUD, pg.tieuDe, pg.moTa, pg.phanTramGiam,
         pg.giamToiDa, pg.soLanSuDungToiDa, pg.soLanDaSuDung, pg.loai,
         pg.trangThai, pg.ngayTao, pg.ngayHetHan,
         kh.hoTen, kh.sdt
    FROM PHIEUGIAMGIA pg
    JOIN KHACHHANG kh ON kh.maKH = pg.maKH`;
const COUNT_SQL = 'SELECT COUNT(*) AS total FROM PHIEUGIAMGIA pg';

const SORT_MAP = {
  maPG: 'pg.maPG',
  ngayTao: 'pg.ngayTao',
  ngayHetHan: 'pg.ngayHetHan',
  phanTramGiam: 'pg.phanTramGiam',
};

/** Mã phiếu sinh nhật duy nhất cho mỗi khách hàng trong một năm. */
function maPhieuSinhNhat(maKH, nam) {
  return `SN${nam}-KH${maKH}`;
}

/**
 * Đọc cấu hình chương trình ưu đãi sinh nhật từ bảng UUDAI.
 * Nếu cơ sở dữ liệu chưa có cấu hình thì dùng giá trị mặc định trong mã nguồn.
 */
async function layCauHinhSinhNhat() {
  const mau = await db.get(
    `SELECT maUD, maCode, tenUD, phanTramGiam, soNgayHieuLuc, soLanDungToiDa, loai, trangThai
       FROM UUDAI WHERE maCode = :maCode`,
    { maCode: MA_UU_DAI_SINH_NHAT }
  );
  return {
    maUD: mau?.maUD ?? null,
    maCode: mau?.maCode ?? MA_UU_DAI_SINH_NHAT,
    tenUD: mau?.tenUD ?? 'Ưu đãi sinh nhật',
    phanTramGiam: Number(mau?.phanTramGiam ?? PHAN_TRAM_SINH_NHAT),
    soNgayHieuLuc: Number(mau?.soNgayHieuLuc ?? SO_NGAY_HIEU_LUC),
    soLanDungToiDa: Number(mau?.soLanDungToiDa ?? 1),
    loai: mau?.loai ?? LOAI_SINH_NHAT,
    trangThai: mau?.trangThai ?? 'Đang áp dụng',
    coTrongCsdl: Boolean(mau),
  };
}

/** Kiểm tra chương trình ưu đãi sinh nhật có đang được bật không. */
async function uuDaiSinhNhatDangApDung() {
  const cauHinh = await layCauHinhSinhNhat();
  return cauHinh.trangThai === 'Đang áp dụng';
}

/**
 * Ngày cuối cùng còn dùng được của phiếu sinh nhật.
 * Ngày nhận phiếu tính là ngày thứ 1, nên hạn cuối là ngày nhận + (số ngày − 1).
 */
function ngayCuoiHieuLuc(soNgayHieuLuc = SO_NGAY_HIEU_LUC) {
  const soNgay = Math.max(1, Number(soNgayHieuLuc) || SO_NGAY_HIEU_LUC);
  return daysFromToday(soNgay - 1);
}

/** Đánh dấu các phiếu đã quá hạn sử dụng. */
async function dongBoHetHan() {
  const ketQua = await db.run(
    `UPDATE PHIEUGIAMGIA
        SET trangThai = N'${HET_HAN}'
      WHERE trangThai = N'${CHUA_DUNG}'
        AND ngayHetHan IS NOT NULL
        AND ngayHetHan < :now`,
    { now: nowSql() }
  );
  return Number(ketQua?.changes ?? 0);
}

/** Danh sách phiếu giảm giá của một khách hàng (có phân trang). */
async function listPhieuGiamGia(maKH, query = {}) {
  await dongBoHetHan();
  const pagination = parsePagination(query);
  const filter = new FilterBuilder()
    .equals('pg.maKH', maKH)
    .equals('pg.trangThai', query.trangThai ?? null)
    .equals('pg.loai', query.loai ?? null);
  const orderBy = buildOrderBy(query, SORT_MAP, 'ngayTao');
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

/** Số phiếu còn dùng được của một khách hàng. */
async function demPhieuKhaDung(maKH) {
  await dongBoHetHan();
  const tong = await db.scalar(
    `SELECT COUNT(*) FROM PHIEUGIAMGIA
      WHERE maKH = :maKH AND trangThai = N'${CHUA_DUNG}'`,
    { maKH }
  );
  return Number(tong ?? 0);
}

/** Lấy chi tiết một phiếu (kiểm tra thuộc về đúng khách hàng). */
async function getPhieuGiamGia(maPG, maKH) {
  const row = await db.get(`${SELECT_SQL} WHERE pg.maPG = :maPG AND pg.maKH = :maKH`, {
    maPG,
    maKH,
  });
  if (!row) throw notFound(`Không tìm thấy phiếu giảm giá có mã ${maPG}.`);
  return row;
}

/** Kiểm tra khách đã nhận phiếu sinh nhật của năm nay chưa. */
async function daCoPhieuSinhNhatNamNay(maKH, nam) {
  const row = await db.get(
    `SELECT maPG FROM PHIEUGIAMGIA
      WHERE maKH = :maKH AND loai = N'${LOAI_SINH_NHAT}' AND maCode = :maCode`,
    { maKH, maCode: maPhieuSinhNhat(maKH, nam) }
  );
  return row ?? null;
}

/**
 * Tạo phiếu giảm giá sinh nhật 50% cho 1 ly.
 * @returns {object|null} phiếu vừa tạo, hoặc null nếu năm nay đã tạo rồi.
 */
async function taoPhieuSinhNhat(maKH, nam = new Date().getFullYear()) {
  const daCo = await daCoPhieuSinhNhatNamNay(maKH, nam);
  if (daCo) return null;

  const maCode = maPhieuSinhNhat(maKH, nam);
  const ketQua = await db.run(
    `INSERT INTO PHIEUGIAMGIA
       (maKH, maCode, tieuDe, moTa, phanTramGiam, giamToiDa,
        soLanSuDungToiDa, soLanDaSuDung, loai, trangThai, ngayTao, ngayHetHan)
     VALUES
       (:maKH, :maCode, :tieuDe, :moTa, :phanTramGiam, NULL,
        1, 0, N'${LOAI_SINH_NHAT}', N'${CHUA_DUNG}', :ngayTao, :ngayHetHan)`,
    {
      maKH,
      maCode,
      tieuDe: `Sinh nhật vui vẻ — giảm ${PHAN_TRAM_SINH_NHAT}% cho 1 ly`,
      moTa: `Phiếu dành riêng cho bạn trong tháng sinh nhật. Hiệu lực ${SO_NGAY_HIEU_LUC} ngày, dùng đến hết ${ngayCuoiHieuLuc()}.`,
      phanTramGiam: PHAN_TRAM_SINH_NHAT,
      ngayTao: nowSql(),
      ngayHetHan: `${ngayCuoiHieuLuc()} 23:59:59`,
    }
  );
  return getPhieuGiamGia(Number(ketQua.lastInsertRowid), maKH);
}

/** Thống kê nhanh phiếu giảm giá của một khách hàng. */
async function thongKePhieuCuaKhach(maKH) {
  await dongBoHetHan();
  const row = await db.get(
    `SELECT COUNT(*) AS tongSo,
            SUM(CASE WHEN trangThai = N'${CHUA_DUNG}' THEN 1 ELSE 0 END) AS chuaDung,
            SUM(CASE WHEN trangThai = N'Đã dùng' THEN 1 ELSE 0 END) AS daDung,
            SUM(CASE WHEN trangThai = N'${HET_HAN}' THEN 1 ELSE 0 END) AS hetHan
       FROM PHIEUGIAMGIA WHERE maKH = :maKH`,
    { maKH }
  );
  return {
    tongSo: Number(row?.tongSo ?? 0),
    chuaDung: Number(row?.chuaDung ?? 0),
    daDung: Number(row?.daDung ?? 0),
    hetHan: Number(row?.hetHan ?? 0),
  };
}

module.exports = {
  PHAN_TRAM_SINH_NHAT,
  SO_NGAY_HIEU_LUC,
  LOAI_SINH_NHAT,
  TRANG_THAI_PHIEU,
  CHUA_DUNG,
  maPhieuSinhNhat,
  dongBoHetHan,
  listPhieuGiamGia,
  demPhieuKhaDung,
  getPhieuGiamGia,
  daCoPhieuSinhNhatNamNay,
  taoPhieuSinhNhat,
  thongKePhieuCuaKhach,
};
