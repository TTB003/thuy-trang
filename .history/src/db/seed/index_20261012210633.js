/**
 * Sinh dữ liệu demo đầy đủ cho toàn bộ 21 bảng.
 * Chạy: node scripts/seed.js  (hoặc tự động khi khởi động nếu CSDL rỗng)
 */
'use strict';

const db = require('../index');
const auth = require('../../core/auth');
const { VND_PER_POINT, VND_PER_POINT_REDEEM, ROLES } = require('../../config');
const { nowSql } = require('../../core/time');
const tinh = require('./du-lieu-tinh');
const { NgauNhien, ngayGioCachHomNay, ngayThangCachHomNay } = require('./tien-ich');

const MAT_KHAU_NHAN_VIEN = 'Coffee@123';
const MAT_KHAU_KHACH_HANG = 'Khach@123';
const MAT_KHAU_ADMIN = 'Admin@123';
const NGAY_GAN_NHAT = 7; // số ngày gần đây được xem là "đang xử lý"

/** Trạng thái kho hàng dùng khi chèn sản phẩm ban đầu. */
const KHO_BAN_DAU = 0;

/**
 * Chèn toàn bộ dữ liệu demo.
 * @param {{ reset?: boolean }} [options] reset=true sẽ tạo lại toàn bộ bảng.
 */
function seedAll(options = {}) {
  const { reset = true } = options;
  if (reset) db.initSchema();

  const rnd = new NgauNhien(20262026);
  const thongKe = {};

  return db.transaction(() => {
    thongKe.loaiSanPham = chenLoaiSanPham();
    const sanPham = chenSanPham();
    thongKe.sanPham = sanPham.length;
    thongKe.nhaCungCap = chenNhaCungCap();
    const nhanVien = chenNhanVienVaTaiKhoan();
    const khachHang = chenKhachHangVaTaiKhoan();
    const khuyenMai = chenKhuyenMai(sanPham);

    const kho = new Map(sanPham.map((sp) => [sp.maSP, KHO_BAN_DAU]));
    thongKe.phieuNhap = chenPhieuNhap(rnd, kho, sanPham, nhanVien);
    const ketQuaBan = chenDonHang(rnd, kho, sanPham, khachHang, nhanVien, khuyenMai);
    thongKe.donHang = ketQuaBan.soDonHang;
    thongKe.chiTietDonHang = ketQuaBan.soChiTiet;
    thongKe.lichSuDiem = ketQuaBan.soGiaoDichDiem;

    capNhatTonKhoCuoi(kho);
    datTonKhoCanhBao(sanPham);
    thongKe.phanHoi = chenPhanHoi(rnd, sanPham, khachHang, nhanVien);
    thongKe.khaoSat = chenKhaoSat(rnd, khachHang, nhanVien);

    return thongKe;
  });
}

/** Nhóm 1 — chèn loại sản phẩm. */
function chenLoaiSanPham() {
  const maLoai = [];
  tinh.LOAISANPHAM.forEach((loai) => {
    const ketQua = db.run(
      'INSERT INTO LOAISANPHAM (tenLoai, moTa) VALUES (:tenLoai, :moTa)',
      { tenLoai: loai.tenLoai, moTa: loai.moTa }
    );
    maLoai.push(ketQua.lastInsertRowid);
  });
  return maLoai;
}

/** Nhóm 2 — chèn sản phẩm (tồn kho ban đầu bằng 0, cập nhật sau). */
function chenSanPham() {
  const danhSach = [];
  tinh.SANPHAM.forEach(([maLoai, tenSP, gia, moTa, hinhAnh]) => {
    const ketQua = db.run(
      `INSERT INTO SANPHAM (maLoai, tenSP, moTa, gia, soLuong, hinhAnh, trangThai)
       VALUES (:maLoai, :tenSP, :moTa, :gia, 0, :hinhAnh, N'Đang bán')`,
      { maLoai, tenSP, moTa, gia, hinhAnh }
    );
    danhSach.push({ maSP: ketQua.lastInsertRowid, maLoai, tenSP, gia, hinhAnh });
  });
  return danhSach;
}

/** Nhóm 3 — chèn nhà cung cấp. */
function chenNhaCungCap() {
  return tinh.NHACUNGCAP.map((ncc) => {
    const ketQua = db.run(
      `INSERT INTO NHACUNGCAP (tenNCC, sdt, diaChi, email, trangThai)
       VALUES (:tenNCC, :sdt, :diaChi, :email, :trangThai)`,
      ncc
    );
    return { maNCC: ketQua.lastInsertRowid, ...ncc };
  });
}

/** Nhóm 4 — chèn nhân viên kèm tài khoản đăng nhập. */
function chenNhanVienVaTaiKhoan() {
  return tinh.NHANVIEN.map((nhanVien) => {
    const ketQua = db.run(
      `INSERT INTO NHANVIEN (hoTen, email, chucVu, sdt, ngayVao, trangThai)
       VALUES (:hoTen, :email, :chucVu, :sdt, :ngayVao, N'Đang làm việc')`,
      nhanVien
    );
    const maNV = ketQua.lastInsertRowid;
    auth.createAccount({
      tenDangNhap: nhanVien.email,
      matKhau: MAT_KHAU_NHAN_VIEN,
      vaiTro: nhanVien.chucVu === 'Quản lý' ? ROLES.MANAGER : ROLES.STAFF,
      maNV,
    });
    return { maNV, ...nhanVien };
  });
}

/** Tài khoản quản trị hệ thống (giao diện ADMIN). */
function chenTaiKhoanAdmin() {
  const daCo = db.get(`SELECT maTK FROM TAIKHOAN WHERE vaiTro = 'Admin'`);
  if (daCo) return daCo.maTK;
  return auth.createAccount({
    tenDangNhap: 'admin',
    matKhau: MAT_KHAU_ADMIN,
    vaiTro: ROLES.ADMIN,
  });
}

/** Nhóm 5 — chèn khách hàng kèm tài khoản đăng nhập. */
function chenKhachHangVaTaiKhoan() {
  const danhSach = [];
  tinh.KHACHHANG.forEach(([hoTen, sdt, email, ngaySinh, gioiTinh, diaChi, soThich], index) => {
    const soNgayDangKy = -(180 - index * 5);
    const ketQua = db.run(
      `INSERT INTO KHACHHANG (hoTen, sdt, email, ngaySinh, gioiTinh, diaChi, soThich,
                              diemTichLuy, trangThai, ngayDangKy)
       VALUES (:hoTen, :sdt, :email, :ngaySinh, :gioiTinh, :diaChi, :soThich,
               0, N'Hoạt động', :ngayDangKy)`,
      {
        hoTen,
        sdt,
        email,
        ngaySinh,
        gioiTinh,
        diaChi,
        soThich,
        ngayDangKy: ngayGioCachHomNay(soNgayDangKy, 9 + (index % 8), 15, 0),
      }
    );
    const maKH = ketQua.lastInsertRowid;
    auth.createAccount({
      tenDangNhap: sdt,
      matKhau: MAT_KHAU_KHACH_HANG,
      vaiTro: ROLES.CUSTOMER,
      maKH,
    });
    danhSach.push({ maKH, hoTen, sdt, email, soThich, diemTichLuy: 0 });
  });
  // Hai khách hàng bị khóa để minh hoạ chức năng CN5.3.
  db.run(`UPDATE KHACHHANG SET trangThai = N'Bị khóa' WHERE sdt = :sdt`, { sdt: '0912000028' });
  db.run(`UPDATE TAIKHOAN SET trangThai = 'Bị khóa' WHERE tenDangNhap = :ten`, {
    ten: '0912000028',
  });
  danhSach[27].biKhoa = true;
  return danhSach;
}

/** Nhóm 9 — chèn chương trình khuyến mãi và chi tiết áp dụng. */
function chenKhuyenMai(sanPham) {
  return tinh.KHUYENMAI.map((km) => {
    const ngayBatDau = ngayThangCachHomNay(km.tuNgay);
    const ngayKetThuc = ngayThangCachHomNay(km.denNgay);
    const ketQua = db.run(
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
    danhSachApDung.forEach((sp) => {
      db.run('INSERT INTO CTKM (maKM, maSP) VALUES (:maKM, :maSP)', { maKM, maSP: sp.maSP });
    });
    return { maKM, ...km, ngayBatDau, ngayKetThuc, danhSachMaSP: danhSachApDung.map((sp) => sp.maSP) };
  });
}

module.exports = {
  seedAll,
  chenTaiKhoanAdmin,
  MAT_KHAU_NHAN_VIEN,
  MAT_KHAU_KHACH_HANG,
  MAT_KHAU_ADMIN,
  NGAY_GAN_NHAT,
};
