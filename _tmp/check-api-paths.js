'use strict';

/*
 * Trích mọi đường dẫn API tĩnh trong public/js rồi gọi thử bằng tài khoản admin.
 * Bắt các đường dẫn gõ sai hoặc không tồn tại ở máy chủ.
 */

const fs = require('node:fs');
const path = require('node:path');

const GOC = 'http://127.0.0.1:3000';
const THU_MUC_TRANG = path.resolve(__dirname, '..', 'public', 'js');

function lietKeJs(thuMuc) {
  const ketQua = [];
  for (const muc of fs.readdirSync(thuMuc, { withFileTypes: true })) {
    const duongDan = path.join(thuMuc, muc.name);
    if (muc.isDirectory()) ketQua.push(...lietKeJs(duongDan));
    else if (muc.name.endsWith('.js')) ketQua.push(duongDan);
  }
  return ketQua;
}

/** Thu thập đường dẫn API tĩnh trong mã nguồn giao diện. */
function thuThapDuongDan() {
  const tap = new Set();
  for (const tep of lietKeJs(THU_MUC_TRANG)) {
    const noiDung = fs.readFileSync(tep, 'utf8');
    for (const khop of noiDung.matchAll(/['"`](\/api\/[^'"`\s]*)['"`]/g)) {
      const duongDan = khop[1];
      if (!duongDan.includes('${')) tap.add(duongDan);
    }
  }
  return [...tap].sort();
}

async function main() {
  const dangNhap = await fetch(`${GOC}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ tenDangNhap: 'admin', matKhau: 'Admin@123' }),
  });
  const cookie = (dangNhap.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]).join('; ');
  if (!dangNhap.ok) throw new Error(`Dang nhap that bai: ${dangNhap.status}`);

  let soLoi = 0;
  for (const duongDan of thuThapDuongDan()) {
    let phanHoi;
    try {
      phanHoi = await fetch(`${GOC}${duongDan}`, { headers: { cookie } });
    } catch (loi) {
      soLoi += 1;
      console.log(`ERR  ${duongDan}  ${loi.message}`);
      continue;
    }
    const kieu = phanHoi.headers.get('content-type') ?? '';
    const than = kieu.includes('json') ? await phanHoi.json().catch(() => null) : null;
    // 405: có route nhưng sai phương thức (bình thường với POST/PUT/PATCH/DELETE).
    // 403: thiếu quyền hoặc sai vai trò.
    if (phanHoi.status >= 400 && phanHoi.status !== 405 && phanHoi.status !== 403) {
      soLoi += 1;
      console.log(`${phanHoi.status}  ${duongDan}  <-- ${than?.message ?? ''}`);
    } else {
      console.log(`${phanHoi.status}  ${duongDan}`);
    }
  }
  console.log(`\nTong loi: ${soLoi}`);
}

main().catch((loi) => {
  console.error(loi);
  process.exitCode = 1;
});
