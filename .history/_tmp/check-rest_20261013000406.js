'use strict';

/* Kiểm tra danh sách sao lưu và toàn bộ API của cổng khách hàng. */

const GOC = 'http://127.0.0.1:3000';

async function dangNhap(tenDangNhap, matKhau) {
  const phanHoi = await fetch(`${GOC}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ tenDangNhap, matKhau }),
  });
  if (!phanHoi.ok) throw new Error(`Dang nhap ${tenDangNhap} that bai: ${phanHoi.status}`);
  return (phanHoi.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]).join('; ');
}

async function goi(duongDan, cookie) {
  const phanHoi = await fetch(`${GOC}${duongDan}`, { headers: { cookie } });
  const goi_ = await phanHoi.json().catch(() => null);
  return { ma: phanHoi.status, duLieu: goi_ && 'data' in goi_ ? goi_.data : goi_ };
}

async function main() {
  const cookieAdmin = await dangNhap('admin', 'Admin@123');
  const saoLuu = await goi('/api/admin/sao-luu', cookieAdmin);
  console.log('=== /api/admin/sao-luu');
  console.log(`  soBan: ${saoLuu.duLieu?.danhSach?.length ?? 0}`);
  console.log(`  phan tu dau: ${JSON.stringify(saoLuu.duLieu?.danhSach?.[0] ?? null)}`);

  const cookieKhach = await dangNhap('0912000001', 'Khach@123');
  console.log('\n=== CỔNG KHÁCH HÀNG (0912000001)');
  for (const duongDan of [
    '/api/cua-toi/ho-so',
    '/api/cua-toi/don-hang?pageSize=2',
    '/api/cua-toi/diem?pageSize=2',
    '/api/cua-toi/phan-hoi?pageSize=2',
    '/api/cua-toi/khaosat',
  ]) {
    const { ma, duLieu } = await goi(duongDan, cookieKhach);
    const tomTat = Array.isArray(duLieu)
      ? `array(${duLieu.length}) -> ${JSON.stringify(duLieu[0] ?? null).slice(0, 700)}`
      : JSON.stringify(duLieu).slice(0, 900);
    console.log(`\n${ma}  ${duongDan}\n  ${tomTat}`);
  }

  const chiTietDon = await goi('/api/cua-toi/don-hang/113', cookieKhach);
  console.log(`\n${chiTietDon.ma}  /api/cua-toi/don-hang/113\n  ${JSON.stringify(chiTietDon.duLieu).slice(0, 900)}`);
}

main().catch((loi) => {
  console.error(loi);
  process.exitCode = 1;
});
