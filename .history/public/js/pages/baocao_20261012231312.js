/**
 * Trang NHÓM 12 — Báo cáo và thống kê (CN12.1 → CN12.6).
 * Gồm: doanh thu, sản phẩm bán chạy, nhập hàng, tồn kho, khách hàng,
 * khách hàng thân thiết — kèm chức năng kết xuất CSV.
 */
'use strict';

import { api } from '../api.js';
import {
  ngay,
  ngayChoInput,
  phanTram,
  so,
  soThapPhan,
  taiTep,
  tenTepCoNgay,
  tien,
  tienRutGon,
  vietTat,
} from '../format.js';
import {
  bang,
  bangPhu,
  baoLoiApi,
  bieuDoCot,
  bieuDoNgang,
  dangXuLy,
  el,
  khuTab,
  nhan,
  nut,
  oTrong,
  the,
  theSoLieu,
  truong,
  xoaHet,
} from '../ui.js';

/** Bộ lọc thời gian dùng chung cho các báo cáo. */
const BO_LOC = { tuNgay: '', denNgay: '' };

/** Chuyển cấu trúc báo cáo của máy chủ thành nội dung CSV. */
function baoCaoSangCsv(bao cao) {
  const thoat = (giaTri) => {
    const chuoi = giaTri === null || giaTri === undefined ? '' : String(giaTri);
    return `"${chuoi.replace(/"/g, '""')}"`;
  };
  const dong = [bao cao.cot.map(thoat).join(',')];
  for (const hang of bao cao.dong) dong.push(hang.map(thoat).join(','));
  return `\ufeff${dong.join('\r\n')}`;
}

/** Nút kết xuất một loại báo cáo thành tệp CSV (CN12.6). */
function nutXuat(loai, thamSoThem = {}) {
  const nutTai = nut({
    nhan: 'Xuất CSV',
    bieuTuong: 'tai-xuong',
    lop: 'nut-trong nut-nho',
    nghe: async () => {
      dangXuLy(nutTai, true);
      try {
        const baoCao = await api.doc('/api/baocao/xuat', {
          loai,
          ...BO_LOC,
          ...thamSoThem,
        });
        if (!baoCao?.cot) {
          baoLoiApi(new Error('Máy chủ không trả về dữ liệu báo cáo.'), 'Không xuất được tệp');
          return;
        }
        taiTep(tenTepCoNgay(`bao-cao-${loai}`), baoCaoSangCsv(baoCao));
      } catch (loi) {
        baoLoiApi(loi, 'Không xuất được tệp');
      } finally {
        dangXuLy(nutTai, false);
      }
    },
  });
  return nutTai;
}

/** Dựng thanh công cụ lọc thời gian cho một báo cáo. */
function thanhLocThoiGian({ khiDoi, congCuThem = null }) {
  const oTuNgay = el('input', { kieu: 'date', giaTri: BO_LOC.tuNgay });
  const oDenNgay = el('input', { kieu: 'date', giaTri: BO_LOC.denNgay });

  const apDung = () => {
    BO_LOC.tuNgay = oTuNgay.value;
    BO_LOC.denNgay = oDenNgay.value;
    khiDoi();
  };
  oTuNgay.addEventListener('change', apDung);
  oDenNgay.addEventListener('change', apDung);

  const thanh = el('div', { lop: 'thanh-cong-cu' }, [
    el('label', { lop: 'truong truong-ngan' }, [el('span', { vanBan: 'Từ ngày' }), oTuNgay]),
    el('label', { lop: 'truong truong-ngan' }, [el('span', { vanBan: 'Đến ngày' }), oDenNgay]),
    el('div', { lop: 'day-khoang-cach' }),
  ]);

  if (congCuThem) thanh.append(congCuThem);
  thanh.append(
    nut({
      nhan: 'Xóa lọc thời gian',
      bieuTuong: 'lam-moi',
      lop: 'nut-trong nut-nho',
      nghe: () => {
        oTuNgay.value = '';
        oDenNgay.value = '';
        BO_LOC.tuNgay = '';
        BO_LOC.denNgay = '';
        khiDoi();
      },
    })
  );
  return thanh;
}

/** Khối báo cáo với vùng nội dung tự vẽ lại. */
function khoiBaoCao({ tieuDe, ghiChu, ve }) {
  const vung = el('div', {});
  const khung = el('div', {});

  /** Nạp lại nội dung báo cáo. */
  async function taiLai() {
    xoaHet(vung);
    vung.append(el('p', { lop: 'mo-chu nho-chu', vanBan: 'Đang tải dữ liệu…' }));
    try {
      const noiDung = await ve();
      xoaHet(vung);
      vung.append(noiDung);
    } catch (loi) {
      xoaHet(vung);
      vung.append(
        el('p', { lop: 'mo-chu', vanBan: `Không tải được báo cáo: ${loi?.message ?? 'lỗi không xác định'}` })
      );
    }
  }

  khung.taiLai = taiLai;
  khung.el = el('div', {}, [
    el('div', { lop: 'the-dau' }, [
      el('div', {}, [el('h2', { vanBan: tieuDe }), ghiChu ? el('p', { lop: 'ghi-chu', vanBan: ghiChu }) : null]),
    ]),
    thanhLocThoiGian({ khiDoi: taiLai, congCuThem: null }),
    vung,
  ]);

  const bao = the({ than: khung.el, lopThan: 'the-than day' });
  taiLai();
  return khung;
}

/** Màn hình báo cáo và thống kê. */
export const manHinh = {
  ma: 'baocao',
  tieuDe: 'Báo cáo & thống kê',
  moTa: 'Doanh thu, sản phẩm bán chạy, nhập hàng, tồn kho và hành vi khách hàng.',
  bieuTuong: 'bao-cao',
  quyen: 'report.view',

  async hienThi(container) {
    /** Tab 1 — doanh thu theo ngày/tháng/năm. */
    function tabDoanhThu() {
      const kieu = { giaTri: 'thang' };

      const vung = el('div', {});
      const oKieu = el('select', {
        nghe: {
          change: (suKien) => {
            kieu.giaTri = suKien.target.value;
            taiLai();
          },
        },
      });
      for (const [giaTri, nhanKieu] of [
        ['ngay', 'Theo ngày'],
        ['thang', 'Theo tháng'],
        ['nam', 'Theo năm'],
      ]) {
        oKieu.append(
          el('option', {
            vanBan: nhanKieu,
            thuocTinh: { value: giaTri, selected: giaTri === kieu.giaTri },
          })
        );
      }

      /** Nạp số liệu doanh thu và vẽ lại. */
      async function taiLai() {
        xoaHet(vung);
        try {
          const du = await api.doc('/api/baocao/doanh-thu', {
            kieu: kieu.giaTri,
            ...BO_LOC,
          });
          const chiTiet = du.chiTiet ?? [];

          vung.append(
            el('div', { lop: 'luoi-thong-ke', thuocTinh: { style: 'padding:16px 18px 0' } }, [
              theSoLieu({
                nhan: 'Tổng doanh thu',
                giaTri: tien(du.tongQuan?.tongDoanhThu ?? 0),
