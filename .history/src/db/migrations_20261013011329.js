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
  `CREATE TABLE IF NOT EXISTS PHIEUGIAMGIA (
     maPG             SERIAL        PRIMARY KEY,
     maKH             INTEGER       NOT NULL REFERENCES KHACHHANG(maKH) ON DELETE CASCADE,
     maCode           VARCHAR(40)   NOT NULL UNIQUE,
     maUD             INTEGER       NULL REFERENCES UUDAI(maUD) ON DELETE SET NULL,
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
  `CREATE TABLE IF NOT EXISTS THONGBAO (
     maTB     SERIAL        PRIMARY KEY,
     maKH     INTEGER       NOT NULL REFERENCES KHACHHANG(maKH) ON DELETE CASCADE,
     tieuDe   VARCHAR(150)  NOT NULL,
     noiDung  VARCHAR(500)  NULL,
     loai     VARCHAR(40)   NOT NULL DEFAULT N'Thông tin',
     maPG     INTEGER       NULL REFERENCES PHIEUGIAMGIA(maPG) ON DELETE SET NULL,
     daDoc    INTEGER       NOT NULL DEFAULT 0,
     ngayTao  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP
   )`,
  `CREATE INDEX IF NOT EXISTS idx_thongbao_kh ON THONGBAO (maKH, daDoc, ngayTao)`,
  `ALTER TABLE PHIEUGIAMGIA ADD COLUMN IF NOT EXISTS maUD INTEGER NULL`,
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
  `CREATE TABLE IF NOT EXISTS PHIEUGIAMGIA (
     maPG             INTEGER PRIMARY KEY AUTOINCREMENT,
     maKH             INTEGER NOT NULL REFERENCES KHACHHANG(maKH) ON DELETE CASCADE,
     maCode           TEXT    NOT NULL UNIQUE,
     maUD             INTEGER NULL REFERENCES UUDAI(maUD) ON DELETE SET NULL,
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
     daDoc    INTEGER NOT NULL DEFAULT 0,
     ngayTao  TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
   )`,
  `CREATE INDEX IF NOT EXISTS idx_thongbao_kh ON THONGBAO (maKH, daDoc, ngayTao)`,
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
