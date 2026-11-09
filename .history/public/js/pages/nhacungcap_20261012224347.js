/**
 * Trang NHÓM 3 — Quản lý nhà cung cấp (CN3.1 → CN3.4).
 */
'use strict';

import { taoTrangCrud, cotSo, cotTrangThai } from '../trang-crud.js';
import { danhSach } from '../store.js';
import { soDienThoai } from '../format.js';

/** Màn hình quản lý nhà cung cấp. */
export const manHinh = taoTrangCrud({
  ma: 'nhacungcap',
  tieuDe: 'Nhà cung cấp',
  moTa: 'Đối tác cung cấp nguyên liệu; theo dõi số phiếu nhập và tổng chi phí.',
  bieuTuong: 'nha-cung-cap',
  quyen: 'catalog.view',
  duongDanApi: '/api/nhacungcap',
  tenKhoa: 'maNCC',
  truongHienThi: 'tenNCC',
  nhanThem: 'Thêm nhà cung cấp',
  tenTepCsv: 'nha-cung-cap',
  sapXepMacDinh: 'tenNCC',

  boLoc: [{ ten: 'trangThai', nhan: 'Trạng thái', danhMuc: 'trangThaiNhaCungCap' }],

  cot: [
    { tieuDe: 'Mã', truong: 'maNCC', lop: 'so' },
    { tieuDe: 'Tên nhà cung cấp', truong: 'tenNCC', lop: 'manh', sapXepTheo: 'tenNCC' },
    {
      tieuDe: 'Điện thoại',
      lop: 'so',
      lay: (ban) => soDienThoai(ban.sdt),
    },
    { tieuDe: 'Địa chỉ', truong: 'diaChi', lop: 'mo' },
    { tieuDe: 'Email', truong: 'email', lop: 'mo' },
    cotSo('Số phiếu nhập', 'soPhieuNhap', { sapXepTheo: 'soPhieuNhap' }),
    cotSo('Tổng chi phí', 'tongChiPhi', { sapXepTheo: 'tongChiPhi', tienTe: true }),
    cotTrangThai('Trạng thái', 'trangThai'),
  ],

  truong: [
    {
      ten: 'tenNCC',
      nhan: 'Tên nhà cung cấp',
      loai: 'text',
      batBuoc: true,
      goiY: 'Ví dụ: Công ty TNHH Cà phê Trung Nguyên',
      thuocTinh: { maxlength: 150 },
    },
    {
      ten: 'sdt',
      nhan: 'Số điện thoại',
      loai: 'text',
      goiY: '10 chữ số, ví dụ 0901234567',
      thuocTinh: { maxlength: 15 },
    },
    {
      ten: 'email',
      nhan: 'Email',
      loai: 'email',
      goiY: 'dia.chi@congty.vn',
      thuocTinh: { maxlength: 150 },
    },
    {
      ten: 'diaChi',
      nhan: 'Địa chỉ',
      loai: 'text',
      rong: true,
      thuocTinh: { maxlength: 255 },
    },
    {
      ten: 'trangThai',
      nhan: 'Trạng thái hợp tác',
      loai: 'select',
      giaTriMacDinh: danhSach('trangThaiNhaCungCap')[0] ?? 'Đang hợp tác',
      batBuoc: true,
      tuyChon: { muc: danhSach('trangThaiNhaCungCap') },
      goiY: 'Chuyển sang "Ngừng hợp tác" nếu không còn nhập hàng từ đối tác này.',
    },
  ],
});
