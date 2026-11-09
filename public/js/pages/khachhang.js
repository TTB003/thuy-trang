/**
 * Trang NHÓM 5 — Quản lý khách hàng (CN5.1 → CN5.4).
 */
'use strict';

import { api } from '../api.js';
import { danhSach } from '../store.js';
import { ngay, ngayChoInput, soDienThoai, tien } from '../format.js';
import {
  bangPhu,
  baoLoiApi,
  el,
  hopThoai,
  moTaCot,
  nhan,
  nut,
  thanhCong,
  xacNhan,
} from '../ui.js';
import { taoTrangCrud, cotSo, cotTrangThai } from '../trang-crud.js';

/** Đảo trạng thái khóa / mở khóa của một khách hàng. */
async function doiTrangThai(ban, veBang) {
  const seKhoa = ban.trangThai !== 'Bị khóa';
  const dongY = await xacNhan({
    tieuDe: seKhoa ? 'Khóa khách hàng' : 'Mở khóa khách hàng',
    noiDung: seKhoa
      ? `Khách hàng "${ban.hoTen}" sẽ không thể đăng nhập. Tài khoản liên quan cũng bị khóa.`
      : `Mở lại quyền đăng nhập cho khách hàng "${ban.hoTen}".`,
    nhanDongY: seKhoa ? 'Khóa khách hàng' : 'Mở khóa',
    nguyHiem: seKhoa,
  });
  if (!dongY) return;
  try {
    await api.patch(`/api/khachhang/${ban.maKH}/trang-thai`, {
      trangThai: seKhoa ? 'Bị khóa' : 'Hoạt động',
    });
    thanhCong(seKhoa ? 'Đã khóa khách hàng' : 'Đã mở khóa khách hàng');
    await veBang();
  } catch (loi) {
    baoLoiApi(loi);
  }
}

/** Mở hộp thoại hồ sơ chi tiết khách hàng kèm lịch sử mua hàng và điểm. */
async function moHoSo(ban) {
  let hoSo;
  try {
    hoSo = await api.doc(`/api/khachhang/${ban.maKH}`);
  } catch (loi) {
    baoLoiApi(loi, 'Không tải được hồ sơ khách hàng');
    return;
  }

  const than = el('div', {}, [
    moTaCot([
      { nhan: 'Họ tên', giaTri: hoSo.hoTen },
      { nhan: 'Điện thoại', giaTri: soDienThoai(hoSo.sdt), so: true },
      { nhan: 'Email', giaTri: hoSo.email },
      { nhan: 'Ngày sinh', giaTri: ngay(hoSo.ngaySinh), so: true },
      { nhan: 'Tuổi', giaTri: hoSo.tuoi ?? '—', so: true },
      { nhan: 'Giới tính', giaTri: hoSo.gioiTinh },
      { nhan: 'Địa chỉ', giaTri: hoSo.diaChi },
      { nhan: 'Sở thích', giaTri: hoSo.soThich },
      { nhan: 'Điểm tích lũy', giaTri: `${hoSo.diemTichLuy} điểm`, so: true },
      { nhan: 'Ngày đăng ký', giaTri: ngay(hoSo.ngayDangKy), so: true },
      { nhan: 'Trạng thái', node: nhan(hoSo.trangThai) },
      { nhan: 'Tổng chi tiêu', giaTri: tien(hoSo.tongChiTieu), so: true },
      { nhan: 'Số đơn hàng', giaTri: hoSo.soDonHang, so: true },
      { nhan: 'Sản phẩm đã mua', giaTri: hoSo.soThichSanPham || '—' },
    ]),
    el('h3', {
      vanBan: `Đơn hàng gần đây (${hoSo.donHangGanDay?.length ?? 0})`,
      thuocTinh: { style: 'margin-top:22px;font-size:14px' },
    }),
    el('div', { thuocTinh: { style: 'margin-top:10px' } }, [
      hoSo.donHangGanDay?.length
        ? bangPhu({
            cot: [
              { tieuDe: 'Mã đơn', lop: 'so', truong: 'maDH' },
              { tieuDe: 'Ngày đặt', lop: 'so', lay: (dong) => ngay(dong.ngayDat) },
              { tieuDe: 'Số mặt hàng', lop: 'so', truong: 'soMatHang' },
              { tieuDe: 'Hình thức', truong: 'hinhThuc' },
              { tieuDe: 'Tổng tiền', lop: 'so', lay: (dong) => tien(dong.tongTien) },
              { tieuDe: 'Trạng thái', dung: (dong) => nhan(dong.trangThai) },
            ],
            duLieu: hoSo.donHangGanDay,
          })
        : el('p', { lop: 'mo-chu', vanBan: 'Khách hàng chưa có đơn hàng nào.' }),
    ]),
    el('h3', {
      vanBan: `Lịch sử điểm (${hoSo.lichSuDiem?.length ?? 0})`,
      thuocTinh: { style: 'margin-top:22px;font-size:14px' },
    }),
    el('div', { thuocTinh: { style: 'margin-top:10px' } }, [
      hoSo.lichSuDiem?.length
        ? bangPhu({
            cot: [
              { tieuDe: 'Ngày', lop: 'so', lay: (dong) => ngay(dong.ngayGD) },
              { tieuDe: 'Mã đơn', lop: 'so', truong: 'maDH' },
              { tieuDe: 'Loại', dung: (dong) => nhan(dong.loaiGD, 'nhan-xam') },
              { tieuDe: 'Số điểm', lop: 'so', truong: 'soDiem' },
              { tieuDe: 'Ghi chú', truong: 'ghiChu', lop: 'mo' },
            ],
            duLieu: hoSo.lichSuDiem,
          })
        : el('p', { lop: 'mo-chu', vanBan: 'Chưa phát sinh giao dịch điểm.' }),
    ]),
  ]);

  const hop = hopThoai({
    tieuDe: `Hồ sơ khách hàng: ${hoSo.hoTen}`,
    moTa: `Mã khách hàng ${hoSo.maKH}`,
    than,
    rong: true,
    nutChan: [nut({ nhan: 'Đóng', lop: 'nut-trong', nghe: () => hop.dong() })],
  });
}

/** Màn hình quản lý khách hàng. */
export const manHinh = taoTrangCrud({
  ma: 'khachhang',
  tieuDe: 'Khách hàng',
  moTa: 'Hồ sơ khách hàng, điểm tích lũy và lịch sử mua hàng.',
  bieuTuong: 'khach-hang',
  quyen: 'customer.view',
  duongDanApi: '/api/khachhang',
  tenKhoa: 'maKH',
  truongHienThi: 'hoTen',
  choTao: false,
  tenTepCsv: 'khach-hang',
  sapXepMacDinh: 'hoTen',

  boLoc: [
    { ten: 'gioiTinh', nhan: 'Giới tính', danhMuc: 'gioiTinh' },
    { ten: 'trangThai', nhan: 'Trạng thái', danhMuc: 'trangThaiKhachHang' },
  ],

  cot: [
    { tieuDe: 'Mã', truong: 'maKH', lop: 'so' },
    { tieuDe: 'Họ tên', truong: 'hoTen', lop: 'manh', sapXepTheo: 'hoTen' },
    { tieuDe: 'Điện thoại', lop: 'so', lay: (ban) => soDienThoai(ban.sdt) },
    { tieuDe: 'Giới tính', truong: 'gioiTinh' },
    { tieuDe: 'Tuổi', lop: 'so', lay: (ban) => ban.tuoi ?? '—' },
    cotSo('Điểm tích lũy', 'diemTichLuy', { sapXepTheo: 'diemTichLuy' }),
    cotSo('Số đơn hàng', 'soDonHang', { sapXepTheo: 'soDonHang' }),
    cotSo('Tổng chi tiêu', 'tongChiTieu', { sapXepTheo: 'tongChiTieu', tienTe: true }),
    cotTrangThai('Trạng thái', 'trangThai'),
  ],

  truong: [
    {
      ten: 'hoTen',
      nhan: 'Họ tên khách hàng',
      loai: 'text',
      batBuoc: true,
      thuocTinh: { maxlength: 100 },
    },
    {
      ten: 'sdt',
      nhan: 'Số điện thoại (dùng làm tên đăng nhập)',
      loai: 'text',
      batBuoc: true,
      goiY: 'Ví dụ: 0912000001',
      thuocTinh: { maxlength: 15 },
    },
    {
      ten: 'email',
      nhan: 'Email',
      loai: 'email',
      thuocTinh: { maxlength: 150 },
    },
    {
      ten: 'ngaySinh',
      nhan: 'Ngày sinh',
      loai: 'date',
    },
    {
      ten: 'gioiTinh',
      nhan: 'Giới tính',
      loai: 'select',
      tuyChon: { muc: danhSach('gioiTinh'), mucRong: '— Chưa rõ —' },
    },
    {
      ten: 'diaChi',
      nhan: 'Địa chỉ',
      loai: 'text',
      thuocTinh: { maxlength: 255 },
    },
    {
      ten: 'soThich',
      nhan: 'Sở thích',
      loai: 'text',
      rong: true,
      goiY: 'Ví dụ: Cà phê đen, ít đường',
      thuocTinh: { maxlength: 150 },
    },
    {
      ten: 'matKhau',
      nhan: 'Mật khẩu ban đầu',
      loai: 'text',
      anKhiSua: true,
      giaTriMacDinh: 'Khach@123',
      goiY: 'Mặc định Khach@123 nếu để trống.',
    },
  ],

  truocKhiGui: (duLieu) => {
    if (duLieu.ngaySinh) duLieu.ngaySinh = ngayChoInput(duLieu.ngaySinh);
    return duLieu;
  },

  thaoTacThem: [
    {
      nhan: 'Khóa / Mở khóa',
      bieuTuong: 'khoa',
      thucHien: (ban, veBang) => doiTrangThai(ban, veBang),
    },
  ],

  hanhDongThem: [
    {
      nhan: 'Hồ sơ',
      bieuTuong: 'ho-so',
      thucHien: (ban) => moHoSo(ban),
    },
  ],
});
