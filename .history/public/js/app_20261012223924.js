/**
 * Điểm khởi động giao diện: đăng nhập, dựng thanh điều hướng và chạy router.
 */
'use strict';

import { api, datXuLyHetPhien, thongDiepLoi } from './api.js';
import {
  coQuyen,
  danhSach,
  datNguoiDung,
  laKhachHang,
  laQuanTri,
  layNguoiDung,
  napDanhMuc,
  napPhien,
  xoaPhien,
} from './store.js';
import {
  baoLoi,
  baoLoiApi,
  dangXuLy,
  el,
  hienTai,
  icon,
  nut,
  thanhCong,
  xoaHet,
} from './ui.js';
import { chuCaiDau } from './format.js';
import { batDauRouter, dangKy, datKhiDoiTuyen, datMacDinh, layManHinh } from './router.js';

/* ------------------------------ MÀN HÌNH ------------------------------- */
import { manHinh as manTongQuan } from './pages/tong-quan.js';
import { manHinh as manLoaiSanPham } from './pages/loaisanpham.js';
import { manHinh as manSanPham } from './pages/sanpham.js';
import { manHinh as manNhaCungCap } from './pages/nhacungcap.js';
import { manHinh as manNhanVien } from './pages/nhanvien.js';
import { manHinh as manKhachHang } from './pages/khachhang.js';
import { manHinh as manPhieuNhap } from './pages/phieunhap.js';
import { manHinh as manDonHang } from './pages/donhang.js';
import { manHinh as manDiem } from './pages/diem.js';
import { manHinh as manKhuyenMai } from './pages/khuyenmai.js';
import { manHinh as manPhanHoi } from './pages/phanhoi.js';
import { manHinh as manKhaoSat } from './pages/khaosat.js';
import { manHinh as manBaoCao } from './pages/baocao.js';
import { manHinh as manQuanTri } from './pages/quan-tri.js';
import { manHinh as manCuaToi } from './pages/cua-toi.js';

/** Toàn bộ màn hình của ứng dụng. */
const CAC_MAN_HINH = [
  manTongQuan,
  manLoaiSanPham,
  manSanPham,
  manNhaCungCap,
  manNhanVien,
  manKhachHang,
  manPhieuNhap,
  manDonHang,
  manDiem,
  manKhuyenMai,
  manPhanHoi,
  manKhaoSat,
  manBaoCao,
  manQuanTri,
  manCuaToi,
];

/**
 * Cấu trúc thanh điều hướng: mỗi nhóm gồm tiêu đề và danh sách mã màn hình.
 * Màn hình nào người dùng không đủ quyền sẽ tự động bị ẩn.
 */
const NHOM_DIEU_HUONG = [
  { tieuDe: 'Tổng quan', muc: ['tong-quan'] },
  { tieuDe: 'Danh mục', muc: ['loaisanpham', 'sanpham', 'nhacungcap'] },
  { tieuDe: 'Con người', muc: ['nhanvien', 'khachhang'] },
  { tieuDe: 'Bán hàng', muc: ['phieunhap', 'donhang', 'diem'] },
  { tieuDe: 'Chăm sóc khách hàng', muc: ['khuyenmai', 'phanhoi', 'khaosat'] },
  { tieuDe: 'Phân tích', muc: ['baocao'] },
  { tieuDe: 'Khu vực quản trị', muc: ['quan-tri'] },
  { tieuDe: 'Tài khoản của tôi', muc: ['cua-toi'] },
];

/** Màn hình mặc định theo vai trò. */
function manHinhMacDinh() {
  return laKhachHang() ? 'cua-toi' : 'tong-quan';
}

/** Người dùng có được phép mở màn hình này không. */
