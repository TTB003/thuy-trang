/**
 * Trang QUẢN TRỊ (mục II của đồ án) — giao diện dành riêng cho vai trò Admin:
 * quản lý tài khoản & phân quyền, sao lưu – phục hồi CSDL, thông tin hệ thống.
 */
'use strict';

import { api } from '../api.js';
import { ngayGio, soDienThoai, so, soDungLuong, vietTat } from '../format.js';
import {
  bang,
  bangPhu,
  baoLoiApi,
  canhBao,
  dangXuLy,
  docBieuMau,
  el,
  hopThoai,
  khuTab,
  luoiTruong,
  moTaCot,
  nhan,
  nut,
  oTrong,
  phanTrang,
  thanhCong,
  the,
  theSoLieu,
  truong,
  xacNhan,
  xoaHet,
} from '../ui.js';

/** Danh sách vai trò — khớp ROLES ở máy chủ. */
const VAI_TRO = ['Admin', 'Quản lý', 'Nhân viên', 'Khách hàng'];
/** Trạng thái tài khoản — khớp TRANG_THAI_TK ở máy chủ. */
const TRANG_THAI_TK = ['Hoạt động', 'Bị khóa'];

/** Mật khẩu mặc định khi đặt lại tài khoản. */
const MAT_KHAU_MAC_DINH = 'Coffee@123';

/** Dữ liệu dùng chung nạp trước cho biểu mẫu tạo tài khoản. */
const DU_LIEU = { nhanVien: [], khachHang: [] };

/** Nạp nhân viên và khách hàng để gán cho tài khoản mới. */
async function napDuLieu() {
  const [nv, kh] = await Promise.all([
    api.doc('/api/nhanvien', { pageSize: 100 }),
    api.doc('/api/khachhang', { pageSize: 100, trangThai: 'Hoạt động' }),
  ]);
  DU_LIEU.nhanVien = Array.isArray(nv?.items) ? nv.items : [];
  DU_LIEU.khachHang = Array.isArray(kh?.items) ? kh.items : [];
}

/** Màn hình quản trị hệ thống. */
export const manHinh = {
  ma: 'quan-tri',
  tieuDe: 'Quản trị hệ thống',
  moTa: 'Quản lý tài khoản và phân quyền, sao lưu – phục hồi cơ sở dữ liệu.',
  bieuTuong: 'quan-tri',
  chiQuanTri: true,

  async hienThi(container, ctx) {
    await napDuLieu();

    const tabs = khuTab([
      { ma: 'tai-khoan', nhan: 'Tài khoản & phân quyền', dung: () => tabTaiKhoan(ctx) },
