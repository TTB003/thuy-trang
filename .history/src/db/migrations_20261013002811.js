/**
 * Nâng cấp lược đồ cho các bảng mới (thông báo khách hàng và phiếu giảm giá).
 *
 * Chạy lúc khởi động máy chủ với `CREATE TABLE IF NOT EXISTS` nên an toàn với
 * cơ sở dữ liệu đã có dữ liệu (không xoá hay tạo lại bảng cũ).
 */
'use strict';

const db = require('./index');

/** Đoạn DDL cho PostgreSQL. */
const DDL_POSTGRES = [
  `CREATE TABLE IF NOT EXISTS PHIEUGIAMGIA (
     maPG             SERIAL        PRIMARY KEY,
     maKH             INTEGER       NOT NULL REFERENCES KHACHHANG(maKH) ON DELETE CASCADE,
     maCode           VARCHAR(40)   NOT NULL UNIQUE,
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
];

/** Đoạn DDL cho SQLite. */
const DDL_SQLITE = [
  `CREATE TABLE IF NOT EXISTS PHIEUGIAMGIA (
     maPG             INTEGER PRIMARY KEY AUTOINCREMENT,
     maKH             INTEGER NOT NULL REFERENCES KHACHHANG(maKH) ON DELETE CASCADE,
     maCode           TEXT    NOT NULL UNIQUE,
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

/** Tạo hai bảng mới nếu chưa có. An toàn khi gọi lặp lại. */
async function chayNangCapLuocDo() {
  const laPostgres = db.getClient() === 'postgres';
  const cacCauLenh = laPostgres ? DDL_POSTGRES : DDL_SQLITE;
  for (const cauLenh of cacCauLenh) {
    await db.run(cauLenh);
  }
  return { he: db.getClient(), soCauLenh: cacCauLenh.length };
}

module.exports = { chayNangCapLuocDo, DDL_POSTGRES, DDL_SQLITE };
