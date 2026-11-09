/**
 * Nâng cấp lược đồ cho các bảng mới của nghiệp vụ khách hàng:
 *   - UUDAI        : cấu hình các chương trình ưu đãi (gồm ưu đãi sinh nhật).
 *   - PHIEUGIAMGIA : phiếu giảm giá cấp cho từng khách hàng.
 *   - THONGBAO     : thông báo cho chuông của khách hàng.
 *
 * Chạy lúc khởi động máy chủ với `CREATE TABLE IF NOT EXISTS` và chèn cấu hình
 * mặc định bằng câu lệnh "bỏ qua nếu đã có", nên an toàn với cơ sở dữ liệu đã
 * có dữ liệu (không xoá hay tạo lại bảng cũ).
 */
'use strict';

const db = require('./index');

/** Mã chương trình ưu đãi sinh nhật. */
const MA_UU_DAI_SINH_NHAT = 'SINHNHAT';

/** Đoạn DDL cho PostgreSQL. */
const DDL_POSTGRES = [
  `ALTER TABLE SANPHAM ALTER COLUMN hinhAnh TYPE TEXT`,
  `UPDATE NHANVIEN SET chucVu = 'Nhân viên bán hàng' WHERE chucVu = 'Nhân viên quản lý đơn'`,
  `ALTER TABLE KHACHHANG ADD COLUMN IF NOT EXISTS ngayMuaHangCuoi TIMESTAMP NULL`,
  `ALTER TABLE KHACHHANG ADD COLUMN IF NOT EXISTS ngayNhacHetHanDiem TIMESTAMP NULL`,
  `UPDATE KHACHHANG kh
      SET ngayMuaHangCuoi = COALESCE(
        (SELECT MAX(d.ngayDat) FROM DONHANG d WHERE d.maKH = kh.maKH AND d.trangThai <> N'Đã hủy'),
        (SELECT MAX(l.ngayGD) FROM LICHSUDIEM l WHERE l.maKH = kh.maKH AND l.loaiGD IN (N'Cộng', N'Hoàn')),
        CURRENT_TIMESTAMP
      )
    WHERE kh.diemTichLuy > 0 AND kh.ngayMuaHangCuoi IS NULL`,
  `ALTER TABLE DONHANG ADD COLUMN IF NOT EXISTS phuongThucThanhToan VARCHAR(40) NOT NULL DEFAULT N'Tiền mặt'`,
  `ALTER TABLE DONHANG ADD COLUMN IF NOT EXISTS diaChiGiaoHang VARCHAR(255) NULL`,
  `CREATE TABLE IF NOT EXISTS DIACHIGIAOHANG (
     maDC          SERIAL        PRIMARY KEY,
     maKH          INTEGER       NOT NULL REFERENCES KHACHHANG(maKH) ON DELETE CASCADE,
     tenGoiNho     VARCHAR(60)   NOT NULL DEFAULT N'Địa chỉ',
     diaChi        VARCHAR(255)  NOT NULL,
     sdtNhanHang   VARCHAR(15)   NULL,
     laMacDinh     BOOLEAN       NOT NULL DEFAULT FALSE,
     ngayTao       TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
     CONSTRAINT uq_diachigiaohang_kh_diachi UNIQUE (maKH, diaChi)
   )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS uq_diachigiaohang_macdinh
     ON DIACHIGIAOHANG (maKH) WHERE laMacDinh = TRUE`,
  `INSERT INTO DIACHIGIAOHANG (maKH, tenGoiNho, diaChi, laMacDinh)
   SELECT kh.maKH, N'Địa chỉ mặc định', BTRIM(kh.diaChi), TRUE
     FROM KHACHHANG kh
    WHERE NULLIF(BTRIM(kh.diaChi), '') IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM DIACHIGIAOHANG dc WHERE dc.maKH = kh.maKH)`,
  `CREATE TABLE IF NOT EXISTS UUDAI (
     maUD             SERIAL        PRIMARY KEY,
     maCode           VARCHAR(40)   NOT NULL UNIQUE,
     tenUD            VARCHAR(150)  NOT NULL,
     moTa             VARCHAR(255)  NULL,
     phanTramGiam     INTEGER       NOT NULL,
     soNgayHieuLuc    INTEGER       NOT NULL DEFAULT 3,
     soLanDungToiDa   INTEGER       NOT NULL DEFAULT 1,
     loai             VARCHAR(40)   NOT NULL DEFAULT N'Ưu đãi',
     trangThai        VARCHAR(30)   NOT NULL DEFAULT N'Đang áp dụng',
     ngayTao          TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
     CONSTRAINT chk_uudai_phantram CHECK (phanTramGiam BETWEEN 1 AND 100),
     CONSTRAINT chk_uudai_songay CHECK (soNgayHieuLuc >= 1),
     CONSTRAINT chk_uudai_solan CHECK (soLanDungToiDa >= 1)
   )`,
  `CREATE TABLE IF NOT EXISTS CHUONGTRINHPHIEU (
     maCTPG             SERIAL PRIMARY KEY,
     maCode             VARCHAR(40) NOT NULL UNIQUE,
     tieuDe             VARCHAR(150) NOT NULL,
     doiTuong           VARCHAR(30) NOT NULL,
     phanTramGiam       INTEGER NOT NULL,
     giamToiDa          NUMERIC(18,2) NULL,
     soLuongToiDa       INTEGER NULL,
     soLuongDaDung      INTEGER NOT NULL DEFAULT 0,
     trangThai          VARCHAR(30) NOT NULL DEFAULT N'Đang áp dụng',
     daThongBaoHetLuot  BOOLEAN NOT NULL DEFAULT FALSE,
     ngayTao            TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
     ngayHetHan         TIMESTAMP NULL,
     CONSTRAINT chk_ctpg_phantram CHECK (phanTramGiam BETWEEN 1 AND 100),
     CONSTRAINT chk_ctpg_soluong CHECK (soLuongToiDa IS NULL OR soLuongToiDa >= 1)
   )`,
  `CREATE TABLE IF NOT EXISTS PHIEUGIAMGIA (
     maPG             SERIAL        PRIMARY KEY,
     maKH             INTEGER       NOT NULL REFERENCES KHACHHANG(maKH) ON DELETE CASCADE,
     maCode           VARCHAR(40)   NOT NULL UNIQUE,
     maUD             INTEGER       NULL REFERENCES UUDAI(maUD) ON DELETE SET NULL,
     maCTPG           INTEGER       NULL REFERENCES CHUONGTRINHPHIEU(maCTPG) ON DELETE SET NULL,
     tieuDe           VARCHAR(150)  NOT NULL,
     moTa             VARCHAR(255)  NULL,
     phanTramGiam     INTEGER       NOT NULL,
     giamToiDa        NUMERIC(18,2) NULL,
     soLanSuDungToiDa INTEGER       NOT NULL DEFAULT 1,
     soLanDaSuDung    INTEGER       NOT NULL DEFAULT 0,
     loai             VARCHAR(40)   NOT NULL DEFAULT N'Khác',
     trangThai        VARCHAR(30)   NOT NULL DEFAULT N'Chưa dùng',
     ngayTao          TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
     ngayHetHan       TIMESTAMP     NULL,
     CONSTRAINT chk_phieugiamgia_phantram CHECK (phanTramGiam BETWEEN 1 AND 100),
     CONSTRAINT chk_phieugiamgia_solan CHECK (soLanDaSuDung >= 0 AND soLanSuDungToiDa >= 1)
   )`,
  `CREATE INDEX IF NOT EXISTS idx_phieugiamgia_kh ON PHIEUGIAMGIA (maKH, trangThai)`,
  `ALTER TABLE DONHANG ADD COLUMN IF NOT EXISTS maPG INTEGER NULL REFERENCES PHIEUGIAMGIA(maPG) ON DELETE SET NULL`,
  `ALTER TABLE DONHANG ADD COLUMN IF NOT EXISTS tienGiamPhieu NUMERIC(18,2) NOT NULL DEFAULT 0`,
  `ALTER TABLE KHAOSAT ADD COLUMN IF NOT EXISTS loaiPhanThuong VARCHAR(30) NOT NULL DEFAULT N'Điểm'`,
  `ALTER TABLE KHAOSAT ADD COLUMN IF NOT EXISTS giaTriPhanThuong INTEGER NOT NULL DEFAULT 5`,
  `ALTER TABLE KHAOSAT ADD COLUMN IF NOT EXISTS giamToiDa NUMERIC(18,2) NULL`,
  `ALTER TABLE KHAOSAT ADD COLUMN IF NOT EXISTS soLuongToiDa INTEGER NULL`,
  `ALTER TABLE KHAOSAT ADD COLUMN IF NOT EXISTS daGui BOOLEAN NOT NULL DEFAULT FALSE`,
  `ALTER TABLE KHAOSAT ADD COLUMN IF NOT EXISTS kieuHetHanPhieu VARCHAR(30) NOT NULL DEFAULT N'Không giới hạn'`,
  `ALTER TABLE KHAOSAT ADD COLUMN IF NOT EXISTS soNgayHieuLucPhieu INTEGER NULL`,
  `ALTER TABLE KHAOSAT ADD COLUMN IF NOT EXISTS ngayHetHanPhieu DATE NULL`,
  `CREATE TABLE IF NOT EXISTS THONGBAO (
     maTB     SERIAL        PRIMARY KEY,
     maKH     INTEGER       NOT NULL REFERENCES KHACHHANG(maKH) ON DELETE CASCADE,
     tieuDe   VARCHAR(150)  NOT NULL,
     noiDung  VARCHAR(500)  NULL,
     loai     VARCHAR(40)   NOT NULL DEFAULT N'Thông tin',
     maPG     INTEGER       NULL REFERENCES PHIEUGIAMGIA(maPG) ON DELETE SET NULL,
     maKS     INTEGER       NULL REFERENCES KHAOSAT(maKS) ON DELETE SET NULL,
     daDoc    INTEGER       NOT NULL DEFAULT 0,
     ngayTao  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP
   )`,
  `CREATE INDEX IF NOT EXISTS idx_thongbao_kh ON THONGBAO (maKH, daDoc, ngayTao)`,
  `ALTER TABLE THONGBAO ADD COLUMN IF NOT EXISTS maKM INTEGER NULL REFERENCES KHUYENMAI(maKM) ON DELETE SET NULL`,
  `ALTER TABLE THONGBAO ADD COLUMN IF NOT EXISTS maKS INTEGER NULL REFERENCES KHAOSAT(maKS) ON DELETE SET NULL`,
  `CREATE UNIQUE INDEX IF NOT EXISTS uq_thongbao_khuyenmai_kh ON THONGBAO (maKH, maKM) WHERE maKM IS NOT NULL`,
  `CREATE TABLE IF NOT EXISTS THONGBAONOIBO (
     maTBNB   SERIAL PRIMARY KEY,
     maTK     INTEGER NOT NULL REFERENCES TAIKHOAN(maTK) ON DELETE CASCADE,
     maDH     INTEGER NOT NULL REFERENCES DONHANG(maDH) ON DELETE CASCADE,
     tieuDe   VARCHAR(150) NOT NULL,
     noiDung  VARCHAR(500) NULL,
     daDoc    BOOLEAN NOT NULL DEFAULT FALSE,
     ngayTao  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
     CONSTRAINT uq_thongbaonoibo_tk_dh UNIQUE (maTK, maDH)
   )`,
  `CREATE INDEX IF NOT EXISTS idx_thongbaonoibo_tk ON THONGBAONOIBO (maTK, daDoc, ngayTao)`,
  `ALTER TABLE PHIEUGIAMGIA ADD COLUMN IF NOT EXISTS maUD INTEGER NULL`,
  `ALTER TABLE PHIEUGIAMGIA ADD COLUMN IF NOT EXISTS maCTPG INTEGER NULL REFERENCES CHUONGTRINHPHIEU(maCTPG) ON DELETE SET NULL`,
  `ALTER TABLE PHIEUGIAMGIA ALTER COLUMN moTa TYPE VARCHAR(500)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS uq_phieugiamgia_chuongtrinh_kh ON PHIEUGIAMGIA (maCTPG, maKH) WHERE maCTPG IS NOT NULL`,
];

/** Câu lệnh chèn cấu hình mặc định cho PostgreSQL. */
const SEED_POSTGRES = [
  `INSERT INTO UUDAI (maCode, tenUD, moTa, phanTramGiam, soNgayHieuLuc, soLanDungToiDa, loai, trangThai)
   VALUES
     (N'${MA_UU_DAI_SINH_NHAT}', N'Ưu đãi sinh nhật', N'Giảm 50% cho 1 ly, tặng tự động vào đúng ngày sinh nhật, mỗi năm một lần.', 50, 3, 1, N'Ưu đãi', N'Đang áp dụng')
   ON CONFLICT (maCode) DO NOTHING`,
];

/** Đoạn DDL cho SQLite. */
const DDL_SQLITE = [
  `UPDATE NHANVIEN SET chucVu = 'Nhân viên bán hàng' WHERE chucVu = 'Nhân viên quản lý đơn'`,
  `CREATE TABLE IF NOT EXISTS UUDAI (
     maUD             INTEGER PRIMARY KEY AUTOINCREMENT,
     maCode           TEXT    NOT NULL UNIQUE,
     tenUD            TEXT    NOT NULL,
     moTa             TEXT    NULL,
     phanTramGiam     INTEGER NOT NULL,
     soNgayHieuLuc    INTEGER NOT NULL DEFAULT 3,
     soLanDungToiDa   INTEGER NOT NULL DEFAULT 1,
     loai             TEXT    NOT NULL DEFAULT 'Ưu đãi',
     trangThai        TEXT    NOT NULL DEFAULT 'Đang áp dụng',
     ngayTao          TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
     CHECK (phanTramGiam BETWEEN 1 AND 100),
     CHECK (soNgayHieuLuc >= 1),
     CHECK (soLanDungToiDa >= 1)
   )`,
  `CREATE TABLE IF NOT EXISTS CHUONGTRINHPHIEU (
     maCTPG             INTEGER PRIMARY KEY AUTOINCREMENT,
     maCode             TEXT NOT NULL UNIQUE,
     tieuDe             TEXT NOT NULL,
     doiTuong           TEXT NOT NULL,
     phanTramGiam       INTEGER NOT NULL,
     giamToiDa          REAL NULL,
     soLuongToiDa       INTEGER NULL,
     soLuongDaDung      INTEGER NOT NULL DEFAULT 0,
     trangThai          TEXT NOT NULL DEFAULT 'Đang áp dụng',
     daThongBaoHetLuot  INTEGER NOT NULL DEFAULT 0,
     ngayTao            TEXT NOT NULL DEFAULT (datetime('now','localtime')),
     ngayHetHan         TEXT NULL,
     CHECK (phanTramGiam BETWEEN 1 AND 100),
     CHECK (soLuongToiDa IS NULL OR soLuongToiDa >= 1)
   )`,
  `CREATE TABLE IF NOT EXISTS PHIEUGIAMGIA (
     maPG             INTEGER PRIMARY KEY AUTOINCREMENT,
     maKH             INTEGER NOT NULL REFERENCES KHACHHANG(maKH) ON DELETE CASCADE,
     maCode           TEXT    NOT NULL UNIQUE,
     maUD             INTEGER NULL REFERENCES UUDAI(maUD) ON DELETE SET NULL,
     maCTPG           INTEGER NULL REFERENCES CHUONGTRINHPHIEU(maCTPG) ON DELETE SET NULL,
     tieuDe           TEXT    NOT NULL,
     moTa             TEXT    NULL,
     phanTramGiam     INTEGER NOT NULL,
     giamToiDa        REAL    NULL,
     soLanSuDungToiDa INTEGER NOT NULL DEFAULT 1,
     soLanDaSuDung    INTEGER NOT NULL DEFAULT 0,
     loai             TEXT    NOT NULL DEFAULT 'Khác',
     trangThai        TEXT    NOT NULL DEFAULT 'Chưa dùng',
     ngayTao          TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
     ngayHetHan       TEXT    NULL,
     CHECK (phanTramGiam BETWEEN 1 AND 100),
     CHECK (soLanDaSuDung >= 0 AND soLanSuDungToiDa >= 1)
   )`,
  `CREATE INDEX IF NOT EXISTS idx_phieugiamgia_kh ON PHIEUGIAMGIA (maKH, trangThai)`,
  `CREATE TABLE IF NOT EXISTS THONGBAO (
     maTB     INTEGER PRIMARY KEY AUTOINCREMENT,
     maKH     INTEGER NOT NULL REFERENCES KHACHHANG(maKH) ON DELETE CASCADE,
     tieuDe   TEXT    NOT NULL,
     noiDung  TEXT    NULL,
     loai     TEXT    NOT NULL DEFAULT 'Thông tin',
     maPG     INTEGER NULL REFERENCES PHIEUGIAMGIA(maPG) ON DELETE SET NULL,
     maKS     INTEGER NULL REFERENCES KHAOSAT(maKS) ON DELETE SET NULL,
     daDoc    INTEGER NOT NULL DEFAULT 0,
     ngayTao  TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
   )`,
  `CREATE INDEX IF NOT EXISTS idx_thongbao_kh ON THONGBAO (maKH, daDoc, ngayTao)`,
  `CREATE TABLE IF NOT EXISTS THONGBAONOIBO (
     maTBNB INTEGER PRIMARY KEY AUTOINCREMENT,
     maTK INTEGER NOT NULL REFERENCES TAIKHOAN(maTK) ON DELETE CASCADE,
     maDH INTEGER NOT NULL REFERENCES DONHANG(maDH) ON DELETE CASCADE,
     tieuDe TEXT NOT NULL,
     noiDung TEXT NULL,
     daDoc INTEGER NOT NULL DEFAULT 0,
     ngayTao TEXT NOT NULL DEFAULT (datetime('now','localtime')),
     UNIQUE (maTK, maDH)
   )`,
  `CREATE INDEX IF NOT EXISTS idx_thongbaonoibo_tk ON THONGBAONOIBO (maTK, daDoc, ngayTao)`,
];

/** Câu lệnh chèn cấu hình mặc định cho SQLite. */
const SEED_SQLITE = [
  `INSERT OR IGNORE INTO UUDAI (maCode, tenUD, moTa, phanTramGiam, soNgayHieuLuc, soLanDungToiDa, loai, trangThai)
   VALUES
     ('${MA_UU_DAI_SINH_NHAT}', 'Ưu đãi sinh nhật',
      'Giảm 50% cho 1 ly, tặng tự động vào đúng ngày sinh nhật, mỗi năm một lần.',
      50, 3, 1, 'Ưu đãi', 'Đang áp dụng')`,
];

/**
 * Tạo các bảng mới và chèn cấu hình mặc định nếu chưa có.
 * An toàn khi gọi lặp lại.
 */
async function chayNangCapLuocDo() {
  const laPostgres = db.getClient() === 'postgres';
  const cacCauLenh = laPostgres ? DDL_POSTGRES : DDL_SQLITE;
  const cacSeed = laPostgres ? SEED_POSTGRES : SEED_SQLITE;

  let soCauLenh = 0;
  let soSeed = 0;

  for (const cauLenh of cacCauLenh) {
    await db.run(cauLenh);
    soCauLenh += 1;
  }
  if (!laPostgres) {
    const cotPhieu = await db.all('PRAGMA table_info(PHIEUGIAMGIA)');
    if (!cotPhieu.some((cot) => cot.name === 'maCTPG')) {
      await db.run('ALTER TABLE PHIEUGIAMGIA ADD COLUMN maCTPG INTEGER NULL REFERENCES CHUONGTRINHPHIEU(maCTPG) ON DELETE SET NULL');
    }
    await db.run('CREATE UNIQUE INDEX IF NOT EXISTS uq_phieugiamgia_chuongtrinh_kh ON PHIEUGIAMGIA (maCTPG, maKH) WHERE maCTPG IS NOT NULL');
    const cotKhaoSat = await db.all('PRAGMA table_info(KHAOSAT)');
    if (!cotKhaoSat.some((cot) => cot.name === 'loaiPhanThuong')) {
      await db.run("ALTER TABLE KHAOSAT ADD COLUMN loaiPhanThuong TEXT NOT NULL DEFAULT 'Điểm'");
    }
    if (!cotKhaoSat.some((cot) => cot.name === 'giaTriPhanThuong')) {
      await db.run('ALTER TABLE KHAOSAT ADD COLUMN giaTriPhanThuong INTEGER NOT NULL DEFAULT 5');
    }
    if (!cotKhaoSat.some((cot) => cot.name === 'giamToiDa')) {
      await db.run('ALTER TABLE KHAOSAT ADD COLUMN giamToiDa REAL NULL');
    }
    if (!cotKhaoSat.some((cot) => cot.name === 'soLuongToiDa')) {
      await db.run('ALTER TABLE KHAOSAT ADD COLUMN soLuongToiDa INTEGER NULL');
    }
    if (!cotKhaoSat.some((cot) => cot.name === 'daGui')) {
      await db.run('ALTER TABLE KHAOSAT ADD COLUMN daGui INTEGER NOT NULL DEFAULT 0');
    }
    if (!cotKhaoSat.some((cot) => cot.name === 'kieuHetHanPhieu')) await db.run("ALTER TABLE KHAOSAT ADD COLUMN kieuHetHanPhieu TEXT NOT NULL DEFAULT 'Không giới hạn'");
    if (!cotKhaoSat.some((cot) => cot.name === 'soNgayHieuLucPhieu')) await db.run('ALTER TABLE KHAOSAT ADD COLUMN soNgayHieuLucPhieu INTEGER NULL');
    if (!cotKhaoSat.some((cot) => cot.name === 'ngayHetHanPhieu')) await db.run('ALTER TABLE KHAOSAT ADD COLUMN ngayHetHanPhieu TEXT NULL');
    const cotThongBao = await db.all('PRAGMA table_info(THONGBAO)');
    if (!cotThongBao.some((cot) => cot.name === 'maKS')) await db.run('ALTER TABLE THONGBAO ADD COLUMN maKS INTEGER NULL REFERENCES KHAOSAT(maKS) ON DELETE SET NULL');
  }
  for (const cauLenh of cacSeed) {
    await db.run(cauLenh);
    soSeed += 1;
  }

  return { he: db.getClient(), soCauLenh, soSeed };
}

module.exports = {
  chayNangCapLuocDo,
  MA_UU_DAI_SINH_NHAT,
  DDL_POSTGRES,
  DDL_SQLITE,
  SEED_POSTGRES,
  SEED_SQLITE,
};
