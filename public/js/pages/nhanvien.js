/**
 * Trang NHÓM 4 — Quản lý nhân viên và tài khoản (CN4.1 → CN4.5).
 */
'use strict';

import { api } from '../api.js';
import { danhSach } from '../store.js';
import { ngay, ngayChoInput, soDienThoai } from '../format.js';
import {
  baoLoiApi,
  dangXuLy,
  el,
  hopThoai,
  moTaCot,
  nhan,
  nut,
  thanhCong,
  truong,
} from '../ui.js';
import { taoTrangCrud, cotSo, cotTrangThai } from '../trang-crud.js';

/** Mở hộp thoại đặt lại mật khẩu cho một nhân viên. */
function moDatLaiMatKhau(ban, sauKhiXong) {
  const bieuMau = el('form', { thuocTinh: { novalidate: true } }, [
    moTaCot([
      { nhan: 'Nhân viên', giaTri: ban.hoTen },
      { nhan: 'Tên đăng nhập', giaTri: ban.tenDangNhap ?? '—' },
    ]),
    el('div', { thuocTinh: { style: 'margin-top:16px' } }, [
      truong({
        ten: 'matKhau',
        nhan: 'Mật khẩu mới',
        loai: 'text',
        batBuoc: true,
        giaTri: 'Coffee@123',
        goiY: 'Mật khẩu mặc định là Coffee@123. Phiên đăng nhập cũ sẽ bị hủy.',
        thuocTinh: { minlength: 6, maxlength: 100 },
      }),
    ]),
  ]);

  const nutLuu = nut({
    nhan: 'Đặt lại mật khẩu',
    bieuTuong: 'khoa',
    chinh: true,
    nghe: () => gui(),
  });

  const hop = hopThoai({
    tieuDe: 'Đặt lại mật khẩu nhân viên',
    moTa: 'Cấp mật khẩu mới cho tài khoản đăng nhập của nhân viên.',
    than: bieuMau,
    nutChan: [nut({ nhan: 'Hủy bỏ', lop: 'nut-trong', nghe: () => hop.dong() }), nutLuu],
  });

  async function gui() {
    const matKhau = bieuMau.querySelector('[name="matKhau"]').value.trim();
    if (matKhau.length < 6) {
      baoLoiApi(new Error('Mật khẩu phải có ít nhất 6 ký tự.'), 'Mật khẩu chưa hợp lệ');
      return;
    }
    dangXuLy(nutLuu, true);
    try {
      await api.post(`/api/nhanvien/${ban.maNV}/dat-lai-mat-khau`, { matKhau });
      thanhCong('Đã đặt lại mật khẩu', `Mật khẩu mới: ${matKhau}`);
      hop.dong();
      if (sauKhiXong) await sauKhiXong();
    } catch (loi) {
      baoLoiApi(loi);
    } finally {
      dangXuLy(nutLuu, false);
    }
  }

  bieuMau.addEventListener('submit', (suKien) => {
    suKien.preventDefault();
    gui();
  });
}

/** Mở hộp thoại xem chi tiết một nhân viên. */
async function moChiTiet(ban) {
  let chiTiet;
  try {
    chiTiet = await api.doc(`/api/nhanvien/${ban.maNV}`);
  } catch (loi) {
    baoLoiApi(loi, 'Không tải được chi tiết nhân viên');
    return;
  }

  const than = el('div', {}, [
    moTaCot([
      { nhan: 'Họ tên', giaTri: chiTiet.hoTen },
      { nhan: 'Chức vụ', giaTri: chiTiet.chucVu },
      { nhan: 'Email', giaTri: chiTiet.email },
      { nhan: 'Điện thoại', giaTri: soDienThoai(chiTiet.sdt), so: true },
      { nhan: 'Ngày vào làm', giaTri: ngay(chiTiet.ngayVao), so: true },
      { nhan: 'Trạng thái công việc', node: nhan(chiTiet.trangThai) },
      { nhan: 'Trạng thái tài khoản', node: nhan(chiTiet.trangThaiTaiKhoan) },
      { nhan: 'Tài khoản', giaTri: chiTiet.tenDangNhap ?? 'Chưa có' },
      { nhan: 'Vai trò hệ thống', giaTri: chiTiet.vaiTro ?? '—' },
      { nhan: 'Lần đăng nhập cuối', giaTri: chiTiet.lanDangNhapCuoi ? ngay(chiTiet.lanDangNhapCuoi) : 'Chưa đăng nhập', so: true },
      { nhan: 'Số đơn hàng phụ trách', giaTri: chiTiet.soDonHang, so: true },
      { nhan: 'Số phiếu nhập đã lập', giaTri: chiTiet.soPhieuNhap, so: true },
      { nhan: 'Số phản hồi đã xử lý', giaTri: chiTiet.soPhanHoiXuLy, so: true },
      { nhan: 'Số khảo sát phụ trách', giaTri: chiTiet.soKhaoSat, so: true },
    ]),
  ]);

  const hopDangMo = hopThoai({
    tieuDe: `Chi tiết nhân viên: ${chiTiet.hoTen}`,
    moTa: `Mã nhân viên ${chiTiet.maNV}`,
    than,
    rong: true,
    nutChan: [nut({ nhan: 'Đóng', lop: 'nut-trong', nghe: () => hopDangMo.dong() })],
  });
  hopDangMo.hop.classList.add('hop-rong');
}

/** Màn hình quản lý nhân viên. */
export const manHinh = taoTrangCrud({
  ma: 'nhanvien',
  tieuDe: 'Nhân viên',
  moTa: 'Hồ sơ nhân viên kèm tài khoản đăng nhập và vai trò phân quyền.',
  bieuTuong: 'nhan-vien',
  quyen: 'employee.view',
  duongDanApi: '/api/nhanvien',
  tenKhoa: 'maNV',
  truongHienThi: 'hoTen',
  nhanThem: 'Thêm nhân viên',
  tenTepCsv: 'nhan-vien',
  sapXepMacDinh: 'hoTen',

  boLoc: [
    { ten: 'chucVu', nhan: 'Chức vụ', danhMuc: 'chucVu' },
    { ten: 'trangThaiTaiKhoan', nhan: 'Trạng thái tài khoản', danhMuc: 'trangThaiTaiKhoan' },
  ],

  cot: [
    { tieuDe: 'Mã', truong: 'maNV', lop: 'so' },
    { tieuDe: 'Họ tên', truong: 'hoTen', lop: 'manh', sapXepTheo: 'hoTen' },
    { tieuDe: 'Chức vụ', truong: 'chucVu', sapXepTheo: 'chucVu' },
    { tieuDe: 'Email', truong: 'email', lop: 'mo' },
    { tieuDe: 'Điện thoại', lop: 'so', lay: (ban) => soDienThoai(ban.sdt) },
    { tieuDe: 'Ngày vào', lop: 'so', sapXepTheo: 'ngayVao', lay: (ban) => ngay(ban.ngayVao) },
    {
      tieuDe: 'Vai trò',
      dung: (ban) => (ban.vaiTro ? nhan(ban.vaiTro, 'nhan-xam') : el('span', { vanBan: '—' })),
    },
    cotSo('Đơn hàng', 'soDonHang', { sapXepTheo: null }),
    cotTrangThai('Trạng thái tài khoản', 'trangThaiTaiKhoan', 'trangThaiTaiKhoan'),
  ],

  truong: [
    {
      ten: 'hoTen',
      nhan: 'Họ tên nhân viên',
      loai: 'text',
      batBuoc: true,
      thuocTinh: { maxlength: 100 },
    },
    {
      ten: 'email',
      nhan: 'Email (dùng làm tên đăng nhập)',
      loai: 'email',
      batBuoc: true,
      goiY: 'Ví dụ: an.nv@coffeecrm.vn',
      thuocTinh: { maxlength: 150 },
    },
    {
      ten: 'chucVu',
      nhan: 'Chức vụ',
      loai: 'select',
      batBuoc: true,
      tuyChon: { muc: () => danhSach('chucVu'), mucRong: '— Chọn chức vụ —' },
      goiY: 'Chức vụ "Quản lý" sẽ được cấp vai trò Quản lý trong hệ thống.',
    },
    {
      ten: 'sdt',
      nhan: 'Số điện thoại',
      loai: 'text',
      thuocTinh: { maxlength: 15 },
    },
    {
      ten: 'ngayVao',
      nhan: 'Ngày vào làm',
      loai: 'date',
      goiY: 'Để trống nếu chưa xác định.',
    },
    {
      ten: 'matKhau',
      nhan: 'Mật khẩu ban đầu',
      loai: 'text',
      anKhiSua: true,
      giaTriMacDinh: 'Coffee@123',
      goiY: 'Mặc định Coffee@123 nếu để trống.',
    },
    {
      ten: 'trangThaiTaiKhoan',
      nhan: 'Trạng thái tài khoản',
      loai: 'select',
      anKhiTao: true,
      tuyChon: { muc: () => danhSach('trangThaiTaiKhoan') },
      goiY: 'Chọn Hoạt động để cho phép đăng nhập hoặc Bị khóa để chặn đăng nhập.',
    },
  ],

  truocKhiGui: (duLieu) => {
    if (duLieu.ngayVao) duLieu.ngayVao = ngayChoInput(duLieu.ngayVao);
    return duLieu;
  },

  thaoTacThem: [
    {
      nhan: 'Đặt lại mật khẩu',
      bieuTuong: 'khoa',
      thucHien: (ban, veBang) => moDatLaiMatKhau(ban, veBang),
    },
  ],

  hanhDongThem: [
    {
      nhan: 'Chi tiết',
      bieuTuong: 'ho-so',
      thucHien: (ban) => moChiTiet(ban),
    },
  ],
});
