/**
 * Kiểm thử tự động các API chính (chạy khi máy chủ đang bật).
 * Cách chạy: node _tmp/kiem-tra-api.js
 */
'use strict';

const DIA_CHI = 'http://127.0.0.1:3000';

let soDat = 0;
let soLoi = 0;

/** Gọi một API và trả về { status, body }. */
async function goi(method, duongDan, { token = null, body = null } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const phanHoi = await fetch(`${DIA_CHI}${duongDan}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  let duLieu = null;
  try {
    duLieu = await phanHoi.json();
  } catch {
    duLieu = null;
  }
  return { status: phanHoi.status, body: duLieu };
}

/** Kiểm tra một API, ghi nhận kết quả. */
async function kiem(method, duongDan, mongDoi, options = {}) {
  try {
    const ketQua = await goi(method, duongDan, options);
    const dat = ketQua.status === mongDoi;
    if (dat) {
      soDat += 1;
      console.log(`[ĐẠT] ${method} ${duongDan} -> ${ketQua.status}`);
    } else {
      soLoi += 1;
      console.log(
        `[LỖI] ${method} ${duongDan} -> ${ketQua.status} (mong đợi ${mongDoi}) ` +
          `${JSON.stringify(ketQua.body)?.slice(0, 260) ?? ''}`
      );
    }
    return ketQua;
  } catch (error) {
    soLoi += 1;
    console.log(`[LỖI] ${method} ${duongDan} -> ngoại lệ: ${error.message}`);
    return { status: 0, body: null };
  }
}

async function main() {
  console.log('Thử kết nối máy chủ...');
  const live = await kiem('POST', '/api/auth/login', 400, { body: {} });

  console.log('\n--- Đăng nhập các vai trò ---');
  const admin = await kiem('POST', '/api/auth/login', 200, {
    body: { tenDangNhap: 'admin', matKhau: 'Admin@123' },
  });
  const quanLy = await kiem('POST', '/api/auth/login', 200, {
    body: { tenDangNhap: 'an.nv@coffeecrm.vn', matKhau: 'Coffee@123' },
  });
  const nhanVien = await kiem('POST', '/api/auth/login', 200, {
    body: { tenDangNhap: 'bich.tt@coffeecrm.vn', matKhau: 'Coffee@123' },
  });
  const khachHang = await kiem('POST', '/api/auth/login', 200, {
    body: { tenDangNhap: '0912000001', matKhau: 'Khach@123' },
  });
  await kiem('POST', '/api/auth/login', 401, {
    body: { tenDangNhap: 'admin', matKhau: 'sai-mat-khau' },
  });

  const tAdmin = admin.body?.data?.token;
  const tQuanLy = quanLy.body?.data?.token;
  const tNhanVien = nhanVien.body?.data?.token;
  const tKhach = khachHang.body?.data?.token;

  console.log('\n--- API dùng chung ---');
  await kiem('GET', '/api/danh-muc', 200);
  await kiem('GET', '/api/auth/me', 200, { token: tAdmin });
  await kiem('GET', '/api/auth/me', 401);

  console.log('\n--- NHÓM 1: loại sản phẩm ---');
  await kiem('GET', '/api/loaisanpham', 200, { token: tQuanLy });
  await kiem('GET', '/api/loaisanpham?q=ca%20phe', 200, { token: tQuanLy });
  await kiem('GET', '/api/loaisanpham/1', 200, { token: tQuanLy });

  console.log('\n--- NHÓM 2: sản phẩm ---');
  await kiem('GET', '/api/sanpham', 200, { token: tQuanLy });
  await kiem('GET', '/api/sanpham?q=tra&sortBy=gia&sortDir=desc', 200, { token: tQuanLy });
  await kiem('GET', '/api/sanpham?chiKhuyenMai=true', 200, { token: tQuanLy });
  await kiem('GET', '/api/sanpham/canh-bao-ton', 200, { token: tQuanLy });
  await kiem('GET', '/api/sanpham/1', 200, { token: tQuanLy });

  console.log('\n--- NHÓM 3: nhà cung cấp ---');
  await kiem('GET', '/api/nhacungcap', 200, { token: tQuanLy });
  await kiem('GET', '/api/nhacungcap/dang-hop-tac', 200, { token: tQuanLy });
  await kiem('GET', '/api/nhacungcap/1', 200, { token: tQuanLy });

  console.log('\n--- NHÓM 4: nhân viên ---');
  await kiem('GET', '/api/nhanvien', 200, { token: tQuanLy });
  await kiem('GET', '/api/nhanvien/dang-lam-viec', 200, { token: tNhanVien });
  await kiem('GET', '/api/nhanvien/1', 200, { token: tQuanLy });

  console.log('\n--- NHÓM 5: khách hàng ---');
  await kiem('GET', '/api/khachhang', 200, { token: tQuanLy });
  await kiem('GET', '/api/khachhang?q=nguyen', 200, { token: tQuanLy });
  await kiem('GET', '/api/khachhang/hoat-dong', 200, { token: tQuanLy });
  await kiem('GET', '/api/khachhang/tim-theo-sdt?sdt=0912000001', 200, { token: tQuanLy });
  await kiem('GET', '/api/khachhang/1', 200, { token: tQuanLy });

  console.log('\n--- NHÓM 6: phiếu nhập ---');
  await kiem('GET', '/api/phieunhap', 200, { token: tQuanLy });
  await kiem('GET', '/api/phieunhap/1', 200, { token: tQuanLy });

  console.log('\n--- NHÓM 7: đơn hàng ---');
  await kiem('GET', '/api/donhang', 200, { token: tQuanLy });
  await kiem('GET', '/api/donhang?trangThai=Ho%C3%A0n%20th%C3%A0nh', 200, { token: tQuanLy });
  await kiem('GET', '/api/donhang/1', 200, { token: tQuanLy });

  console.log('\n--- NHÓM 8: điểm ---');
  await kiem('GET', '/api/diem/lich-su', 200, { token: tQuanLy });
  await kiem('GET', '/api/diem/khachhang/1', 200, { token: tQuanLy });
  await kiem('GET', '/api/diem/khachhang/1/hien-tai', 200, { token: tQuanLy });

  console.log('\n--- NHÓM 9: khuyến mãi ---');
  await kiem('GET', '/api/khuyenmai', 200, { token: tQuanLy });
  await kiem('GET', '/api/khuyenmai/dang-hieu-luc', 200, { token: tQuanLy });
  await kiem('GET', '/api/khuyenmai/1', 200, { token: tQuanLy });

  console.log('\n--- NHÓM 10: phản hồi ---');
  await kiem('GET', '/api/phanhoi', 200, { token: tQuanLy });
  await kiem('GET', '/api/phanhoi/thong-ke', 200, { token: tQuanLy });
  await kiem('GET', '/api/phanhoi/chua-xu-ly', 200, { token: tQuanLy });
  await kiem('GET', '/api/phanhoi/1', 200, { token: tQuanLy });

  console.log('\n--- NHÓM 11: khảo sát ---');
  await kiem('GET', '/api/khaosat', 200, { token: tQuanLy });
  await kiem('GET', '/api/khaosat/1', 200, { token: tQuanLy });
  await kiem('GET', '/api/khaosat/1/thong-ke', 200, { token: tQuanLy });
  await kiem('GET', '/api/khaosat/1/nguoi-nhan', 200, { token: tQuanLy });

  console.log('\n--- NHÓM 12: báo cáo ---');
  await kiem('GET', '/api/baocao/dashboard', 200, { token: tQuanLy });
  await kiem('GET', '/api/baocao/doanh-thu?kieu=thang', 200, { token: tQuanLy });
  await kiem('GET', '/api/baocao/san-pham-ban-chay?top=5', 200, { token: tQuanLy });
  await kiem('GET', '/api/baocao/nhap-hang', 200, { token: tQuanLy });
  await kiem('GET', '/api/baocao/ton-kho', 200, { token: tQuanLy });
  await kiem('GET', '/api/baocao/khach-hang', 200, { token: tQuanLy });
  await kiem('GET', '/api/baocao/khach-hang-than-thiet', 200, { token: tQuanLy });
  await kiem('GET', '/api/baocao/xuat?loai=doanhthu&kieu=thang', 200, { token: tQuanLy });
  await kiem('GET', '/api/baocao/xuat?loai=khong-ton-tai', 400, { token: tQuanLy });

  console.log('\n--- Cổng khách hàng (4.3) ---');
  await kiem('GET', '/api/cua-toi/ho-so', 200, { token: tKhach });
  await kiem('GET', '/api/cua-toi/diem', 200, { token: tKhach });
  await kiem('GET', '/api/cua-toi/don-hang', 200, { token: tKhach });
  await kiem('GET', '/api/cua-toi/phan-hoi', 200, { token: tKhach });
  await kiem('GET', '/api/cua-toi/khaosat', 200, { token: tKhach });

  console.log('\n--- Giao diện ADMIN ---');
  await kiem('GET', '/api/admin/taikhoan', 200, { token: tAdmin });
  await kiem('GET', '/api/admin/taikhoan/thong-ke', 200, { token: tAdmin });
  await kiem('GET', '/api/admin/taikhoan/1', 200, { token: tAdmin });
  await kiem('GET', '/api/admin/he-thong', 200, { token: tAdmin });
  await kiem('GET', '/api/admin/toan-ven', 200, { token: tAdmin });
  await kiem('GET', '/api/admin/taikhoan', 403, { token: tQuanLy });
  await kiem('GET', '/api/admin/taikhoan', 401);

  console.log('\n--- Phân quyền ---');
  await kiem('GET', '/api/nhanvien', 403, { token: tNhanVien });
  await kiem('GET', '/api/khachhang', 200, { token: tNhanVien });

  console.log('\n--- Thao tác ghi ---');
  const loaiMoi = await kiem('POST', '/api/loaisanpham', 201, {
    token: tQuanLy,
    body: { tenLoai: 'Trà thảo mộc thử nghiệm', moTa: 'Bản ghi kiểm thử tự động' },
  });
  const maLoaiMoi = loaiMoi.body?.data?.maLoai;
