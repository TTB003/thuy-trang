/**
 * CHUÔNG THÔNG BÁO của khách hàng — hiển thị ở góc phải thanh trên.
 *
 * Mở ra xem các thông báo mới nhất (ưu đãi sinh nhật, đơn hàng, phản hồi...),
 * đánh dấu đã đọc từng thông báo hoặc tất cả.
 */
'use strict';

import { api } from './api.js';
import { baoLoiApi, el, hopThoai, icon, nut, oTrong, xoaHet } from './ui.js';
import { ngayGio } from './format.js';
import { dieuHuong } from './router.js';

/** Biểu tượng tương ứng với từng loại thông báo. */
const BIEU_TUONG_THEO_LOAI = {
  'Ưu đãi': 'khuyen-mai',
  'Đơn hàng': 'don-hang',
  'Phản hồi': 'phan-hoi',
  'Khảo sát': 'khao-sat',
  'Hệ thống': 'thong-tin',
};

/** Lấy biểu tượng của một loại thông báo. */
function bieuTuongLoai(loai) {
  return BIEU_TUONG_THEO_LOAI[loai] ?? 'thong-tin';
}

/** Định dạng thời gian: hôm nay chỉ hiện giờ, khác ngày hiện đầy đủ. */
function thoiGianHienThi(ngayTao) {
  if (!ngayTao) return '';
  const chuoi = String(ngayTao);
  const homNay = new Date();
  const ngayHomNay = `${homNay.getFullYear()}-${String(homNay.getMonth() + 1).padStart(2, '0')}-${String(
    homNay.getDate()
  ).padStart(2, '0')}`;
  return chuoi.slice(0, 10) === ngayHomNay ? `Hôm nay · ${chuoi.slice(11, 16)}` : ngayGio(chuoi);
}

/**
 * Tạo phần tử chuông thông báo kèm danh sách xổ xuống.
 * @returns {HTMLElement}
 */
export function taoChuongThongBao({ noiBo = false } = {}) {
  const duongDanThongBao = noiBo ? '/api/noi-bo/thong-bao' : '/api/cua-toi/thong-bao';
  const chamDo = el('span', { lop: 'cham-chua-doc', thuocTinh: { hidden: true } });
  const nutChuong = el(
    'button',
    {
      lop: 'nut-chuong',
      kieu: 'button',
      thuocTinh: { type: 'button', 'aria-label': 'Thông báo', 'aria-expanded': 'false' },
    },
    [icon('chuong'), chamDo]
  );

  const soChuaDocEl = el('span', { lop: 'so-chua-doc' });
  const dauDanhSach = el('div', { lop: 'chuong-dau' }, [
    el('strong', { vanBan: 'Thông báo' }),
    soChuaDocEl,
  ]);
  const thanDanhSach = el('div', { lop: 'danh-sach-thong-bao' });
  const nutDocHet = nut({
    nhan: 'Đánh dấu tất cả đã đọc',
    bieuTuong: 'tick',
    lop: 'nut-trong nut-nho nut-rong',
    nghe: () => danhDauTatCa(),
  });
  const khungXo = el('div', { lop: 'chuong-than', thuocTinh: { hidden: true } }, [
    dauDanhSach,
    thanDanhSach,
    el('div', { lop: 'chuong-chan' }, [nutDocHet]),
  ]);

  const goc = el('div', { lop: 'chuong-thong-bao' }, [nutChuong, khungXo]);

  /** Cập nhật chấm đỏ và dòng "còn bao nhiêu chưa đọc". */
  function capNhatChamDo(soChuaDoc) {
    const coMoi = soChuaDoc > 0;
    chamDo.hidden = !coMoi;
    chamDo.textContent = coMoi ? (soChuaDoc > 9 ? '9+' : String(soChuaDoc)) : '';
    soChuaDocEl.textContent = coMoi ? `${soChuaDoc} chưa đọc` : 'Đã đọc hết';
    nutDocHet.disabled = !coMoi;
  }

  /** Vẽ một dòng thông báo. */
  function veMotThongBao(thongBao) {
    const chuaDoc = Number(thongBao.daDoc) === 0;
    return el(
      'button',
      {
        lop: `muc-thong-bao ${chuaDoc ? 'chua-doc' : ''}`,
        kieu: 'button',
        thuocTinh: { type: 'button' },
        nghe: () => danhDauDaDoc(thongBao),
      },
      [
        el('span', { lop: 'bieu-tuong-tb', html: icon(bieuTuongLoai(thongBao.loai)).innerHTML }),
        el('span', { lop: 'noi-dung-tb' }, [
          el('strong', { vanBan: thongBao.noiDung ? `${thongBao.tieuDe}: ` : thongBao.tieuDe }),
          thongBao.noiDung ? el('span', { vanBan: thongBao.noiDung }) : null,
          el('small', { vanBan: thoiGianHienThi(thongBao.ngayTao) }),
        ]),
        chuaDoc ? el('span', { lop: 'cham-moi' }) : null,
      ]
    );
  }

  /** Vẽ danh sách thông báo. */
  function veDanhSach(danhSach, khuyenMaiDangApDung = []) {
    xoaHet(thanDanhSach);
    const tinMoi = Array.isArray(danhSach) ? danhSach : [];
    const uuDaiDangChay = Array.isArray(khuyenMaiDangApDung) ? khuyenMaiDangApDung : [];
    if (tinMoi.length === 0 && uuDaiDangChay.length === 0) {
      thanDanhSach.append(
        oTrong({
          tieuDe: 'Chưa có thông báo nào',
          moTa: 'Ưu đãi sinh nhật và tin từ cửa hàng sẽ xuất hiện ở đây.',
          bieuTuong: 'chuong',
        })
      );
      return;
    }
    if (uuDaiDangChay.length) {
      thanDanhSach.append(el('h3', { lop: 'tieu-de-thong-bao-nhom', vanBan: 'Khuyến mãi đang áp dụng' }));
      for (const thongBao of uuDaiDangChay) thanDanhSach.append(veMotThongBao(thongBao));
    }
    const maKhuyenMaiDangHien = new Set(uuDaiDangChay.map((tb) => Number(tb.maKM)));
    const tinGanDay = tinMoi.filter((tb) => !tb.maKM || !maKhuyenMaiDangHien.has(Number(tb.maKM)));
    if (tinGanDay.length) {
      if (uuDaiDangChay.length) thanDanhSach.append(el('h3', { lop: 'tieu-de-thong-bao-nhom', vanBan: 'Thông báo gần đây' }));
      for (const thongBao of tinGanDay) thanDanhSach.append(veMotThongBao(thongBao));
    }
  }

  /** Nạp số chưa đọc và danh sách thông báo mới nhất. */
  async function taiDanhSach() {
    try {
      const tomTat = await api.doc(`${duongDanThongBao}/tom-tat`);
      capNhatChamDo(Number(tomTat?.chuaDoc ?? 0));
      veDanhSach(tomTat?.moiNhat ?? [], tomTat?.khuyenMaiDangApDung ?? []);
    } catch (loi) {
      baoLoiApi(loi, 'Không tải được thông báo');
    }
  }

  /** Đánh dấu một thông báo đã đọc rồi làm mới danh sách. */
  async function danhDauDaDoc(thongBao) {
    if (Number(thongBao.daDoc) === 0) {
      try {
        const maThongBao = noiBo ? thongBao.maTBNB : thongBao.maTB;
        await api.post(`${duongDanThongBao}/${maThongBao}/doc`, {});
      } catch (loi) {
        baoLoiApi(loi, 'Không cập nhật được thông báo');
        return;
      }
    }
    await taiDanhSach();
    if (thongBao.maPG || thongBao.maKM) await moChiTietUuDai(thongBao);
    else if (noiBo && thongBao.maDH) {
      dieuHuong('donhang', { query: { maDH: thongBao.maDH } });
      khungXo.hidden = true;
      nutChuong.setAttribute('aria-expanded', 'false');
      goc.classList.remove('dang-mo');
    } else if (thongBao.maKS) {
      window.location.hash = '#/cua-toi?tab=khao-sat';
      khungXo.hidden = true;
      nutChuong.setAttribute('aria-expanded', 'false');
      goc.classList.remove('dang-mo');
    }
  }

  async function moChiTietUuDai(thongBao) {
    try {
      const chiTiet = thongBao.maPG
        ? await api.doc(`/api/cua-toi/uu-dai/${thongBao.maPG}`)
        : await api.doc(`/api/cua-toi/khuyenmai/${thongBao.maKM}`);
      const laPhieu = Boolean(thongBao.maPG);
      const noiDung = el('div', { lop: 'chi-tiet-uu-dai-thong-bao' }, [
        el('p', { vanBan: chiTiet.moTa || thongBao.noiDung || 'Chương trình khuyến mãi dành cho bạn.' }),
        laPhieu
          ? el('div', { lop: 'mo-ta-cot' }, [
              el('div', {}, [el('small', { vanBan: 'Mã phiếu' }), el('strong', { vanBan: chiTiet.maCode })]),
              el('div', {}, [el('small', { vanBan: 'Mức giảm' }), el('strong', { vanBan: `${chiTiet.phanTramGiam}%` })]),
              el('div', {}, [el('small', { vanBan: 'Hạn dùng' }), el('strong', { vanBan: chiTiet.ngayHetHan || 'Không giới hạn' })]),
              el('div', {}, [el('small', { vanBan: 'Trạng thái' }), el('strong', { vanBan: chiTiet.trangThai })]),
            ])
          : el('div', { lop: 'mo-ta-cot' }, [
              el('div', {}, [el('small', { vanBan: 'Chương trình' }), el('strong', { vanBan: chiTiet.tenKM })]),
              el('div', {}, [el('small', { vanBan: 'Giảm theo sản phẩm' }), el('strong', { vanBan: `${chiTiet.giaTriGiam} ₫` })]),
              el('div', {}, [el('small', { vanBan: 'Thời gian' }), el('strong', { vanBan: `${chiTiet.ngayBatDau} – ${chiTiet.ngayKetThuc}` })]),
              el('div', {}, [el('small', { vanBan: 'Trạng thái' }), el('strong', { vanBan: chiTiet.trangThai })]),
            ]),
      ]);
      hopThoai({ tieuDe: chiTiet.tieuDe || chiTiet.tenKM || thongBao.tieuDe, moTa: 'Chi tiết ưu đãi', than: noiDung, rong: true });
    } catch (loi) {
      baoLoiApi(loi, 'Không tải được chi tiết ưu đãi');
    }
  }

  /** Đánh dấu tất cả thông báo đã đọc. */
  async function danhDauTatCa() {
    try {
      await api.post(`${duongDanThongBao}/doc-het`, {});
      await taiDanhSach();
    } catch (loi) {
      baoLoiApi(loi, 'Không cập nhật được thông báo');
    }
  }

  /** Mở hoặc đóng danh sách xổ xuống. */
  function doiTrangThai() {
    const dangMo = !khungXo.hidden;
    khungXo.hidden = dangMo;
    nutChuong.setAttribute('aria-expanded', String(!dangMo));
    goc.classList.toggle('dang-mo', !dangMo);
    if (!dangMo) taiDanhSach();
  }

  nutChuong.addEventListener('click', (suKien) => {
    suKien.stopPropagation();
    doiTrangThai();
  });
  khungXo.addEventListener('click', (suKien) => suKien.stopPropagation());
  document.addEventListener('click', () => {
    if (!khungXo.hidden) doiTrangThai();
  });

  // Nạp số chưa đọc ngay khi vào ứng dụng.
  taiDanhSach();
  if (noiBo) {
    const boDem = window.setInterval(() => {
      if (!goc.isConnected) {
        window.clearInterval(boDem);
        return;
      }
      if (document.visibilityState === 'visible') taiDanhSach();
    }, 30000);
  }

  return goc;
}
