'use strict';

/* Đăng nhập bằng cookie rồi gọi các API màn hình dùng, in mã trạng thái. */

const GOC = 'http://127.0.0.1:3000';

async function goi(duongDan, cookie, tuyChon = {}) {
  const phanHoi = await fetch(`${GOC}${duongDan}`, {
    ...tuyChon,
    headers: {
      ...(tuyChon.headers ?? {}),
      ...(cookie ? { cookie } : {}),
    },
  });
  const kieu = phanHoi.headers.get('content-type') ?? '';
  const than = kieu.includes('json') ? await phanHoi.json().catch(() => null) : null;
  return { ma: phanHoi.status, than };
}

async function main() {
  const dangNhap = await fetch(`${GOC}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ tenDangNhap: 'admin', matKhau: 'Admin@123' }),
  });
  const cookie = (dangNhap.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]).join('; ');
  console.log(`ĐĂNG NHẬP: ${dangNhap.status}  cookie=${cookie ? 'có' : 'KHÔNG'}`);
  if (!dangNhap.ok) {
    console.log(JSON.stringify(await dangNhap.text()));
    return;
  }

  const duongDanCan = [
    '/api/auth/me',
    '/api/danh-muc',
    '/api/baocao/dashboard',
    '/api/phanhoi/thong-ke',
    '/api/sanpham/canh-bao-ton',
    '/api/sanpham?pageSize=5',
    '/api/loaisanpham',
    '/api/nhacungcap',
    '/api/nhanvien?pageSize=5',
    '/api/khachhang?pageSize=5',
    '/api/phieunhap?pageSize=5',
    '/api/donhang?pageSize=5',
    '/api/diem/lich-su?pageSize=5',
    '/api/khuyenmai?pageSize=5',
    '/api/phanhoi?pageSize=5',
    '/api/khaosat?pageSize=5',
    '/api/admin/he-thong',
    '/api/admin/tai-khoan?pageSize=5',
    '/api/admin/sao-luu',
    '/api/cua-toi/ho-so',
    '/api/cua-toi/don-hang?pageSize=5',
    '/api/cua-toi/diem?pageSize=5',
    '/api/cua-toi/phan-hoi?pageSize=5',
    '/api/cua-toi/khaosat',
  ];

  for (const duongDan of duongDanCan) {
    try {
      const { ma, than } = await goi(duongDan, cookie);
      const loi = ma >= 400 ? `  <-- ${than?.message ?? ''}` : '';
      console.log(`${String(ma).padStart(3)}  ${duongDan}${loi}`);
    } catch (loi) {
      console.log(`ERR  ${duongDan}  ${loi.message}`);
    }
  }
}

main().catch((loi) => {
  console.error(loi);
  process.exitCode = 1;
});
