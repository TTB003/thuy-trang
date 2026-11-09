/**
 * Trạng thái dùng chung toàn ứng dụng: người dùng đang đăng nhập,
 * tập quyền được cấp và danh mục trạng thái (nạp một lần duy nhất).
 */
'use strict';

import { api } from './api.js';

/** Người dùng hiện tại (null nếu chưa đăng nhập). */
let nguoiDung = null;

/** Danh mục trạng thái dùng cho các biểu mẫu, chỉ nạp một lần. */
let danhMuc = null;

/** Những nơi đã đăng ký theo dõi thay đổi người dùng. */
const khachTheoDoi = new Set();

/** Đăng ký hàm được gọi mỗi khi người dùng thay đổi. */
export function theoDoiNguoiDung(fn) {
  khachTheoDoi.add(fn);
  return () => khachTheoDoi.delete(fn);
}

/** Ghi nhận người dùng mới và thông báo cho nơi theo dõi. */
export function datNguoiDung(user) {
  nguoiDung = user ?? null;
  for (const fn of khachTheoDoi) fn(nguoiDung);
}

/** Người dùng hiện tại. */
export function layNguoiDung() {
  return nguoiDung;
}

/** Xóa phiên phía giao diện. */
export function xoaPhien() {
  datNguoiDung(null);
  danhMuc = null;
}

/** Hỏi máy chủ xem cookie phiên còn hiệu lực không (dùng khi tải lại trang). */
export async function napPhien() {
  try {
    const user = await api.doc('/api/auth/me');
    datNguoiDung(user);
    return user;
  } catch {
    datNguoiDung(null);
    return null;
  }
}

/** Nạp danh mục trạng thái (chỉ gọi máy chủ ở lần đầu). */
export async function napDanhMuc() {
  if (danhMuc) return danhMuc;
  danhMuc = await api.doc('/api/danh-muc');
  return danhMuc;
}

/** Danh mục trạng thái đã nạp (có thể null nếu chưa nạp). */
export function layDanhMuc() {
  return danhMuc;
}

/** Lấy một danh sách trạng thái từ danh mục; trả mảng rỗng nếu chưa có. */
export function danhSach(ten) {
  const giaTri = danhMuc?.[ten];
  return Array.isArray(giaTri) ? giaTri : [];
}

/** Người dùng hiện tại có quyền cụ thể hay không. */
export function coQuyen(quyen) {
  if (!quyen) return true;
  const ds = nguoiDung?.capabilities;
  if (!Array.isArray(ds)) return false;
  return ds.includes(quyen);
}

/** Có ít nhất một trong các quyền được liệt kê. */
export function coMotTrong(quyenList) {
  return quyenList.some((quyen) => coQuyen(quyen));
}

/** Người dùng hiện tại có phải quản trị viên hệ thống. */
export function laQuanTri() {
  return nguoiDung?.vaiTro === 'Admin';
}

/** Người dùng hiện tại có phải khách hàng (cổng khách hàng). */
export function laKhachHang() {
  return nguoiDung?.vaiTro === 'Khách hàng';
}

/** Người dùng nội bộ (Admin / Quản lý / Nhân viên). */
export function laNguoiDungNoiBo() {
  return Boolean(nguoiDung) && nguoiDung.vaiTro !== 'Khách hàng';
}

/** Mã khách hàng của chính người đang đăng nhập. */
export function maKhachHangCuaToi() {
  return nguoiDung?.maKH ? Number(nguoiDung.maKH) : null;
}
