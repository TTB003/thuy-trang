'use strict';

/* In hình dạng hai cấp của các phản hồi báo cáo để đối chiếu với giao diện. */

const GOC = 'http://127.0.0.1:3000';

const DUONG_DAN = [
  '/api/phanhoi/thong-ke',
  '/api/baocao/dashboard',
  '/api/baocao/doanh-thu',
  '/api/baocao/san-pham-ban-chay',
  '/api/baocao/ton-kho',
  '/api/baocao/khach-hang',
  '/api/baocao/khach-hang-than-thiet',
  '/api/baocao/nhap-hang',
  '/api/admin/he-thong',
  '/api/admin/taikhoan/thong-ke',
  '/api/admin/toan-ven',
  '/api/sanpham/canh-bao-ton',
  '/api/khachhang/hoat-dong',
];

/** In hình dạng của một giá trị, đi sâu tối đa hai cấp. */
function moTa(giaTri, sauDo = 0) {
  if (giaTri === null || giaTri === undefined) return String(giaTri);
  if (Array.isArray(giaTri)) {
    if (giaTri.length === 0) return 'array(0)';
    return `array(${giaTri.length}) -> ${sauDo >= 2 ? '…' : moTa(giaTri[0], sauDo + 1)}`;
  }
  if (typeof giaTri === 'object') {
    if (sauDo >= 2) return '{…}';
    const phan = Object.entries(giaTri)
      .slice(0, 16)
      .map(([k, v]) => `${k}: ${moTa(v, sauDo + 1)}`);
    return `{\n        ${phan.join('\n        ')}\n      }`;
  }
  return typeof giaTri;
}

async function main() {
  const dangNhap = await fetch(`${GOC}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ tenDangNhap: 'admin', matKhau: 'Admin@123' }),
  });
  const cookie = (dangNhap.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]).join('; ');

  for (const duongDan of DUONG_DAN) {
    const phanHoi = await fetch(`${GOC}${duongDan}`, { headers: { cookie } });
    const goi = await phanHoi.json().catch(() => null);
    const duLieu = goi && 'data' in goi ? goi.data : goi;
    console.log(`\n=== ${duongDan}\n    ${moTa(duLieu)}`);
  }
}

main().catch((loi) => {
  console.error(loi);
  process.exitCode = 1;
});
