/**
 * Trang NHÓM 1 — Quản lý loại sản phẩm (CN1.1 → CN1.4).
 */
'use strict';

import { taoTrangCrud, cotSo } from '../trang-crud.js';

/** Màn hình quản lý loại sản phẩm. */
export const manHinh = taoTrangCrud({
  ma: 'loaisanpham',
  tieuDe: 'Loại sản phẩm',
  moTa: 'Phân nhóm sản phẩm theo loại để quản lý danh mục và báo cáo.',
  bieuTuong: 'phan-loai',
  quyen: 'catalog.view',
  duongDanApi: '/api/loaisanpham',
  tenKhoa: 'maLoai',
  truongHienThi: 'tenLoai',
  nhanThem: 'Thêm loại sản phẩm',
  tenTepCsv: 'loai-san-pham',

  cot: [
    { tieuDe: 'Mã', truong: 'maLoai', lop: 'so', thuocTinh: { style: 'width:70px' } },
    { tieuDe: 'Tên loại sản phẩm', truong: 'tenLoai', lop: 'manh' },
    { tieuDe: 'Mô tả', truong: 'moTa', lop: 'mo' },
    cotSo('Số sản phẩm', 'soSanPham', { sapXepTheo: null }),
  ],

  truong: [
    {
      ten: 'tenLoai',
      nhan: 'Tên loại sản phẩm',
      loai: 'text',
      batBuoc: true,
      goiY: 'Ví dụ: Cà phê Việt Nam',
      thuocTinh: { maxlength: 100 },
    },
    {
      ten: 'moTa',
      nhan: 'Mô tả',
      loai: 'textarea',
      rong: true,
      goiY: 'Mô tả ngắn giúp nhân viên chọn đúng loại khi tạo sản phẩm.',
      thuocTinh: { maxlength: 255 },
    },
  ],
});
