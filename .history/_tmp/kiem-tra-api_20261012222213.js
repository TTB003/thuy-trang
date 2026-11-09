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
  await kiem('GET', '/api/admin/he-thong', 403, { token: tNhanVien });

  console.log('\n--- Phân quyền ---');
  await kiem('GET', '/api/nhanvien', 403, { token: tNhanVien });
  await kiem('GET', '/api/khachhang', 200, { token: tNhanVien });

  console.log('\n--- Thao tác ghi ---');
  const loaiMoi = await kiem('POST', '/api/loaisanpham', 201, {
    token: tQuanLy,
    body: { tenLoai: 'Trà thảo mộc thử nghiệm', moTa: 'Bản ghi kiểm thử tự động' },
  });
  const maLoaiMoi = loaiMoi.body?.data?.maLoai;
  if (maLoaiMoi) {
    await kiem('PUT', `/api/loaisanpham/${maLoaiMoi}`, 200, {
      token: tQuanLy,
      body: { tenLoai: 'Trà thảo mộc kiểm thử', moTa: 'Đã sửa' },
    });
    await kiem('DELETE', `/api/loaisanpham/${maLoaiMoi}`, 200, { token: tQuanLy });
  }
  await kiem('POST', '/api/loaisanpham', 409, {
    token: tQuanLy,
    body: { tenLoai: 'Cà phê Việt Nam', moTa: 'Trùng tên' },
  });
  await kiem('POST', '/api/loaisanpham', 403, {
    token: tKhach,
    body: { tenLoai: 'Không được phép' },
  });

  const khachMoi = await kiem('POST', '/api/khachhang', 201, {
    token: tQuanLy,
    body: {
      hoTen: 'Khách Kiểm Thử',
      sdt: '0999888777',
      email: 'kiemthu@example.com',
      ngaySinh: '1995-05-05',
      gioiTinh: 'Nam',
      soThich: 'Cà phê đen',
    },
  });
  const maKhMoi = khachMoi.body?.data?.maKH;
  if (maKhMoi) {
    await kiem('PUT', `/api/khachhang/${maKhMoi}`, 200, {
      token: tQuanLy,
      body: { soThich: 'Cà phê sữa đá' },
    });
    await kiem('PATCH', `/api/khachhang/${maKhMoi}/trang-thai`, 200, {
      token: tQuanLy,
      body: { trangThai: 'Bị khóa' },
    });
    await kiem('PATCH', `/api/khachhang/${maKhMoi}/trang-thai`, 200, {
      token: tQuanLy,
      body: { trangThai: 'Hoạt động' },
    });
    await kiem('DELETE', `/api/khachhang/${maKhMoi}`, 200, { token: tQuanLy });
  }

  const donMoi = await kiem('POST', '/api/donhang', 201, {
    token: tQuanLy,
    body: {
      maKH: 1,
      chiTiet: [{ maSP: 3, soLuong: 2 }, { maSP: 5, soLuong: 1 }],
      hinhThuc: 'Tại quán',
    },
  });
  const maDhMoi = donMoi.body?.data?.maDH;
  if (maDhMoi) {
    await kiem('PATCH', `/api/donhang/${maDhMoi}/trang-thai`, 200, {
      token: tQuanLy,
      body: { trangThai: 'Đã xác nhận' },
    });
    await kiem('PATCH', `/api/donhang/${maDhMoi}/trang-thai`, 200, {
      token: tQuanLy,
      body: { trangThai: 'Hoàn thành' },
    });
    await kiem('PATCH', `/api/donhang/${maDhMoi}/trang-thai`, 400, {
      token: tQuanLy,
      body: { trangThai: 'Đang giao' },
    });
  }
  await kiem('POST', '/api/donhang/tinh-tien', 200, {
    token: tQuanLy,
    body: { chiTiet: [{ maSP: 1, soLuong: 3 }], diemSuDung: 0 },
  });
  await kiem('POST', '/api/donhang', 400, {
    token: tQuanLy,
    body: { maKH: 1, chiTiet: [] },
  });

  const kmMoi = await kiem('POST', '/api/khuyenmai', 201, {
    token: tQuanLy,
    body: {
      tenKM: 'Khuyến mãi kiểm thử',
      moTa: 'Bản ghi kiểm thử tự động',
      giaTriGiam: 5000,
      ngayBatDau: new Date().toISOString().slice(0, 10),
      ngayKetThuc: new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10),
      trangThai: 'Đang diễn ra',
    },
  });
  const maKmMoi = kmMoi.body?.data?.maKM;
  if (maKmMoi) {
    const apDung = await kiem('POST', `/api/khuyenmai/${maKmMoi}/ap-dung`, 200, {
      token: tQuanLy,
      body: { danhSachMaSP: [1, 2, 3, 4, 5, 6] },
    });
    const dsApDung = apDung.body?.data?.danhSachMaSP ?? [];
    if (dsApDung.length > 0) {
      await kiem('DELETE', `/api/khuyenmai/${maKmMoi}/san-pham/${dsApDung[0]}`, 200, { token: tQuanLy });
    }
    // Gỡ một sản phẩm không nằm trong chương trình -> phải báo lỗi 404.
    const ngoaiDanhSach = [1, 2, 3, 4, 5, 6].find((ma) => !dsApDung.includes(ma));
    if (ngoaiDanhSach) {
      await kiem('DELETE', `/api/khuyenmai/${maKmMoi}/san-pham/${ngoaiDanhSach}`, 404, { token: tQuanLy });
    }
  const maPhMoi = phMoi.body?.data?.maPH;
  if (maPhMoi) {
    await kiem('POST', `/api/phanhoi/${maPhMoi}/xu-ly`, 200, {
      token: tQuanLy,
      body: { phanHoiLai: 'Cảm ơn bạn đã góp ý.' },
    });
    await kiem('GET', `/api/phanhoi/${maPhMoi}`, 200, { token: tQuanLy });
  }

  const phieuMoi = await kiem('POST', '/api/phieunhap', 201, {
    token: tQuanLy,
    body: {
      maNCC: 1,
      chiTiet: [{ maSP: 1, soLuong: 50, donGia: 15000 }],
      trangThai: 'Chờ duyệt',
    },
  });
  const maPnhMoi = phieuMoi.body?.data?.maPNH;
  if (maPnhMoi) {
    await kiem('POST', `/api/phieunhap/${maPnhMoi}/duyet`, 200, { token: tQuanLy });
    // Hủy phiếu đã nhập kho: hệ thống phải trừ lại tồn kho (trả về 200).
    await kiem('POST', `/api/phieunhap/${maPnhMoi}/huy`, 200, { token: tQuanLy, body: { lyDo: 'Thử' } });
    await kiem('POST', `/api/phieunhap/${maPnhMoi}/huy`, 400, { token: tQuanLy, body: { lyDo: 'Hủy lần hai' } });
  }

  const ksMoi = await kiem('POST', '/api/khaosat', 201, {
    token: tQuanLy,
    body: {
      tieuDe: 'Khảo sát kiểm thử tự động',
      moTa: 'Kiểm thử',
      loaiKS: 'Khác',
      doiTuong: 'Tất cả khách hàng',
      cauHoi: [
        { noiDung: 'Bạn thấy thế nào?', loaiCauHoi: 'Thang điểm', luaChon: '1|2|3|4|5' },
      ],
    },
  });
  const maKsMoi = ksMoi.body?.data?.maKS;
  if (maKsMoi) {
    await kiem('POST', `/api/khaosat/${maKsMoi}/cau-hoi`, 201, {
      token: tQuanLy,
      body: { noiDung: 'Bạn dùng bao lâu một lần?', loaiCauHoi: 'Một lựa chọn', luaChon: 'Hằng ngày|Hằng tuần|Hiếm khi' },
    });
    await kiem('POST', `/api/khaosat/${maKsMoi}/gui`, 200, { token: tQuanLy, body: { danhSachMaKH: [1, 2, 3] } });
    await kiem('GET', `/api/khaosat/${maKsMoi}/thong-ke`, 200, { token: tQuanLy });
    await kiem('DELETE', `/api/khaosat/${maKsMoi}`, 200, { token: tQuanLy });
  }

  console.log('\n--- Tài khoản (Admin) ---');
  // Tạo nhân viên mới (chưa có tài khoản) rồi mới cấp tài khoản cho nhân viên đó.
  const nvMoi = await kiem('POST', '/api/nhanvien', 201, {
    token: tAdmin,
    body: {
      hoTen: 'Nhân Viên Kiểm Thử',
      email: 'nv.kiemthu@coffeecrm.vn',
      chucVu: 'Nhân viên bán hàng',
      sdt: '0900111222',
      ngayVao: '2026-01-05',
    },
  });
  const maNvMoi = nvMoi.body?.data?.maNV;
  const maTkCuaNvMoi = nvMoi.body?.data?.maTK;

  const tkMoi = await kiem('POST', '/api/admin/taikhoan', 201, {
    token: tAdmin,
    body: { vaiTro: 'Nhân viên', matKhau: 'Matkhau@123', maNV: maNvMoi },
  });
  const maTkMoi = tkMoi.body?.data?.maTK;
  if (maTkMoi) {
    await kiem('PATCH', `/api/admin/taikhoan/${maTkMoi}/trang-thai`, 200, {
      token: tAdmin,
      body: { trangThai: 'Bị khóa' },
    });
    await kiem('PATCH', `/api/admin/taikhoan/${maTkMoi}/trang-thai`, 200, {
      token: tAdmin,
      body: { trangThai: 'Hoạt động' },
    });
    await kiem('POST', `/api/admin/taikhoan/${maTkMoi}/dat-lai-mat-khau`, 200, {
      token: tAdmin,
      body: { matKhau: 'Matkhau@456' },
    });
    await kiem('DELETE', `/api/admin/taikhoan/${maTkMoi}`, 200, { token: tAdmin });
  }
  await kiem('GET', '/api/admin/sao-luu', 200, { token: tAdmin });
  if (maNvMoi) {
    await kiem('POST', `/api/admin/taikhoan`, 400, {
      token: tAdmin,
      body: { vaiTro: 'Nhân viên', matKhau: 'Matkhau@123', maNV: maNvMoi },
    });
    await kiem('DELETE', `/api/nhanvien/${maNvMoi}`, 200, { token: tAdmin });
  }
  if (maTkCuaNvMoi) {
    await kiem('PATCH', `/api/admin/taikhoan/${maTkCuaNvMoi}/vai-tro`, 200, {
      token: tAdmin,
      body: { vaiTro: 'Quản lý' },
    });
  }

  console.log('\n--- Khách hàng đặt hàng qua cổng khách hàng ---');
  await kiem('POST', '/api/donhang', 201, {
    token: tKhach,
    body: { chiTiet: [{ maSP: 1, soLuong: 1 }], hinhThuc: 'Tại quán' },
  });
  await kiem('POST', '/api/cua-toi/phan-hoi', 201, {
    token: tKhach,
    body: { noiDung: 'Khách tự gửi phản hồi kiểm thử', danhGia: 4 },
  });
  await kiem('GET', '/api/nhanvien', 403, { token: tKhach });

  console.log('\n--- Đăng xuất ---');
  await kiem('POST', '/api/auth/logout', 200, { token: tKhach });
  await kiem('GET', '/api/cua-toi/ho-so', 401, { token: tKhach });

  console.log(`\n=========================================`);
  console.log(`  Số API ĐẠT : ${soDat}`);
  console.log(`  Số API LỖI : ${soLoi}`);
  console.log(`=========================================`);
  if (soLoi > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error('LỖI CHẠY KIỂM THỬ:', error.message);
  process.exitCode = 1;
});
