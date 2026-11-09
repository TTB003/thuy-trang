/**
 * Trang NHÓM 9 — Quản lý chương trình khuyến mãi (CN9.1 → CN9.6).
 */
'use strict';

import { api } from '../api.js';
import { ngay, ngayChoInput, tien } from '../format.js';
import {
  bangPhu,
  baoLoiApi,
  canhBao,
  dangXuLy,
  danhSachChon,
  el,
  hopThoai,
  layDaChon,
  moTaCot,
  nhan,
  nut,
  thanhCong,
  xacNhan,
} from '../ui.js';
import { taoTrangCrud, cotSo, cotTrangThai } from '../trang-crud.js';

/**
 * Trạng thái khuyến mãi — phải khớp hằng số TRANG_THAI_KM
 * trong src/services/promotion.service.js phía máy chủ.
 */
const TRANG_THAI_KHUYEN_MAI = ['Đang diễn ra', 'Đã kết thúc', 'Tạm dừng'];

/** Tải toàn bộ sản phẩm để chọn khi áp dụng khuyến mãi. */
async function lay TatCaSanPham() {
  const ketQua = await api.doc('/api/sanpham', { pageSize: 100 });
  return Array.isArray(ketQua?.items) ? ketQua.items : [];
}

/** Mở hộp thoại áp dụng khuyến mãi cho một danh sách sản phẩm. */
async function moApDung(ban, veBang) {
  let tatCaSanPham;
  let chiTiet;
  try {
    tatCaSanPham = await layTatCaSanPham();
    chiTiet = await api.doc(`/api/khuyenmai/${ban.maKM}`);
  } catch (loi) {
    baoLoiApi(loi, 'Không tải được dữ liệu khuyến mãi');
    return;
  }

  const dangApDung = new Set((chiTiet.sanPham ?? []).map((sp) => Number(sp.maSP)));
  const muc = tatCaSanPham.map((sp) => ({
    giaTri: sp.maSP,
    nhan: `${sp.tenSP} — ${tien(sp.gia)}`,
  }));

  const khoiChon = danhSachChon({ ten: 'danhSachMaSP', cacMuc: muc, dangChon: [] });

  const than = el('div', {}, [
    moTaCot([
      { nhan: 'Chương trình', giaTri: chiTiet.tenKM },
      { nhan: 'Giá trị giảm', giaTri: `${tien(chiTiet.giaTriGiam)} / sản phẩm`, so: true },
      { nhan: 'Thời gian', giaTri: `${ngay(chiTiet.ngayBatDau)} → ${ngay(chiTiet.ngayKetThuc)}` },
      { nhan: 'Sản phẩm đang áp dụng', giaTri: `${chiTiet.soSanPham} sản phẩm`, so: true },
    ]),
    el('p', {
      lop: 'mo-chu nho-chu',
      vanBan:
        'Tích các sản phẩm cần thêm vào chương trình. Sản phẩm đang chạy chương trình khác sẽ được bỏ qua và báo lại.',
      thuocTinh: { style: 'margin-top:14px' },
    }),
    el('div', { thuocTinh: { style: 'margin-top:10px' } }, [khoiChon]),
  ]);

  const nutLuu = nut({
    nhan: 'Áp dụng cho sản phẩm đã chọn',
    bieuTuong: 'tick',
    chinh: true,
    nghe: () => gui(),
  });

  const hop = hopThoai({
    tieuDe: 'Áp dụng khuyến mãi cho sản phẩm',
    moTa: `Mã chương trình ${ban.maKM}`,
    than,
    nutChan: [nut({ nhan: 'Đóng', lop: 'nut-trong', nghe: () => hop.dong() }), nutLuu],
    rong: true,
  });

  async function gui() {
    const danhSachMaSP = layDaChon(khoiChon).filter((ma) => !dangApDung.has(ma));
    if (danhSachMaSP.length === 0) {
      canhBao('Chưa chọn sản phẩm', 'Hãy tích ít nhất một sản phẩm chưa nằm trong chương trình.');
      return;
    }
    dangXuLy(nutLuu, true);
    try {
      const ketQua = await api.post(`/api/khuyenmai/${ban.maKM}/ap-dung`, { danhSachMaSP });
      const soBoQua = ketQua?.boQua?.length ?? 0;
      thanhCong(
        `Đã thêm ${ketQua?.soThem ?? 0} sản phẩm vào chương trình`,
        soBoQua
          ? `${soBoQua} sản phẩm bị bỏ qua: ${ketQua.boQua
              .slice(0, 3)
              .map((mucBoQua) => mucBoQua.tenSP)
              .join(', ')}${soBoQua > 3 ? '…' : ''}`
          : null
      );
      hop.dong();
      await veBang();
    } catch (loi) {
      baoLoiApi(loi);
    } finally {
      dangXuLy(nutLuu, false);
    }
  }
}

/** Mở hộp thoại xem chi tiết chương trình khuyến mãi. */
async function moChiTiet(ban) {
  let chiTiet;
  try {
    chiTiet = await api.doc(`/api/khuyenmai/${ban.maKM}`);
  } catch (loi) {
    baoLoiApi(loi, 'Không tải được chi tiết khuyến mãi');
    return;
  }

  const than = el('div', {}, [
    moTaCot([
      { nhan: 'Tên chương trình', giaTri: chiTiet.tenKM },
      { nhan: 'Mô tả', giaTri: chiTiet.moTa },
      { nhan: 'Giá trị giảm', giaTri: `${tien(chiTiet.giaTriGiam)} / sản phẩm`, so: true },
      { nhan: 'Ngày bắt đầu', giaTri: ngay(chiTiet.ngayBatDau), so: true },
      { nhan: 'Ngày kết thúc', giaTri: ngay(chiTiet.ngayKetThuc), so: true },
      { nhan: 'Trạng thái', node: nhan(chiTiet.trangThai) },
      {
        nhan: 'Đang hiệu lực',
        node: chiTiet.dangHieuLuc
          ? nhan('Có', 'nhan-xanh')
          : nhan('Không', 'nhan-trung-tinh'),
      },
    ]),
    el('h3', {
      vanBan: `Sản phẩm áp dụng (${chiTiet.sanPham?.length ?? 0})`,
      thuocTinh: { style: 'margin-top:22px;font-size:14px' },
    }),
    el('div', { thuocTinh: { style: 'margin-top:10px' } }, [
      chiTiet.sanPham?.length
        ? bangPhu({
            cot: [
              { tieuDe: 'Mã', lop: 'so', truong: 'maSP' },
              { tieuDe: 'Sản phẩm', truong: 'tenSP' },
              { tieuDe: 'Loại', truong: 'tenLoai', lop: 'mo' },
              { tieuDe: 'Giá gốc', lop: 'so', lay: (dong) => tien(dong.gia) },
              { tieuDe: 'Giá sau giảm', lop: 'so', lay: (dong) => tien(dong.giaSauGiam) },
            ],
            duLieu: chiTiet.sanPham,
          })
        : el('p', { lop: 'mo-chu', vanBan: 'Chương trình chưa áp dụng cho sản phẩm nào.' }),
    ]),
  ]);

  hopThoai({
    tieuDe: `Chi tiết khuyến mãi: ${chiTiet.tenKM}`,
    moTa: `Mã chương trình ${chiTiet.maKM}`,
    than,
    rong: true,
    nutChan: [nut({ nhan: 'Đóng', lop: 'nut-trong', nghe: () => hop.dong() })],
  });
}

/** Kết thúc sớm một khuyến mãi. */
async function ketThucSom(ban, veBang) {
  const dongY = await xacNhan({
    tieuDe: 'Kết thúc sớm khuyến mãi',
    noiDung: `Chương trình "${ban.tenKM}" sẽ kết thúc ngay hôm nay và không còn được áp dụng cho đơn hàng mới.`,
    nhanDongY: 'Kết thúc ngay',
    nguyHiem: true,
  });
  if (!dongY) return;
  try {
    await api.post(`/api/khuyenmai/${ban.maKM}/ket-thuc-som`, {});
    thanhCong('Đã kết thúc chương trình khuyến mãi');
    await veBang();
  } catch (loi) {
    baoLoiApi(loi);
  }
}

/** Màn hình quản lý khuyến mãi. */
export const manHinh = taoTrangCrud({
  ma: 'khuyenmai',
  tieuDe: 'Khuyến mãi',
  moTa: 'Chương trình giảm giá theo sản phẩm và khoảng thời gian hiệu lực.',
  bieuTuong: 'khuyen-mai',
  quyen: 'promotion.view',
  duongDanApi: '/api/khuyenmai',
  tenKhoa: 'maKM',
  truongHienThi: 'tenKM',
  nhanThem: 'Tạo chương trình',
  tenTepCsv: 'khuyen-mai',

  boLoc: [{ ten: 'trangThai', nhan: 'Trạng thái', muc: TRANG_THAI_KHUYEN_MAI }],

  cot: [
    { tieuDe: 'Mã', truong: 'maKM', lop: 'so' },
    { tieuDe: 'Tên chương trình', truong: 'tenKM', lop: 'manh' },
    cotSo('Giá trị giảm', 'giaTriGiam', { tienTe: true }),
    { tieuDe: 'Bắt đầu', lop: 'so', lay: (ban) => ngay(ban.ngayBatDau) },
    { tieuDe: 'Kết thúc', lop: 'so', lay: (ban) => ngay(ban.ngayKetThuc) },
    cotSo('Số sản phẩm', 'soSanPham'),
    {
      tieuDe: 'Hiệu lực',
      dung: (ban) =>
        ban.dangHieuLuc
          ? nhan('Đang hiệu lực', 'nhan-xanh')
          : nhan('Không hiệu lực', 'nhan-trung-tinh'),
    },
    cotTrangThai('Trạng thái', 'trangThai'),
  ],

  truong: [
    {
      ten: 'tenKM',
      nhan: 'Tên chương trình',
      loai: 'text',
      batBuoc: true,
      goiY: 'Ví dụ: Giảm giá cà phê pha máy tháng 11',
      thuocTinh: { maxlength: 150 },
    },
    {
      ten: 'giaTriGiam',
      nhan: 'Giá trị giảm (đồng / sản phẩm)',
      loai: 'number',
      so: true,
      batBuoc: true,
      goiY: 'Số tiền giảm trực tiếp trên mỗi sản phẩm, ví dụ 5000.',
      thuocTinh: { min: 1, step: 1000 },
    },
    {
      ten: 'ngayBatDau',
      nhan: 'Ngày bắt đầu',
      loai: 'date',
      batBuoc: true,
      giaTriMacDinh: ngayChoInput(new Date()),
    },
    {
      ten: 'ngayKetThuc',
      nhan: 'Ngày kết thúc',
      loai: 'date',
      batBuoc: true,
      goiY: 'Phải bằng hoặc sau ngày bắt đầu và không nhỏ hơn hôm nay.',
    },
    {
      ten: 'trangThai',
      nhan: 'Trạng thái',
      loai: 'select',
      batBuoc: true,
      giaTriMacDinh: TRANG_THAI_KHUYEN_MAI[0],
      tuyChon: { muc: TRANG_THAI_KHUYEN_MAI },
      goiY: 'Chỉ chương trình "Đang diễn ra" trong thời gian hiệu lực mới được áp dụng.',
    },
    {
      ten: 'moTa',
      nhan: 'Mô tả',
      loai: 'textarea',
      rong: true,
      thuocTinh: { maxlength: 255 },
    },
  ],

  truocKhiGui: (duLieu) => {
    if (duLieu.ngayBatDau) duLieu.ngayBatDau = ngayChoInput(duLieu.ngayBatDau);
    if (duLieu.ngayKetThuc) duLieu.ngayKetThuc = ngayChoInput(duLieu.ngayKetThuc);
    return duLieu;
  },

  thaoTacThem: [
    {
      nhan: 'Áp dụng sản phẩm',
      bieuTuong: 'them',
      thucHien: (ban, veBang) => moApDung(ban, veBang),
    },
    {
      nhan: 'Kết thúc sớm',
      bieuTuong: 'gio',
      thucHien: (ban, veBang) => ketThucSom(ban, veBang),
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
