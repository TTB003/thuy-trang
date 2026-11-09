'use strict';

/* Tìm khách còn khảo sát chưa trả lời và in cấu trúc câu hỏi trả về. */

const GOC = 'http://127.0.0.1:3000';

async function dangNhap(tenDangNhap, matKhau) {
  const phanHoi = await fetch(`${GOC}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ tenDangNhap, matKhau }),
  });
  if (!phanHoi.ok) return null;
  return (phanHoi.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]).join('; ');
}

async function main() {
  for (let i = 2; i <= 12; i += 1) {
    const sdt = `091200000${String(i).padStart(2, '0')}`;
    const cookie = await dangNhap(sdt, 'Khach@123');
    if (!cookie) continue;
    const phanHoi = await fetch(`${GOC}/api/cua-toi/khaosat`, { headers: { cookie } });
    if (!phanHoi.ok) continue;
    const goi = await phanHoi.json();
    const danhSach = goi?.data ?? [];
    const chuaTraLoi = danhSach.filter((ks) => !ks.daTraLoi);
    if (chuaTraLoi.length === 0) continue;
    console.log(`\n=== ${sdt} — ${chuaTraLoi.length} khảo sát chưa trả lời`);
    console.log(JSON.stringify(chuaTraLoi[0], null, 2).slice(0, 1800));
    return;
  }
  console.log('Không tìm được khách nào còn khảo sát chưa trả lời.');
}

main().catch((loi) => {
  console.error(loi);
  process.exitCode = 1;
});
