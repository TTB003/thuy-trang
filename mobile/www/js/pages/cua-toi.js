/**
 * CỔNG KHÁCH HÀNG (mục 4.3) — dành cho tài khoản vai trò Khách hàng:
 * hồ sơ cá nhân, đơn hàng của tôi, điểm thưởng, phản hồi và khảo sát được giao.
 */
'use strict';

import { api } from '../api.js';
import { anhSanPham } from '../hinh-san-pham.js';
import { chuCaiDau, ngay, ngayChoInput, ngayGio, so, tien } from '../format.js';
import {
  bang,
  bangPhu,
  baoLoiApi,
  canhBao,
  dangXuLy,
  docBieuMau,
  el,
  hopThoai,
  icon,
  luoiTruong,
  moTaCot,
  nhan,
  nut,
  oTrong,
  phanTrang,
  thanhCong,
  the,
  theSoLieu,
  truong,
  xoaHet,
} from '../ui.js';

const gioHangMuaSam = new Map();

/** Màn hình cổng khách hàng. */
export const manHinh = {
  ma: 'cua-toi',
  tieuDe: 'Cổng khách hàng',
  moTa: 'Xem hồ sơ, đơn hàng, điểm thưởng, gửi phản hồi và trả lời khảo sát.',
  bieuTuong: 'khach-hang',
  chiKhachHang: true,

  async hienThi(container, ctx) {
    const cacTab = {
      'mua-hang': () => tabMuaHang(),
      'ho-so': () => tabHoSo(),
      'don-hang': () => tabDonHang(ctx),
      diem: () => tabDiem(ctx),
      'uu-dai': () => tabUuDai(ctx),
      'phan-hoi': () => tabPhanHoi(ctx),
      'khao-sat': () => tabKhaoSat(),
    };
    const noiDungTab = (cacTab[ctx.query.tab] ?? cacTab['mua-hang'])();

    container.append(
      the({
        tieuDe: 'Cổng khách hàng',
        ghiChu: 'Khu vực dành riêng cho tài khoản khách hàng của cửa hàng.',
        than: noiDungTab,
        lopThan: 'the-than day cong-khach-hang',
      })
    );
  },
};

/* =========================== TAB 0: MUA HÀNG ============================ */

/** Danh mục sản phẩm, giỏ hàng và thanh toán tại quán/giao hàng. */
function tabMuaHang() {
  const vung = el('div', {});
  let danhSachDiaChi = [];
  let maDiaChiChon = null;
  let thongTinDiem = { diemTichLuy: 0 };
  let danhSachPhieu = [];
  let soPhieuHetLuot = 0;
  let maPhieuChon = '';
  const vungSanPham = el('div', { lop: 'luoi-san-pham-khach' });
  const vungGioHang = el('div', {});
  const oTimKiemSanPham = el('input', {
    kieu: 'search',
    giaTri: '',
    thuocTinh: { placeholder: 'Tìm tên sản phẩm...', 'aria-label': 'Tìm tên sản phẩm' },
  });
  let henTimKiem = null;
  oTimKiemSanPham.addEventListener('input', () => {
    window.clearTimeout(henTimKiem);
    henTimKiem = window.setTimeout(() => taiSanPham(), 250);
  });
  const oLoai = el('select', {
    nghe: {
      change: () => taiSanPham(),
    },
  });
  const oHinhThuc = truong({
    ten: 'hinhThuc',
    nhan: 'Cách nhận hàng',
    loai: 'select',
    batBuoc: true,
    giaTri: 'Giao hàng',
    tuyChon: { muc: ['Giao hàng', 'Tại quán'] },
  });
  const oThanhToan = truong({
    ten: 'phuongThucThanhToan',
    nhan: 'Phương thức thanh toán',
    loai: 'select',
    batBuoc: true,
    giaTri: 'Tiền mặt',
    tuyChon: {
      muc: [
        { giaTri: 'Tiền mặt', nhan: 'Tiền mặt khi nhận hàng' },
        { giaTri: 'Chuyển khoản', nhan: 'Chuyển khoản' },
      ],
    },
  });
  const vungDiaChi = el('div', { lop: 'danh-sach-dia-chi' });
  const khuDiaChi = el('div', { lop: 'khu-dia-chi-giao-hang' }, [
    el('div', { lop: 'dong-dia-chi-tieu-de' }, [
      el('strong', { vanBan: 'Địa chỉ giao hàng' }),
      nut({ nhan: 'Thêm địa chỉ', bieuTuong: 'them', lop: 'nut-trong nut-nho', nghe: moThemDiaChi }),
    ]),
    vungDiaChi,
  ]);
  const oDiem = truong({
    ten: 'diemSuDung',
    nhan: 'Dùng điểm tích lũy',
    loai: 'number',
    giaTri: 0,
    thuocTinh: { min: 0, step: 1 },
  });
  const oDiemKhaDung = el('strong', { lop: 'so', vanBan: '0 điểm khả dụng' });
  const chonPhieu = el('select', { nghe: { change: () => { maPhieuChon = chonPhieu.value; veGioHang(); } } });
  const moTaPhieu = el('p', { lop: 'mo-chu nho-chu', vanBan: 'Chọn phiếu giảm giá nếu bạn có.' });
  const khuPhieu = el('label', { lop: 'truong khu-chon-phieu' }, [el('span', { vanBan: 'Phiếu giảm giá' }), chonPhieu, moTaPhieu]);
  chonPhieu.append(el('option', { vanBan: 'Không sử dụng phiếu', thuocTinh: { value: '' } }));
  const oNhacDiem = el('p', {
    lop: 'mo-chu nho-chu',
    vanBan: 'Điểm sẽ hết hạn sau 30 ngày không mua hàng. Đơn mua mới sẽ tính lại thời hạn từ ngày mua gần nhất.',
  });
  const oGhiChu = truong({
    ten: 'ghiChu',
    nhan: 'Ghi chú cho cửa hàng',
    loai: 'textarea',
    thuocTinh: { maxlength: 255 },
  });
  const oTong = el('strong', { lop: 'so', vanBan: tien(0) });
  const nhanGioDock = el('span', { lop: 'gio-hang-dock-so', vanBan: '0' });
  const nutGioDock = el('button', { lop: 'gio-hang-dock', kieu: 'button', thuocTinh: { 'aria-expanded': 'false', 'aria-label': 'Mở giỏ hàng' } }, [
    el('span', { lop: 'gio-hang-dock-bieu-tuong' }, [icon('gio-hang')]),
    nhanGioDock,
  ]);
  nutGioDock.addEventListener('click', () => {
    if (!layoutMuaHang.classList.contains('gio-hang-mo')) {
      document.getElementById('khung-ung-dung')?.classList.remove('mo-thanh-ben');
      document.getElementById('lop-phu-thanh-ben').hidden = true;
    }
    const dangMo = layoutMuaHang.classList.toggle('gio-hang-mo');
    document.getElementById('khung-ung-dung')?.classList.toggle('mo-gio-hang', dangMo);
    nutGioDock.setAttribute('aria-expanded', String(dangMo));
    nutGioDock.setAttribute('aria-label', dangMo ? 'Đóng giỏ hàng' : 'Mở giỏ hàng');
  });
  document.addEventListener('click', (suKien) => {
    if (!layoutMuaHang.classList.contains('gio-hang-mo')) return;
    if (suKien.target === layoutMuaHang || !layoutMuaHang.contains(suKien.target)) {
      layoutMuaHang.classList.remove('gio-hang-mo');
      document.getElementById('khung-ung-dung')?.classList.remove('mo-gio-hang');
      nutGioDock.setAttribute('aria-expanded', 'false');
      nutGioDock.setAttribute('aria-label', 'Mở giỏ hàng');
    }
  });
  document.addEventListener('keydown', (suKien) => {
    if (suKien.key !== 'Escape' || !layoutMuaHang.classList.contains('gio-hang-mo')) return;
    layoutMuaHang.classList.remove('gio-hang-mo');
    document.getElementById('khung-ung-dung')?.classList.remove('mo-gio-hang');
    nutGioDock.setAttribute('aria-expanded', 'false');
    nutGioDock.setAttribute('aria-label', 'Mở giỏ hàng');
  });
  oDiem.querySelector('input').addEventListener('input', veGioHang);
  const nutDatHang = nut({
    nhan: 'Đặt hàng',
    bieuTuong: 'tick',
    chinh: true,
    nghe: guiDonHang,
  });

  function capNhatHinhThucThanhToan() {
    const giaoHang = oHinhThuc.querySelector('select').value === 'Giao hàng';
    khuDiaChi.hidden = !giaoHang;
    for (const tuyChon of oThanhToan.querySelectorAll('option')) {
      if (tuyChon.value === 'Tiền mặt') {
        tuyChon.textContent = giaoHang ? 'Tiền mặt khi nhận hàng' : 'Tiền mặt tại quán';
      }
    }
  }
  oHinhThuc.querySelector('select').addEventListener('change', capNhatHinhThucThanhToan);
  capNhatHinhThucThanhToan();

  oLoai.append(el('option', { vanBan: 'Tất cả loại sản phẩm', thuocTinh: { value: '' } }));
  const layoutMuaHang = el('div', { lop: 'khu-mua-hang-layout' }, [
    el('section', { lop: 'khu-mua-hang-san-pham' }, [
    el('div', { lop: 'thanh-cong-cu' }, [
      el('label', { lop: 'truong truong-tim-kiem' }, [
        el('span', { vanBan: 'Tìm sản phẩm' }),
        oTimKiemSanPham,
      ]),
      el('label', { lop: 'truong truong-ngan' }, [
        el('span', { vanBan: 'Lọc theo loại' }),
        oLoai,
      ]),
    ]),
    vungSanPham,
    ]),
    el('aside', { lop: 'khu-mua-hang-thanh-ben' }, [
    the({
      tieuDe: 'Giỏ hàng',
      ghiChu: 'Chọn món ở trên để thêm vào đơn.',
      than: vungGioHang,
      lopThan: 'the-than day',
    }),
    the({
      tieuDe: 'Thông tin nhận hàng và thanh toán',
      ghiChu: 'Chuyển khoản được ghi nhận trong đơn; cửa hàng xác nhận thanh toán thủ công.',
      than: el('div', {}, [
        el('div', { lop: 'luoi-hai-cot' }, [oHinhThuc, oThanhToan]),
        khuDiaChi,
        el('div', { lop: 'thong-tin-diem-gio-hang', thuocTinh: { style: 'margin-top:12px' } }, [
          el('span', { vanBan: 'Điểm tích lũy khả dụng: ' }), oDiemKhaDung, oNhacDiem,
        ]),
        el('div', { thuocTinh: { style: 'margin-top:12px' } }, [oDiem]),
        el('div', { thuocTinh: { style: 'margin-top:12px' } }, [khuPhieu]),
        el('div', { thuocTinh: { style: 'margin-top:12px' } }, [oGhiChu]),
        el('div', { lop: 'bang-tong' }, [
          el('div', { lop: 'dong-tong tong-cuoi' }, [
            el('span', { vanBan: 'Tổng tiền tạm tính' }),
            oTong,
          ]),
        ]),
        el('div', { lop: 'nhom-nut' }, [nutDatHang]),
      ]),
      lopThan: 'the-than day',
    })
    ]),
    nutGioDock,
  ]);
  vung.append(layoutMuaHang);

  async function taiSanPham() {
    xoaHet(vungSanPham);
    vungSanPham.append(el('p', { lop: 'mo-chu', vanBan: 'Đang tải sản phẩm…' }));
    try {
      const query = { trangThai: 'Đang bán', conHang: 'true', pageSize: 100 };
      if (oLoai.value) query.maLoai = oLoai.value;
      if (oTimKiemSanPham.value.trim()) query.q = oTimKiemSanPham.value.trim();
      const du = await api.doc('/api/sanpham', query);
      const items = Array.isArray(du?.items) ? du.items : [];
      xoaHet(vungSanPham);
      if (items.length === 0) {
        vungSanPham.append(oTrong({
          tieuDe: 'Chưa có món phù hợp',
          moTa: 'Loại sản phẩm này hiện không có món đang bán.',
          bieuTuong: 'san-pham',
        }));
        return;
      }
      for (const sp of items) {
        const giaGoc = Number(sp.gia ?? 0);
        const giaBan = Number(sp.giaSauGiam ?? giaGoc);
        const soTienGiam = Math.max(0, giaGoc - giaBan);
        const phanTramGiam = giaGoc > 0 ? Math.round((soTienGiam / giaGoc) * 100) : 0;
        vungSanPham.append(the({
          tieuDe: sp.tenSP,
          ghiChu: sp.tenLoai,
          than: el('div', { lop: 'the-khach-mua-noi-dung' }, [
            anhSanPham(sp, 'the-khach-mua-anh'),
            sp.moTa ? el('p', { lop: 'mo-chu nho-chu', vanBan: sp.moTa }) : null,
            el('p', { lop: 'gia the-khach-mua-gia', vanBan: tien(giaBan) }),
            sp.coKhuyenMai && soTienGiam > 0 ? el('div', { lop: 'the-khach-mua-giam' }, [
              sp.tenKhuyenMai ? el('strong', { lop: 'the-khach-mua-ten-km', vanBan: sp.tenKhuyenMai }) : null,
              el('span', { lop: 'gia-goc', vanBan: tien(giaGoc) }),
              el('span', { lop: 'nhan nhan-cam', vanBan: `Giảm ${tien(soTienGiam)} · ${phanTramGiam}%` }),
            ]) : null,
            el('p', { lop: 'mo-chu nho-chu the-khach-mua-ton', vanBan: `Còn ${so(sp.soLuong)}` }),
            nut({ nhan: 'Thêm vào giỏ', bieuTuong: 'them', chinh: true, nghe: () => {
              const dong = gioHangMuaSam.get(Number(sp.maSP));
              const soLuongMoi = (dong?.soLuong ?? 0) + 1;
              if (soLuongMoi > Number(sp.soLuong)) {
                canhBao('Đã đạt số lượng tồn kho', `Hiện chỉ còn ${so(sp.soLuong)} ${sp.tenSP}.`);
                return;
              }
              gioHangMuaSam.set(Number(sp.maSP), { sp, soLuong: soLuongMoi });
              veGioHang();
              thanhCong('Đã thêm vào giỏ', sp.tenSP);
            } }),
          ]),
          lopThan: 'the-than the-khach-mua-the',
        }));
      }
    } catch (loi) {
      xoaHet(vungSanPham);
      vungSanPham.append(el('p', { lop: 'mo-chu', vanBan: `Không tải được sản phẩm: ${loi.message}` }));
    }
  }

  async function taiLoaiSanPham() {
    const du = await api.doc('/api/loaisanpham', { pageSize: 100 });
    for (const loai of du?.items ?? []) {
      oLoai.append(el('option', {
        vanBan: loai.tenLoai,
        thuocTinh: { value: String(loai.maLoai) },
      }));
    }
  }

  function veGioHang() {
    xoaHet(vungGioHang);
    let tong = 0;
    for (const [maSP, dong] of gioHangMuaSam) {
      const gia = Number(dong.sp.giaSauGiam ?? dong.sp.gia);
      const thanhTien = gia * dong.soLuong;
      tong += thanhTien;
      vungGioHang.append(el('div', { lop: 'hang-gio-hang' }, [
        el('div', { lop: 'hang-gio-hang-ten' }, [
          el('strong', { vanBan: dong.sp.tenSP }),
          el('small', { lop: 'mo-chu', vanBan: `${tien(gia)} / món` }),
        ]),
        el('div', { lop: 'so-luong-gio-hang' }, [
          nut({ nhan: '−', lop: 'nut-trong nut-nho', tat: dong.soLuong <= 1, nghe: () => {
          dong.soLuong = Math.max(1, dong.soLuong - 1);
          veGioHang();
        } }),
          el('strong', { lop: 'so-luong-hien-tai so', vanBan: so(dong.soLuong) }),
          nut({ nhan: '+', lop: 'nut-trong nut-nho', nghe: () => {
          if (dong.soLuong >= Number(dong.sp.soLuong)) {
            canhBao('Đã đạt số lượng tồn kho', `Hiện chỉ còn ${so(dong.sp.soLuong)} ${dong.sp.tenSP}.`);
            return;
          }
          dong.soLuong += 1;
          veGioHang();
        } }),
        ]),
        el('strong', { lop: 'so', vanBan: tien(thanhTien) }),
        nut({ nhan: 'Xóa', bieuTuong: 'xoa', lop: 'nut-trong nut-nho nut-xoa-gio', nghe: () => {
          gioHangMuaSam.delete(maSP);
          veGioHang();
        } }),
      ]));
    }
    if (gioHangMuaSam.size === 0) {
      vungGioHang.append(oTrong({ tieuDe: 'Giỏ hàng đang trống', moTa: 'Thêm sản phẩm để bắt đầu đặt hàng.' }));
    }
    const inputDiem = oDiem.querySelector('input');
    const diemToiDa = Math.min(Number(thongTinDiem.diemTichLuy ?? 0), Math.floor(tong / 1000));
    inputDiem.max = String(diemToiDa);
    const diemNhap = Math.min(Math.max(0, Number(inputDiem.value) || 0), diemToiDa);
    if (Number(inputDiem.value) !== diemNhap) inputDiem.value = String(diemNhap);
    const giamDiem = diemNhap * 1000;
    const phieu = danhSachPhieu.find((p) => String(p.maPG) === String(maPhieuChon));
    let giamPhieu = 0;
    if (phieu && tong > giamDiem) {
      const coSo = phieu.loai === 'Sinh nhật'
        ? Math.max(0, ...[...gioHangMuaSam.values()].map(({ sp }) => Number(sp.giaSauGiam ?? sp.gia)))
        : tong;
      giamPhieu = coSo * Number(phieu.phanTramGiam || 0) / 100;
      if (phieu.giamToiDa != null) giamPhieu = Math.min(giamPhieu, Number(phieu.giamToiDa));
      giamPhieu = Math.min(giamPhieu, tong - giamDiem);
      moTaPhieu.textContent = `${phieu.tieuDe} · giảm ${tien(giamPhieu)}${phieu.ngayHetHan ? ` · hạn ${ngay(phieu.ngayHetHan)}` : ''}`;
    } else moTaPhieu.textContent = phieu ? 'Thêm sản phẩm vào giỏ để áp dụng phiếu.' : (soPhieuHetLuot ? `Có ${soPhieuHetLuot} phiếu đã hết lượt; hệ thống đã gửi thông báo cho bạn.` : 'Chọn phiếu giảm giá nếu bạn có.');
    if (giamDiem > 0) vungGioHang.append(el('div', { lop: 'dong-tong' }, [
      el('span', { vanBan: 'Giảm điểm' }), el('span', { lop: 'so', vanBan: `− ${tien(giamDiem)}` }),
    ]));
    if (giamPhieu > 0) vungGioHang.append(el('div', { lop: 'dong-tong' }, [
      el('span', { vanBan: 'Giảm phiếu' }), el('span', { lop: 'so', vanBan: `− ${tien(giamPhieu)}` }),
    ]));
    oTong.textContent = tien(Math.max(0, tong - giamDiem - giamPhieu));
    const soMon = [...gioHangMuaSam.values()].reduce((sum, dong) => sum + dong.soLuong, 0);
    nhanGioDock.textContent = soMon > 99 ? '99+' : String(soMon);
    nutGioDock.title = `Giỏ hàng · ${soMon} món · ${oTong.textContent}`;
  }

  async function taiPhieuGiamGia() {
    try {
      const data = await api.doc('/api/cua-toi/uu-dai', { pageSize: 100 });
      const all = data?.items ?? [];
      soPhieuHetLuot = all.filter((p) => p.trangThai === 'Hết lượt').length;
      danhSachPhieu = all.filter((p) => p.trangThai === 'Chưa dùng' && Number(p.soLanDaSuDung ?? 0) < Number(p.soLanSuDungToiDa ?? 1));
      if (!danhSachPhieu.some((p) => String(p.maPG) === String(maPhieuChon))) maPhieuChon = '';
      chonPhieu.replaceChildren(el('option', { vanBan: 'Không sử dụng phiếu', thuocTinh: { value: '' } }));
      for (const p of danhSachPhieu) chonPhieu.append(el('option', {
        vanBan: `${p.tieuDe} · giảm ${p.phanTramGiam}%`,
        thuocTinh: { value: String(p.maPG), selected: String(p.maPG) === String(maPhieuChon) },
      }));
      if (soPhieuHetLuot) chonPhieu.append(el('option', { vanBan: `${soPhieuHetLuot} phiếu đã hết lượt`, thuocTinh: { value: '', disabled: true } }));
      chonPhieu.value = maPhieuChon;
      khuPhieu.hidden = danhSachPhieu.length === 0 && soPhieuHetLuot === 0;
      veGioHang();
    } catch { khuPhieu.hidden = true; }
  }

  function veDiaChi() {
    xoaHet(vungDiaChi);
    if (!danhSachDiaChi.length) {
      vungDiaChi.append(el('p', { lop: 'mo-chu nho-chu', vanBan: 'Chưa có địa chỉ đã lưu. Hãy thêm địa chỉ để giao hàng.' }));
      return;
    }
    for (const diaChi of danhSachDiaChi) {
      const maDC = Number(diaChi.maDC);
      const radio = el('input', { kieu: 'radio', thuocTinh: { name: 'diaChiChon', value: String(maDC), checked: maDC === Number(maDiaChiChon) } });
      radio.addEventListener('change', () => chonDiaChi(maDC));
      vungDiaChi.append(el('label', { lop: `the-dia-chi ${diaChi.laMacDinh ? 'dang-chon' : ''}` }, [
        radio,
        el('span', { lop: 'the-dia-chi-noi-dung' }, [
          el('strong', { vanBan: diaChi.tenGoiNho || 'Địa chỉ' }),
          el('span', { vanBan: diaChi.diaChi }),
          diaChi.sdtNhanHang ? el('small', { lop: 'mo-chu', vanBan: `SĐT nhận hàng: ${diaChi.sdtNhanHang}` }) : null,
          diaChi.laMacDinh ? nhan('Đang chọn', 'nhan-xanh') : null,
        ]),
      ]));
    }
  }

  async function taiDiaChi() {
    const du = await api.doc('/api/cua-toi/dia-chi');
    danhSachDiaChi = Array.isArray(du) ? du : (du?.items ?? []);
    maDiaChiChon = danhSachDiaChi.find((d) => d.laMacDinh)?.maDC ?? null;
    veDiaChi();
  }

  async function chonDiaChi(maDC) {
    maDiaChiChon = maDC;
    try {
      await api.patch(`/api/cua-toi/dia-chi/${maDC}/mac-dinh`, {});
      danhSachDiaChi = danhSachDiaChi.map((d) => ({ ...d, laMacDinh: Number(d.maDC) === maDC }));
      danhSachDiaChi.sort((a, b) => Number(b.laMacDinh) - Number(a.laMacDinh));
      veDiaChi();
    } catch (loi) {
      baoLoiApi(loi, 'Không lưu được địa chỉ đã chọn');
      await taiDiaChi();
    }
  }

  function moThemDiaChi() {
    const form = el('form', { thuocTinh: { novalidate: true } }, [luoiTruong([
      truong({ ten: 'tenGoiNho', nhan: 'Tên gợi nhớ', giaTri: 'Nhà', thuocTinh: { maxlength: 60 } }),
      truong({ ten: 'sdtNhanHang', nhan: 'Số điện thoại nhận hàng', loai: 'tel', thuocTinh: { maxlength: 15 } }),
      truong({ ten: 'diaChi', nhan: 'Địa chỉ đầy đủ', loai: 'textarea', batBuoc: true, rong: true, thuocTinh: { maxlength: 255 } }),
    ])]);
    const nutLuu = nut({ nhan: 'Lưu địa chỉ', bieuTuong: 'luu', chinh: true, nghe: luu });
    const hop = hopThoai({
      tieuDe: 'Thêm địa chỉ giao hàng',
      moTa: 'Địa chỉ mới sẽ được lưu và tự chọn cho đơn hàng tiếp theo.',
      than: form,
      nutChan: [nut({ nhan: 'Hủy', lop: 'nut-trong', nghe: () => hop.dong() }), nutLuu],
      rong: true,
    });
    form.addEventListener('submit', (e) => { e.preventDefault(); luu(); });
    async function luu() {
      if (!form.querySelector('[name="diaChi"]').value.trim()) {
        canhBao('Thiếu địa chỉ', 'Vui lòng nhập địa chỉ giao hàng đầy đủ.');
        return;
      }
      dangXuLy(nutLuu, true);
      try {
        await api.post('/api/cua-toi/dia-chi', docBieuMau(form));
        await taiDiaChi();
        hop.dong();
        thanhCong('Đã lưu địa chỉ', 'Địa chỉ này đã được chọn cho đơn hàng.');
      } catch (loi) { baoLoiApi(loi, 'Không lưu được địa chỉ'); }
      finally { dangXuLy(nutLuu, false); }
    }
  }

  async function napThongTinKhach() {
    try {
      thongTinDiem = await api.doc('/api/cua-toi/diem', { pageSize: 1 });
      const input = oDiem.querySelector('input');
      const diem = Number(thongTinDiem.diemTichLuy ?? 0);
      input.max = String(diem);
      input.placeholder = `Tối đa ${so(diem)} điểm`;
      if (Number(input.value) > diem) input.value = String(diem);
      oDiemKhaDung.textContent = `${so(diem)} điểm`;
      oNhacDiem.textContent = diem > 0 && thongTinDiem.ngayHetHanDiem
        ? `Điểm sẽ hết hạn vào ${ngayGio(thongTinDiem.ngayHetHanDiem)} nếu bạn không mua hàng. Đơn mua mới sẽ tính lại thời hạn 30 ngày.`
        : 'Điểm sẽ hết hạn sau 30 ngày không mua hàng. Đơn mua mới sẽ tính lại thời hạn từ ngày mua gần nhất.';
      veGioHang();
    } catch {
      // Vẫn nạp sổ địa chỉ độc lập với hồ sơ khách hàng.
    }
  }

  async function guiDonHang() {
    if (gioHangMuaSam.size === 0) {
      canhBao('Giỏ hàng đang trống', 'Hãy thêm ít nhất một sản phẩm trước khi đặt hàng.');
      return;
    }
    const hinhThuc = oHinhThuc.querySelector('select').value;
    const diaChiChon = danhSachDiaChi.find((d) => Number(d.maDC) === Number(maDiaChiChon));
    if (hinhThuc === 'Giao hàng' && !diaChiChon) {
      canhBao('Cần địa chỉ giao hàng', 'Chọn địa chỉ đã lưu hoặc thêm địa chỉ mới trước khi thanh toán.');
      if (!danhSachDiaChi.length) moThemDiaChi();
      else khuDiaChi.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    dangXuLy(nutDatHang, true);
    try {
      const du = await api.post('/api/donhang', {
        hinhThuc,
        phuongThucThanhToan: oThanhToan.querySelector('select').value,
        diaChiGiaoHang: hinhThuc === 'Giao hàng' ? diaChiChon.diaChi : null,
        diemSuDung: Number(oDiem.querySelector('input').value) || 0,
        maPG: maPhieuChon || null,
        ghiChu: oGhiChu.querySelector('textarea').value.trim() || null,
        chiTiet: [...gioHangMuaSam.values()].map(({ sp, soLuong }) => ({ maSP: sp.maSP, soLuong })),
      });
      gioHangMuaSam.clear();
      maPhieuChon = '';
      veGioHang();
      thanhCong('Đặt hàng thành công', `Mã đơn #${du.maDH} · Tổng tiền ${tien(du.tongTien)}.`);
      oGhiChu.querySelector('textarea').value = '';
      oDiem.querySelector('input').value = '0';
      await Promise.all([taiSanPham(), napThongTinKhach(), taiPhieuGiamGia()]);
    } catch (loi) {
      baoLoiApi(loi, 'Không đặt được đơn hàng');
    } finally {
      dangXuLy(nutDatHang, false);
    }
  }

  veGioHang();
  taiLoaiSanPham().catch(() => {}).finally(() => taiSanPham());
  napThongTinKhach();
  taiPhieuGiamGia();
  taiDiaChi().catch((loi) => baoLoiApi(loi, 'Không tải được địa chỉ giao hàng'));
  return vung;
}

/* ============================ TAB 1: HỒ SƠ ============================== */

/** Tab hồ sơ cá nhân: xem thông tin, điểm và sửa thông tin liên hệ. */
function tabHoSo() {
  const vung = el('div', {});

  /** Nạp hồ sơ và vẽ lại toàn bộ tab. */
  async function taiLai() {
    xoaHet(vung);
    vung.append(el('p', { lop: 'mo-chu nho-chu', vanBan: 'Đang tải hồ sơ…' }));
    try {
      const hoSo = await api.doc('/api/cua-toi/ho-so');
      xoaHet(vung);
      vung.append(veHoSo(hoSo));
    } catch (loi) {
      xoaHet(vung);
      vung.append(
        el('p', { lop: 'mo-chu', vanBan: `Không tải được hồ sơ: ${loi?.message ?? 'lỗi không xác định'}` })
      );
    }
  }

  /** Khối hồ sơ: thẻ tóm tắt, thông tin chi tiết và nút sửa. */
  function veHoSo(hoSo) {
    return el('div', {}, [
      el('div', { lop: 'khach-hang-dau' }, [
        el('div', { lop: 'anh-dai-dien', vanBan: chuCaiDau(hoSo.hoTen) }),
        el('div', { lop: 'thong-tin-dau' }, [
          el('h2', { vanBan: hoSo.hoTen }),
          el('p', {
            lop: 'mo-chu nho-chu',
            vanBan: `Mã khách hàng #${hoSo.maKH} · Thành viên từ ${ngay(hoSo.ngayDangKy)}`,
          }),
          el('div', { lop: 'nhom-nut' }, [nhan(hoSo.trangThai), nhan(hoSo.gioiTinh ?? 'Chưa rõ')]),
        ]),
        nut({
          nhan: 'Sửa thông tin',
          bieuTuong: 'sua',
          chinh: true,
          nghe: () => moSuaHoSo(hoSo),
        }),
      ]),
      el('div', { lop: 'luoi-thong-ke', thuocTinh: { style: 'margin-top:16px' } }, [
        theSoLieu({
          nhan: 'Điểm tích lũy',
          giaTri: so(hoSo.diemTichLuy),
          phu: `Tương đương ${tien(Number(hoSo.diemTichLuy) * 1000)} khi sử dụng`,
          sac: 'sac-matcha',
          bieuTuong: 'diem-thuong',
        }),
        theSoLieu({
          nhan: 'Số đơn hàng',
          giaTri: so(hoSo.soDonHang),
          bieuTuong: 'don-hang',
        }),
        theSoLieu({
          nhan: 'Tổng chi tiêu',
          giaTri: tien(hoSo.tongChiTieu),
          phu: 'Chỉ tính các đơn đã hoàn thành',
          sac: 'sac-honey',
          bieuTuong: 'tien',
        }),
      ]),
      el('div', { lop: 'bao-cao-luoi', thuocTinh: { style: 'margin-top:16px' } }, [
        the({
          tieuDe: 'Thông tin liên hệ',
          than: moTaCot([
            { nhan: 'Họ tên', giaTri: hoSo.hoTen },
            { nhan: 'Số điện thoại', giaTri: hoSo.sdt, so: true },
            { nhan: 'Email', giaTri: hoSo.email },
            { nhan: 'Ngày sinh', giaTri: hoSo.ngaySinh ? ngay(hoSo.ngaySinh) : null, so: true },
            { nhan: 'Tuổi', giaTri: hoSo.tuoi === null || hoSo.tuoi === undefined ? null : `${so(hoSo.tuoi)} tuổi`, so: true },
            { nhan: 'Giới tính', giaTri: hoSo.gioiTinh },
            { nhan: 'Địa chỉ', giaTri: hoSo.diaChi },
            { nhan: 'Sở thích', giaTri: hoSo.soThich },
          ]),
        }),
        the({
          tieuDe: 'Tài khoản đăng nhập',
          than: moTaCot([
            { nhan: 'Tên đăng nhập', giaTri: hoSo.tenDangNhap, so: true },
            { nhan: 'Trạng thái tài khoản', node: nhan(hoSo.trangThaiTaiKhoan) },
            { nhan: 'Đăng nhập gần nhất', giaTri: ngayGio(hoSo.lanDangNhapCuoi), so: true },
            { nhan: 'Ngày đăng ký', giaTri: ngayGio(hoSo.ngayDangKy), so: true },
          ]),
        }),
      ]),
      the({
        tieuDe: 'Món bạn hay dùng',
        ghiChu: 'Tổng hợp từ các đơn hàng đã hoàn thành.',
        than: hoSo.soThichSanPham
          ? el('div', { lop: 'nhom-nut' }, [
              ...String(hoSo.soThichSanPham)
                .split(',')
                .map((ten) => ten.trim())
                .filter(Boolean)
                .map((ten) => nhan(ten, 'nhan-trung-tinh')),
            ])
          : oTrong({
              tieuDe: 'Chưa có dữ liệu mua hàng',
              moTa: 'Sở thích sẽ được tổng hợp sau khi bạn có đơn hàng hoàn thành.',
              bieuTuong: 'san-pham',
            }),
        lopThan: 'the-than day',
      }),
    ]);
  }

  /** Hộp thoại cập nhật thông tin cá nhân (mục 4.3.1). */
  function moSuaHoSo(hoSo) {
    const bieuMau = el('form', { thuocTinh: { novalidate: true } }, [
      luoiTruong([
        truong({
          ten: 'hoTen',
          nhan: 'Họ và tên',
          loai: 'text',
          batBuoc: true,
          giaTri: hoSo.hoTen,
          thuocTinh: { maxlength: 100 },
        }),
        truong({
          ten: 'sdt',
          nhan: 'Số điện thoại (tên đăng nhập)',
          loai: 'text',
          giaTri: hoSo.sdt,
          goiY: 'Không thể thay đổi vì đây là tên đăng nhập của bạn.',
          thuocTinh: { maxlength: 15, readonly: true },
        }),
        truong({
          ten: 'email',
          nhan: 'Email',
          loai: 'email',
          giaTri: hoSo.email,
          thuocTinh: { maxlength: 150 },
        }),
        truong({
          ten: 'ngaySinh',
          nhan: 'Ngày sinh',
          loai: 'date',
          giaTri: ngayChoInput(hoSo.ngaySinh),
        }),
        truong({
          ten: 'gioiTinh',
          nhan: 'Giới tính',
          loai: 'select',
          giaTri: hoSo.gioiTinh ?? '',
          tuyChon: { muc: ['Nam', 'Nữ', 'Khác'], mucRong: '— Chưa chọn —' },
        }),
      ]),
      el('div', { lop: 'ghi-chu-sinh-nhat' }, [
        el('span', { lop: 'bieu-tuong-ghi-chu', html: icon('khuyen-mai').innerHTML }),
        el('div', {}, [
          el('strong', { vanBan: 'Quà tặng sinh nhật' }),
          el('p', {
            vanBan:
              'Điền ngày sinh để nhận phiếu giảm 50% cho 1 ly. Phiếu được gửi tự động vào đúng ngày sinh nhật, hiệu lực 3 ngày.',
          }),
        ]),
      ]),
    ]);

    const nutLuu = nut({
      nhan: 'Lưu thay đổi',
      bieuTuong: 'tick',
      chinh: true,
      nghe: () => gui(),
    });

    const hop = hopThoai({
      tieuDe: 'Cập nhật thông tin cá nhân',
      moTa: 'Số điện thoại và email không được trùng với khách hàng khác.',
      than: bieuMau,
      nutChan: [nut({ nhan: 'Hủy bỏ', lop: 'nut-trong', nghe: () => hop.dong() }), nutLuu],
      rong: true,
    });

    /** Gửi thông tin đã sửa lên máy chủ. */
    async function gui() {
      // Chỉ gửi các trường khách được phép sửa; số điện thoại là tên đăng nhập
      // nên máy chủ giữ nguyên dù có gửi lên.
      const duLieu = {
        hoTen: bieuMau.querySelector('[name="hoTen"]').value.trim(),
        email: bieuMau.querySelector('[name="email"]').value.trim() || null,
        ngaySinh: bieuMau.querySelector('[name="ngaySinh"]').value || null,
        gioiTinh: bieuMau.querySelector('[name="gioiTinh"]').value || null,
      };
      if (!duLieu.hoTen) {
        canhBao('Thiếu thông tin', 'Vui lòng nhập họ tên.');
        return;
      }

      dangXuLy(nutLuu, true);
      try {
        await api.put('/api/cua-toi/ho-so', duLieu);
        thanhCong('Đã cập nhật thông tin cá nhân');
        hop.dong();
        await taiLai();
      } catch (loi) {
        baoLoiApi(loi, 'Không lưu được thông tin');
      } finally {
        dangXuLy(nutLuu, false);
      }
    }

    bieuMau.addEventListener('submit', (suKien) => {
      suKien.preventDefault();
      gui();
    });
  }

  taiLai();
  return vung;
}

/* ========================== TAB 2: ĐƠN HÀNG ============================= */

/** Tab danh sách đơn hàng của khách hàng đang đăng nhập. */
function tabDonHang(ctx) {
  const trangThai = {
    page: Number(ctx.query.page) || 1,
    pageSize: Number(ctx.query.pageSize) || 10,
    trangThai: ctx.query.trangThai ?? '',
  };

  const thanhCongCu = el('div', { lop: 'thanh-cong-cu' });
  const vungBang = el('div', {});

  /** Vẽ bảng đơn hàng của khách. */
  async function veBang() {
    xoaHet(vungBang);
    try {
      const ketQua = await api.doc('/api/cua-toi/don-hang', {
        page: trangThai.page,
        pageSize: trangThai.pageSize,
        trangThai: trangThai.trangThai,
      });
      const items = Array.isArray(ketQua?.items) ? ketQua.items : [];
      const phan = ketQua?.pagination ?? { page: 1, pageSize: trangThai.pageSize, total: 0, totalPages: 1 };

      vungBang.append(
        bang({
          cot: [
            { tieuDe: 'Mã đơn', truong: 'maDH', lop: 'so' },
            { tieuDe: 'Ngày đặt', lop: 'so', lay: (ban) => ngayGio(ban.ngayDat) },
            { tieuDe: 'Hình thức', truong: 'hinhThuc' },
            { tieuDe: 'Số món', lop: 'so', lay: (ban) => so(ban.soMatHang) },
            { tieuDe: 'Tiền hàng', lop: 'so', lay: (ban) => tien(ban.tienHang) },
            {
              tieuDe: 'Giảm từ điểm',
              lop: 'so',
              lay: (ban) => (Number(ban.tienGiamDiem) > 0 ? `− ${tien(ban.tienGiamDiem)}` : '—'),
            },
            { tieuDe: 'Thành tiền', lop: 'so', lay: (ban) => tien(ban.tongTien) },
            { tieuDe: 'Trạng thái', dung: (ban) => nhan(ban.trangThai) },
            {
              tieuDe: 'Thao tác',
              lop: 'cot-thao-tac',
              dung: (ban) =>
                el('div', { lop: 'gon', thuocTinh: { style: 'justify-content:flex-end' } }, [
                  nut({
                    nhan: 'Xem chi tiết',
                    bieuTuong: 'ho-so',
                    nho: true,
                    nghe: () => moChiTiet(ban.maDH),
                  }),
                  ban.trangThai === 'Hoàn thành'
                    ? nut({
                        nhan: 'Đánh giá',
                        bieuTuong: 'danh-gia',
                        nho: true,
                        nghe: () => moDanhGia(ban.maDH),
                      })
                    : null,
                ]),
            },
          ],
          duLieu: items,
          khiRong: oTrong({
            tieuDe: 'Bạn chưa có đơn hàng nào',
            moTa: 'Đơn hàng bạn đặt từ mục Mua hàng sẽ xuất hiện ở đây.',
            bieuTuong: 'don-hang',
          }),
        })
      );

      if (phan.total > 0) {
        vungBang.append(
          phanTrang({
            phan,
            khiDoiTrang: (trang) => {
              trangThai.page = trang;
              veBang();
            },
            khiDoiCoTrang: (co) => {
              trangThai.pageSize = co;
              trangThai.page = 1;
              veBang();
            },
          })
        );
      }
    } catch (loi) {
      baoLoiApi(loi, 'Không tải được đơn hàng của bạn');
    }
  }

  /** Xem chi tiết một đơn hàng của chính khách. */
  async function moChiTiet(maDH) {
    let don;
    try {
      don = await api.doc(`/api/cua-toi/don-hang/${maDH}`);
    } catch (loi) {
      baoLoiApi(loi, 'Không tải được chi tiết đơn hàng');
      return;
    }

    const hop = hopThoai({
      tieuDe: `Đơn hàng #${don.maDH}`,
      moTa: `${ngayGio(don.ngayDat)} · ${don.trangThai}`,
      than: el('div', {}, [
        moTaCot([
          { nhan: 'Hình thức', giaTri: don.hinhThuc },
          { nhan: 'Thanh toán', giaTri: don.phuongThucThanhToan },
          { nhan: 'Địa chỉ giao hàng', giaTri: don.diaChiGiaoHang },
          { nhan: 'Nhân viên phục vụ', giaTri: don.tenNhanVien ?? 'Khách tự đặt' },
          { nhan: 'Trạng thái', node: nhan(don.trangThai) },
          { nhan: 'Ghi chú', giaTri: don.ghiChu },
          { nhan: 'Lý do hủy', giaTri: don.lyDoHuy },
        ]),
        el('h3', {
          vanBan: `Món đã gọi (${don.chiTiet?.length ?? 0})`,
          thuocTinh: { style: 'margin-top:20px;font-size:14px' },
        }),
        el('div', { thuocTinh: { style: 'margin-top:10px' } }, [
          bangPhu({
            cot: [
              { tieuDe: 'Sản phẩm', truong: 'tenSP' },
              { tieuDe: 'Số lượng', lop: 'so', lay: (dong) => so(dong.soLuong) },
              { tieuDe: 'Đơn giá', lop: 'so', lay: (dong) => tien(dong.donGia) },
              { tieuDe: 'Thành tiền', lop: 'so', lay: (dong) => tien(dong.thanhTien) },
            ],
            duLieu: don.chiTiet ?? [],
            chanBang: [
              { giaTri: 'Tổng cộng' },
              { giaTri: '' },
              { giaTri: tien(don.tienHang), lop: 'so' },
              { giaTri: tien(don.tongTien), lop: 'so' },
            ],
          }),
        ]),
        el('div', { lop: 'bang-tong', thuocTinh: { style: 'margin-top:14px' } }, [
          el('div', { lop: 'dong-tong' }, [
            el('span', { vanBan: 'Tiền hàng' }),
            el('span', { lop: 'so', vanBan: tien(don.tienHang) }),
          ]),
          Number(don.diemSuDung) > 0
            ? el('div', { lop: 'dong-tong' }, [
                el('span', { vanBan: `Dùng ${so(don.diemSuDung)} điểm` }),
                el('span', { lop: 'so', vanBan: `− ${tien(don.tienGiamDiem)}` }),
              ])
            : null,
          Number(don.tienGiamPhieu) > 0
            ? el('div', { lop: 'dong-tong' }, [
                el('span', { vanBan: `Phiếu ${don.maCodePhieu || 'giảm giá'}` }),
                el('span', { lop: 'so', vanBan: `− ${tien(don.tienGiamPhieu)}` }),
              ])
            : null,
          el('div', { lop: 'dong-tong tong-cuoi' }, [
            el('span', { vanBan: 'Bạn đã trả' }),
            el('span', { lop: 'so', vanBan: tien(don.tongTien) }),
          ]),
        ]),
      ]),
      rong: true,
      nutChan: [nut({ nhan: 'Đóng', lop: 'nut-trong', nghe: () => hop.dong() })],
    });
  }

  /** Mở biểu mẫu đánh giá các sản phẩm thuộc đơn đã hoàn thành. */
  async function moDanhGia(maDH) {
    let don;
    try {
      don = await api.doc(`/api/cua-toi/don-hang/${maDH}`);
    } catch (loi) {
      baoLoiApi(loi, 'Không tải được sản phẩm của đơn hàng');
      return;
    }
    const sanPham = don.chiTiet ?? [];
    if (!sanPham.length) {
      canhBao('Chưa có sản phẩm', 'Đơn hàng này không có sản phẩm để đánh giá.');
      return;
    }
    const bieuMau = el('form', { thuocTinh: { novalidate: true } }, [
      luoiTruong([
        truong({
          ten: 'maSP', nhan: 'Sản phẩm', loai: 'select', batBuoc: true,
          tuyChon: { muc: sanPham.map((sp) => ({ giaTri: sp.maSP, nhan: sp.tenSP })) },
        }),
        truong({
          ten: 'danhGia', nhan: 'Số sao', loai: 'select', batBuoc: true, giaTri: 5,
          tuyChon: { muc: [5, 4, 3, 2, 1].map((sao) => ({ giaTri: sao, nhan: `${sao} sao` })) },
        }),
        truong({
          ten: 'noiDung', nhan: 'Nội dung đánh giá', loai: 'textarea', batBuoc: true, rong: true,
          thuocTinh: { maxlength: 1000 },
        }),
      ]),
    ]);
    const nutGui = nut({ nhan: 'Gửi đánh giá', bieuTuong: 'danh-gia', chinh: true, nghe: gui });
    const hop = hopThoai({
      tieuDe: `Đánh giá đơn hàng #${maDH}`,
      moTa: 'Chọn sản phẩm bạn đã mua và chia sẻ nhận xét.',
      than: bieuMau,
      nutChan: [nut({ nhan: 'Đóng', lop: 'nut-trong', nghe: () => hop.dong() }), nutGui],
      rong: true,
    });
    bieuMau.addEventListener('submit', (event) => { event.preventDefault(); gui(); });

    async function gui() {
      const noiDung = bieuMau.querySelector('[name="noiDung"]').value.trim();
      if (!noiDung) {
        canhBao('Thiếu nội dung', 'Vui lòng nhập nội dung đánh giá.');
        return;
      }
      dangXuLy(nutGui, true);
      try {
        await api.post('/api/cua-toi/phan-hoi', {
          maDH,
          maSP: Number(bieuMau.querySelector('[name="maSP"]').value),
          danhGia: Number(bieuMau.querySelector('[name="danhGia"]').value),
          noiDung,
        });
        thanhCong('Đã gửi đánh giá', 'Cảm ơn bạn đã chia sẻ trải nghiệm.');
        hop.dong();
      } catch (loi) {
        baoLoiApi(loi, 'Không gửi được đánh giá');
      } finally {
        dangXuLy(nutGui, false);
      }
    }
  }

  const oTrangThaiLoc = el('select', {
    nghe: {
      change: (suKien) => {
        trangThai.trangThai = suKien.target.value;
        trangThai.page = 1;
        veBang();
      },
    },
  });
  oTrangThaiLoc.append(el('option', { vanBan: 'Tất cả trạng thái', thuocTinh: { value: '' } }));
  for (const giaTri of ['Chờ xử lý', 'Đã xác nhận', 'Đang giao', 'Hoàn thành', 'Đã hủy']) {
    oTrangThaiLoc.append(el('option', { vanBan: giaTri, thuocTinh: { value: giaTri } }));
  }
  thanhCongCu.append(
    el('label', { lop: 'truong truong-ngan' }, [
      el('span', { vanBan: 'Trạng thái' }),
      oTrangThaiLoc,
    ]),
    el('div', { lop: 'day-khoang-cach' }),
    nut({ nhan: 'Làm mới', bieuTuong: 'lam-moi', nghe: () => veBang() })
  );

  veBang();
  return el('div', {}, [thanhCongCu, vungBang]);
}

/* ============================ TAB 3: ĐIỂM =============================== */

/** Tab điểm thưởng: số điểm hiện có, giá trị quy đổi và lịch sử giao dịch. */
function tabDiem(ctx) {
  const trangThai = {
    page: Number(ctx.query.page) || 1,
    pageSize: Number(ctx.query.pageSize) || 20,
  };

  const vungThongKe = el('div', { lop: 'luoi-thong-ke', thuocTinh: { style: 'margin-bottom:16px' } });
  const vungBang = el('div', {});

  /** Nạp số điểm hiện tại và lịch sử giao dịch điểm. */
  async function taiLai() {
    xoaHet(vungBang);
    xoaHet(vungThongKe);
    try {
      const [hoSo, lichSu] = await Promise.all([
        api.doc('/api/cua-toi/ho-so'),
        api.doc('/api/cua-toi/diem', { page: trangThai.page, pageSize: trangThai.pageSize }),
      ]);

      const quyDoi = lichSu?.quyDoi ?? { pointsPerProduct: 1, vndPerPointRedeem: 1000 };
      const diemHienCo = Number(lichSu?.diemTichLuy ?? hoSo.diemTichLuy ?? 0);
      vungThongKe.append(
        theSoLieu({
          nhan: 'Điểm hiện có',
          giaTri: so(diemHienCo),
          phu: 'Dùng ngay khi thanh toán tại quán',
          sac: 'sac-matcha',
          bieuTuong: 'diem-thuong',
        }),
        theSoLieu({
          nhan: 'Giá trị quy đổi',
          giaTri: tien(diemHienCo * Number(quyDoi.vndPerPointRedeem)),
          phu: `1 điểm = ${tien(quyDoi.vndPerPointRedeem)}`,
          sac: 'sac-honey',
          bieuTuong: 'tien',
        }),
        theSoLieu({
          nhan: 'Cách tích điểm',
          giaTri: `${Number(quyDoi.pointsPerProduct ?? 1)} điểm / sản phẩm`,
          phu: 'Mỗi sản phẩm trong đơn hoàn thành được cộng điểm',
          sac: 'sac-steel',
          bieuTuong: 'bao-cao',
        })
      );

      const items = Array.isArray(lichSu?.items) ? lichSu.items : [];
      const phan = lichSu?.pagination ?? { page: 1, pageSize: trangThai.pageSize, total: 0, totalPages: 1 };

      vungBang.append(
        bang({
          cot: [
            { tieuDe: 'Mã GD', truong: 'maLS', lop: 'so' },
            { tieuDe: 'Đơn hàng', lop: 'so', lay: (ban) => (ban.maDH ? `#${ban.maDH}` : '—') },
            { tieuDe: 'Loại', truong: 'loaiGD' },
            {
              tieuDe: 'Biến động',
              lop: 'so',
              dung: (ban) =>
                el('span', {
                  vanBan: `${Number(ban.bienDong) >= 0 ? '+' : '−'}${so(Math.abs(ban.bienDong))}`,
                  thuocTinh: {
                    style: `font-family:var(--phong-chu-so);font-weight:600;color:${
                      Number(ban.bienDong) >= 0 ? 'var(--matcha)' : 'var(--chili)'
                    }`,
                  },
                }),
            },
            { tieuDe: 'Ghi chú', truong: 'ghiChu', lop: 'mo' },
            { tieuDe: 'Thời điểm', lop: 'so', lay: (ban) => ngayGio(ban.ngayGD) },
          ],
          duLieu: items,
          khiRong: oTrong({
            tieuDe: 'Bạn chưa có giao dịch điểm nào',
            moTa: 'Điểm được cộng khi đơn hàng của bạn chuyển sang trạng thái "Hoàn thành".',
            bieuTuong: 'diem-thuong',
          }),
        })
      );

      if (phan.total > 0) {
        vungBang.append(
          phanTrang({
            phan,
            khiDoiTrang: (trang) => {
              trangThai.page = trang;
              taiLai();
            },
            khiDoiCoTrang: (co) => {
              trangThai.pageSize = co;
              trangThai.page = 1;
              taiLai();
            },
          })
        );
      }
    } catch (loi) {
      xoaHet(vungBang);
      vungBang.append(
        el('p', { lop: 'mo-chu', vanBan: `Không tải được thông tin điểm: ${loi?.message ?? ''}` })
      );
    }
  }

  taiLai();
  return el('div', {}, [vungThongKe, vungBang]);
}

/* =========================== TAB 4: ƯU ĐÃI ============================== */

/** Tab ưu đãi: phiếu giảm giá (đặc biệt là phiếu sinh nhật) của khách. */
function tabUuDai(ctx) {
  const trangThai = {
    page: Number(ctx.query.page) || 1,
    pageSize: Number(ctx.query.pageSize) || 10,
  };

  const vungThongKe = el('div', { lop: 'luoi-thong-ke', thuocTinh: { style: 'margin-bottom:16px' } });
  const vungDanhSach = el('div', {});

  /** Thẻ hiển thị một phiếu giảm giá. */
  function veThePhieu(phieu) {
    const conDung = phieu.trangThai === 'Chưa dùng';
    return el('article', { lop: `the-uu-dai ${conDung ? '' : 'khong-dung-duoc'}` }, [
      el('div', { lop: 'uu-dai-giam' }, [
        el('strong', { vanBan: `${so(phieu.phanTramGiam)}%` }),
        el('small', { vanBan: 'giảm 1 ly' }),
      ]),
      el('div', { lop: 'uu-dai-noi-dung' }, [
        el('div', { lop: 'uu-dai-dau' }, [
          el('h3', { vanBan: phieu.tieuDe }),
          nhan(phieu.trangThai, conDung ? 'nhan-xanh' : 'nhan-trung-tinh'),
        ]),
        phieu.moTa ? el('p', { lop: 'mo-chu nho-chu', vanBan: phieu.moTa }) : null,
        el('div', { lop: 'uu-dai-chi-tiet' }, [
          el('span', {}, [
            el('small', { vanBan: 'Mã phiếu' }),
            el('strong', { lop: 'so', vanBan: phieu.maCode }),
          ]),
          el('span', {}, [
            el('small', { vanBan: 'Hạn dùng' }),
            el('strong', { vanBan: phieu.ngayHetHan ? ngay(phieu.ngayHetHan) : 'Không giới hạn' }),
          ]),
          el('span', {}, [
            el('small', { vanBan: 'Loại ưu đãi' }),
            el('strong', { vanBan: phieu.loai }),
          ]),
        ]),
      ]),
    ]);
  }

  /** Nạp số liệu và danh sách phiếu giảm giá của khách. */
  async function taiLai() {
    xoaHet(vungThongKe);
    xoaHet(vungDanhSach);
    try {
      const [thongKe, ketQua] = await Promise.all([
        api.doc('/api/cua-toi/uu-dai/thong-ke'),
        api.doc('/api/cua-toi/uu-dai', { page: trangThai.page, pageSize: trangThai.pageSize }),
      ]);

      vungThongKe.append(
        theSoLieu({
          nhan: 'Phiếu dùng được',
          giaTri: so(thongKe?.chuaDung ?? 0),
          phu: 'Xuất trình mã phiếu khi thanh toán',
          sac: 'sac-matcha',
          bieuTuong: 'khuyen-mai',
        }),
        theSoLieu({
          nhan: 'Đã sử dụng',
          giaTri: so(thongKe?.daDung ?? 0),
          bieuTuong: 'tick',
        }),
        theSoLieu({
          nhan: 'Hết hạn',
          giaTri: so(thongKe?.hetHan ?? 0),
          sac: 'sac-steel',
          bieuTuong: 'gio',
        }),
        theSoLieu({
          nhan: 'Hết lượt',
          giaTri: so(thongKe?.hetLuot ?? 0),
          sac: 'sac-steel',
          bieuTuong: 'thong-tin',
        })
      );

      const items = Array.isArray(ketQua?.items) ? ketQua.items : [];
      const phan =
        ketQua?.pagination ?? { page: 1, pageSize: trangThai.pageSize, total: 0, totalPages: 1 };

      if (items.length === 0) {
        vungDanhSach.append(
          the({
            tieuDe: 'Ưu đãi của tôi',
            than: oTrong({
              tieuDe: 'Bạn chưa có phiếu giảm giá nào',
              moTa:
                'Điền ngày sinh trong mục "Hồ sơ của tôi" để nhận phiếu giảm 50% cho 1 ly vào đúng ngày sinh nhật.',
              bieuTuong: 'khuyen-mai',
            }),
            lopThan: 'the-than day',
          })
        );
        return;
      }

      const luoi = el('div', { lop: 'luoi-uu-dai' });
      for (const phieu of items) luoi.append(veThePhieu(phieu));
      vungDanhSach.append(luoi);

      if (phan.total > 0) {
        vungDanhSach.append(
          phanTrang({
            phan,
            khiDoiTrang: (trang) => {
              trangThai.page = trang;
              taiLai();
            },
            khiDoiCoTrang: (co) => {
              trangThai.pageSize = co;
              trangThai.page = 1;
              taiLai();
            },
          })
        );
      }
    } catch (loi) {
      baoLoiApi(loi, 'Không tải được ưu đãi của bạn');
    }
  }

  taiLai();
  return el('div', {}, [vungThongKe, vungDanhSach]);
}

/* ========================== TAB 5: PHẢN HỒI ============================= */

/** Tab phản hồi: danh sách phản hồi đã gửi và biểu mẫu gửi phản hồi mới. */
function tabPhanHoi(ctx) {
  const trangThai = {
    page: Number(ctx.query.page) || 1,
    pageSize: Number(ctx.query.pageSize) || 10,
  };

  const thanhCongCu = el('div', { lop: 'thanh-cong-cu' });
  const vungBang = el('div', {});

  /** Vẽ bảng phản hồi của khách. */
  async function veBang() {
    xoaHet(vungBang);
    try {
      const ketQua = await api.doc('/api/cua-toi/phan-hoi', {
        page: trangThai.page,
        pageSize: trangThai.pageSize,
      });
      const items = Array.isArray(ketQua?.items) ? ketQua.items : [];
      const phan = ketQua?.pagination ?? { page: 1, pageSize: trangThai.pageSize, total: 0, totalPages: 1 };

      vungBang.append(
        bang({
          cot: [
            { tieuDe: 'Ngày gửi', lop: 'so', lay: (ban) => ngayGio(ban.ngayGui) },
            { tieuDe: 'Sản phẩm', truong: 'tenSP', lop: 'mo' },
            { tieuDe: 'Đánh giá', dung: (ban) => nhan(`${ban.danhGia}/5`, 'nhan-vang') },
            { tieuDe: 'Nội dung', truong: 'noiDung', lop: 'manh' },
            { tieuDe: 'Trạng thái', dung: (ban) => nhan(ban.trangThai) },
            { tieuDe: 'Phản hồi của quán', truong: 'phanHoiLai', lop: 'mo' },
            {
              tieuDe: 'Thao tác',
              dung: (ban) => nut({
                nhan: 'Sửa đánh giá',
                bieuTuong: 'sua',
                nho: true,
                nghe: () => moSuaPhanHoi(ban),
              }),
            },
          ],
          duLieu: items,
          khiRong: oTrong({
            tieuDe: 'Bạn chưa gửi phản hồi nào',
            moTa: 'Ý kiến của bạn giúp cửa hàng phục vụ tốt hơn.',
            bieuTuong: 'phan-hoi',
          }),
        })
      );

      if (phan.total > 0) {
        vungBang.append(
          phanTrang({
            phan,
            khiDoiTrang: (trang) => {
              trangThai.page = trang;
              veBang();
            },
            khiDoiCoTrang: (co) => {
              trangThai.pageSize = co;
              trangThai.page = 1;
              veBang();
            },
          })
        );
      }
    } catch (loi) {
      baoLoiApi(loi, 'Không tải được phản hồi của bạn');
    }
  }

  function moSuaPhanHoi(ban) {
    const bieuMau = el('form', { thuocTinh: { novalidate: true } }, [
      luoiTruong([
        truong({
          ten: 'danhGia',
          nhan: 'Số sao',
          loai: 'select',
          batBuoc: true,
          giaTri: ban.danhGia,
          tuyChon: { muc: [5, 4, 3, 2, 1].map((sao) => ({ giaTri: sao, nhan: `${sao} sao` })) },
        }),
        truong({
          ten: 'noiDung',
          nhan: 'Nội dung phản hồi',
          loai: 'textarea',
          batBuoc: true,
          rong: true,
          giaTri: ban.noiDung,
          thuocTinh: { maxlength: 1000 },
        }),
      ]),
    ]);
    const nutLuu = nut({ nhan: 'Lưu thay đổi', bieuTuong: 'luu', chinh: true, nghe: gui });
    const hop = hopThoai({
      tieuDe: `Sửa đánh giá #${ban.maPH}`,
      moTa: 'Bạn chỉ có thể sửa số sao và nội dung phản hồi của chính mình.',
      than: bieuMau,
      nutChan: [nut({ nhan: 'Hủy', lop: 'nut-trong', nghe: () => hop.dong() }), nutLuu],
      rong: true,
    });
    bieuMau.addEventListener('submit', (event) => { event.preventDefault(); gui(); });

    async function gui() {
      const noiDung = bieuMau.querySelector('[name="noiDung"]').value.trim();
      if (!noiDung) {
        canhBao('Thiếu nội dung', 'Vui lòng nhập nội dung phản hồi.');
        return;
      }
      dangXuLy(nutLuu, true);
      try {
        await api.put(`/api/cua-toi/phan-hoi/${ban.maPH}`, {
          noiDung,
          danhGia: Number(bieuMau.querySelector('[name="danhGia"]').value),
        });
        thanhCong('Đã cập nhật đánh giá');
        hop.dong();
        await veBang();
      } catch (loi) {
        baoLoiApi(loi, 'Không sửa được đánh giá');
      } finally {
        dangXuLy(nutLuu, false);
      }
    }
  }

  /** Hộp thoại gửi phản hồi mới (mục 4.3.4). */
  async function moGuiPhanHoi() {
    let danhSachSanPham = [];
    try {
      const ketQua = await api.doc('/api/sanpham', { pageSize: 100 });
      danhSachSanPham = Array.isArray(ketQua?.items) ? ketQua.items : [];
    } catch {
      danhSachSanPham = [];
    }

    const bieuMau = el('form', { thuocTinh: { novalidate: true } }, [
      luoiTruong([
        truong({
          ten: 'maSP',
          nhan: 'Sản phẩm muốn góp ý',
          loai: 'select',
          tuyChon: {
            muc: danhSachSanPham.map((sp) => ({ giaTri: sp.maSP, nhan: sp.tenSP })),
            mucRong: '— Góp ý chung —',
          },
        }),
        truong({
          ten: 'danhGia',
          nhan: 'Mức độ hài lòng (1–5)',
          loai: 'select',
          batBuoc: true,
          giaTri: 5,
          tuyChon: {
            muc: [5, 4, 3, 2, 1].map((diem) => ({
              giaTri: diem,
              nhan: `${diem} sao — ${['Rất tệ', 'Tệ', 'Bình thường', 'Hài lòng', 'Rất hài lòng'][diem - 1]}`,
            })),
          },
        }),
        truong({
          ten: 'noiDung',
          nhan: 'Nội dung góp ý',
          loai: 'textarea',
          batBuoc: true,
          rong: true,
          goiY: 'Chia sẻ trải nghiệm của bạn về chất lượng phục vụ, đồ uống hoặc không gian quán.',
          thuocTinh: { maxlength: 500 },
        }),
      ]),
    ]);

    const nutLuu = nut({
      nhan: 'Gửi phản hồi',
      bieuTuong: 'gui',
      chinh: true,
      nghe: () => gui(),
    });

    const hop = hopThoai({
      tieuDe: 'Gửi phản hồi cho cửa hàng',
      moTa: 'Cảm ơn bạn đã dành thời gian chia sẻ ý kiến với cửa hàng.',
      than: bieuMau,
      nutChan: [nut({ nhan: 'Hủy bỏ', lop: 'nut-trong', nghe: () => hop.dong() }), nutLuu],
      rong: true,
    });

    /** Gửi phản hồi lên máy chủ. */
    async function gui() {
      const noiDung = bieuMau.querySelector('[name="noiDung"]').value.trim();
      if (!noiDung) {
        canhBao('Thiếu nội dung', 'Vui lòng nhập nội dung góp ý.');
        return;
      }
      const maSP = Number(bieuMau.querySelector('[name="maSP"]').value) || null;
      const danhGia = Number(bieuMau.querySelector('[name="danhGia"]').value) || 5;

      dangXuLy(nutLuu, true);
      try {
        await api.post('/api/cua-toi/phan-hoi', { noiDung, danhGia, maSP });
        thanhCong('Đã gửi phản hồi', 'Cửa hàng sẽ phản hồi bạn trong thời gian sớm nhất.');
        hop.dong();
        await veBang();
      } catch (loi) {
        baoLoiApi(loi, 'Không gửi được phản hồi');
      } finally {
        dangXuLy(nutLuu, false);
      }
    }

    bieuMau.addEventListener('submit', (suKien) => {
      suKien.preventDefault();
      gui();
    });
  }

  thanhCongCu.append(
    el('p', {
      lop: 'mo-chu nho-chu',
      vanBan: 'Mọi góp ý của bạn đều được cửa hàng tiếp nhận và phản hồi lại.',
    }),
    el('div', { lop: 'day-khoang-cach' }),
    nut({ nhan: 'Làm mới', bieuTuong: 'lam-moi', nghe: () => veBang() }),
    nut({
      nhan: 'Gửi phản hồi',
      bieuTuong: 'them',
      chinh: true,
      nghe: () => moGuiPhanHoi(),
    })
  );

  veBang();
  return el('div', {}, [thanhCongCu, vungBang]);
}

/* =========================== TAB 6: KHẢO SÁT ============================ */

/** Tab khảo sát: danh sách khảo sát được giao và biểu mẫu trả lời. */
function tabKhaoSat() {
  const vung = el('div', {});

  /** Nạp danh sách khảo sát được gửi cho khách. */
  async function taiLai() {
    xoaHet(vung);
    vung.append(el('p', { lop: 'mo-chu nho-chu', vanBan: 'Đang tải khảo sát…' }));
    try {
      const danhSach = await api.doc('/api/cua-toi/khaosat');
      xoaHet(vung);
      if (!Array.isArray(danhSach) || danhSach.length === 0) {
        vung.append(
          oTrong({
            tieuDe: 'Chưa có khảo sát nào được gửi cho bạn',
            moTa: 'Khi cửa hàng gửi khảo sát, nó sẽ xuất hiện ở đây.',
            bieuTuong: 'khao-sat',
          })
        );
        return;
      }
      for (const khaoSat of danhSach) {
        vung.append(theKhaoSat(khaoSat));
      }
    } catch (loi) {
      xoaHet(vung);
      vung.append(
        el('p', { lop: 'mo-chu', vanBan: `Không tải được khảo sát: ${loi?.message ?? ''}` })
      );
    }
  }

  /** Thẻ hiển thị một khảo sát kèm nút trả lời. */
  function theKhaoSat(khaoSat) {
    const daTraLoi = Boolean(khaoSat.daTraLoi);
    const daHetLuot = Boolean(khaoSat.daHetLuot);
    return the({
      tieuDe: khaoSat.tieuDe,
      ghiChu: khaoSat.moTa ?? null,
      congCu: el('div', { lop: 'gon' }, [
        daTraLoi
          ? nhan('Đã trả lời', 'nhan-xanh')
          : daHetLuot
            ? nhan('Đã đủ lượt', 'nhan-do')
            : nhan('Chưa trả lời', 'nhan-vang'),
        daTraLoi || daHetLuot
          ? null
          : nut({
              nhan: 'Trả lời khảo sát',
              bieuTuong: 'gui',
              chinh: true,
              nghe: () => moTraLoi(khaoSat),
            }),
      ]),
      than: moTaCot([
        { nhan: 'Loại khảo sát', giaTri: khaoSat.loaiKS },
        { nhan: 'Đối tượng', giaTri: khaoSat.doiTuong },
        { nhan: 'Số câu hỏi', giaTri: so(khaoSat.soCauHoi), so: true },
        { nhan: 'Lượt trả lời', giaTri: khaoSat.soLuongToiDa == null ? `${so(khaoSat.soPhieuTraLoi)} · Không giới hạn` : `${so(khaoSat.soPhieuTraLoi)} / ${so(khaoSat.soLuongToiDa)}`, so: true },
        { nhan: 'Phần thưởng', giaTri: khaoSat.loaiPhanThuong === 'Phiếu giảm giá' ? `Phiếu giảm ${so(khaoSat.giaTriPhanThuong)}%${khaoSat.giamToiDa ? ` · tối đa ${tien(khaoSat.giamToiDa)}` : ''}` : `${so(khaoSat.giaTriPhanThuong ?? 5)} điểm` },
        { nhan: 'Ngày gửi khảo sát', giaTri: ngay(khaoSat.ngayTao), so: true },
        {
          nhan: 'Hạn trả lời',
          giaTri: khaoSat.hanChot ? ngay(khaoSat.hanChot) : 'Không giới hạn thời gian',
          so: true,
        },
      ]),
      lopThan: 'the-than day',
    });
  }

  /** Hộp thoại trả lời khảo sát (mục 4.3.5). */
  function moTraLoi(khaoSat) {
    const cauHoi = khaoSat.cauHoi ?? [];
    if (cauHoi.length === 0) {
      canhBao('Khảo sát chưa có câu hỏi', 'Vui lòng quay lại sau.');
      return;
    }

    const cacOTraLoi = [];

    /** Dựng ô trả lời phù hợp với loại câu hỏi. */
    function oTraLoi(cauHoiMuc, thuTu) {
      const nhanCauHoi = `${cauHoiMuc.noiDung}${Number(cauHoiMuc.batBuoc) === 1 ? ' (bắt buộc)' : ''}`;
      let oNhap;

      if (cauHoiMuc.loaiCauHoi === 'Một lựa chọn' || cauHoiMuc.loaiCauHoi === 'Nhiều lựa chọn') {
        const nhieu = cauHoiMuc.loaiCauHoi === 'Nhiều lựa chọn';
        oNhap = el('select', {
          dinhDanh: `cauhoi-${cauHoiMuc.maCauHoi}`,
          thuocTinh: { multiple: nhieu, size: nhieu ? Math.min(5, (cauHoiMuc.luaChonList ?? []).length) : 1 },
        });
        if (!nhieu) oNhap.append(el('option', { vanBan: '— Chọn —', thuocTinh: { value: '' } }));
        for (const luaChon of cauHoiMuc.luaChonList ?? []) {
          oNhap.append(el('option', { vanBan: luaChon, thuocTinh: { value: luaChon } }));
        }
      } else if (cauHoiMuc.loaiCauHoi === 'Thang điểm') {
        oNhap = el('input', {
          dinhDanh: `cauhoi-${cauHoiMuc.maCauHoi}`,
          kieu: 'number',
          thuocTinh: { min: 1, max: 5, step: 1 },
        });
      } else {
        oNhap = el('textarea', {
          dinhDanh: `cauhoi-${cauHoiMuc.maCauHoi}`,
          lop: 'o-tra-loi-noi-dung',
          thuocTinh: { rows: 6, maxlength: 1000 },
        });
      }

      cacOTraLoi.push({ maCauHoi: cauHoiMuc.maCauHoi, oNhap, batBuoc: Number(cauHoiMuc.batBuoc) === 1 });

      return el('div', { lop: 'cau-hoi-khao-sat' }, [
        el('div', { lop: 'tieu-de-cau-hoi' }, [
          el('span', { lop: 'so-thu-tu', vanBan: String(thuTu) }),
          el('span', { vanBan: nhanCauHoi }),
        ]),
        cauHoiMuc.loaiCauHoi === 'Nhiều lựa chọn'
          ? el('div', {
              lop: 'mo-chu nho-chu',
              vanBan: 'Giữ Ctrl (hoặc Cmd) để chọn nhiều đáp án.',
              thuocTinh: { style: 'margin-bottom:7px' },
            })
          : null,
        cauHoiMuc.loaiCauHoi === 'Trả lời ngắn'
          ? el('div', {
              lop: 'goi-y',
              vanBan: 'Nhập câu trả lời của bạn vào ô bên dưới.',
              thuocTinh: { style: 'margin-bottom:7px' },
            })
          : null,
        cauHoiMuc.loaiCauHoi === 'Thang điểm'
          ? el('div', {
              lop: 'goi-y',
              vanBan: 'Chọn điểm từ 1 đến 5.',
              thuocTinh: { style: 'margin-bottom:7px' },
            })
          : null,
        oNhap,
      ]);
    }

    const bieuMau = el('form', { thuocTinh: { novalidate: true } }, [
      el('div', {}, cauHoi.map((muc, chi) => oTraLoi(muc, chi + 1))),
    ]);

    const nutLuu = nut({
      nhan: 'Gửi câu trả lời',
      bieuTuong: 'gui',
      chinh: true,
      nghe: () => gui(),
    });

    const hop = hopThoai({
      tieuDe: khaoSat.tieuDe,
      moTa: `Hoàn thành khảo sát để nhận 5 điểm thưởng. ${cauHoi.length} câu hỏi.`,
      than: bieuMau,
      nutChan: [nut({ nhan: 'Hủy bỏ', lop: 'nut-trong', nghe: () => hop.dong() }), nutLuu],
      rong: true,
    });

    /** Thu thập câu trả lời và gửi lên máy chủ. */
    async function gui() {
      const chiTiet = [];
      const thieu = [];

      for (const muc of cacOTraLoi) {
        let giaTri;
        if (muc.oNhap.tagName === 'SELECT' && muc.oNhap.multiple) {
          giaTri = Array.from(muc.oNhap.selectedOptions)
            .map((o) => o.value)
            .join(', ');
        } else {
          giaTri = String(muc.oNhap.value ?? '').trim();
        }
        if (!giaTri) {
          if (muc.batBuoc) thieu.push(muc.maCauHoi);
          continue;
        }
        chiTiet.push({ maCauHoi: muc.maCauHoi, noiDungTraLoi: giaTri });
      }

      if (thieu.length > 0) {
        canhBao('Còn câu hỏi bắt buộc', `Bạn cần trả lời thêm ${thieu.length} câu hỏi bắt buộc.`);
        return;
      }

      dangXuLy(nutLuu, true);
      try {
        const ketQua = await api.post(`/api/cua-toi/khaosat/${khaoSat.maKS}/tra-loi`, { chiTiet });
        thanhCong(
          'Đã gửi câu trả lời',
          ketQua?.diemThuong
            ? `Bạn nhận được ${so(ketQua.diemThuong)} điểm thưởng.`
            : (ketQua?.thongBao ?? null)
        );
        hop.dong();
        await taiLai();
      } catch (loi) {
        baoLoiApi(loi, 'Không gửi được câu trả lời');
      } finally {
        dangXuLy(nutLuu, false);
      }
    }

    bieuMau.addEventListener('submit', (suKien) => {
      suKien.preventDefault();
      gui();
    });
  }

  taiLai();
  return vung;
}
