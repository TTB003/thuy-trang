/**
 * Trang TỔNG QUAN — bảng điều khiển hiển thị các chỉ số quan trọng nhất.
 * Dữ liệu lấy từ /api/baocao/dashboard, /api/phanhoi/thong-ke và cảnh báo tồn kho.
 */
'use strict';

import { api } from '../api.js';
import { ngay, phanTram, so, tien, tienRutGon, vietTat } from '../format.js';
import {
  bangPhu,
  bieuDoCot,
  bieuDoNgang,
  el,
  nhan,
  nut,
  oTrong,
  the,
  theSoLieu,
} from '../ui.js';
import { dieuHuong } from '../router.js';

/** Màn hình bảng điều khiển tổng quan. */
export const manHinh = {
  ma: 'tong-quan',
  tieuDe: 'Tổng quan',
  moTa: 'Tình hình kinh doanh hôm nay, doanh thu 7 ngày gần nhất và các cảnh báo cần xử lý.',
  bieuTuong: 'tong-quan',
  quyen: 'report.view',

  async hienThi(container) {
    const [tongQuan, haiLong, canhBaoTon] = await Promise.all([
      api.doc('/api/baocao/dashboard'),
      api.doc('/api/phanhoi/thong-ke').catch(() => null),
      api.doc('/api/sanpham/canh-bao-ton').catch(() => null),
    ]);

    container.append(
      khoiTheSoLieu(tongQuan),
      khoiThePhu(tongQuan),
      el('div', { lop: 'bao-cao-luoi', thuocTinh: { style: 'margin-top:16px' } }, [
        the({
          tieuDe: 'Doanh thu 7 ngày gần nhất',
          ghiChu: 'Chỉ tính các đơn hàng đã hoàn thành.',
          than: veBieuDoDoanhThu(tongQuan.doanhThu7Ngay ?? []),
        }),
        the({
          tieuDe: 'Top 5 sản phẩm bán chạy',
          ghiChu: 'Xếp theo số lượng bán ra của các đơn hoàn thành.',
          than: veTopSanPham(tongQuan.sanPhamBanChay ?? []),
        }),
      ]),
      el('div', { lop: 'bao-cao-luoi', thuocTinh: { style: 'margin-top:16px' } }, [
        the({
          tieuDe: 'Sản phẩm cần nhập thêm',
          ghiChu: canhBaoTon
            ? `Ngưỡng cảnh báo: ${so(canhBaoTon.nguong)} đơn vị.`
            : 'Chưa tải được ngưỡng cảnh báo.',
          congCu: nut({
            nhan: 'Tới danh mục sản phẩm',
            bieuTuong: 'san-pham',
            lop: 'nut-nho nut-trong',
            nghe: () => dieuHuong('sanpham'),
          }),
          than: veCanhBaoTon(canhBaoTon),
          lopThan: 'the-than day',
        }),
        the({
          tieuDe: 'Mức độ hài lòng của khách hàng',
          ghiChu: 'Tổng hợp từ toàn bộ phản hồi khách hàng đã gửi.',
          than: veMucDoHaiLong(haiLong),
        }),
      ])
    );
  },
};

/* ------------------------------ THẺ SỐ LIỆU ------------------------------ */

/** Bốn thẻ số liệu chính của bảng điều khiển. */
function khoiTheSoLieu(tongQuan) {
  const phanHoiChuaXuLy = Number(tongQuan.phanHoiChuaXuLy ?? 0);
  return el('div', { lop: 'luoi-thong-ke' }, [
    theSoLieu({
      nhan: 'Doanh thu hôm nay',
      giaTri: tien(tongQuan.homNay?.doanhThu ?? 0),
      phu: `${so(tongQuan.homNay?.soDon ?? 0)} đơn trong ngày ${ngay(tongQuan.homNay?.ngay)}`,
      bieuTuong: 'tien',
    }),
    theSoLieu({
      nhan: 'Doanh thu tháng này',
      giaTri: tienRutGon(tongQuan.thangNay?.doanhThu ?? 0),
      phu: `${so(tongQuan.thangNay?.soDon ?? 0)} đơn đã hoàn thành`,
      sac: 'sac-matcha',
      bieuTuong: 'bao-cao',
    }),
    theSoLieu({
      nhan: 'Đơn cần xử lý',
      giaTri: so(tongQuan.donChoXuLy ?? 0),
      phu: 'Chờ xử lý, đã xác nhận hoặc đang giao',
      sac: 'sac-honey',
      bieuTuong: 'don-hang',
    }),
    theSoLieu({
      nhan: 'Phản hồi chờ xử lý',
      giaTri: so(phanHoiChuaXuLy),
      phu: phanHoiChuaXuLy > 0 ? 'Cần nhân viên phản hồi lại' : 'Đã xử lý hết',
      sac: phanHoiChuaXuLy > 0 ? 'sac-chili' : 'sac-steel',
      bieuTuong: 'phan-hoi',
    }),
  ]);
}

/** Khối thẻ phụ: khách hàng, sản phẩm, nhân viên và tình trạng tồn kho. */
function khoiThePhu(tongQuan) {
  return el('div', { lop: 'luoi-thong-ke', thuocTinh: { style: 'margin-top:16px' } }, [
    theSoLieu({
      nhan: 'Khách hàng đang hoạt động',
      giaTri: so(tongQuan.soKhachHang ?? 0),
      phu: `+${so(tongQuan.khachMoi30Ngay ?? 0)} khách mới trong 30 ngày`,
      bieuTuong: 'khach-hang',
    }),
    theSoLieu({
      nhan: 'Sản phẩm trong danh mục',
      giaTri: so(tongQuan.soSanPham ?? 0),
      phu: tongQuan.canhBaoTonKho
        ? `${so(tongQuan.canhBaoTonKho.soLuong)} sản phẩm dưới ngưỡng tồn`
        : null,
      sac: 'sac-steel',
      bieuTuong: 'san-pham',
    }),
    theSoLieu({
      nhan: 'Nhân viên đang làm việc',
      giaTri: so(tongQuan.soNhanVien ?? 0),
      sac: 'sac-matcha',
      bieuTuong: 'nhan-vien',
    }),
  ]);
}

/* -------------------------------- BIỂU ĐỒ -------------------------------- */

/** Biểu đồ cột doanh thu theo ngày. */
function veBieuDoDoanhThu(cacNgay) {
  if (!cacNgay.length) {
    return oTrong({
      tieuDe: 'Chưa có doanh thu trong 7 ngày gần nhất',
      moTa: 'Doanh thu được ghi nhận khi đơn hàng chuyển sang trạng thái "Hoàn thành".',
      bieuTuong: 'bao-cao',
    });
  }
  const cot = cacNgay.map((muc) => ({
    nhan: ngay(muc.ngay).slice(0, 5),
    giaTri: Number(muc.doanhThu) || 0,
  }));
  return el('div', {}, [
    bieuDoCot(cot, { dinhDang: (giaTri) => tienRutGon(giaTri) }),
    el('div', { lop: 'nhom-nut', thuocTinh: { style: 'margin-top:14px' } }, [
      nut({
        nhan: 'Xem báo cáo doanh thu đầy đủ',
        bieuTuong: 'bao-cao',
        lop: 'nut-trong nut-nho',
        nghe: () => dieuHuong('baocao'),
      }),
    ]),
  ]);
}

/** Danh sách top sản phẩm bán chạy dạng thanh ngang. */
function veTopSanPham(cacSanPham) {
  if (!cacSanPham.length) {
    return oTrong({
      tieuDe: 'Chưa có dữ liệu bán hàng',
      moTa: 'Số liệu xuất hiện sau khi có đơn hàng hoàn thành.',
      bieuTuong: 'san-pham',
    });
  }
  return bieuDoNgang(
    cacSanPham.map((sp) => ({
      nhan: vietTat(sp.tenSP, 26),
      giaTri: Number(sp.tongSoLuong) || 0,
    })),
    { dinhDang: (giaTri) => `${so(giaTri)} ly` }
  );
}

/* ------------------------------- CẢNH BÁO -------------------------------- */

/** Bảng sản phẩm dưới ngưỡng tồn kho. */
function veCanhBaoTon(canhBaoTon) {
  const danhSach = canhBaoTon?.items ?? [];
  if (danhSach.length === 0) {
    return oTrong({
      tieuDe: 'Tồn kho đang ở mức an toàn',
      moTa: 'Không có sản phẩm nào dưới ngưỡng cảnh báo.',
      bieuTuong: 'kho',
    });
  }
  return bangPhu({
    cot: [
      { tieuDe: 'Sản phẩm', truong: 'tenSP' },
      { tieuDe: 'Loại', truong: 'tenLoai', lop: 'mo' },
      { tieuDe: 'Tồn kho', lop: 'so', lay: (dong) => so(dong.soLuong) },
      {
        tieuDe: 'Mức độ',
        dung: (dong) =>
          dong.mucDo === 'Hết hàng' ? nhan('Hết hàng', 'nhan-do') : nhan('Sắp hết', 'nhan-vang'),
      },
    ],
    duLieu: danhSach.slice(0, 6),
  });
}

/** Khối thống kê mức độ hài lòng: điểm trung bình và phân bố số sao. */
function veMucDoHaiLong(haiLong) {
  if (!haiLong?.tongQuan) {
    return oTrong({
      tieuDe: 'Chưa tải được thống kê phản hồi',
      moTa: 'Thử tải lại trang để lấy dữ liệu mới nhất.',
      bieuTuong: 'phan-hoi',
    });
  }

  const { tongPhanHoi, diemTrungBinh, chuaXuLy, daXuLy } = haiLong.tongQuan;
  const khoi = el('div', {}, [
    el('div', { lop: 'so-diem-lon' }, [
      el('span', { lop: 'con-so', vanBan: so(diemTrungBinh) }),
      el('span', { lop: 'don-vi', vanBan: '/ 5 điểm trung bình' }),
    ]),
    el('div', { lop: 'danh-sach-theo-doi', thuocTinh: { style: 'margin-top:16px' } }, [
      dongTheoDoi('Tổng số phản hồi', so(tongPhanHoi)),
      dongTheoDoi('Đã xử lý', so(daXuLy)),
      dongTheoDoi('Chờ xử lý', so(chuaXuLy)),
    ]),
  ]);

  if (tongPhanHoi > 0) {
    const khoiPhanBo = el('div', { lop: 'ket-qua-khao-sat', thuocTinh: { style: 'margin-top:16px' } });
    for (const muc of haiLong.phanBo ?? []) {
      khoiPhanBo.append(
        el('div', { lop: 'lua-chon-ket-qua' }, [
          el('span', { lop: 'ten-lua-chon', vanBan: `${muc.danhGia} sao` }),
          el(
            'div',
            {
              lop: 'thanh-cot',
              thuocTinh: {
                style: 'height:14px;border-radius:5px;background:var(--milk);overflow:hidden',
              },
            },
            [
              el('span', {
                thuocTinh: {
                  style: `display:block;height:100%;width:${Math.max(2, Math.round(muc.tyLe))}%;background:linear-gradient(90deg,var(--caramel),#d8912f);border-radius:5px`,
                },
              }),
            ]
          ),
          el('span', {
            lop: 'ty-le',
            vanBan: `${so(muc.soLuong)} · ${phanTram(muc.tyLe)}`,
          }),
        ])
      );
    }
    khoi.append(khoiPhanBo);
  }

  khoi.append(
    el('div', { lop: 'nhom-nut', thuocTinh: { style: 'margin-top:14px' } }, [
      nut({
        nhan: 'Tới danh sách phản hồi',
        bieuTuong: 'phan-hoi',
        lop: 'nut-trong nut-nho',
        nghe: () => dieuHuong('phanhoi'),
      }),
    ])
  );
  return khoi;
}

/** Dòng nhãn – giá trị dùng trong khối thống kê phản hồi. */
function dongTheoDoi(tenNhan, giaTri) {
  return el('div', { lop: 'dong-theo-doi' }, [
    el('span', { vanBan: tenNhan }),
    el('strong', { vanBan: giaTri }),
  ]);
}
