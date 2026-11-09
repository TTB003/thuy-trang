/**
 * Ánh xạ tên cột về đúng dạng viết hoa/thường của ứng dụng.
 *
 * PostgreSQL chuyển mọi định danh không được trích dẫn về chữ thường, nên kết
 * quả truy vấn trả về `maloai`, `tensp`... trong khi ứng dụng dùng `maLoai`,
 * `tenSP`. Module này dựng bảng ánh xạ chữ thường -> tên chuẩn, lấy từ hai
 * nguồn:
 *   1. Danh sách bảng/cột trong database/schema.sql (nguồn chuẩn).
 *   2. Các bí danh (alias) xuất hiện dạng `AS tenBíDanh` trong mã nguồn.
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { config } = require('../config');

/** Thư mục chứa mã nguồn cần quét để tìm bí danh. */
const THU_MUC_QUET = ['src/db', 'src/services', 'src/core', 'src/routes'];

/** Đọc schema.sql và trích ra tên cột của từng bảng. */
function docCotTuSchema() {
  if (!fs.existsSync(config.schemaFile)) return [];
  const noiDung = fs.readFileSync(config.schemaFile, 'utf8');
  const tenCot = new Set();

  const khoiBang = noiDung.match(/CREATE TABLE\s+\w+\s*\(([\s\S]*?)\n\);/g) ?? [];
  khoiBang.forEach((khoi) => {
    const than = khoi.slice(khoi.indexOf('(') + 1);
    than.split('\n').forEach((dong) => {
      const dongSach = dong.replace(/--.*$/, '').trim();
      if (!dongSach) return;
      if (/^(FOREIGN|PRIMARY|UNIQUE|CHECK|CONSTRAINT)\b/i.test(dongSach)) return;
      const khop = /^([A-Za-z_][A-Za-z0-9_]*)\s+/.exec(dongSach);
      if (khop) tenCot.add(khop[1]);
    });
  });
  return [...tenCot];
}

/** Quét mã nguồn để lấy các bí danh dùng trong mệnh đề SELECT ... AS ten. */
function docBidanhTuMaNguon() {
  const tenBidanh = new Set();
  const regexAlias = /\bAS\s+([A-Za-z_][A-Za-z0-9_]*)/g;

  const duyet = (thuMuc) => {
    const duongDan = path.join(config.rootDir, thuMuc);
    if (!fs.existsSync(duongDan)) return;
    fs.readdirSync(duongDan, { withFileTypes: true }).forEach((muc) => {
      const duongDanCon = path.join(duongDan, muc.name);
      if (muc.isDirectory()) {
        duyet(path.join(thuMuc, muc.name));
        return;
      }
      if (!muc.name.endsWith('.js')) return;
      const noiDung = fs.readFileSync(duongDanCon, 'utf8');
      let khop = regexAlias.exec(noiDung);
      while (khop) {
        tenBidanh.add(khop[1]);
        khop = regexAlias.exec(noiDung);
      }
      regexAlias.lastIndex = 0;
    });
  };

  THU_MUC_QUET.forEach(duyet);
  return [...tenBidanh];
}

/** @type {Map<string, string>} chữ thường -> tên chuẩn */
let bangAnhXa = null;
/** @type {Set<string>} các khóa lạ đã gặp (chỉ cảnh báo một lần) */
const khoaLaDaGap = new Set();

/** Dựng bảng ánh xạ (chỉ chạy một lần). */
function layBangAnhXa() {
  if (bangAnhXa) return bangAnhXa;
  bangAnhXa = new Map();
  const tatCa = [...docCotTuSchema(), ...docBidanhTuMaNguon()];
  tatCa.forEach((ten) => {
    const khoa = ten.toLowerCase();
    // Ưu tiên tên đã có; không ghi đè để giữ nguồn chuẩn đầu tiên.
    if (!bangAnhXa.has(khoa)) bangAnhXa.set(khoa, ten);
  });
  return bangAnhXa;
}

/**
 * Chuẩn hóa khóa của một dòng dữ liệu về đúng dạng của ứng dụng.
 * @param {Record<string, unknown>} row
 * @returns {Record<string, unknown>}
 */
function chuanHoaDong(row) {
  if (!row || typeof row !== 'object') return row;
  const anhXa = layBangAnhXa();
  const ketQua = {};
  Object.keys(row).forEach((khoa) => {
    const tenChuan = anhXa.get(khoa.toLowerCase());
    if (tenChuan) {
      ketQua[tenChuan] = row[khoa];
    } else {
      // Không tìm thấy tên chuẩn: giữ nguyên khóa và ghi nhận để kiểm tra.
      ketQua[khoa] = row[khoa];
      if (khoa === khoa.toLowerCase() && !khoaLaDaGap.has(khoa)) {
        khoaLaDaGap.add(khoa);
        console.warn(`[CSDL] Cột "${khoa}" chưa có trong bảng ánh xạ tên cột.`);
      }
    }
  });
  return ketQua;
}

/** Chuẩn hóa danh sách dòng. */
function chuanHoaNhieuDong(rows) {
  return Array.isArray(rows) ? rows.map(chuanHoaDong) : rows;
}

/** Danh sách khóa lạ đã gặp (dùng cho script kiểm tra). */
function layKhoaLa() {
  return [...khoaLaDaGap];
}

/** Xóa bộ nhớ đệm (dùng khi cần dựng lại bảng ánh xạ). */
function xoaBoNhoDem() {
  bangAnhXa = null;
  khoaLaDaGap.clear();
}

module.exports = { chuanHoaDong, chuanHoaNhieuDong, layBangAnhXa, layKhoaLa, xoaBoNhoDem };
