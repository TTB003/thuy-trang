/**
 * CHUÔNG THÔNG BÁO của khách hàng — hiển thị ở góc phải thanh trên.
 *
 * Mở ra xem các thông báo mới nhất (ưu đãi sinh nhật, đơn hàng, phản hồi...),
 * đánh dấu đã đọc từng thông báo hoặc tất cả.
 */
'use strict';

import { api } from './api.js';
import { baoLoiApi, el, icon, nut, oTrong, xoaHet } from './ui.js';
import { ngayGio } from './format.js';

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
export function taoChuongThongBao() {
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
          el('strong', { vanBan: thongBao.tieuDe }),
          thongBao.noiDung ? el('span', { vanBan: thongBao.noiDung }) : null,
          el('small', { vanBan: thoiGianHienThi(thongBao.ngayTao) }),
        ]),
        chuaDoc ? el('span', { lop: 'cham-moi' }) : null,
      ]
    );
  }

  /** Vẽ danh sách thông báo. */
  function veDanhSach(danhSach) {
    xoaHet(thanDanhSach);
    if (!Array.isArray(danhSach) || danhSach.length === 0) {
      thanDanhSach.append(
        oTrong({
          tieuDe: 'Chưa có thông báo nào',
          moTa: 'Ưu đãi sinh nhật và tin từ cửa hàng sẽ xuất hiện ở đây.',
          bieuTuong: 'chuong',
        })
      );
      return;
    }
    for (const thongBao of danhSach) thanDanhSach.append(veMotThongBao(thongBao));
  }

  /** Nạp số chưa đọc và danh sách thông báo mới nhất. */
  async function taiDanhSach() {
    try {
      const tomTat = await api.doc('/api/cua-toi/thong-bao/tom-tat');
      capNhatChamDo(Number(tomTat?.chuaDoc ?? 0));
      veDanhSach(tomTat?.moiNhat ?? []);
    } catch (loi) {
      baoLoiApi(loi, 'Không tải được thông báo');
    }
  }

  /** Đánh dấu một thông báo đã đọc rồi làm mới danh sách. */
  async function danhDauDaDoc(thongBao) {
    if (Number(thongBao.daDoc) === 0) {
      try {
        await api.post(`/api/cua-toi/thong-bao/${thongBao.maTB}/doc`, {});
      } catch (loi) {
        baoLoiApi(loi, 'Không cập nhật được thông báo');
        return;
      }
    }
    await taiDanhSach();
  }

  /** Đánh dấu tất cả thông báo đã đọc. */
  async function danhDauTatCa() {
    try {
      await api.post('/api/cua-toi/thong-bao/doc-het', {});
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

  return goc;
}
