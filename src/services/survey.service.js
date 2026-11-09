/**
 * NGHIỆP VỤ NHÓM 11 — Quản lý khảo sát (CN11.1 → CN11.6).
 * Bao gồm "tạo bảng khảo sát và gửi đến tài khoản khách hàng" (mục 4.1).
 * Bảng: KHAOSAT, CAUHOIKHAOSAT, PHIEUTRALOI, CHITIETTRALOI, GUIKHAOSAT.
 */
'use strict';

const crypto = require('crypto');
const db = require('../db');
const loyaltyService = require('./loyalty.service');
const thongBaoService = require('./thongbao.service');
const { ROLES, LOAI_KHAO_SAT, LOAI_CAU_HOI, TRANG_THAI_KS } = require('../config');
const { badRequest, notFound, conflict } = require('../core/errors');
const {
  requiredText,
  optionalText,
  requiredInt,
  requiredNumber,
  dateOnly,
  oneOf,
  asArray,
} = require('../core/validation');
const { nowSql, todaySql, daysFromToday } = require('../core/time');
const { FilterBuilder, parsePagination, paginate, executePaged } = require('../core/query');

/** Số điểm thưởng cho khách hàng sau khi hoàn thành một khảo sát. */
const DIEM_THUONG_KHAO_SAT = 5;
const LOAI_PHAN_THUONG_KHAO_SAT = ['Điểm', 'Phiếu giảm giá'];
const DOI_TUONG_KHAO_SAT = ['Tất cả khách hàng', 'Nam', 'Nữ'];

const SELECT_SQL = `
  SELECT k.maKS, k.maNV, nv.hoTen AS tenNhanVien, k.tieuDe, k.moTa, k.loaiKS, k.doiTuong,
         k.ngayTao, k.hanChot, k.trangThai, k.loaiPhanThuong, k.giaTriPhanThuong, k.giamToiDa, k.soLuongToiDa, k.daGui,
         k.kieuHetHanPhieu, k.soNgayHieuLucPhieu, k.ngayHetHanPhieu,
         (SELECT COUNT(*) FROM CAUHOIKHAOSAT ch WHERE ch.maKS = k.maKS) AS soCauHoi,
         (SELECT COUNT(*) FROM PHIEUTRALOI pt WHERE pt.maKS = k.maKS) AS soPhieuTraLoi
    FROM KHAOSAT k
    LEFT JOIN NHANVIEN nv ON nv.maNV = k.maNV`;
const COUNT_SQL = 'SELECT COUNT(*) AS total FROM KHAOSAT k';

async function thongBaoKetThucKhaoSat(maKS, lyDo) {
  const survey = await db.get('SELECT maKS, tieuDe FROM KHAOSAT WHERE maKS = :maKS', { maKS });
  if (!survey) return;
  const title = `${lyDo}: ${survey.tieuDe}`.slice(0, 150);
  const recipients = await db.all(
    `SELECT g.maKH FROM GUIKHAOSAT g
      WHERE g.maKS = :maKS
        AND NOT EXISTS (SELECT 1 FROM PHIEUTRALOI p WHERE p.maKS = g.maKS AND p.maKH = g.maKH)`,
    { maKS }
  );
  for (const { maKH } of recipients) {
    const exists = await db.get('SELECT maTB FROM THONGBAO WHERE maKH = :maKH AND maKS = :maKS AND tieuDe = :tieuDe', { maKH, maKS, tieuDe: title });
    if (!exists) await thongBaoService.taoThongBao({ maKH, maKS, loai: 'Khảo sát', tieuDe: title, noiDung: lyDo === 'Khảo sát đã hết lượt' ? 'Khảo sát đã nhận đủ số câu trả lời và hiện đã đóng.' : 'Khảo sát đã hết hạn và hiện đã đóng.' });
  }
}

async function thongBaoKhaoSatMoi(maKS, maKH) {
  const survey = await db.get('SELECT tieuDe, moTa FROM KHAOSAT WHERE maKS = :maKS', { maKS });
  if (!survey) return;
  const tieuDe = `Khảo sát mới: ${survey.tieuDe}`.slice(0, 150);
  const exists = await db.get('SELECT maTB FROM THONGBAO WHERE maKH = :maKH AND maKS = :maKS AND tieuDe = :tieuDe', { maKH, maKS, tieuDe });
  if (!exists) await thongBaoService.taoThongBao({ maKH, maKS, loai: 'Khảo sát', tieuDe, noiDung: survey.moTa || 'Bạn được mời tham gia khảo sát mới.' });
}

async function dongKhaoSatDatGioiHan() {
  const open = await db.all(`SELECT maKS, hanChot, soLuongToiDa,
      (SELECT COUNT(*) FROM PHIEUTRALOI p WHERE p.maKS = KHAOSAT.maKS) AS soPhieuTraLoi
    FROM KHAOSAT WHERE trangThai = N'Đang mở'`);
  for (const survey of open) {
    const expired = survey.hanChot && String(survey.hanChot).slice(0, 10) < todaySql();
    const full = survey.soLuongToiDa != null && Number(survey.soPhieuTraLoi) >= Number(survey.soLuongToiDa);
    if (!expired && !full) continue;
    await db.run("UPDATE KHAOSAT SET trangThai = N'Đã đóng' WHERE maKS = :maKS", { maKS: survey.maKS });
    await thongBaoKetThucKhaoSat(survey.maKS, full ? 'Khảo sát đã hết lượt' : 'Khảo sát đã hết hạn');
  }
}

async function dongBoThongBaoKhaoSat() {
  await dongKhaoSatDatGioiHan();
}

/** Tách chuỗi lựa chọn 'A|B|C' thành mảng. */
function tachLuaChon(luaChon) {
  if (!luaChon) return [];
  return String(luaChon)
    .split('|')
    .map((item) => item.trim())
    .filter(Boolean);
}

/**
 * CN11.4 — Xem danh sách khảo sát.
 * Khách hàng chỉ thấy khảo sát được gửi cho mình.
 */
async function listKhaoSat(query = {}, user = null) {
  await dongKhaoSatDatGioiHan();
  const pagination = parsePagination(query);
  const filter = new FilterBuilder()
    .search(query.q, ['k.tieuDe', 'k.moTa'])
    .equals('k.loaiKS', query.loaiKS ? optionalText(query.loaiKS, 50) : null)
    .equals('k.trangThai', query.trangThai ? optionalText(query.trangThai, 30) : null);

  const laKhachHang = user?.vaiTro === ROLES.CUSTOMER;
  if (laKhachHang) {
    filter.raw(
      `EXISTS (SELECT 1 FROM GUIKHAOSAT g WHERE g.maKS = k.maKS AND g.maKH = :maKHDangNhap)`,
      { maKHDangNhap: Number(user.maKH) }
    );
    filter.equals('k.trangThai', 'Đang mở');
  }

  const { items, total } = await executePaged({
    selectSql: SELECT_SQL,
    countSql: COUNT_SQL,
    filter,
    orderBy: 'ORDER BY k.ngayTao DESC, k.maKS DESC',
    pagination,
    runAll: db.all,
    runGet: db.get,
  });

  let duLieu = items;
  if (laKhachHang) {
    duLieu = [];
    for (const row of items) {
      const daTraLoi = await db.get(
        'SELECT maPhieu FROM PHIEUTRALOI WHERE maKS = :maKS AND maKH = :maKH',
        { maKS: row.maKS, maKH: Number(user.maKH) }
      );
      duLieu.push({ ...row, daTraLoi: Boolean(daTraLoi), daHetLuot: row.soLuongToiDa != null && Number(row.soPhieuTraLoi) >= Number(row.soLuongToiDa) });
    }
  }

  return paginate(duLieu, total, pagination);
}

/** Lấy khảo sát kèm danh sách câu hỏi. */
async function getKhaoSat(maKS) {
  const header = await db.get(`${SELECT_SQL} WHERE k.maKS = :maKS`, { maKS });
  if (!header) throw notFound(`Không tìm thấy khảo sát có mã ${maKS}.`);
  const cauHoi = await db.all(
    `SELECT maCauHoi, maKS, noiDung, loaiCauHoi, luaChon, batBuoc, thuTu
       FROM CAUHOIKHAOSAT WHERE maKS = :maKS ORDER BY thuTu ASC, maCauHoi ASC`,
    { maKS }
  );
  return {
    ...header,
    cauHoi: cauHoi.map((row) => ({ ...row, luaChonList: tachLuaChon(row.luaChon) })),
  };
}

/** CN11.1 — Tạo khảo sát. */
async function createKhaoSat(payload, user) {
  const maNV = requiredInt(user?.maNV ?? payload.maNV, 'Nhân viên tạo khảo sát', 1);
  const nhanVien = await db.get('SELECT maNV FROM NHANVIEN WHERE maNV = :maNV', { maNV });
  if (!nhanVien) throw badRequest(`Nhân viên có mã ${maNV} không tồn tại.`);
  const tieuDe = requiredText(payload.tieuDe, 'Tiêu đề khảo sát', 200);
  const moTa = optionalText(payload.moTa, 500);
  const loaiKS = oneOf(payload.loaiKS, LOAI_KHAO_SAT, 'Loại khảo sát');
  const doiTuong = oneOf(payload.doiTuong ?? 'Tất cả khách hàng', DOI_TUONG_KHAO_SAT, 'Đối tượng khảo sát');
  const hanChot = dateOnly(payload.hanChot, 'Hạn chót', { allowNull: true });
  const loaiPhanThuong = oneOf(payload.loaiPhanThuong ?? 'Điểm', LOAI_PHAN_THUONG_KHAO_SAT, 'Phần thưởng khảo sát');
  const giaTriPhanThuong = requiredInt(payload.giaTriPhanThuong ?? DIEM_THUONG_KHAO_SAT, 'Giá trị phần thưởng', 1);
  if (loaiPhanThuong === 'Phiếu giảm giá' && giaTriPhanThuong > 100) {
    throw badRequest('Phần trăm giảm của phiếu khảo sát không được vượt quá 100%.');
  }
  const giamToiDa = loaiPhanThuong === 'Phiếu giảm giá' && payload.giamToiDa !== '' && payload.giamToiDa != null
    ? requiredNumber(payload.giamToiDa, 'Mức giảm tối đa', 1) : null;
  const kieuHetHanPhieu = loaiPhanThuong === 'Phiếu giảm giá'
    ? oneOf(payload.kieuHetHanPhieu ?? 'Không giới hạn', ['Không giới hạn', 'Sau số ngày', 'Chọn ngày hết hạn'], 'Thời hạn phiếu')
    : 'Không giới hạn';
  const soNgayHieuLucPhieu = kieuHetHanPhieu === 'Sau số ngày'
    ? requiredInt(payload.soNgayHieuLucPhieu, 'Số ngày hiệu lực phiếu', 1) : null;
  const ngayHetHanPhieu = kieuHetHanPhieu === 'Chọn ngày hết hạn'
    ? dateOnly(payload.ngayHetHanPhieu, 'Ngày hết hạn phiếu') : null;
  if (ngayHetHanPhieu && ngayHetHanPhieu < todaySql()) throw badRequest('Ngày hết hạn phiếu phải là hôm nay hoặc một ngày trong tương lai.');
  const soLuongToiDa = payload.soLuongToiDa === '' || payload.soLuongToiDa == null
    ? null : requiredInt(payload.soLuongToiDa, 'Số lượt trả lời tối đa', 1);

  const result = await db.run(
    `INSERT INTO KHAOSAT (maNV, tieuDe, moTa, loaiKS, doiTuong, ngayTao, hanChot, trangThai,
                         loaiPhanThuong, giaTriPhanThuong, giamToiDa, soLuongToiDa,
                         kieuHetHanPhieu, soNgayHieuLucPhieu, ngayHetHanPhieu)
     VALUES (:maNV, :tieuDe, :moTa, :loaiKS, :doiTuong, :ngayTao, :hanChot, N'Đã đóng',
             :loaiPhanThuong, :giaTriPhanThuong, :giamToiDa, :soLuongToiDa,
             :kieuHetHanPhieu, :soNgayHieuLucPhieu, :ngayHetHanPhieu)`,
    { maNV, tieuDe, moTa, loaiKS, doiTuong, ngayTao: nowSql(), hanChot, loaiPhanThuong, giaTriPhanThuong, giamToiDa, soLuongToiDa, kieuHetHanPhieu, soNgayHieuLucPhieu, ngayHetHanPhieu }
  );
  const maKS = result.lastInsertRowid;

  const danhSachCauHoi = asArray(payload.cauHoi);
  for (let index = 0; index < danhSachCauHoi.length; index += 1) {
    await themCauHoi(maKS, { ...danhSachCauHoi[index], thuTu: index + 1 });
  }
  return getKhaoSat(maKS);
}

/** CN11.2 — Sửa thông tin khảo sát. */
async function updateKhaoSat(maKS, payload) {
  const current = await getKhaoSat(maKS);
  const tieuDe = requiredText(payload.tieuDe ?? current.tieuDe, 'Tiêu đề khảo sát', 200);
  const moTa = optionalText(payload.moTa ?? current.moTa, 500);
  const loaiKS = oneOf(payload.loaiKS ?? current.loaiKS, LOAI_KHAO_SAT, 'Loại khảo sát');
  const doiTuong = payload.doiTuong === undefined
    ? current.doiTuong
    : oneOf(payload.doiTuong, DOI_TUONG_KHAO_SAT, 'Đối tượng khảo sát');
  const hanChot =
    payload.hanChot === undefined
      ? current.hanChot
      : dateOnly(payload.hanChot, 'Hạn chót', { allowNull: true });
  const trangThai = oneOf(payload.trangThai ?? current.trangThai, TRANG_THAI_KS, 'Trạng thái');
  const loaiPhanThuong = oneOf(payload.loaiPhanThuong ?? current.loaiPhanThuong ?? 'Điểm', LOAI_PHAN_THUONG_KHAO_SAT, 'Phần thưởng khảo sát');
  const giaTriPhanThuong = requiredInt(payload.giaTriPhanThuong ?? current.giaTriPhanThuong ?? DIEM_THUONG_KHAO_SAT, 'Giá trị phần thưởng', 1);
  if (loaiPhanThuong === 'Phiếu giảm giá' && giaTriPhanThuong > 100) throw badRequest('Phần trăm giảm của phiếu khảo sát không được vượt quá 100%.');
  const giamToiDa = loaiPhanThuong === 'Phiếu giảm giá'
    ? (payload.giamToiDa === undefined
      ? current.giamToiDa
      : payload.giamToiDa === '' || payload.giamToiDa == null
        ? null : requiredNumber(payload.giamToiDa, 'Mức giảm tối đa', 1))
    : null;
  const kieuHetHanPhieu = loaiPhanThuong === 'Phiếu giảm giá'
    ? oneOf(payload.kieuHetHanPhieu ?? current.kieuHetHanPhieu ?? 'Không giới hạn', ['Không giới hạn', 'Sau số ngày', 'Chọn ngày hết hạn'], 'Thời hạn phiếu')
    : 'Không giới hạn';
  const soNgayHieuLucPhieu = kieuHetHanPhieu === 'Sau số ngày'
    ? requiredInt(payload.soNgayHieuLucPhieu ?? current.soNgayHieuLucPhieu, 'Số ngày hiệu lực phiếu', 1) : null;
  const ngayHetHanPhieu = kieuHetHanPhieu === 'Chọn ngày hết hạn'
    ? dateOnly(payload.ngayHetHanPhieu ?? current.ngayHetHanPhieu, 'Ngày hết hạn phiếu') : null;
  if (ngayHetHanPhieu && ngayHetHanPhieu < todaySql()) throw badRequest('Ngày hết hạn phiếu phải là hôm nay hoặc một ngày trong tương lai.');
  const soLuongToiDa = payload.soLuongToiDa === undefined
    ? current.soLuongToiDa
    : payload.soLuongToiDa === '' || payload.soLuongToiDa == null
      ? null : requiredInt(payload.soLuongToiDa, 'Số lượt trả lời tối đa', 1);

  const canTuDongGui = trangThai === 'Đang mở' && !current.daGui;
  if (canTuDongGui) {
    const soCauHoi = Number(await db.scalar('SELECT COUNT(*) FROM CAUHOIKHAOSAT WHERE maKS = :maKS', { maKS: current.maKS }));
    if (soCauHoi === 0) throw badRequest('Hãy thêm câu hỏi trước khi mở khảo sát. Khi chuyển sang Đang mở, khảo sát sẽ tự gửi cho khách phù hợp.');
  }

  await db.run(
    `UPDATE KHAOSAT
        SET tieuDe = :tieuDe, moTa = :moTa, loaiKS = :loaiKS, doiTuong = :doiTuong,
            hanChot = :hanChot, trangThai = :trangThai,
            loaiPhanThuong = :loaiPhanThuong, giaTriPhanThuong = :giaTriPhanThuong,
            giamToiDa = :giamToiDa,
            soLuongToiDa = :soLuongToiDa,
            kieuHetHanPhieu = :kieuHetHanPhieu,
            soNgayHieuLucPhieu = :soNgayHieuLucPhieu,
            ngayHetHanPhieu = :ngayHetHanPhieu
      WHERE maKS = :maKS`,
    { tieuDe, moTa, loaiKS, doiTuong, hanChot, trangThai, loaiPhanThuong, giaTriPhanThuong, giamToiDa, soLuongToiDa, kieuHetHanPhieu, soNgayHieuLucPhieu, ngayHetHanPhieu, maKS: current.maKS }
  );
  if (canTuDongGui) await guiKhaoSat(current.maKS);
  return getKhaoSat(current.maKS);
}

/**
 * CN11.2 — Xóa khảo sát.
 * Nếu đã có phiếu trả lời thì chỉ đóng khảo sát để giữ dữ liệu thống kê.
 */
async function deleteKhaoSat(maKS) {
  const current = await getKhaoSat(maKS);
  if (Number(current.soPhieuTraLoi) > 0) {
    await db.run(`UPDATE KHAOSAT SET trangThai = N'Đã đóng' WHERE maKS = :maKS`, {
      maKS: current.maKS,
    });
    return {
      maKS: current.maKS,
      tieuDe: current.tieuDe,
      hanhDong: 'dong',
      thongBao: 'Khảo sát đã có phiếu trả lời nên được đóng lại thay vì xóa.',
    };
  }
  await db.transaction(async () => {
    await db.run('DELETE FROM GUIKHAOSAT WHERE maKS = :maKS', { maKS: current.maKS });
    await db.run('DELETE FROM CAUHOIKHAOSAT WHERE maKS = :maKS', { maKS: current.maKS });
    await db.run('DELETE FROM KHAOSAT WHERE maKS = :maKS', { maKS: current.maKS });
  });
  return {
    maKS: current.maKS,
    tieuDe: current.tieuDe,
    hanhDong: 'xoa',
    thongBao: 'Đã xóa khảo sát.',
  };
}

/** CN11.3 — Thêm câu hỏi cho khảo sát. */
async function themCauHoi(maKS, payload) {
  const khaoSat = await db.get('SELECT maKS, trangThai FROM KHAOSAT WHERE maKS = :maKS', { maKS });
  if (!khaoSat) throw notFound(`Không tìm thấy khảo sát có mã ${maKS}.`);
  if (khaoSat.daGui) throw badRequest('Khảo sát đã gửi cho khách nên không thể thêm câu hỏi.');

  const noiDung = requiredText(payload.noiDung, 'Nội dung câu hỏi', 500);
  const loaiCauHoi = oneOf(payload.loaiCauHoi ?? LOAI_CAU_HOI[0], LOAI_CAU_HOI, 'Loại câu hỏi');
  const luaChon = optionalText(payload.luaChon, 500);
  if (
    (loaiCauHoi === 'Một lựa chọn' || loaiCauHoi === 'Nhiều lựa chọn') &&
    tachLuaChon(luaChon).length < 2
  ) {
    throw badRequest('Câu hỏi lựa chọn phải có ít nhất 2 lựa chọn, phân tách bằng dấu "|".');
  }
  const thuTu =
    Number(payload.thuTu) > 0
      ? Number(payload.thuTu)
      : Number(
          await db.scalar(
            'SELECT COALESCE(MAX(thuTu), 0) + 1 FROM CAUHOIKHAOSAT WHERE maKS = :maKS',
            { maKS }
          )
        );
  const batBuoc = payload.batBuoc === false || payload.batBuoc === 0 ? 0 : 1;

  const result = await db.run(
    `INSERT INTO CAUHOIKHAOSAT (maKS, noiDung, loaiCauHoi, luaChon, batBuoc, thuTu)
     VALUES (:maKS, :noiDung, :loaiCauHoi, :luaChon, :batBuoc, :thuTu)`,
    { maKS, noiDung, loaiCauHoi, luaChon, batBuoc, thuTu }
  );
  return db.get(
    `SELECT maCauHoi, maKS, noiDung, loaiCauHoi, luaChon, batBuoc, thuTu
       FROM CAUHOIKHAOSAT WHERE maCauHoi = :maCauHoi`,
    { maCauHoi: result.lastInsertRowid }
  );
}

/** CN11.3 — Sửa câu hỏi khảo sát. */
async function suaCauHoi(maCauHoi, payload) {
  const current = await db.get('SELECT * FROM CAUHOIKHAOSAT WHERE maCauHoi = :maCauHoi', {
    maCauHoi,
  });
  if (!current) throw notFound(`Không tìm thấy câu hỏi có mã ${maCauHoi}.`);
  const noiDung = requiredText(payload.noiDung ?? current.noiDung, 'Nội dung câu hỏi', 500);
  const loaiCauHoi = oneOf(payload.loaiCauHoi ?? current.loaiCauHoi, LOAI_CAU_HOI, 'Loại câu hỏi');
  const luaChon = optionalText(payload.luaChon ?? current.luaChon, 500);
  const batBuoc = payload.batBuoc === undefined ? current.batBuoc : payload.batBuoc ? 1 : 0;
  const thuTu = Number(payload.thuTu) > 0 ? Number(payload.thuTu) : current.thuTu;

  await db.run(
    `UPDATE CAUHOIKHAOSAT
        SET noiDung = :noiDung, loaiCauHoi = :loaiCauHoi, luaChon = :luaChon,
            batBuoc = :batBuoc, thuTu = :thuTu
      WHERE maCauHoi = :maCauHoi`,
    { noiDung, loaiCauHoi, luaChon, batBuoc, thuTu, maCauHoi: current.maCauHoi }
  );
  return db.get('SELECT * FROM CAUHOIKHAOSAT WHERE maCauHoi = :maCauHoi', {
    maCauHoi: current.maCauHoi,
  });
}

/** CN11.3 — Xóa câu hỏi (chỉ khi chưa có câu trả lời). */
async function xoaCauHoi(maCauHoi) {
  const current = await db.get('SELECT * FROM CAUHOIKHAOSAT WHERE maCauHoi = :maCauHoi', {
    maCauHoi,
  });
  if (!current) throw notFound(`Không tìm thấy câu hỏi có mã ${maCauHoi}.`);
  const soTraLoi = Number(
    await db.scalar('SELECT COUNT(*) FROM CHITIETTRALOI WHERE maCauHoi = :maCauHoi', { maCauHoi })
  );
  if (soTraLoi > 0) {
    throw conflict(`Câu hỏi này đã có ${soTraLoi} câu trả lời nên không thể xóa.`);
  }
  await db.run('DELETE FROM CAUHOIKHAOSAT WHERE maCauHoi = :maCauHoi', {
    maCauHoi: current.maCauHoi,
  });
  return { maCauHoi: current.maCauHoi, noiDung: current.noiDung };
}

/**
 * 4.1.6 — Gửi khảo sát đến tài khoản khách hàng.
 * @param {number} maKS
 * @param {number[]|'all'} danhSachMaKH
 */
async function guiKhaoSat(maKS) {
  await dongKhaoSatDatGioiHan();
  const khaoSat = await getKhaoSat(maKS);
  if (khaoSat.trangThai !== 'Đang mở') throw badRequest('Khảo sát đã đóng, không thể gửi.');
  if (khaoSat.cauHoi.length === 0) throw badRequest('Khảo sát chưa có câu hỏi nào.');

  const gioiTinhMucTieu = ['Nam', 'Nữ'].includes(khaoSat.doiTuong) ? khaoSat.doiTuong : null;
  const khachHangHoatDong = await db.all(
    `SELECT maKH, gioiTinh FROM KHACHHANG WHERE trangThai = N'Hoạt động'`
  );
  const maKHEligible = new Set(
    khachHangHoatDong
      .filter((kh) => !gioiTinhMucTieu || kh.gioiTinh === gioiTinhMucTieu)
      .map((kh) => Number(kh.maKH))
  );

  const danhSach = Array.from(maKHEligible);

  return db.transaction(async () => {
    let soGui = 0;
    for (const maKH of danhSach) {
      const khachHang = await db.get('SELECT maKH, trangThai FROM KHACHHANG WHERE maKH = :maKH', {
        maKH,
      });
      if (!khachHang || khachHang.trangThai !== 'Hoạt động') continue;
      const daGui = await db.get(
        'SELECT maKH FROM GUIKHAOSAT WHERE maKS = :maKS AND maKH = :maKH',
        { maKS, maKH }
      );
      if (daGui) continue;
      await db.run(
        `INSERT INTO GUIKHAOSAT (maKS, maKH, ngayGui, daXem) VALUES (:maKS, :maKH, :ngayGui, 0)`,
        { maKS, maKH, ngayGui: nowSql() }
      );
      await thongBaoKhaoSatMoi(maKS, maKH);
      soGui += 1;
    }
    const daGui = db.getClient() === 'postgres' ? 'TRUE' : '1';
    await db.run(`UPDATE KHAOSAT SET daGui = ${daGui} WHERE maKS = :maKS`, { maKS });
    return {
      maKS,
      soGui,
      tongKhachHang: danhSach.length,
      thongBao: `Đã gửi khảo sát cho ${soGui} khách hàng.`,
    };
  });
}

/** Gắn các khảo sát đã phát hành cho tài khoản khách mới theo đúng đối tượng. */
async function ganKhaoSatChoKhachHang(maKH, gioiTinh) {
  await dongKhaoSatDatGioiHan();
  const surveys = await db.all(
    `SELECT maKS, doiTuong, soLuongToiDa
       FROM KHAOSAT
      WHERE daGui = TRUE AND trangThai = N'Đang mở'
        AND (doiTuong = N'Tất cả khách hàng'
          OR (doiTuong = N'Nam' AND :gioiTinh = N'Nam')
          OR (doiTuong = N'Nữ' AND :gioiTinh = N'Nữ'))`,
    { gioiTinh: gioiTinh ?? null }
  );
  let soGan = 0;
  for (const survey of surveys) {
    if (survey.soLuongToiDa != null) {
      const soPhieu = Number(await db.scalar('SELECT COUNT(*) FROM PHIEUTRALOI WHERE maKS = :maKS', { maKS: survey.maKS }));
      if (soPhieu >= Number(survey.soLuongToiDa)) continue;
    }
    const assigned = await db.get(
      'SELECT maKH FROM GUIKHAOSAT WHERE maKS = :maKS AND maKH = :maKH',
      { maKS: survey.maKS, maKH }
    );
    if (assigned) continue;
    await db.run(
      `INSERT INTO GUIKHAOSAT (maKS, maKH, ngayGui, daXem) VALUES (:maKS, :maKH, :ngayGui, 0)`,
      { maKS: survey.maKS, maKH, ngayGui: nowSql() }
    );
    await thongBaoKhaoSatMoi(survey.maKS, maKH);
    soGan += 1;
  }
  return soGan;
}

/** Danh sách khách hàng đã nhận khảo sát. */
async function listNguoiNhan(maKS) {
  return db.all(
    `SELECT g.maKH, kh.hoTen, kh.sdt, g.ngayGui, g.daXem,
            CASE WHEN pt.maPhieu IS NULL THEN 0 ELSE 1 END AS daTraLoi
       FROM GUIKHAOSAT g
       JOIN KHACHHANG kh ON kh.maKH = g.maKH
       LEFT JOIN PHIEUTRALOI pt ON pt.maKS = g.maKS AND pt.maKH = g.maKH
      WHERE g.maKS = :maKS
      ORDER BY daTraLoi ASC, g.ngayGui DESC`,
    { maKS }
  );
}

/**
 * Danh sách khảo sát khách hàng cần thực hiện (mục 4.3.5).
 * Khảo sát chưa trả lời được kèm luôn danh sách câu hỏi để cổng khách hàng
 * dựng được biểu mẫu trả lời mà không cần quyền xem khảo sát của nhân viên.
 */
async function listKhaoSatCuaKhach(maKH) {
  await dongKhaoSatDatGioiHan();
  const rows = await db.all(
    `${SELECT_SQL}
      WHERE k.trangThai = N'Đang mở'
        AND EXISTS (SELECT 1 FROM GUIKHAOSAT g WHERE g.maKS = k.maKS AND g.maKH = :maKH)
      ORDER BY k.ngayTao DESC`,
    { maKH }
  );
  const ketQua = [];
  for (const row of rows) {
    const phieu = await db.get(
      'SELECT maPhieu FROM PHIEUTRALOI WHERE maKS = :maKS AND maKH = :maKH',
      { maKS: row.maKS, maKH }
    );
    const daTraLoi = Boolean(phieu);
    const cauHoi = daTraLoi
      ? []
      : (
          await db.all(
            `SELECT maCauHoi, noiDung, loaiCauHoi, luaChon, batBuoc, thuTu
               FROM CAUHOIKHAOSAT WHERE maKS = :maKS ORDER BY thuTu ASC, maCauHoi ASC`,
            { maKS: row.maKS }
          )
        ).map((muc) => ({ ...muc, luaChonList: tachLuaChon(muc.luaChon) }));
    const daHetLuot = row.soLuongToiDa != null && Number(row.soPhieuTraLoi) >= Number(row.soLuongToiDa);
    ketQua.push({ ...row, daTraLoi, daHetLuot, cauHoi: daHetLuot ? [] : cauHoi });
  }
  return ketQua;
}

/**
 * CN11.5 — Khách hàng trả lời khảo sát.
 * @param {number} maKS
 * @param {Array<{maCauHoi:number, noiDungTraLoi:string}>} danhSachTraLoi
 * @param {object} user người đang đăng nhập
 */
async function traLoiKhaoSat(maKS, danhSachTraLoi, user = null) {
  const laKhachHang = user?.vaiTro === ROLES.CUSTOMER;
  const maKH = laKhachHang
    ? Number(user.maKH)
    : requiredInt(danhSachTraLoi?.maKH, 'Khách hàng', 1);
  const khaoSat = await getKhaoSat(maKS);
  if (khaoSat.trangThai !== 'Đang mở') throw badRequest('Khảo sát đã đóng, không thể trả lời.');
  if (khaoSat.hanChot && String(khaoSat.hanChot).slice(0, 10) < todaySql()) {
    throw badRequest('Khảo sát đã quá hạn trả lời.');
  }
  const khachHang = await db.get('SELECT maKH, trangThai FROM KHACHHANG WHERE maKH = :maKH', {
    maKH,
  });
  if (!khachHang) throw badRequest(`Khách hàng có mã ${maKH} không tồn tại.`);
  if (khachHang.trangThai !== 'Hoạt động') {
    throw conflict(
      `Khách hàng đang ở trạng thái "${khachHang.trangThai}", không thể trả lời khảo sát.`
    );
  }
  const daTraLoi = await db.get(
    'SELECT maPhieu FROM PHIEUTRALOI WHERE maKS = :maKS AND maKH = :maKH',
    { maKS, maKH }
  );
  if (daTraLoi) throw conflict('Bạn đã trả lời khảo sát này rồi.');

  const traLoiMap = new Map();
  asArray(danhSachTraLoi?.chiTiet ?? danhSachTraLoi).forEach((item, index) => {
    const maCauHoi = requiredInt(item.maCauHoi, `Mã câu hỏi dòng ${index + 1}`, 1);
    const noiDung = requiredText(item.noiDungTraLoi, `Câu trả lời dòng ${index + 1}`, 1000);
    traLoiMap.set(maCauHoi, noiDung);
  });

  const thieu = khaoSat.cauHoi.filter(
    (cauHoi) => Number(cauHoi.batBuoc) === 1 && !traLoiMap.has(Number(cauHoi.maCauHoi))
  );
  if (thieu.length > 0) {
    throw badRequest(`Còn ${thieu.length} câu hỏi bắt buộc chưa được trả lời.`);
  }
  const maCauHoiHopLe = new Set(khaoSat.cauHoi.map((cauHoi) => Number(cauHoi.maCauHoi)));
  traLoiMap.forEach((_value, maCauHoi) => {
    if (!maCauHoiHopLe.has(maCauHoi)) {
      throw badRequest(`Câu hỏi có mã ${maCauHoi} không thuộc khảo sát này.`);
    }
  });

  return db.transaction(async () => {
    const khoa = db.getClient() === 'postgres' ? ' FOR UPDATE' : '';
    const surveyLocked = await db.get(`SELECT maKS, trangThai, soLuongToiDa FROM KHAOSAT WHERE maKS = :maKS${khoa}`, { maKS });
    if (!surveyLocked || surveyLocked.trangThai !== 'Đang mở') throw badRequest('Khảo sát đã đóng, không thể trả lời.');
    if (surveyLocked.soLuongToiDa != null) {
      const daNhan = Number(await db.scalar('SELECT COUNT(*) FROM PHIEUTRALOI WHERE maKS = :maKS', { maKS }));
      if (daNhan >= Number(surveyLocked.soLuongToiDa)) throw badRequest('Khảo sát đã nhận đủ số lượt trả lời.');
    }
    const result = await db.run(
      `INSERT INTO PHIEUTRALOI (maKS, maKH, ngayTraLoi) VALUES (:maKS, :maKH, :ngayTraLoi)`,
      { maKS, maKH, ngayTraLoi: nowSql() }
    );
    const maPhieu = result.lastInsertRowid;
    for (const [maCauHoi, noiDungTraLoi] of traLoiMap) {
      await db.run(
        `INSERT INTO CHITIETTRALOI (maPhieu, maCauHoi, noiDungTraLoi)
         VALUES (:maPhieu, :maCauHoi, :noiDungTraLoi)`,
        { maPhieu, maCauHoi, noiDungTraLoi }
      );
    }
    await db.run('UPDATE GUIKHAOSAT SET daXem = 1 WHERE maKS = :maKS AND maKH = :maKH', {
      maKS,
      maKH,
    });

    let diemThuong = 0;
    let maPG = null;
    if (khaoSat.loaiPhanThuong === 'Phiếu giảm giá') {
      const phanTramGiam = Number(khaoSat.giaTriPhanThuong);
      const ngayHetHan = khaoSat.kieuHetHanPhieu === 'Sau số ngày'
        ? `${daysFromToday(Number(khaoSat.soNgayHieuLucPhieu))} 23:59:59`
        : khaoSat.kieuHetHanPhieu === 'Chọn ngày hết hạn' && khaoSat.ngayHetHanPhieu
          ? `${String(khaoSat.ngayHetHanPhieu).slice(0, 10)} 23:59:59`
          : null;
      const maCode = `KS${maKS}${maKH}${crypto.randomBytes(5).toString('hex').toUpperCase()}`;
      const phieu = await db.run(
        `INSERT INTO PHIEUGIAMGIA
           (maKH, maCode, tieuDe, moTa, phanTramGiam, giamToiDa,
            soLanSuDungToiDa, soLanDaSuDung, loai, trangThai, ngayTao, ngayHetHan)
         VALUES (:maKH, :maCode, :tieuDe, :moTa, :phanTramGiam, :giamToiDa,
            1, 0, N'Khảo sát', N'Chưa dùng', :ngayTao, :ngayHetHan)`,
        {
          maKH, maCode, tieuDe: `Thưởng khảo sát: ${khaoSat.tieuDe}`.slice(0, 150),
          moTa: `Mã ${maCode} giảm ${phanTramGiam}% cho đơn hàng của bạn.`, phanTramGiam,
          giamToiDa: khaoSat.giamToiDa ?? null, ngayTao: nowSql(), ngayHetHan,
        }
      );
      maPG = Number(phieu.lastInsertRowid);
      await thongBaoService.taoThongBao({
        maKH, maPG, loai: 'Ưu đãi', tieuDe: `Bạn nhận được phiếu giảm giá ${phanTramGiam}%`,
        noiDung: `Hoàn thành khảo sát “${khaoSat.tieuDe}” và nhận phiếu ${maCode}. Phiếu chỉ dùng được một lần.`,
      });
    } else if (Number(khaoSat.giaTriPhanThuong) > 0) {
      diemThuong = Number(khaoSat.giaTriPhanThuong);
      await loyaltyService.ghiGiaoDichDiem({
        maKH,
        maDH: null,
        soDiem: diemThuong,
        loaiGD: 'Cộng',
        ghiChu: `Điểm thưởng hoàn thành khảo sát #${maKS}`,
      });
    }
    if (surveyLocked.soLuongToiDa != null) {
      const soPhieu = Number(await db.scalar('SELECT COUNT(*) FROM PHIEUTRALOI WHERE maKS = :maKS', { maKS }));
      if (soPhieu >= Number(surveyLocked.soLuongToiDa)) {
        await db.run("UPDATE KHAOSAT SET trangThai = N'Đã đóng' WHERE maKS = :maKS", { maKS });
        await thongBaoKetThucKhaoSat(maKS, 'Khảo sát đã hết lượt');
      }
    }
    return {
      maPhieu,
      maKS,
      maKH,
      diemThuong,
      maPG,
      thongBao: maPG
        ? `Cảm ơn bạn đã hoàn thành khảo sát! Phiếu giảm giá đã được thêm vào mục Ưu đãi của tôi.`
        : `Cảm ơn bạn đã hoàn thành khảo sát! Bạn nhận được ${diemThuong} điểm thưởng.`,
    };
  });
}

/** CN11.6 — Xem kết quả và thống kê khảo sát. */
async function thongKeKhaoSat(maKS) {
  const khaoSat = await getKhaoSat(maKS);
  const soPhieu = Number(khaoSat.soPhieuTraLoi);
  const soNguoiNhan = Number(
    await db.scalar('SELECT COUNT(*) FROM GUIKHAOSAT WHERE maKS = :maKS', { maKS })
  );

  const chiTiet = [];
  for (const cauHoi of khaoSat.cauHoi) {
    const traLoi = await db.all(
      `SELECT ct.noiDungTraLoi, pt.ngayTraLoi, kh.hoTen
         FROM CHITIETTRALOI ct
         JOIN PHIEUTRALOI pt ON pt.maPhieu = ct.maPhieu
         JOIN KHACHHANG kh ON kh.maKH = pt.maKH
        WHERE ct.maCauHoi = :maCauHoi
        ORDER BY pt.ngayTraLoi DESC`,
      { maCauHoi: cauHoi.maCauHoi }
    );

    const tanSuat = new Map();
    traLoi.forEach((item) => {
      const key = String(item.noiDungTraLoi ?? '').trim();
      if (!key) return;
      tanSuat.set(key, (tanSuat.get(key) ?? 0) + 1);
    });
    const thongKe = [...tanSuat.entries()]
      .map(([giaTri, soLuong]) => ({
        giaTri,
        soLuong,
        tyLe: traLoi.length > 0 ? Math.round((soLuong / traLoi.length) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.soLuong - a.soLuong);

    const diemTrungBinh =
      cauHoi.loaiCauHoi === 'Thang điểm'
        ? traLoi.reduce((sum, item) => sum + (Number(item.noiDungTraLoi) || 0), 0) /
          (traLoi.length || 1)
        : null;

    chiTiet.push({
      maCauHoi: cauHoi.maCauHoi,
      noiDung: cauHoi.noiDung,
      loaiCauHoi: cauHoi.loaiCauHoi,
      soTraLoi: traLoi.length,
      diemTrungBinh: diemTrungBinh === null ? null : Math.round(diemTrungBinh * 100) / 100,
      thongKe,
      traLoi: traLoi.slice(0, 50),
    });
  }

  return {
    khaoSat: {
      maKS: khaoSat.maKS,
      tieuDe: khaoSat.tieuDe,
      loaiKS: khaoSat.loaiKS,
      doiTuong: khaoSat.doiTuong,
      ngayTao: khaoSat.ngayTao,
      hanChot: khaoSat.hanChot,
      trangThai: khaoSat.trangThai,
    },
    soPhieu,
    soNguoiNhan,
    tyLePhanHoi: soNguoiNhan > 0 ? Math.round((soPhieu / soNguoiNhan) * 1000) / 10 : 0,
    chiTiet,
  };
}

module.exports = {
  listKhaoSat,
  getKhaoSat,
  createKhaoSat,
  updateKhaoSat,
  deleteKhaoSat,
  themCauHoi,
  suaCauHoi,
  xoaCauHoi,
  guiKhaoSat,
  ganKhaoSatChoKhachHang,
  listNguoiNhan,
  listKhaoSatCuaKhach,
  traLoiKhaoSat,
  thongKeKhaoSat,
  tachLuaChon,
  DIEM_THUONG_KHAO_SAT,
  dongKhaoSatDatGioiHan,
  dongBoThongBaoKhaoSat,
};
