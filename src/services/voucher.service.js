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
const crypto = require('crypto');
const { notFound, badRequest } = require('../core/errors');
const { requiredText, requiredInt, requiredNumber, optionalText, dateOnly, oneOf } = require('../core/validation');
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
const TRANG_THAI_PHIEU = ['Chưa dùng', 'Đã dùng', 'Hết hạn', 'Hết lượt'];
const CHUA_DUNG = 'Chưa dùng';
const HET_HAN = 'Hết hạn';

const SELECT_SQL = `
  SELECT pg.maPG, pg.maKH, pg.maCode, pg.maUD, pg.tieuDe, pg.moTa, pg.phanTramGiam,
         pg.giamToiDa, pg.soLanSuDungToiDa, pg.soLanDaSuDung, pg.loai,
         CASE WHEN ct.trangThai = N'Hết lượt' AND pg.trangThai = N'Chưa dùng'
              THEN N'Hết lượt' ELSE pg.trangThai END AS trangThai,
         pg.ngayTao, pg.ngayHetHan, kh.hoTen, kh.sdt,
         ct.maCTPG, ct.maCode AS maCodeChuongTrinh, ct.doiTuong,
         ct.soLuongToiDa, ct.soLuongDaDung, ct.trangThai AS trangThaiChuongTrinh
    FROM PHIEUGIAMGIA pg
    JOIN KHACHHANG kh ON kh.maKH = pg.maKH
    LEFT JOIN CHUONGTRINHPHIEU ct ON ct.maCTPG = pg.maCTPG`;
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
  await db.run(
    `UPDATE CHUONGTRINHPHIEU SET trangThai = N'Hết hạn'
      WHERE trangThai = N'Đang áp dụng' AND ngayHetHan IS NOT NULL AND ngayHetHan < :now`,
    { now: nowSql() }
  );
  const chuongTrinhHetLuot = await db.all(
    `SELECT * FROM CHUONGTRINHPHIEU
      WHERE trangThai IN (N'Đang áp dụng', N'Hết lượt') AND soLuongToiDa IS NOT NULL
        AND soLuongDaDung >= soLuongToiDa AND daThongBaoHetLuot = FALSE`
  );
  for (const ct of chuongTrinhHetLuot) {
    await db.run("UPDATE CHUONGTRINHPHIEU SET trangThai = N'Hết lượt', daThongBaoHetLuot = TRUE WHERE maCTPG = :maCTPG", { maCTPG: ct.maCTPG });
    await db.run("UPDATE PHIEUGIAMGIA SET trangThai = N'Hết lượt' WHERE maCTPG = :maCTPG AND trangThai = N'Chưa dùng'", { maCTPG: ct.maCTPG });
    const khachNhanPhieu = await db.all('SELECT maKH, maPG FROM PHIEUGIAMGIA WHERE maCTPG = :maCTPG', { maCTPG: ct.maCTPG });
    const thongbaoService = require('./thongbao.service');
    for (const kh of khachNhanPhieu) {
      try {
        await thongbaoService.taoThongBao({
          maKH: kh.maKH, maPG: kh.maPG, loai: 'Ưu đãi',
          tieuDe: `Phiếu giảm giá "${ct.tieuDe}" đã hết lượt`.slice(0, 150),
          noiDung: 'Chương trình đã sử dụng hết số lượt phát hành. Phiếu này không còn áp dụng được.',
        });
      } catch (error) {
        console.error(`[voucher] Không gửi được thông báo hết lượt cho khách #${kh.maKH}:`, error.message);
      }
    }
  }
  return Number(ketQua?.changes ?? 0) + chuongTrinhHetLuot.length;
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

/** Danh sách phiếu toàn hệ thống dành cho nhân sự được cấp quyền quản lý. */
async function listTatCaPhieu(query = {}) {
  await dongBoHetHan();
  const pagination = parsePagination(query);
  const filter = new FilterBuilder()
    .search(query.q, ['ct.tieuDe', 'ct.maCode', 'ct.doiTuong', 'ct.tenKhach'])
    .equals('ct.trangThai', query.trangThai ?? null);
  const orderBy = buildOrderBy(query, { maCTPG: 'ct.maCTPG', ngayTao: 'ct.ngayTao', tieuDe: 'ct.tieuDe' }, 'ngayTao');
  const { items, total } = await executePaged({
    selectSql: `SELECT ct.* FROM (
      SELECT p.maCTPG, p.maCode, p.tieuDe, p.doiTuong, p.phanTramGiam, p.giamToiDa,
             p.soLuongToiDa, p.soLuongDaDung, p.trangThai, p.ngayTao, p.ngayHetHan,
             (SELECT COUNT(*) FROM PHIEUGIAMGIA pg WHERE pg.maCTPG = p.maCTPG) AS soKhachNhan,
             NULL AS tenKhach, 'Chương trình' AS loaiPhieu
        FROM CHUONGTRINHPHIEU p
      UNION ALL
      SELECT pg.maPG AS maCTPG, pg.maCode, pg.tieuDe, 'Cá nhân' AS doiTuong, pg.phanTramGiam,
             pg.giamToiDa, pg.soLanSuDungToiDa AS soLuongToiDa, pg.soLanDaSuDung AS soLuongDaDung,
             pg.trangThai, pg.ngayTao, pg.ngayHetHan, 1 AS soKhachNhan, kh.hoTen AS tenKhach,
             pg.loai AS loaiPhieu
        FROM PHIEUGIAMGIA pg JOIN KHACHHANG kh ON kh.maKH = pg.maKH
       WHERE pg.maCTPG IS NULL
    ) ct`,
    countSql: `SELECT COUNT(*) AS total FROM (
      SELECT p.maCTPG, p.tieuDe, p.maCode, p.doiTuong, p.trangThai, NULL AS tenKhach FROM CHUONGTRINHPHIEU p
      UNION ALL SELECT pg.maPG AS maCTPG, pg.tieuDe, pg.maCode, 'Cá nhân' AS doiTuong, pg.trangThai, kh.hoTen AS tenKhach
        FROM PHIEUGIAMGIA pg JOIN KHACHHANG kh ON kh.maKH = pg.maKH WHERE pg.maCTPG IS NULL
    ) ct`,
    filter, orderBy, pagination,
    runAll: db.all, runGet: db.get,
  });
  return paginate(items, total, pagination);
}

/** Tạo phiếu riêng cho một khách hàng và trả về phiếu vừa tạo. */
async function taoPhieuGiamGia(payload = {}) {
  const doiTuong = oneOf(payload.doiTuong, ['Tất cả', 'Nam', 'Nữ', 'Khách mới'], 'Đối tượng khách hàng');
  const tieuDe = requiredText(payload.tieuDe, 'Tên phiếu giảm giá', 150);
  const moTa = optionalText(payload.moTa, 500);
  const phanTramGiam = requiredInt(payload.phanTramGiam, 'Phần trăm giảm', 1);
  if (phanTramGiam > 100) throw badRequest('Phần trăm giảm không được vượt quá 100%.');
  const giamToiDa = payload.giamToiDa === '' || payload.giamToiDa == null
    ? null : requiredNumber(payload.giamToiDa, 'Mức giảm tối đa', 1);
  const soLuongToiDa = payload.soLuongToiDa === '' || payload.soLuongToiDa == null
    ? null : requiredInt(payload.soLuongToiDa, 'Tổng lượt sử dụng', 1);
  const loai = requiredText(payload.loai || 'CSKH', 'Loại phiếu', 40);
  const ngayHetHan = dateOnly(payload.ngayHetHan, 'Ngày hết hạn', { allowNull: true });
  const now = todaySql();
  if (ngayHetHan && ngayHetHan < now) throw badRequest('Ngày hết hạn phải từ hôm nay trở đi.');
  const maCode = `CT${Date.now().toString(36).toUpperCase()}${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
  const tuNgay = daysFromToday(-30);
  const customers = await db.all(
    `SELECT maKH, hoTen FROM KHACHHANG WHERE trangThai = N'Hoạt động'
       AND (:doiTuong = N'Tất cả'
         OR (:doiTuong = N'Nam' AND gioiTinh = N'Nam')
         OR (:doiTuong = N'Nữ' AND gioiTinh = N'Nữ')
         OR (:doiTuong = N'Khách mới' AND ngayDangKy >= :tuNgay))
       ORDER BY maKH`,
    { doiTuong, tuNgay }
  );
  if (!customers.length) throw badRequest('Không có khách hàng đang hoạt động phù hợp với đối tượng đã chọn.');
  const created = await db.transaction(async () => {
    const campaign = await db.run(
      `INSERT INTO CHUONGTRINHPHIEU
         (maCode, tieuDe, doiTuong, phanTramGiam, giamToiDa, soLuongToiDa, soLuongDaDung, trangThai, ngayTao, ngayHetHan)
       VALUES (:maCode, :tieuDe, :doiTuong, :phanTramGiam, :giamToiDa, :soLuongToiDa, 0, N'Đang áp dụng', :ngayTao, :ngayHetHan)`,
      { maCode, tieuDe, doiTuong, phanTramGiam, giamToiDa, soLuongToiDa, ngayTao: nowSql(), ngayHetHan: ngayHetHan ? `${ngayHetHan} 23:59:59` : null }
    );
    const maCTPG = Number(campaign.lastInsertRowid);
    const phieuList = [];
    for (const kh of customers) {
      const result = await db.run(
        `INSERT INTO PHIEUGIAMGIA
           (maKH, maCode, maCTPG, tieuDe, moTa, phanTramGiam, giamToiDa,
            soLanSuDungToiDa, soLanDaSuDung, loai, trangThai, ngayTao, ngayHetHan)
         VALUES (:maKH, :maCodeCaNhan, :maCTPG, :tieuDe, :moTa, :phanTramGiam, :giamToiDa,
            1, 0, :loai, N'${CHUA_DUNG}', :ngayTao, :ngayHetHan)`,
        { maKH: kh.maKH, maCodeCaNhan: `${maCode}-${kh.maKH}`, maCTPG, tieuDe, moTa, phanTramGiam, giamToiDa, loai,
          ngayTao: nowSql(), ngayHetHan: ngayHetHan ? `${ngayHetHan} 23:59:59` : null }
      );
      phieuList.push({ maKH: kh.maKH, maPG: Number(result.lastInsertRowid), hoTen: kh.hoTen });
    }
    return { maCTPG, maCode, tieuDe, doiTuong, phanTramGiam, soLuongToiDa, soKhachNhan: phieuList.length, phieuList };
  });
  return created;
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
            SUM(CASE WHEN trangThai = N'${HET_HAN}' THEN 1 ELSE 0 END) AS hetHan,
            SUM(CASE WHEN trangThai = N'Hết lượt' THEN 1 ELSE 0 END) AS hetLuot
       FROM PHIEUGIAMGIA WHERE maKH = :maKH`,
    { maKH }
  );
  return {
    tongSo: Number(row?.tongSo ?? 0),
    chuaDung: Number(row?.chuaDung ?? 0),
    daDung: Number(row?.daDung ?? 0),
    hetHan: Number(row?.hetHan ?? 0),
    hetLuot: Number(row?.hetLuot ?? 0),
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
  listTatCaPhieu,
  taoPhieuGiamGia,
  demPhieuKhaDung,
  getPhieuGiamGia,
  daCoPhieuSinhNhatNamNay,
  taoPhieuSinhNhat,
  thongKePhieuCuaKhach,
};
