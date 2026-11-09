/**
 * Kiểm tra cú pháp mọi tệp JS trong public/ bằng `node --check`.
 * Chạy với cwd trỏ vào public/ để Node hiểu đây là ES module.
 */
'use strict';

const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const goc = path.resolve(__dirname, '..');
const thuMucPublic = path.join(goc, 'public');

/** Liệt kê đệ quy mọi tệp .js trong một thư mục. */
function lietKeJs(thuMuc) {
  const ketQua = [];
  for (const muc of fs.readdirSync(thuMuc, { withFileTypes: true })) {
    const duongDan = path.join(thuMuc, muc.name);
    if (muc.isDirectory()) ketQua.push(...lietKeJs(duongDan));
    else if (muc.name.endsWith('.js')) ketQua.push(duongDan);
  }
  return ketQua;
}

const cacTep = lietKeJs(thuMucPublic);
let soLoi = 0;

for (const tep of cacTep) {
  const tenTuongDoi = path.relative(goc, tep).replace(/\\/g, '/');
  try {
    execFileSync(process.execPath, ['--check', tep], { cwd: thuMucPublic, stdio: 'pipe' });
    console.log(`OK   ${tenTuongDoi}`);
  } catch (loi) {
    soLoi += 1;
    console.log(`LOI  ${tenTuongDoi}`);
    console.log(String(loi.stderr ?? loi.message).trim());
  }
}

console.log(`\nTong: ${cacTep.length} tep, ${soLoi} loi cu phap.`);
process.exitCode = soLoi === 0 ? 0 : 1;
