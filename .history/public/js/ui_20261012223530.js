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
/* ============================== 6. BIỂU MẪU ============================== */

/**
 * Tạo một trường nhập liệu.
 * @param {{ nhan, ten, loai, giaTri, batBuoc, goiY, tuyChon, lop, thuocTinh, nghe, con }} tuyChon
 *   loai: 'text' | 'number' | 'date' | 'password' | 'email' | 'textarea' | 'select' | 'checkbox' | 'search'
 *   tuyChon: [{ giaTri, nhan }] dùng khi loai = 'select'
 */
export function truong(tuyChon = {}) {
  const {
    nhan: tenNhan,
    ten,
    loai = 'text',
    giaTri = '',
    batBuoc = false,
    goiY = null,
    tuyChon = null,
    lop = '',
    thuocTinh = null,
    nghe = null,
    con = [],
    truongPhu = null,
  } = tuyChon;

  let oNhap;
  if (loai === 'textarea') {
    oNhap = el('textarea', { lop, thuocTinh: { name: ten, rows: 3 }, nghe: nghe ?? {} });
    if (giaTri !== null && giaTri !== undefined) oNhap.value = String(giaTri);
  } else if (loai === 'select') {
    oNhap = el('select', { lop, thuocTinh: { name: ten }, nghe: nghe ?? {} });
    const mucRong = tuyChon?.mucRong;
    if (mucRong !== undefined) {
      oNhap.append(
        el('option', {
          vanBan: mucRong ?? '— Chọn —',
          giaTri: '',
          thuocTinh: { value: '', selected: giaTri === '' || giaTri === null || giaTri === undefined },
        })
      );
    }
    const cacMuc = Array.isArray(tuyChon?.muc) ? tuyChon.muc : [];
    for (const muc of cacMuc) {
      const giaTriMuc = typeof muc === 'string' ? muc : muc.giaTri;
      const nhanMuc = typeof muc === 'string' ? muc : muc.nhan;
      const dangChon = String(giaTriMuc) === String(giaTri ?? '');
      oNhap.append(
        el('option', {
          vanBan: nhanMuc,
          giaTri: giaTriMuc,
          thuocTinh: { value: String(giaTriMuc), selected: dangChon },
        })
      );
    }
    if (oNhap.value === '' && giaTri !== null && giaTri !== undefined && giaTri !== '') {
      oNhap.value = String(giaTri);
    }
  } else if (loai === 'checkbox') {
    return el('label', { lop: 'o-chon' }, [
      el('input', {
        kieu: loai,
        thuocTinh: { name: ten, checked: Boolean(giaTri) },
        nghe: nghe ?? {},
      }),
      el('span', { vanBan: tenNhan }),
    ]);
  } else {
    oNhap = el('input', {
      lop,
      kieu: loai,
      thuocTinh: { name: ten, placeholder: goiY ?? null, ...(thuocTinh ?? {}) },
      nghe: nghe ?? {},
    });
    if (giaTri !== null && giaTri !== undefined) oNhap.value = String(giaTri);
  }

  const than = el('label', { lop: 'truong' }, [
    tenNhan
      ? el('span', {}, [
          el('span', { vanBan: tenNhan }),
          batBuoc ? el('span', { lop: 'bat-buoc', vanBan: ' *' }) : null,
        ])
      : null,
    oNhap,
    goiY && (loai === 'select' || loai === 'textarea' || loai.includes('date'))
      ? el('span', { lop: 'goi-y', vanBan: goiY })
      : null,
    ...con,
  ]);
  if (truongPhu) than.append(truongPhu);
  return than;
}

/** Đọc toàn bộ giá trị của một biểu mẫu thành object (chuỗi rỗng -> null). */
export function docBieuMau(bieuMau) {
  const duLieu = new FormData(bieuMau);
  const ketQua = {};
  for (const [ten, giaTri] of duLieu.entries()) {
    const chuoi = typeof giaTri === 'string' ? giaTri.trim() : giaTri;
    ketQua[ten] = chuoi === '' ? null : chuoi;
  }
  // Các ô chọn nhiều lần (multi-select) gom thành mảng.
  for (const the of bieuMau.querySelectorAll('select[multiple]')) {
    if (!the.name) continue;
    ketQua[the.name] = Array.from(the.selectedOptions).map((o) => o.value);
  }
  // Các nhóm radio/checkbox không được chọn sẽ không có trong FormData.
  for (const the of bieuMau.querySelectorAll('input[type="checkbox"][name]')) {
    ketQua[the.name] = Boolean(
      bieuMau.querySelector(`input[type="checkbox"][name="${the.name}"]:checked`)
    );
  }
  return ketQua;
}

/** Nhóm trường theo bố cục lưới hai cột. */
export function luoiTruong(cacTruong) {
  return el('div', { lop: 'luoi-hai-cot' }, cacTruong);
}

/** Khối chọn nhiều bằng hộp kiểm: danh sách [{ giaTri, nhan }]. */
export function danhSachChon({ ten, cacMuc, dangChon = [], lop = 'danh-sach-chon' }) {
  const tap = new Set(dangChon.map(String));
  const hop = el('div', { lop });
  for (const muc of cacMuc) {
    const giaTri = typeof muc === 'string' ? muc : muc.giaTri;
    const nhanMuc = typeof muc === 'string' ? muc : muc.nhan;
    const oChon = el('label', { lop: 'o-chon' }, [
      el('input', {
        kieu: 'checkbox',
        thuocTinh: { name: ten, value: String(giaTri), checked: tap.has(String(giaTri)) },
      }),
      el('span', { vanBan: nhanMuc }),
    ]);
    hop.append(oChon);
  }
  return hop;
}

/** Lấy danh sách giá trị đã chọn trong một khối hộp kiểm. */
export function layDaChon(khoi) {
  return Array.from(khoi.querySelectorAll('input[type="checkbox"]:checked')).map((o) => Number(o.value));
}

/* ========================= 7. THÔNG BÁO & HỘP THOẠI ====================== */

const BIEU_TUONG_THONG_BAO = {
  'thanh-cong': 'tick',
  loi: 'canh-bao',
  'canh-bao': 'canh-bao',
  'thong-tin': 'thong-tin',
};

/** Hiện thông báo nổi ở góc phải trên. */
export function thongBao(loai, tieuDe, noiDung = null, thoiGian = 4200) {
  const khu = document.getElementById('khu-thong-bao');
  if (!khu) return;
  const hop = el('div', { lop: `thong-bao ${loai}` }, [
    icon(BIEU_TUONG_THONG_BAO[loai] ?? 'thong-tin'),
    el('div', { lop: 'noi-dung-thong-bao' }, [
      el('strong', { vanBan: tieuDe }),
      noiDung ? el('p', { vanBan: noiDung }) : null,
    ]),
  ]);
  khu.append(hop);
  window.setTimeout(() => hop.remove(), thoiGian);
}

/** Thông báo thành công. */
export function thanhCong(tieuDe, noiDung = null) {
  thongBao('thanh-cong', tieuDe, noiDung);
}

/** Thông báo lỗi. */
export function baoLoi(tieuDe, noiDung = null) {
  thongBao('loi', tieuDe, noiDung, 6500);
}

/** Thông báo cảnh báo. */
export function canhBao(tieuDe, noiDung = null) {
  thongBao('canh-bao', tieuDe, noiDung, 5200);
}

/** Thông báo thông tin. */
export function thongTin(tieuDe, noiDung = null) {
  thongBao('thong-tin', tieuDe, noiDung);
}

/** Hiện lỗi trả về từ API dưới dạng thông báo. */
export function baoLoiApi(loi, tieuDe = 'Không thực hiện được') {
  baoLoi(tieuDe, thongDiepLoi(loi));
}

/** Bật/tắt lớp che chờ xử lý. */
export function hienTai(bat) {
  const lop = document.getElementById('lop-tai');
  if (lop) lop.hidden = !bat;
}

/** Đặt nút vào trạng thái đang xử lý. */
export function dangXuLy(nutBam, bat) {
  if (!nutBam) return;
  nutBam.disabled = Boolean(bat);
  nutBam.classList.toggle('nut-dang-tai', Boolean(bat));
}

/**
 * Mở hộp thoại.
 * @param {{ tieuDe, moTa, than, nutChan, rong, khiDong }} tuyChon
 * @returns {{ dong: Function, hop: HTMLElement }}
 */
export function hopThoai(tuyChon = {}) {
  const { tieuDe = '', moTa = null, than, nutChan = null, rong = false, khiDong = null } = tuyChon;

  const lopPhu = el('div', { lop: 'hop-thoai' });
  const hop = el('div', { lop: `hop-thoai-hop ${rong ? 'hop-rong' : ''}` });

  const dong = () => {
    lopPhu.remove();
    document.removeEventListener('keydown', xuLyPhim);
    if (khiDong) khiDong();
  };

  const xuLyPhim = (suKien) => {
    if (suKien.key === 'Escape') {
      suKien.stopPropagation();
      dong();
    }
  };

  const nutDong = el('button', {
    lop: 'nut-dong',
    kieu: 'button',
    html: bieuTuong('dong', 'bieu-tuong'),
    nghe: { click: dong },
    thuocTinh: { title: 'Đóng', 'aria-label': 'Đóng' },
  });

  hop.append(
    el('div', { lop: 'hop-thoai-dau' }, [
      el('div', {}, [
        el('h2', { vanBan: tieuDe }),
        moTa ? el('p', { vanBan: moTa }) : null,
      ]),
      nutDong,
    ])
  );

  const thanHop = el('div', { lop: 'hop-thoai-than' }, [than]);
  hop.append(thanHop);
  if (nutChan) hop.append(el('div', { lop: 'hop-thoai-chan' }, Array.isArray(nutChan) ? nutChan : [nutChan]));

  lopPhu.append(hop);
  lopPhu.addEventListener('click', (suKien) => {
    if (suKien.target === lopPhu) dong();
  });
  document.getElementById('khu-hop-thoai').append(lopPhu);
  document.addEventListener('keydown', xuLyPhim);

  const oNhapDau = hop.querySelector('input, select, textarea');
  if (oNhapDau) window.setTimeout(() => oNhapDau.focus(), 30);

  return { dong, hop, than: thanHop };
}

/**
 * Hộp thoại xác nhận. Trả về Promise<boolean>.
 * @param {{ tieuDe, noiDung, nhanDongY, nguyHiem }} tuyChon
 */
export function xacNhan(tuyChon = {}) {
  const {
    tieuDe = 'Xác nhận thao tác',
    noiDung = 'Bạn có chắc chắn muốn tiếp tục?',
    nhanDongY = 'Đồng ý',
    nguyHiem = false,
  } = tuyChon;

  return new Promise((dongY) => {
    let daTraLoi = false;
    const traLoi = (giaTri) => {
      if (daTraLoi) return;
      daTraLoi = true;
      dongY(giaTri);
    };

    const nutDongY = nut({
      nhan: nhanDongY,
      bieuTuong: nguyHiem ? 'canh-bao' : 'tick',
      chinh: !nguyHiem,
      nguyHiem,
      nghe: () => {
        traLoi(true);
        hopThoai.dong();
      },
    });
    const nutHuy = nut({
      nhan: 'Hủy bỏ',
      lop: 'nut-trong',
      nghe: () => {
        traLoi(false);
        hopThoai.dong();
      },
    });

    const hopThoai = hopThoai_(
      {
        tieuDe,
        than: el('p', { vanBan: noiDung, thuocTinh: { style: 'font-size:13.5px' } }),
        nutChan: [nutHuy, nutDongY],
        khiDong: () => traLoi(false),
      }
    );
  });
}

/** Bí danh nội bộ để hàm xacNhan không trùng tên với tham số. */
const hopThoai_ = hopThoai;

/* ============================== 8. BIỂU ĐỒ =============================== */

/** Biểu đồ ngang từ danh sách [{ nhan, giaTri }]. */
export function bieuDoNgang(cacDong, { dinhDang = (v) => String(v) } = {}) {
  const lonNhat = Math.max(1, ...cacDong.map((dong) => Number(dong.giaTri) || 0));
  const hop = el('div', { lop: 'bieu-do-bang' });
  for (const dong of cacDong) {
    const giaTri = Number(dong.giaTri) || 0;
    hop.append(
      el('div', { lop: 'dong-bieu-do' }, [
        el('span', { lop: 'nhan-cot', vanBan: dong.nhan, thuocTinh: { title: dong.nhan } }),
        el('div', { lop: 'thanh-cot' }, [
          el('span', { thuocTinh: { style: `width:${Math.round((giaTri / lonNhat) * 100)}%` } }),
        ]),
        el('span', { lop: 'gia-tri-cot', vanBan: dinhDang(giaTri) }),
      ])
    );
  }
  return hop;
}

/** Biểu đồ cột dọc từ danh sách [{ nhan, giaTri }]. */
export function bieuDoCot(cacDong, { dinhDang = (v) => String(v) } = {}) {
  const lonNhat = Math.max(1, ...cacDong.map((dong) => Number(dong.giaTri) || 0));
  const hop = el('div', { lop: 'bieu-do-cot-doc' });
  for (const dong of cacDong) {
    const giaTri = Number(dong.giaTri) || 0;
    const phanTramCao = Math.max(2, Math.round((giaTri / lonNhat) * 100));
    hop.append(
      el('div', {
        lop: 'cot-doc',
        thuocTinh: { title: `${dong.nhan}: ${dinhDang(giaTri)}` },
      }, [
        el('span', { lop: 'gia-tri-nho', vanBan: dinhDang(giaTri) }),
        el('div', { lop: 'thanh', thuocTinh: { style: `height:${phanTramCao}%` } }),
        el('span', { lop: 'nhan-duoi', vanBan: dong.nhan }),
      ])
    );
  }
  return hop;
}

/* =========================== 9. TAB & THỜI GIAN ========================== */

/**
 * Dựng khu vực tab. Trả về { tabEl, thanEl, dangChon }.
 * @param {Array<{ ma, nhan, dung: Function }>} cacTab
 */
export function khuTab(cacTab) {
  let tabHienTai = cacTab[0]?.ma ?? null;
  const thanEl = el('div', { lop: 'the-than' });
  const tabEl = el('div', { lop: 'tab' });

  const veLai = () => {
    xoaHet(thanEl);
    const tab = cacTab.find((muc) => muc.ma === tabHienTai) ?? cacTab[0];
    if (tab) thanEl.append(tab.dung());
    for (const nutTab of tabEl.children) {
      nutTab.classList.toggle('dang-chon', nutTab.dataset.ma === tabHienTai);
    }
  };

  for (const tab of cacTab) {
    const nutTab = el('button', {
      lop: 'nut-tab',
      vanBan: tab.nhan,
      kieu: 'button',
      thuocTinh: { 'data-ma': tab.ma },
      nghe: {
        click: () => {
          tabHienTai = tab.ma;
          veLai();
        },
      },
    });
    tabEl.append(nutTab);
  }
  veLai();

  return {
    tabEl,
    thanEl,
    get dangChon() {
      return tabHienTai;
    },
  };
}

/** Dòng thời gian từ danh sách [{ thoiDiem, tieuDe, moTa }]. */
export function dongThoiGian(cacMoc) {
  const hop = el('div', {});
  for (const moc of cacMoc) {
    hop.append(
      el('div', { lop: 'dong-thoi-gian' }, [
        el('span', { lop: 'cham-moc' }),
        el('div', { lop: 'noi-dung-moc' }, [
          el('div', {}, [
            el('div', { vanBan: moc.tieuDe, thuocTinh: { style: 'font-weight:600' } }),
            moc.moTa ? el('div', { lop: 'mo-chu nho-chu', vanBan: moc.moTa }) : null,
          ]),
          el('span', { lop: 'thoi-diem', vanBan: moc.thoiDiem }),
        ]),
      ])
    );
  }
  return hop;
}

/** Dòng theo dõi (nhãn + giá trị) dùng cho các khối tóm tắt. */
export function dongTheoDoi({ bieuTuong: ten, nhan: tenNhan, giaTri }) {
  return el('div', { lop: 'dong-theo-doi' }, [
    el('div', { lop: 'trai' }, [ten ? icon(ten) : null, el('span', { vanBan: tenNhan })]),
    el('strong', { vanBan: giaTri }),
  ]);
}
