/**
 * Sinh dữ liệu demo đầy đủ cho toàn bộ 21 bảng.
 * Chạy: node scripts/seed.js
 * Dữ liệu sinh theo bộ số ngẫu nhiên TẤT ĐỊNH nên chạy lại cho kết quả giống nhau.
 */
'use strict';

const db = require('../index');
const auth = require('../../core/auth');
const { ROLES, VND_PER_POINT, VND_PER_POINT_REDEEM } = require('../../config');
const tinh = require('./du-lieu-tinh');
const { NgauNhien, ngayGioCachHomNay, ngayThangCachHomNay } = require('./tien-ich');

/** Mật khẩu mặc định của tài khoản demo. */
const MAT_KHAU_NHAN_VIEN = 'Coffee@123';
const MAT_KHAU_KHACH_HANG = 'Khach@123';
const MAT_KHAU_ADMIN = 'Admin@123';

/** Số phiếu nhập và số đơn hàng sinh ra. */
const SO_PHIEU_NHAP = 16;
const SO_DON_HANG = 110;
/** Số ngày gần nhất được xem là "đang xử lý". */
const NGAY_GAN_NHAT = 8;

/**
 * Chèn toàn bộ dữ liệu demo.
 * @param {{ reset?: boolean }} [options] reset=false sẽ không xóa bảng trước khi chèn.
 * @returns {Promise<object>} thống kê số bản ghi đã tạo
 */
async function seedAll(options = {}) {
  const { reset = true } = options;
  if (reset) await db.initSchema();

  const rnd = new NgauNhien(20262026);
  const thongKe = {};

  return db.transaction(async () => {
    thongKe.loaiSanPham = await chenLoaiSanPham();
    const sanPham = await chenSanPham();
    thongKe.sanPham = sanPham.length;
    thongKe.nhaCungCap = await chenNhaCungCap();
    const nhanVien = await chenNhanVienVaTaiKhoan();
    await chenTaiKhoanAdmin();
    const khachHang = await chenKhachHangVaTaiKhoan();
    const khuyenMai = await chenKhuyenMai(sanPham);

    const kho = new Map(sanPham.map((sp) => [sp.maSP, 0]));
    thongKe.phieuNhap = await chenPhieuNhap(rnd, kho, sanPham);
    const ketQuaBan = await chenDonHang(rnd, kho, sanPham, khachHang, nhanVien, khuyenMai);
    thongKe.donHang = ketQuaBan.soDonHang;
    thongKe.chiTietDonHang = ketQuaBan.soChiTiet;
    thongKe.lichSuDiem = ketQuaBan.soGiaoDichDiem;

    await capNhatTonKhoCuoi(kho);
    await datTonKhoCanhBao(sanPham);
    thongKe.phanHoi = await chenPhanHoi(rnd, sanPham, khachHang, nhanVien);
    thongKe.khaoSat = await chenKhaoSat(rnd, khachHang, nhanVien);

    return thongKe;
  });
}

/** Nhóm 1 — chèn loại sản phẩm. */
async function chenLoaiSanPham() {
  const maLoai = [];
  for (const loai of tinh.LOAISANPHAM) {
    const ketQua = await db.run(
      'INSERT INTO LOAISANPHAM (tenLoai, moTa) VALUES (:tenLoai, :moTa)',
      { tenLoai: loai.tenLoai, moTa: loai.moTa }
    );
    maLoai.push(ketQua.lastInsertRowid);
  }
  return maLoai;
}

/** Nhóm 2 — chèn sản phẩm (tồn kho ban đầu 0, cập nhật sau khi nhập hàng). */
async function chenSanPham() {
  const danhSach = [];
  for (const [maLoai, tenSP, gia, moTa, hinhAnh] of tinh.SANPHAM) {
    const ketQua = await db.run(
      `INSERT INTO SANPHAM (maLoai, tenSP, moTa, gia, soLuong, hinhAnh, trangThai)
       VALUES (:maLoai, :tenSP, :moTa, :gia, 0, :hinhAnh, N'Đang bán')`,
      { maLoai, tenSP, moTa, gia, hinhAnh }
    );
    danhSach.push({ maSP: ketQua.lastInsertRowid, maLoai, tenSP, gia, hinhAnh });
  }
  return danhSach;
}

/** Nhóm 3 — chèn nhà cung cấp. */
async function chenNhaCungCap() {
  const danhSach = [];
  for (const ncc of tinh.NHACUNGCAP) {
    const ketQua = await db.run(
      `INSERT INTO NHACUNGCAP (tenNCC, sdt, diaChi, email, trangThai)
       VALUES (:tenNCC, :sdt, :diaChi, :email, :trangThai)`,
      ncc
    );
    danhSach.push({ maNCC: ketQua.lastInsertRowid, ...ncc });
  }
  return danhSach;
}

/** Nhóm 4 — chèn nhân viên kèm tài khoản đăng nhập. */
async function chenNhanVienVaTaiKhoan() {
  const danhSach = [];
  for (const nhanVien of tinh.NHANVIEN) {
    const ketQua = await db.run(
      `INSERT INTO NHANVIEN (hoTen, email, chucVu, sdt, ngayVao, trangThai)
       VALUES (:hoTen, :email, :chucVu, :sdt, :ngayVao, N'Đang làm việc')`,
      nhanVien
    );
    const maNV = ketQua.lastInsertRowid;
    await auth.createAccount({
      tenDangNhap: nhanVien.email,
      matKhau: MAT_KHAU_NHAN_VIEN,
      vaiTro: nhanVien.chucVu === 'Quản lý' ? ROLES.MANAGER : ROLES.STAFF,
      maNV,
    });
    danhSach.push({ maNV, ...nhanVien });
  }
  return danhSach;
}

/** Tài khoản quản trị hệ thống (giao diện ADMIN). */
async function chenTaiKhoanAdmin() {
  const daCo = await db.get(`SELECT maTK FROM TAIKHOAN WHERE vaiTro = 'Admin'`);
  if (daCo) return daCo.maTK;
  return auth.createAccount({
    tenDangNhap: 'admin',
    matKhau: MAT_KHAU_ADMIN,
    vaiTro: ROLES.ADMIN,
  });
}

/** Nhóm 5 — chèn khách hàng kèm tài khoản đăng nhập. */
async function chenKhachHangVaTaiKhoan() {
  const danhSach = [];
  let index = 0;
  for (const [hoTen, sdt, emailValue, ngaySinh, gioiTinh, diaChi, soThich] of tinh.KHACHHANG) {
    const soNgayDangKy = -(180 - index * 5);
    const ketQua = await db.run(
      `INSERT INTO KHACHHANG (hoTen, sdt, email, ngaySinh, gioiTinh, diaChi, soThich,
                              diemTichLuy, trangThai, ngayDangKy)
       VALUES (:hoTen, :sdt, :email, :ngaySinh, :gioiTinh, :diaChi, :soThich,
               0, N'Hoạt động', :ngayDangKy)`,
      {
        hoTen,
        sdt,
        email: emailValue,
        ngaySinh,
        gioiTinh,
        diaChi,
        soThich,
        ngayDangKy: ngayGioCachHomNay(soNgayDangKy, 9 + (index % 8), 15, 0),
      }
    );
    const maKH = ketQua.lastInsertRowid;
    await auth.createAccount({
      tenDangNhap: sdt,
      matKhau: MAT_KHAU_KHACH_HANG,
      vaiTro: ROLES.CUSTOMER,
      maKH,
    });
    danhSach.push({ maKH, hoTen, sdt, email: emailValue, soThich, biKhoa: false });
    index += 1;
  }

  // Một khách hàng bị khóa để minh hoạ chức năng CN5.3.
  const khachBiKhoa = danhSach[danhSach.length - 1];
  await db.run(`UPDATE KHACHHANG SET trangThai = N'Bị khóa' WHERE maKH = :maKH`, {
    maKH: khachBiKhoa.maKH,
  });
  await db.run(`UPDATE TAIKHOAN SET trangThai = 'Bị khóa' WHERE maKH = :maKH`, {
    maKH: khachBiKhoa.maKH,
  });
  khachBiKhoa.biKhoa = true;

  return danhSach;
}

/** Nhóm 9 — chèn chương trình khuyến mãi và chi tiết áp dụng. */
async function chenKhuyenMai(sanPham) {
  const danhSach = [];
  for (const km of tinh.KHUYENMAI) {
    const ngayBatDau = ngayThangCachHomNay(km.tuNgay);
    const ngayKetThuc = ngayThangCachHomNay(km.denNgay);
    const ketQua = await db.run(
      `INSERT INTO KHUYENMAI (tenKM, moTa, giaTriGiam, ngayBatDau, ngayKetThuc, trangThai)
       VALUES (:tenKM, :moTa, :giaTriGiam, :ngayBatDau, :ngayKetThuc, :trangThai)`,
      {
        tenKM: km.tenKM,
        moTa: km.moTa,
        giaTriGiam: km.giaTriGiam,
        ngayBatDau,
        ngayKetThuc,
        trangThai: km.trangThai,
      }
    );
    const maKM = ketQua.lastInsertRowid;
    const batDauIndex = km.apDungTuSanPham - 1;
    const danhSachApDung = sanPham.slice(batDauIndex, batDauIndex + km.soSanPham);
    for (const sp of danhSachApDung) {
      await db.run('INSERT INTO CTKM (maKM, maSP) VALUES (:maKM, :maSP)', { maKM, maSP: sp.maSP });
    }
    danhSach.push({
      maKM,
      tenKM: km.tenKM,
      giaTriGiam: km.giaTriGiam,
      ngayBatDau,
      ngayKetThuc,
      danhSachMaSP: danhSachApDung.map((sp) => sp.maSP),
    });
  }
  return danhSach;
}
