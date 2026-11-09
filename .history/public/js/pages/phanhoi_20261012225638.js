/**
 * Trang NHÓM 10 — Quản lý phản hồi khách hàng (CN10.1 → CN10.4).
 */
'use strict';

import { api } from '../api.js';
import { ngayGio, soDienThoai } from '../format.js';
import {
  baoLoiApi,
  dangXuLy,
  el,
  hopThoai,
  icon,
  moTaCot,
  nhan,
  nut,
  thanhCong,
  truong,
} from '../ui.js';
import { taoTrangCrud, cotTrangThai } from '../trang-crud.js';

/** Dữ liệu nạp trước cho các ô chọn động trong biểu mẫu. */
const DU_LIEU_CHON = { khachHang: [], sanPham: [] };

/** Nạp danh sách khách hàng và sản phẩm để chọn trong biểu mẫu. */
async function napDuLieuChon() {
  try {
    const [KH, SP] = await Promise.all([
      api.doc('/api/khachhang', { pageSize: 100 }),
      api.doc('/api/sanpham', { pageSize: 100 }),
    ]);
    DU_LIEU_CHON.khachHang = Array.isArray(KH?.items) ? KH.items : [];
    DU_LIEU_CHON.sanPham = Array.isArray(SP?.items) ? SP.items : [];
  } catch {
    // Nếu không nạp được, biểu mẫu vẫn hiển thị với ô chọn rỗng.
  }
}

const MUC_KHACH_HANG = () =>
  DU_LIEU_CHON.khachHang.map((kh) => ({
    giaTri: kh.maKH,
    nhan: `${kh.hoTen} — ${soDienThoai(kh.sdt)}`,
  }));

const MUC_SAN_PHAM = () =>
  DU_LIEU_CHON.sanPham.map((sp) => ({ giaTri: sp.maSP, nhan: sp.tenSP }));

const MUC_DANH_GIA = [
  { giaTri: 5, nhan: '5 sao — Rất hài lòng' },
  { giaTri: 4, nhan: '4 sao — Hài lòng' },
  { giaTri: 3, nhan: '3 sao — Bình thường' },
  { giaTri: 2, nhan: '2 sao — Chưa hài lòng' },
  { giaTri: 1, nhan: '1 sao — Rất không hài lòng' },
];

/** Dãy sao chỉ để hiển thị. */
function hienThiSao(soSao) {
  const giaTri = Number(soSao) || 0;
  const hop = el('span', { lop: 'hop-danh-gia' });
  for (let sao = 1; sao <= 5; sao += 1) {
    const the = el('span', {
      lop: `sao ${sao <= giaTri ? 'dang-sang' : ''}`,
      html: icon('danh-gia').innerHTML,
      thuocTinh: { title: `${giaTri}/5 sao` },
    });
    hop.append(the);
  }
  hop.append(el('span', { lop: 'nho-chu mo-chu', vanBan: `${giaTri}/5` }));
  return hop;
}

/** Mở hộp thoại xem đầy đủ nội dung một phản hồi. */
async function moChiTiet(ban) {
  let chiTiet;
  try {
    chiTiet = await api.doc(`/api/phanhoi/${ban.maPH}`);
  } catch (loi) {
    baoLoiApi(loi, 'Không tải được phản hồi');
    return;
  }

  const than = el('div', {}, [
    moTaCot([
      { nhan: 'Khách hàng', giaTri: chiTiet.tenKhachHang },
      { nhan: 'Điện thoại', giaTri: soDienThoai(chiTiet.sdtKhachHang), so: true },
      { nhan: 'Sản phẩm', giaTri: chiTiet.tenSP ?? 'Không gắn sản phẩm' },
      { nhan: 'Đánh giá', node: hienThiSao(chiTiet.danhGia) },
      { nhan: 'Trạng thái', node: nhan(chiTiet.trangThai) },
      { nhan: 'Ngày gửi', giaTri: ngayGio(chiTiet.ngayGui), so: true },
      { nhan: 'Nhân viên xử lý', giaTri: chiTiet.tenNhanVien ?? 'Chưa phân công' },
      { nhan: 'Ngày xử lý', giaTri: chiTiet.ngayXuLy ? ngayGio(chiTiet.ngayXuLy) : '—', so: true },
    ]),
    el('h3', {
      vanBan: 'Nội dung khách hàng gửi',
      thuocTinh: { style: 'margin-top:20px;font-size:14px' },
    }),
    el('p', {
      vanBan: chiTiet.noiDung,
      thuocTinh: { style: 'margin-top:6px;white-space:pre-wrap' },
    }),
    el('h3', {
      vanBan: 'Phản hồi của cửa hàng',
      thuocTinh: { style: 'margin-top:20px;font-size:14px' },
    }),
    el('p', {
      vanBan: chiTiet.phanHoiLai || 'Chưa có phản hồi lại.',
      lop: chiTiet.phanHoiLai ? '' : 'mo-chu',
      thuocTinh: { style: 'margin-top:6px;white-space:pre-wrap' },
    }),
  ]);

  hopThoai({
    tieuDe: `Phản hồi #${chiTiet.maPH}`,
    moTa: `${chiTiet.tenKhachHang} · ${ngayGio(chiTiet.ngayGui)}`,
    than,
    rong: true,
    nutChan: [nut({ nhan: 'Đóng', lop: 'nut-trong', nghe: () => hop.dong() })],
  });
}

/** Mở hộp thoại tiếp nhận và trả lời một phản hồi (CN10.2). */
function moXuLy(ban, veBang) {
  const bieuMau = el('form', { thuocTinh: { novalidate: true } }, [
    moTaCot([
      { nhan: 'Khách hàng', giaTri: ban.tenKhachHang },
      { nhan: 'Đánh giá', node: hienThiSao(ban.danhGia) },
      { nhan: 'Ngày gửi', giaTri: ngayGio(ban.ngayGui), so: true },
    ]),
    el('div', { thuocTinh: { style: 'margin-top:14px' } }, [
      el('p', { lop: 'mo-chu nho-chu', vanBan: 'Nội dung khách hàng gửi:' }),
      el('p', {
        vanBan: ban.noiDung,
        thuocTinh: {
          style: 'margin-top:4px;padding:10px 12px;background:var(--cream);border:1px solid var(--line);border-radius:8px;white-space:pre-wrap',
        },
      }),
    ]),
    el('div', { thuocTinh: { style: 'margin-top:16px' } }, [
      truong({
        ten: 'phanHoiLai',
        nhan: 'Nội dung phản hồi lại khách hàng',
        loai: 'textarea',
        batBuoc: true,
        giaTri: ban.phanHoiLai ?? '',
        goiY: 'Nhân viên đang đăng nhập sẽ được ghi nhận là người xử lý.',
        thuocTinh: { maxlength: 1000 },
      }),
    ]),
  ]);

  const nutLuu = nut({
    nhan: 'Đánh dấu đã xử lý',
    bieuTuong: 'tick',
    chinh: true,
    nghe: () => gui(),
  });

  const hop = hopThoai({
    tieuDe: 'Xử lý phản hồi khách hàng',
    moTa: `Phản hồi #${ban.maPH}`,
    than: bieuMau,
    nutChan: [nut({ nhan: 'Hủy bỏ', lop: 'nut-trong', nghe: () => hop.dong() }), nutLuu],
    rong: true,
  });

  async function gui() {
    const phanHoiLai = bieuMau.querySelector('[name="phanHoiLai"]').value.trim();
    if (!phanHoiLai) {
      baoLoiApi(new Error('Vui lòng nhập nội dung phản hồi lại.'), 'Thiếu nội dung');
      return;
    }
    dangXuLy(nutLuu, true);
    try {
      await api.post(`/api/phanhoi/${ban.maPH}/xu-ly`, { phanHoiLai });
      thanhCong('Đã xử lý phản hồi', 'Trạng thái chuyển sang "Đã xử lý".');
      hop.dong();
      await veBang();
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

/** Màn hình quản lý phản hồi. */
export const manHinh = taoTrangCrud({
  ma: 'phanhoi',
  tieuDe: 'Phản hồi khách hàng',
  moTa: 'Tiếp nhận, phân công và trả lời ý kiến – đánh giá của khách hàng.',
  bieuTuong: 'phan-hoi',
  quyen: 'feedback.view',
  duongDanApi: '/api/phanhoi',
  tenKhoa: 'maPH',
  truongHienThi: 'tenKhachHang',
  nhanThem: 'Ghi nhận phản hồi',
  tenTepCsv: 'phan-hoi',
  chuanBi: napDuLieuChon,

  boLoc: [
    { ten: 'trangThai', nhan: 'Trạng thái', danhMuc: 'trangThaiPhanHoi' },
    { ten: 'danhGia', nhan: 'Số sao', muc: MUC_DANH_GIA.map((muc) => muc.giaTri) },
  ],

  cot: [
    { tieuDe: 'Mã', truong: 'maPH', lop: 'so' },
    { tieuDe: 'Khách hàng', truong: 'tenKhachHang', lop: 'manh' },
    { tieuDe: 'Điện thoại', lop: 'so', lay: (ban) => soDienThoai(ban.sdtKhachHang) },
    { tieuDe: 'Sản phẩm', truong: 'tenSP', lop: 'mo' },
    { tieuDe: 'Đánh giá', dung: (ban) => hienThiSao(ban.danhGia) },
    { tieuDe: 'Nội dung', lop: 'mo', lay: (ban) => ban.noiDung },
    { tieuDe: 'Nhân viên xử lý', truong: 'tenNhanVien', lop: 'mo' },
    { tieuDe: 'Ngày gửi', lop: 'so', lay: (ban) => ngayGio(ban.ngayGui) },
    cotTrangThai('Trạng thái', 'trangThai'),
  ],

  truong: [
    {
      ten: 'maKH',
      nhan: 'Khách hàng',
      loai: 'select',
      so: true,
      batBuoc: true,
      tuyChon: { muc: MUC_KHACH_HANG, mucRong: '— Chọn khách hàng —' },
      goiY: 'Tìm nhanh trong danh sách theo họ tên hoặc số điện thoại.',
    },
    {
      ten: 'danhGia',
      nhan: 'Mức độ hài lòng',
      loai: 'select',
      so: true,
      batBuoc: true,
      giaTriMacDinh: 5,
      tuyChon: { muc: MUC_DANH_GIA },
    },
    {
      ten: 'maSP',
      nhan: 'Sản phẩm được đánh giá',
      loai: 'select',
      so: true,
      tuyChon: { muc: MUC_SAN_PHAM, mucRong: '— Không gắn sản phẩm —' },
    },
    {
      ten: 'noiDung',
      nhan: 'Nội dung phản hồi',
      loai: 'textarea',
      batBuoc: true,
      rong: true,
      thuocTinh: { maxlength: 1000 },
    },
  ],

  thaoTacThem: [
    {
      nhan: 'Xử lý',
      bieuTuong: 'tick',
      thucHien: (ban, veBang) => moXuLy(ban, veBang),
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
