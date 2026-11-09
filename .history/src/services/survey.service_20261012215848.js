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
const {
  requiredText,
  optionalText,
  requiredInt,
  dateOnly,
  oneOf,
  asArray,
} = require('../core/validation');
const { nowSql, todaySql } = require('../core/time');
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
      duLieu.push({ ...row, daTraLoi: Boolean(daTraLoi) });
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
  const maNV = requiredInt(payload.maNV ?? user?.maNV, 'Nhân viên tạo khảo sát', 1);
  const nhanVien = await db.get('SELECT maNV FROM NHANVIEN WHERE maNV = :maNV', { maNV });
  if (!nhanVien) throw badRequest(`Nhân viên có mã ${maNV} không tồn tại.`);
  const tieuDe = requiredText(payload.tieuDe, 'Tiêu đề khảo sát', 200);
  const moTa = optionalText(payload.moTa, 500);
  const loaiKS = oneOf(payload.loaiKS, LOAI_KHAO_SAT, 'Loại khảo sát');
  const doiTuong = optionalText(payload.doiTuong, 30) ?? 'Tất cả khách hàng';
  const hanChot = dateOnly(payload.hanChot, 'Hạn chót', { allowNull: true });

  const result = await db.run(
    `INSERT INTO KHAOSAT (maNV, tieuDe, moTa, loaiKS, doiTuong, ngayTao, hanChot, trangThai)
     VALUES (:maNV, :tieuDe, :moTa, :loaiKS, :doiTuong, :ngayTao, :hanChot, N'Đang mở')`,
    { maNV, tieuDe, moTa, loaiKS, doiTuong, ngayTao: nowSql(), hanChot }
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
  const doiTuong = optionalText(payload.doiTuong ?? current.doiTuong, 30) ?? 'Tất cả khách hàng';
  const hanChot =
    payload.hanChot === undefined
      ? current.hanChot
      : dateOnly(payload.hanChot, 'Hạn chót', { allowNull: true });
  const trangThai = oneOf(payload.trangThai ?? current.trangThai, TRANG_THAI_KS, 'Trạng thái');

  await db.run(
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
  if (khaoSat.trangThai !== 'Đang mở') {
    throw badRequest('Khảo sát đã đóng, không thể thêm câu hỏi.');
  }

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
async function guiKhaoSat(maKS, danhSachMaKH) {
  const khaoSat = await getKhaoSat(maKS);
  if (khaoSat.trangThai !== 'Đang mở') throw badRequest('Khảo sát đã đóng, không thể gửi.');
  if (khaoSat.cauHoi.length === 0) throw badRequest('Khảo sát chưa có câu hỏi nào.');

  let danhSach;
  if (danhSachMaKH === 'all' || danhSachMaKH === undefined || danhSachMaKH === null) {
    const tatCa = await db.all(`SELECT maKH FROM KHACHHANG WHERE trangThai = N'Hoạt động'`);
    danhSach = tatCa.map((row) => row.maKH);
  } else {
    danhSach = asArray(danhSachMaKH).map((value, index) =>
      requiredInt(value, `Khách hàng ${index + 1}`, 1)
    );
  }

  if (danhSach.length === 0) throw badRequest('Không có khách hàng nào để gửi khảo sát.');

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
      soGui += 1;
    }
    return {
      maKS,
      soGui,
      tongKhachHang: danhSach.length,
      thongBao: `Đã gửi khảo sát cho ${soGui} khách hàng.`,
    };
  });
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

/** Danh sách khảo sát khách hàng cần thực hiện (mục 4.3.5). */
async function listKhaoSatCuaKhach(maKH) {
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
    ketQua.push({ ...row, daTraLoi: Boolean(phieu) });
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
    if (DIEM_THUONG_KHAO_SAT > 0) {
      await loyaltyService.ghiGiaoDichDiem({
        maKH,
        maDH: null,
        soDiem: DIEM_THUONG_KHAO_SAT,
        loaiGD: 'Cộng',
        ghiChu: `Điểm thưởng hoàn thành khảo sát #${maKS}`,
      });
      diemThuong = DIEM_THUONG_KHAO_SAT;
    }
    return {
      maPhieu,
      maKS,
      maKH,
      diemThuong,
      thongBao: `Cảm ơn bạn đã hoàn thành khảo sát! Bạn nhận được ${diemThuong} điểm thưởng.`,
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
  listNguoiNhan,
  listKhaoSatCuaKhach,
  traLoiKhaoSat,
  thongKeKhaoSat,
  tachLuaChon,
  DIEM_THUONG_KHAO_SAT,
};
