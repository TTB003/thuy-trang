'use strict';

/* In JSON của phần tử đầu tiên trong mỗi mảng dữ liệu để đối chiếu tên trường. */

const GOC = 'http://127.0.0.1:3000';

const DUONG_DAN = [
  '/api/sanpham?pageSize=1',
  '/api/loaisanpham',
  '/api/nhacungcap',
  '/api/nhanvien?pageSize=1',
  '/api/khachhang?pageSize=1',
  '/api/phieunhap?pageSize=1',
  '/api/donhang?pageSize=1',
  '/api/diem/lich-su?pageSize=1',
  '/api/khuyenmai?pageSize=1',
  '/api/phanhoi?pageSize=1',
  '/api/khaosat?pageSize=1',
  '/api/admin/taikhoan?pageSize=1',
];

/** In phần tử đầu tiên của mảng (nếu có) dưới dạng JSON gọn. */
function inDau(duongDan, duLieu) {
  const mang = Array.isArray(duLieu) ? duLieu : duLieu?.items;
  if (!Array.isArray(mang) || mang.length === 0) {
    console.log(`\n=== ${duongDan}: (rỗng)`);
    return;
  }
  console.log(`\n=== ${duongDan}`);
  console.log(JSON.stringify(mang[0], null, 2));
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
    inDau(duongDan, goi && 'data' in goi ? goi.data : goi);
  }

  // Danh sách con trong báo cáo
  const baoCao = [
    '/api/baocao/dashboard',
    '/api/baocao/doanh-thu',
    '/api/baocao/san-pham-ban-chay',
    '/api/baocao/ton-kho',
    '/api/baocao/khach-hang',
    '/api/baocao/khach-hang-than-thiet',
    '/api/baocao/nhap-hang',
    '/api/phanhoi/thong-ke',
    '/api/sanpham/canh-bao-ton',
    '/api/admin/taikhoan/thong-ke',
  ];
  for (const duongDan of baoCao) {
    const phanHoi = await fetch(`${GOC}${duongDan}`, { headers: { cookie } });
    const goi = await phanHoi.json().catch(() => null);
    const duLieu = goi && 'data' in goi ? goi.data : goi;
    console.log(`\n=== ${duongDan}`);
    console.log(JSON.stringify(duLieu, null, 2).slice(0, 2600));
  }
}

main().catch((loi) => {
  console.error(loi);
  process.exitCode = 1;
});
