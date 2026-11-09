/**
 * NGHIỆP VỤ NHÓM 11 — Quản lý khảo sát (CN11.1 → CN11.6).
 * Bao gồm "tạo bảng khảo sát và gửi đến tài khoản khách hàng" (mục 4.1).
 * Bảng: KHAOSAT, CAUHOIKHAOSAT, PHIEUTRALOI, CHITIETTRALOI, GUIKHAOSAT.
 */
'use strict';

const db = require('../db');
const loyaltyService = require('./loyalty.service');
const { ROLES, LOAI_KHAO_SAT, LOAI_CAU_HOI, TRANG_THAI_KS } = require('../config');
const { badRequest, notFound, conflict } = require('../core/errors');
const { requiredText, optionalText, requiredInt, dateOnly, oneOf, asArray } = require('../core/validation');
const { nowSql } = require('../core/time');
const { FilterBuilder, parsePagination, paginate, executePaged } = require('../core/query');

/** Số điểm thưởng cho khách hàng sau khi hoàn thành một khảo sát. */
const DIEM_THUONG_KHAO_SAT = 5;

const SELECT_SQL = `
  SELECT k.maKS, k.maNV, nv.hoTen AS tenNhanVien, k.tieuDe, k.moTa, k.loaiKS, k.doiTuong,
         k.ngayTao, k.hanChot, k.trangThai,
         (SELECT COUNT(*) FROM CAUHOIKHAOSAT ch WHERE ch.maKS = k.maKS) AS soCauHoi,
         (SELECT COUNT(*) FROM PHIEUTRALOI pt WHERE pt.maKS = k.maKS) AS soPhieuTraLoi
    FROM KHAOSAT k
    LEFT JOIN NHANVIEN nv ON nv.maNV = k.maNV`;
const COUNT_SQL = 'SELECT COUNT(*) AS total FROM KHAOSAT k';

/**
 * CN11.4 — Xem danh sách khảo sát.
 * Khách hàng chỉ thấy khảo sát được gửi cho mình.
 */
function listKhaoSat(query = {}, user = null) {
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

  const { items, total } = executePaged({
    selectSql: SELECT_SQL,
    countSql: COUNT_SQL,
    filter,
    orderBy: 'ORDER BY k.ngayTao DESC, k.maKS DESC',
    pagination,
    runAll: db.all,
    runGet: db.get,
  });

  const duLieu = items.map((row) => {
    if (!laKhachHang) return row;
    const daTraLoi = db.get(
      'SELECT maPhieu FROM PHIEUTRALOI WHERE maKS = :maKS AND maKH = :maKH',
      { maKS: row.maKS, maKH: Number(user.maKH) }
    );
    return { ...row, daTraLoi: Boolean(daTraLoi) };
  });

  return paginate(duLieu, total, pagination);
}

/** Lấy khảo sát kèm danh sách câu hỏi. */
function getKhaoSat(maKS) {
  const header = db.get(`${SELECT_SQL} WHERE k.maKS = :maKS`, { maKS });
  if (!header) throw notFound(`Không tìm thấy khảo sát có mã ${maKS}.`);
  const cauHoi = db.all(
    `SELECT maCauHoi, maKS, noiDung, loaiCauHoi, luaChon, batBuoc, thuTu
       FROM CAUHOIKHAOSAT WHERE maKS = :maKS ORDER BY thuTu ASC, maCauHoi ASC`,
    { maKS }
  );
  return { ...header, cauHoi: cauHoi.map((row) => ({ ...row, luaChonList: tachLuaChon(row.luaChon) })) };
}

/** Tách chuỗi lựa chọn 'A|B|C' thành mảng. */
function tachLuaChon(luaChon) {
  if (!luaChon) return [];
  return String(luaChon)
    .split('|')
    .map((item) => item.trim())
    .filter(Boolean);
}

/** CN11.1 — Tạo khảo sát. */
function createKhaoSat(payload, user) {
  const maNV = requiredInt(payload.maNV ?? user?.maNV, 'Nhân viên tạo khảo sát', 1);
  const nhanVien = db.get('SELECT maNV FROM NHANVIEN WHERE maNV = :maNV', { maNV });
  if (!nhanVien) throw badRequest(`Nhân viên có mã ${maNV} không tồn tại.`);
  const tieuDe = requiredText(payload.tieuDe, 'Tiêu đề khảo sát', 200);
  const moTa = optionalText(payload.moTa, 500);
  const loaiKS = oneOf(payload.loaiKS, LOAI_KHAO_SAT, 'Loại khảo sát');
  const doiTuong = optionalText(payload.doiTuong, 30) ?? 'Tất cả khách hàng';
  const hanChot = dateOnly(payload.hanChot, 'Hạn chót', { allowNull: true });

  const result = db.run(
    `INSERT INTO KHAOSAT (maNV, tieuDe, moTa, loaiKS, doiTuong, ngayTao, hanChot, trangThai)
     VALUES (:maNV, :tieuDe, :moTa, :loaiKS, :doiTuong, :ngayTao, :hanChot, N'Đang mở')`,
    { maNV, tieuDe, moTa, loaiKS, doiTuong, ngayTao: nowSql(), hanChot }
  );
  const maKS = result.lastInsertRowid;

  asArray(payload.cauHoi).forEach((cauHoi, index) => {
    themCauHoi(maKS, { ...cauHoi, thuTu: index + 1 });
  });
  return getKhaoSat(maKS);
}

/** CN11.2 — Sửa thông tin khảo sát. */
function updateKhaoSat(maKS, payload) {
  const current = getKhaoSat(maKS);
  const tieuDe = requiredText(payload.tieuDe ?? current.tieuDe, 'Tiêu đề khảo sát', 200);
  const moTa = optionalText(payload.moTa ?? current.moTa, 500);
  const loaiKS = oneOf(payload.loaiKS ?? current.loaiKS, LOAI_KHAO_SAT, 'Loại khảo sát');
  const doiTuong = optionalText(payload.doiTuong ?? current.doiTuong, 30) ?? 'Tất cả khách hàng';
  const hanChot =
    payload.hanChot === undefined
      ? current.hanChot
      : dateOnly(payload.hanChot, 'Hạn chót', { allowNull: true });
  const trangThai = oneOf(payload.trangThai ?? current.trangThai, TRANG_THAI_KS, 'Trạng thái');

  db.run(
    `UPDATE KHAOSAT
        SET tieuDe = :tieuDe, moTa = :moTa, loaiKS = :loaiKS, doiTuong = :doiTuong,
            hanChot = :hanChot, trangThai = :trangThai
      WHERE maKS = :maKS`,
    { tieuDe, moTa, loaiKS, doiTuong, hanChot, trangThai, maKS: current.maKS }
  );
  return getKhaoSat(current.maKS);
}

/**
 * CN11.2 — Xóa khảo sát.
 * Nếu đã có phiếu trả lời thì chỉ đóng khảo sát để giữ dữ liệu thống kê.
 */
function deleteKhaoSat(maKS) {
  const current = getKhaoSat(maKS);
  if (Number(current.soPhieuTraLoi) > 0) {
    db.run(`UPDATE KHAOSAT SET trangThai = N'Đã đóng' WHERE maKS = :maKS`, { maKS: current.maKS });
    return {
      maKS: current.maKS,
      tieuDe: current.tieuDe,
      hanhDong: 'dong',
      thongBao: 'Khảo sát đã có phiếu trả lời nên được đóng lại thay vì xóa.',
    };
  }
  db.transaction(() => {
    db.run('DELETE FROM GUIKHAOSAT WHERE maKS = :maKS', { maKS: current.maKS });
    db.run('DELETE FROM CAUHOIKHAOSAT WHERE maKS = :maKS', { maKS: current.maKS });
    db.run('DELETE FROM KHAOSAT WHERE maKS = :maKS', { maKS: current.maKS });
  });
  return { maKS: current.maKS, tieuDe: current.tieuDe, hanhDong: 'xoa', thongBao: 'Đã xóa khảo sát.' };
}

/** CN11.3 — Thêm câu hỏi cho khảo sát. */
function themCauHoi(maKS, payload) {
  const khaoSat = db.get('SELECT maKS, trangThai FROM KHAOSAT WHERE maKS = :maKS', { maKS });
  if (!khaoSat) throw notFound(`Không tìm thấy khảo sát có mã ${maKS}.`);
  if (khaoSat.trangThai !== 'Đang mở') throw badRequest('Khảo sát đã đóng, không thể thêm câu hỏi.');

  const noiDung = requiredText(payload.noiDung, 'Nội dung câu hỏi', 500);
  const loaiCauHoi = oneOf(payload.loaiCauHoi ?? LOAI_CAU_HOI[0], LOAI_CAU_HOI, 'Loại câu hỏi');
  const luaChon = optionalText(payload.luaChon, 500);
  if ((loaiCauHoi === 'Một lựa chọn' || loaiCauHoi === 'Nhiều lựa chọn') && tachLuaChon(luaChon).length < 2) {
    throw badRequest('Câu hỏi lựa chọn phải có ít nhất 2 lựa chọn, phân tách bằng dấu "|".');
  }
  const thuTu = Number(payload.thuTu) > 0
    ? Number(payload.thuTu)
    : Number(db.scalar('SELECT COALESCE(MAX(thuTu), 0) + 1 FROM CAUHOIKHAOSAT WHERE maKS = :maKS', { maKS }));
  const batBuoc = payload.batBuoc === false || payload.batBuoc === 0 ? 0 : 1;

  const result = db.run(
    `INSERT INTO CAUHOIKHAOSAT (maKS, noiDung, loaiCauHoi, luaChon, batBuoc, thuTu)
     VALUES (:maKS, :noiDung, :loaiCauHoi, :luaChon, :batBuoc, :thuTu)`,
    { maKS, noiDung, loaiCauHoi, luaChon, batBuoc, thuTu }
  );
  return db.get(
    'SELECT maCauHoi, maKS, noiDung, loaiCauHoi, luaChon, batBuoc, thuTu FROM CAUHOIKHAOSAT WHERE maCauHoi = :maCauHoi',
    { maCauHoi: result.lastInsertRowid }
  );
}

/** CN11.3 — Sửa câu hỏi khảo sát. */
function suaCauHoi(maCauHoi, payload) {
  const current = db.get('SELECT * FROM CAUHOIKHAOSAT WHERE maCauHoi = :maCauHoi', { maCauHoi });
  if (!current) throw notFound(`Không tìm thấy câu hỏi có mã ${maCauHoi}.`);
  const noiDung = requiredText(payload.noiDung ?? current.noiDung, 'Nội dung câu hỏi', 500);
  const loaiCauHoi = oneOf(payload.loaiCauHoi ?? current.loaiCauHoi, LOAI_CAU_HOI, 'Loại câu hỏi');
  const luaChon = optionalText(payload.luaChon ?? current.luaChon, 500);
  const batBuoc = payload.batBuoc === undefined ? current.batBuoc : payload.batBuoc ? 1 : 0;
  const thuTu = Number(payload.thuTu) > 0 ? Number(payload.thuTu) : current.thuTu;

  db.run(
    `UPDATE CAUHOIKHAOSAT
        SET noiDung = :noiDung, loaiCauHoi = :loaiCauHoi, luaChon = :luaChon,
            batBuoc = :batBuoc, thuTu = :thuTu
      WHERE maCauHoi = :maCauHoi`,
    { noiDung, loaiCauHoi, luaChon, batBuoc, thuTu, maCauHoi: current.maCauHoi }
  );
  return db.get('SELECT * FROM CAUHOIKHAOSAT WHERE maCauHoi = :maCauHoi', { maCauHoi: current.maCauHoi });
}

/** CN11.3 — Xóa câu hỏi (chỉ khi chưa có câu trả lời). */
function xoaCauHoi(maCauHoi) {
  const current = db.get('SELECT * FROM CAUHOIKHAOSAT WHERE maCauHoi = :maCauHoi', { maCauHoi });
  if (!current) throw notFound(`Không tìm thấy câu hỏi có mã ${maCauHoi}.`);
  const soTraLoi = Number(
    db.scalar('SELECT COUNT(*) FROM CHITIETTRALOI WHERE maCauHoi = :maCauHoi', { maCauHoi })
  );
  if (soTraLoi > 0) {
    throw conflict(`Câu hỏi này đã có ${soTraLoi} câu trả lời nên không thể xóa.`);
  }
  db.run('DELETE FROM CAUHOIKHAOSAT WHERE maCauHoi = :maCauHoi', { maCauHoi: current.maCauHoi });
  return { maCauHoi: current.maCauHoi, noiDung: current.noiDung };
}

/**
 * 4.1.6 — Gửi khảo sát đến tài khoản khách hàng.
 * @param {number} maKS
 * @param {number[]|'all'} danhSachMaKH
 */
function guiKhaoSat(maKS, danhSachMaKH) {
  const khaoSat = getKhaoSat(maKS);
  if (khaoSat.trangThai !== 'Đang mở') throw badRequest('Khảo sát đã đóng, không thể gửi.');
  if (khaoSat.cauHoi.length === 0) throw badRequest('Khảo sát chưa có câu hỏi nào.');

  const danhSach =
    danhSachMaKH === 'all' || danhSachMaKH === undefined || danhSachMaKH === null
      ? db.all(`SELECT maKH FROM KHACHHANG WHERE trangThai = N'Hoạt động'`).map((row) => row.maKH)
      : asArray(danhSachMaKH).map((value, index) => requiredInt(value, `Khách hàng ${index + 1}`, 1));

  if (danhSach.length === 0) throw badRequest('Không có khách hàng nào để gửi khảo sát.');

  return db.transaction(() => {
    let soGui = 0;
    danhSach.forEach((maKH) => {
      const khachHang = db.get('SELECT maKH, trangThai FROM KHACHHANG WHERE maKH = :maKH', { maKH });
      if (!khachHang || khachHang.trangThai !== 'Hoạt động') return;
      const daGui = db.get('SELECT maKH FROM GUIKHAOSAT WHERE maKS = :maKS AND maKH = :maKH', {
        maKS,
        maKH,
      });
      if (daGui) return;
      db.run(
        `INSERT INTO GUIKHAOSAT (maKS, maKH, ngayGui, daXem) VALUES (:maKS, :maKH, :ngayGui, 0)`,
        { maKS, maKH, ngayGui: nowSql() }
      );
      soGui += 1;
    });
    return { maKS, soGui, tongKhachHang: danhSach.length, thongBao: `Đã gửi khảo sát cho ${soGui} khách hàng.` };
  });
}

/** Danh sách khách hàng đã nhận khảo sát. */
function listNguoiNhan(maKS) {
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

/** Danh sách khảo sát khách hàng cần thực hiện (mục 4.3.5). */
function listKhaoSatCuaKhach(maKH) {
  return db.all(
    `${SELECT_SQL}
      WHERE k.trangThai = N'Đang mở'
        AND EXISTS (SELECT 1 FROM GUIKHAOSAT g WHERE g.maKS = k.maKS AND g.maKH = :maKH)
      ORDER BY k.ngayTao DESC`,
    { maKH }
  ).map((row) => ({
    ...row,
    daTraLoi: Boolean(
      db.get('SELECT maPhieu FROM PHIEUTRALOI WHERE maKS = :maKS AND maKH = :maKH', {
        maKS: row.maKS,
        maKH,
      })
    ),
  }));
}

/**
 * CN11.5 — Khách hàng trả lời khảo sát.
 * @param {number} maKS
 * @param {Array<{maCauHoi:number, noiDungTraLoi:string}>} danhSachTraLoi
 * @param {object} user người đang đăng nhập
 */
function traLoiKhaoSat(maKS, danhSachTraLoi, user = null) {
