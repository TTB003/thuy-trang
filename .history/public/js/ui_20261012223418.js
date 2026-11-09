/**
 * Bộ thành phần giao diện dùng chung.
 *
 * Nguyên tắc an toàn: mọi dữ liệu động (tên sản phẩm, ghi chú, ...) đều được
 * gán bằng `textContent`, không nội suy vào chuỗi HTML. Chỉ những đoạn HTML
 * tĩnh do chính mô-đun này sinh ra (biểu tượng SVG) mới dùng `innerHTML`.
 */
'use strict';

import { bieuTuong } from './icons.js';
import { mauTheoTrangThai } from './format.js';
import { thongDiepLoi } from './api.js';

/* ============================== 1. DOM CƠ BẢN ============================== */

/**
 * Tạo một phần tử.
 * @param {string} tag tên thẻ
 * @param {object} [tuyChon] { lop, vanBan, html, thuocTinh, nghe, kieu, giaTri }
 * @param {Array<Node|null|undefined|false>} [con] các phần tử con
 */
export function el(tag, tuyChon = {}, con = []) {
  const nut = document.createElement(tag);
  const { lop, vanBan, html, thuocTinh, nghe, kieu, giaTri, dinhDanh } = tuyChon;

  if (lop) nut.className = lop;
  if (dinhDanh) nut.id = dinhDanh;
  if (vanBan !== undefined && vanBan !== null) nut.textContent = String(vanBan);
  if (html) nut.innerHTML = html; // chỉ dùng cho SVG tĩnh nội bộ
  if (kieu) nut.type = kieu;
  if (giaTri !== undefined && giaTri !== null) nut.value = String(giaTri);
  if (thuocTinh) {
    for (const [ten, giaTriThuocTinh] of Object.entries(thuocTinh)) {
      if (giaTriThuocTinh === null || giaTriThuocTinh === undefined || giaTriThuocTinh === false) {
        continue;
      }
      nut.setAttribute(ten, giaTriThuocTinh === true ? '' : String(giaTriThuocTinh));
    }
  }
  if (nghe) {
    for (const [tenSuKien, hamXuLy] of Object.entries(nghe)) {
      nut.addEventListener(tenSuKien, hamXuLy);
    }
  }
  ganCon(nut, con);
  return nut;
}

/** Gắn nhiều phần tử con, tự bỏ qua giá trị rỗng. */
export function ganCon(cha, con) {
  const danhSach = Array.isArray(con) ? con : [con];
  for (const muc of danhSach) {
    if (muc === null || muc === undefined || muc === false || muc === '') continue;
    cha.append(muc instanceof Node ? muc : document.createTextNode(String(muc)));
  }
  return cha;
}

/** Xóa toàn bộ phần tử con. */
export function xoaHet(cha) {
  while (cha.firstChild) cha.removeChild(cha.firstChild);
  return cha;
}

/** Tạo thẻ biểu tượng SVG. */
export function icon(ten, lop = 'bieu-tuong') {
  return el('span', { html: bieuTuong(ten, lop), lop: 'vung-bieu-tuong' });
}

/** Phần tử văn bản thuần. */
export function chu(noiDung) {
  return document.createTextNode(noiDung === null || noiDung === undefined ? '' : String(noiDung));
}

/* ============================= 2. NÚT VÀ NHÃN ============================= */

/** Nút bấm có nhãn và biểu tượng. */
export function nut({
  nhan,
  bieuTuong: tenBieuTuong = null,
  lop = 'nut',
  nghe = null,
  nguyHiem = false,
  chinh = false,
  nho = false,
  tat = false,
  loai = 'button',
  dinhDanh = null,
}) {
  const lopDay = ['nut', chinh ? 'nut-chinh' : '', nguyHiem ? 'nut-nguy-hiem' : '', nho ? 'nut-nho' : '', lop]
    .filter(Boolean)
    .join(' ');
  const the = el(
    'button',
    { lop: lopDay, kieu: loai, dinhDanh, nghe, thuocTinh: { disabled: tat } },
    [tenBieuTuong ? icon(tenBieuTuong) : null, nhan ? el('span', { vanBan: nhan }) : null]
  );
  return the;
}

/** Nút chỉ có biểu tượng, kèm nhãn trợ năng. */
export function nutBieuTuong({ bieuTuong: ten, nhan, lop = 'nut nut-nho', nghe = null }) {
  return el('button', {
    lop: `${lop} nut-chi-bieu-tuong`,
    kieu: 'button',
    nghe,
    thuocTinh: { title: nhan, 'aria-label': nhan },
    html: bieuTuong(ten, 'bieu-tuong'),
  });
}

/** Nhãn trạng thái có màu theo nghiệp vụ. */
export function nhan(vanBan, lop = null) {
  const lopMau = lop ?? mauTheoTrangThai(vanBan);
  return el('span', { lop: `nhan ${lopMau}` }, [el('span', { lop: 'cham' }), el('span', { vanBan })]);
}

/** Nhãn quản trị (khu vực ADMIN). */
export function nhanQuanTri(vanBan = 'Quản trị hệ thống') {
  return el('span', { lop: 'nhan-quan-tri', vanBan });
}

/* ========================== 3. THẺ, SỐ LIỆU, RỖNG ======================== */

/** Thẻ bao ngoài có tiêu đề và vùng thân. */
export function the({ tieuDe = null, ghiChu = null, congCu = null, than = null, lopThan = '' }) {
  const phan = [];
  if (tieuDe || congCu) {
    phan.push(
      el('div', { lop: 'the-dau' }, [
        el('div', {}, [
          tieuDe ? el('h2', { vanBan: tieuDe }) : null,
          ghiChu ? el('p', { lop: 'ghi-chu', vanBan: ghiChu }) : null,
        ]),
        congCu,
      ])
    );
  }
  if (than) phan.push(than);
  const theBao = el('section', { lop: 'the' }, phan);
  if (lopThan) theBao.classList.add(lopThan);
  return theBao;
}

/** Thẻ số liệu: nhãn nhỏ, giá trị lớn, dòng phụ. */
export function theSoLieu({ nhan: tenNhan, giaTri, phu = null, sac = '', bieuTuong: ten = null }) {
  return el('div', { lop: `the-so-lieu ${sac}`.trim() }, [
    el('div', { lop: 'nhan-so-lieu' }, [ten ? icon(ten) : null, el('span', { vanBan: tenNhan })]),
    el('div', { lop: 'gia-tri', vanBan: giaTri }),
    phu ? el('div', { lop: 'phu', vanBan: phu }) : null,
  ]);
}

/** Ô thông báo khi không có dữ liệu. */
export function oTrong({ tieuDe = 'Chưa có dữ liệu', moTa = null, bieuTuong: ten = 'thong-tin', hanhDong = null }) {
  return el('div', { lop: 'o-trong' }, [
    el('div', { lop: 'bieu-tuong-lon', html: bieuTuong(ten) }),
    el('strong', { vanBan: tieuDe }),
    moTa ? el('p', { vanBan: moTa }) : null,
    hanhDong ? el('div', { lop: 'nhom-nut', thuocTinh: { style: 'justify-content:center;margin-top:12px' } }, [hanhDong]) : null,
  ]);
}

/** Danh sách mô tả dạng nhãn – giá trị. */
export function moTaCot(cacMuc) {
  const dl = el('dl', { lop: 'mo-ta-cot' });
  for (const muc of cacMuc) {
    if (!muc) continue;
    dl.append(el('dt', { vanBan: muc.nhan }));
    const dd = el('dd', { lop: muc.so ? 'so' : '' });
    if (muc.node) dd.append(muc.node);
    else dd.textContent = muc.giaTri === null || muc.giaTri === undefined || muc.giaTri === '' ? '—' : String(muc.giaTri);
    dl.append(dd);
  }
  return dl;
}

/** Thanh tiến độ 0-100. */
export function thanhTienDo(phan) {
  const giaTri = Math.max(0, Math.min(100, Number(phan) || 0));
  return el('div', { lop: 'thanh-tien-do' }, [
    el('span', { thuocTinh: { style: `width:${giaTri}%` } }),
  ]);
}

/* ============================= 4. BẢNG DỮ LIỆU ============================ */

/**
 * Dựng bảng dữ liệu.
 * @param {{ cot: Array, duLieu: Array, oTrong: object, sapXep: object, dongNhanBam: Function }} tuyChon
 *   cot: [{ tieuDe, lop, sapXepTheo, lay(ban) | dung(ban) }]
 */
export function bang({ cot, duLieu, khiRong = null, sapXep = null, dongNhanBam = null }) {
  if (!duLieu || duLieu.length === 0) {
    return khiRong ?? oTrong({});
  }

  const thead = el('thead');
  const hangTieuDe = el('tr');
  for (const muc of cot) {
    const th = el('th', { lop: muc.lop ?? '' });
    th.append(el('span', { vanBan: muc.tieuDe }));
    if (muc.sapXepTheo && sapXep) {
      th.classList.add('sap-xep-duoc');
      if (sapXep.truong === muc.sapXepTheo) {
        th.append(el('span', { lop: 'mui-ten', vanBan: sapXep.chieu === 'asc' ? '▲' : '▼' }));
      }
      th.addEventListener('click', () => sapXep.khiDoi(muc.sapXepTheo));
    }
    hangTieuDe.append(th);
  }
  thead.append(hangTieuDe);

  const tbody = el('tbody');
  for (const ban of duLieu) {
    const hang = el('tr');
    for (const muc of cot) {
      const td = el('td', { lop: muc.lop ?? '' });
      if (muc.dung) {
        const noiDung = muc.dung(ban);
        if (noiDung) td.append(noiDung);
      } else {
        const giaTri = muc.lay ? muc.lay(ban) : ban[muc.truong];
        td.textContent = giaTri === null || giaTri === undefined || giaTri === '' ? '—' : String(giaTri);
      }
      hang.append(td);
    }
    if (dongNhanBam) {
      hang.classList.add('nhan-bam-duoc');
      hang.addEventListener('click', (suKien) => {
        if (suKien.target.closest('button, a, input, select')) return;
        dongNhanBam(ban);
      });
    }
    tbody.append(hang);
  }

  const bangThe = el('table', { lop: 'bang' }, [thead, tbody]);
  return el('div', { lop: 'bang-truot' }, [bangThe]);
}

/** Bảng chi tiết nhỏ (không phân trang) dùng trong hộp thoại. */
export function bangPhu({ cot, duLieu, chanBang = null }) {
  const thead = el('thead');
  const hangTieuDe = el('tr');
  for (const muc of cot) hangTieuDe.append(el('th', { lop: muc.lop ?? '', vanBan: muc.tieuDe }));
  thead.append(hangTieuDe);

  const tbody = el('tbody');
  for (const ban of duLieu) {
    const hang = el('tr');
    for (const muc of cot) {
      const td = el('td', { lop: muc.lop ?? '' });
      if (muc.dung) {
        const noiDung = muc.dung(ban);
        if (noiDung) td.append(noiDung);
      } else {
        const giaTri = muc.lay ? muc.lay(ban) : ban[muc.truong];
        td.textContent = giaTri === null || giaTri === undefined || giaTri === '' ? '—' : String(giaTri);
      }
      hang.append(td);
    }
    tbody.append(hang);
  }
  const phan = [thead, tbody];
  if (chanBang) {
    const tfoot = el('tfoot');
    const hangChan = el('tr');
    for (const muc of chanBang) {
      hangChan.append(el('td', { lop: muc.lop ?? '', vanBan: muc.giaTri }));
    }
    tfoot.append(hangChan);
    phan.push(tfoot);
  }
  return el('table', { lop: 'bang-phu' }, phan);
}

/* ============================== 5. PHÂN TRANG ============================= */

/** Thanh phân trang. */
export function phanTrang({ phan, khiDoiTrang, khiDoiCoTrang = null }) {
  const { page, pageSize, total, totalPages } = phan;
  const tu = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const den = Math.min(page * pageSize, total);

  const nhomNut = el('div', { lop: 'dieu-huong-trang' }, [
    nut({
      nhan: 'Trước',
      bieuTuong: 'trai',
      nho: true,
      tat: page <= 1,
      nghe: () => khiDoiTrang(page - 1),
    }),
    el('span', {
      lop: 'nhan nhan-trung-tinh',
      vanBan: `Trang ${page}/${Math.max(1, totalPages)}`,
      thuocTinh: { style: 'padding:5px 12px' },
    }),
    nut({
      nhan: 'Sau',
      bieuTuong: 'phai',
      nho: true,
      tat: page >= totalPages,
      nghe: () => khiDoiTrang(page + 1),
    }),
  ]);

  const phan2 = [el('span', { vanBan: `Hiển thị ${tu}–${den} trên ${total} bản ghi` })];
  if (khiDoiCoTrang) {
    const chon = el('select', { lop: '', nghe: { change: (e) => khiDoiCoTrang(Number(e.target.value)) } });
    for (const co of [10, 20, 50, 100]) {
      chon.append(el('option', { vanBan: `${co}/trang`, giaTri: co, thuocTinh: { selected: co === pageSize } }));
    }
    phan2.push(el('div', { lop: 'gon' }, [el('span', { vanBan: 'Số dòng:' }), chon]));
  }
  phan2.push(nhomNut);
  return el('div', { lop: 'phan-trang' }, phan2);
}
