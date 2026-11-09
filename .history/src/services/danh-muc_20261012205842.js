/**
 * Danh mục hằng số nghiệp vụ dùng chung cho giao diện.
 * Giúp frontend hiển thị dropdown đúng giá trị mà backend chấp nhận.
 */
'use strict';

const config = require('../config');
const reportService = require('./report.service');

module.exports = {
  vaiTro: Object.values(config.ROLES),
  chucVu: config.CHUC_VU,
  trangThaiNhanVien: config.TRANG_THAI_NV,
  trangThaiKhachHang: ['Hoạt động', 'Bị khóa', 'Đã xóa'],
  trangThaiTaiKhoan: config.TRANG_THAI_TK,
  trangThaiSanPham: config.TRANG_THAI_SP,
  trangThaiDonHang: config.TRANG_THAI_DH,
  luongDonHang: config.LUONG_DON_HANG,
  trangThaiPhieuNhap: config.TRANG_THAI_PNH,
  trangThaiPhanHoi: config.TRANG_THAI_PH,
  trangThaiKhaoSat: config.TRANG_THAI_KS,
  loaiKhaoSat: config.LOAI_KHAO_SAT,
  loaiCauHoi: config.LOAI_CAU_HOI,
  loaiGiaoDichDiem: config.LOAI_GIAO_DICH_DIEM,
  hinhThucDonHang: config.HINH_THUC_DH,
  gioiTinh: ['Nam', 'Nữ', 'Khác'],
  trangThaiNhaCungCap: ['Đang hợp tác', 'Ngừng hợp tác'],
  quyDoiDiem: {
    vndPerPoint: config.VND_PER_POINT,
    vndPerPointRedeem: config.VND_PER_POINT_REDEEM,
  },
  nguongSapHet: config.NGUONG_SAP_HET,
  pageSize: config.PAGE_SIZE,
  loaiBaoCao: reportService.LOAI_BAO_CAO,
