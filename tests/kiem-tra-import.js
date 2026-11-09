'use strict';

/*
 * Kiểm tra tĩnh: mọi tên được import trong public/js phải thực sự được export
 * từ mô-đun đích. Bắt lỗi gõ sai tên mà `node --check` không phát hiện.
 */

const fs = require('node:fs');
const path = require('node:path');

const GOC = path.resolve(__dirname, '..');
const THU_MUC = path.join(GOC, 'public', 'js');

function lietKeJs(thuMuc) {
  const ketQua = [];
  for (const muc of fs.readdirSync(thuMuc, { withFileTypes: true })) {
    const duongDan = path.join(thuMuc, muc.name);
    if (muc.isDirectory()) ketQua.push(...lietKeJs(duongDan));
    else if (muc.name.endsWith('.js')) ketQua.push(duongDan);
  }
  return ketQua;
}

/** Tập hợp tên được export từ một tệp. */
function layExport(noiDung) {
  const ten = new Set();
  const mau = [
    /export\s+(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/g,
    /export\s+const\s+([A-Za-z_$][\w$]*)/g,
    /export\s+let\s+([A-Za-z_$][\w$]*)/g,
    /export\s+var\s+([A-Za-z_$][\w$]*)/g,
    /export\s+class\s+([A-Za-z_$][\w$]*)/g,
    /export\s+default\b/g,
  ];
  for (const re of mau) {
    for (const khop of noiDung.matchAll(re)) if (khop[1]) ten.add(khop[1]);
  }
  for (const khop of noiDung.matchAll(/export\s*\{([^}]*)\}/g)) {
    for (const phan of khop[1].split(',')) {
      const chuoi = phan.trim();
      if (!chuoi) continue;
      const doiTen = chuoi.split(/\s+as\s+/);
      ten.add((doiTen[1] ?? doiTen[0]).trim());
    }
  }
  return ten;
}

/** Danh sách { ten, nguon } cho mỗi câu lệnh import tĩnh. */
function layImport(noiDung) {
  const ketQua = [];
  const re = /import\s+(?:([A-Za-z_$][\w$]*)\s*,?\s*)?(?:\{([^}]*)\})?\s*from\s*['"]([^'"]+)['"]/g;
  for (const khop of noiDung.matchAll(re)) {
    const macDinh = khop[1] ?? null;
    const dsTen = khop[2] ?? '';
    const nguon = khop[3];
    const ten = [];
    if (macDinh) ten.push('default');
    for (const phan of dsTen.split(',')) {
      const chuoi = phan.trim();
      if (!chuoi) continue;
      ten.push(chuoi.split(/\s+as\s+/)[0].trim());
    }
    ketQua.push({ ten, nguon });
  }
  return ketQua;
}

const cacTep = lietKeJs(THU_MUC);
const boNhoExport = new Map();
for (const tep of cacTep) {
  boNhoExport.set(path.resolve(tep), layExport(fs.readFileSync(tep, 'utf8')));
}

let soLoi = 0;
for (const tep of cacTep) {
  const noiDung = fs.readFileSync(tep, 'utf8');
  for (const { ten, nguon } of layImport(noiDung)) {
    if (!nguon.startsWith('.')) continue; // thư viện ngoài
    const dich = path.resolve(path.dirname(tep), nguon);
    if (!fs.existsSync(dich)) {
      soLoi += 1;
      console.log(`THIEU-TEP  ${path.relative(GOC, tep)} -> ${nguon}`);
      continue;
    }
    const coSan = boNhoExport.get(dich) ?? new Set();
    for (const tenImport of ten) {
      if (!coSan.has(tenImport)) {
        soLoi += 1;
        console.log(
          `THIEU-EXPORT  ${path.relative(GOC, tep)}  import {${tenImport}} from '${nguon}'`
        );
      }
    }
  }
}

console.log(`\nTong: ${cacTep.length} tep, ${soLoi} loi import.`);
process.exitCode = soLoi === 0 ? 0 : 1;
