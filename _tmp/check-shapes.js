'use strict';

/* In các khóa cấp cao nhất của từng phản hồi API để đối chiếu với giao diện. */

const GOC = 'http://127.0.0.1:3000';

const DUONG_DAN = [
  '/api/auth/me',
  '/api/danh-muc',
  '/api/sanpham?pageSize=2',
  '/api/loaisanpham',
  '/api/nhacungcap',
  '/api/nhanvien?pageSize=2',
  '/api/khachhang?pageSize=2',
  '/api/khachhang/hoat-dong',
  '/api/phieunhap?pageSize=2',
  '/api/donhang?pageSize=2',
  '/api/diem/lich-su?pageSize=2',
  '/api/khuyenmai?pageSize=2',
  '/api/phanhoi?pageSize=2',
  '/api/phanhoi/thong-ke',
  '/api/khaosat?pageSize=2',
  '/api/sanpham/canh-bao-ton',
  '/api/baocao/dashboard',
  '/api/baocao/doanh-thu',
  '/api/baocao/san-pham-ban-chay',
  '/api/baocao/nhap-hang',
  '/api/baocao/ton-kho',
  '/api/baocao/khach-hang',
  '/api/baocao/khach-hang-than-thiet',
  '/api/admin/taikhoan?pageSize=2',
  '/api/admin/taikhoan/thong-ke',
  '/api/admin/sao-luu',
  '/api/admin/he-thong',
  '/api/admin/toan-ven',
];

/** Mô tả ngắn gọn hình dạng của một giá trị. */
function moTa(giaTri) {
  if (giaTri === null) return 'null';
  if (Array.isArray(giaTri)) return `array(${giaTri.length})`;
  if (typeof giaTri === 'object') return `{${Object.keys(giaTri).slice(0, 14).join(', ')}}`;
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
    if (phanHoi.status >= 400) {
      console.log(`${phanHoi.status}  ${duongDan}  <-- ${goi?.message ?? ''}`);
      continue;
    }
    const duLieu = goi && 'data' in goi ? goi.data : goi;
    console.log(`${duongDan}\n    ${moTa(duLieu)}`);
  }
}

main().catch((loi) => {
  console.error(loi);
  process.exitCode = 1;
});
