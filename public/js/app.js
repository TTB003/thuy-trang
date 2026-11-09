/**
 * Điểm khởi động giao diện: đăng nhập, dựng thanh điều hướng và chạy router.
 */
'use strict';

import { api, dangChayTrenMobile, datXuLyHetPhien, thongDiepLoi } from './api.js';
import {
  coQuyen,
  danhSach,
  datNguoiDung,
  laKhachHang,
  laQuanTri,
  layNguoiDung,
  napDanhMuc,
  napPhien,
  xoaPhien,
} from './store.js';
import {
  baoLoi,
  baoLoiApi,
  dangXuLy,
  el,
  hienTai,
  icon,
  nut,
  thanhCong,
  xoaHet,
} from './ui.js';
import { chuCaiDau, so } from './format.js';
import { batDauRouter, dangKy, datKhiDoiTuyen, datMacDinh, docHash, layManHinh } from './router.js';
import { ganQuyTacMatKhau, loiMatKhau } from './mat-khau.js';
import { taoChuongThongBao } from './thong-bao.js';

/* ------------------------------ MÀN HÌNH ------------------------------- */
import { manHinh as manTongQuan } from './pages/tong-quan.js';
import { manHinh as manLoaiSanPham } from './pages/loaisanpham.js';
import { manHinh as manSanPham } from './pages/sanpham.js';
import { manHinh as manNhaCungCap } from './pages/nhacungcap.js';
import { manHinh as manNhanVien } from './pages/nhanvien.js';
import { manHinh as manKhachHang } from './pages/khachhang.js';
import { manHinh as manPhieuNhap } from './pages/phieunhap.js';
import { manHinh as manDonHang } from './pages/donhang.js?v=20261108-4';
import { manHinh as manDiem } from './pages/diem.js';
import { manHinh as manKhuyenMai } from './pages/khuyenmai.js';
import { manHinh as manPhieuGiamGia } from './pages/phieugiamgia.js';
import { manHinh as manPhanHoi } from './pages/phanhoi.js';
import { manHinh as manKhaoSat } from './pages/khaosat.js';
import { manHinh as manBaoCao } from './pages/baocao.js';
import { manHinh as manQuanTri } from './pages/quan-tri.js';
import { manHinh as manCuaToi } from './pages/cua-toi.js';

/** Toàn bộ màn hình của ứng dụng. */
const CAC_MAN_HINH = [
  manTongQuan,
  manLoaiSanPham,
  manSanPham,
  manNhaCungCap,
  manNhanVien,
  manKhachHang,
  manPhieuNhap,
  manDonHang,
  manDiem,
  manKhuyenMai,
  manPhieuGiamGia,
  manPhanHoi,
  manKhaoSat,
  manBaoCao,
  manQuanTri,
  manCuaToi,
];

/**
 * Cấu trúc thanh điều hướng: mỗi nhóm gồm tiêu đề và danh sách mã màn hình.
 * Màn hình nào người dùng không đủ quyền sẽ tự động bị ẩn.
 */
const NHOM_DIEU_HUONG = [
  { tieuDe: 'Tổng quan', muc: ['tong-quan'] },
  { tieuDe: 'Danh mục', muc: ['loaisanpham', 'sanpham', 'nhacungcap'] },
  { tieuDe: 'Con người', muc: ['nhanvien', 'khachhang'] },
  { tieuDe: 'Bán hàng', muc: ['phieunhap', 'donhang', 'diem'] },
  { tieuDe: 'Chăm sóc khách hàng', muc: ['khuyenmai', 'phieugiamgia', 'phanhoi', 'khaosat'] },
  { tieuDe: 'Phân tích', muc: ['baocao'] },
  { tieuDe: 'Khu vực quản trị', muc: ['quan-tri'] },
  { tieuDe: 'Tài khoản của tôi', muc: ['cua-toi'] },
];

/** Màn hình mặc định theo vai trò. */
function manHinhMacDinh() {
  if (laKhachHang()) return 'cua-toi';
  if (laQuanTri() || coQuyen('report.view')) return 'tong-quan';
  const theoChucVu = {
    'Nhân viên bán hàng': 'donhang',
    'Nhân viên quản lý đơn': 'donhang',
    'Nhân viên kho': 'phieunhap',
    'Nhân viên CSKH': 'phanhoi',
  };
  return theoChucVu[layNguoiDung()?.chucVu] ?? 'sanpham';
}

/** Người dùng có được phép mở màn hình này không. */
function duocPhep(manHinh) {
  if (!manHinh) return false;
  if (laKhachHang() && manHinh.ma !== 'cua-toi') return false;
  const chucVu = layNguoiDung()?.chucVu;
  const manHinhTheoChucVu = {
    'Nhân viên bán hàng': ['donhang'],
    'Nhân viên quản lý đơn': ['donhang'], // Tương thích tài khoản cũ trước khi migration hoàn tất.
    'Nhân viên kho': ['phieunhap', 'loaisanpham', 'sanpham'],
    'Nhân viên CSKH': ['phanhoi', 'khaosat', 'phieugiamgia'],
  };
  if (chucVu && manHinhTheoChucVu[chucVu] && !manHinhTheoChucVu[chucVu].includes(manHinh.ma)) return false;
  if (manHinh.chiQuanTri && !laQuanTri()) return false;
  if (manHinh.chiKhachHang && !laKhachHang()) return false;
  if (manHinh.quyen) {
    const danhSachQuyen = Array.isArray(manHinh.quyen) ? manHinh.quyen : [manHinh.quyen];
    return danhSachQuyen.some((quyen) => coQuyen(quyen));
  }
  return true;
}

/* ============================== ĐĂNG NHẬP =============================== */

const manDangNhap = document.getElementById('man-hinh-dang-nhap');
const khungUngDung = document.getElementById('khung-ung-dung');
const bieuMauDangNhap = document.getElementById('bieu-mau-dang-nhap');
const oTenDangNhap = document.getElementById('ten-dang-nhap');
const oMatKhau = document.getElementById('mat-khau');
const oLoiDangNhap = document.getElementById('loi-dang-nhap');
const nutDangNhap = document.getElementById('nut-dang-nhap');
const laCongAdmin = window.location.pathname.startsWith('/admin/') || new URLSearchParams(window.location.search).get('portal') === 'admin';
const duongDanDangNhapAdmin = dangChayTrenMobile ? '/admin.html' : '/admin';
const duongDanKhuVucAdmin = dangChayTrenMobile ? '/admin.html' : '/admin/panel';

/* -------------------- ĐĂNG KÝ TÀI KHOẢN KHÁCH HÀNG --------------------- */
const bieuMauDangKy = document.getElementById('bieu-mau-dang-ky');
const oDkHoTen = document.getElementById('dk-ho-ten');
const oDkSdt = document.getElementById('dk-sdt');
const oDkGioiTinh = document.getElementById('dk-gioi-tinh');
const oDkMatKhau = document.getElementById('dk-mat-khau');
const oDkNhapLai = document.getElementById('dk-nhap-lai');
const oLoiDangKy = document.getElementById('loi-dang-ky');
const nutDangKy = document.getElementById('nut-dang-ky');
const danhSachQuyTacMatKhau = document.getElementById('quy-tac-mat-khau');
const oLoiNhapLai = document.getElementById('loi-nhap-lai-mat-khau');

function capNhatXacNhanMatKhau() {
  const matKhau = oDkMatKhau.value;
  const nhapLai = oDkNhapLai.value;
  if (!nhapLai) {
    oLoiNhapLai.hidden = true;
    oLoiNhapLai.textContent = '';
    oDkNhapLai.removeAttribute('aria-invalid');
    return;
  }
  const khop = matKhau === nhapLai;
  oLoiNhapLai.hidden = false;
  oLoiNhapLai.textContent = khop ? 'Mật khẩu khớp.' : 'Mật khẩu nhập lại chưa khớp.';
  oLoiNhapLai.classList.toggle('xac-nhan-mat-khau-dung', khop);
  oDkNhapLai.setAttribute('aria-invalid', String(!khop));
}

/** Hiển thị lỗi ngay trên biểu mẫu đăng nhập. */
function hienLoiDangNhap(thongDiep) {
  if (!thongDiep) {
    oLoiDangNhap.hidden = true;
    oLoiDangNhap.textContent = '';
    return;
  }
  oLoiDangNhap.hidden = false;
  oLoiDangNhap.textContent = thongDiep;
}

/** Hiển thị lỗi ngay trên biểu mẫu đăng ký. */
function hienLoiDangKy(thongDiep) {
  if (!thongDiep) {
    oLoiDangKy.hidden = true;
    oLoiDangKy.textContent = '';
    return;
  }
  oLoiDangKy.hidden = false;
  oLoiDangKy.textContent = thongDiep;
}

/** Chuyển qua lại giữa hai chế độ Đăng nhập và Đăng ký. */
function datCheDo(cheDo) {
  const laDangKy = cheDo === 'dang-ky';
  bieuMauDangNhap.hidden = laDangKy;
  bieuMauDangKy.hidden = !laDangKy;
  for (const nutCheDo of document.querySelectorAll('.muc-che-do')) {
    const dangChon = nutCheDo.dataset.cheDo === cheDo;
    nutCheDo.classList.toggle('dang-chon', dangChon);
    nutCheDo.setAttribute('aria-selected', String(dangChon));
  }
  hienLoiDangNhap(null);
  hienLoiDangKy(null);
  (laDangKy ? oDkHoTen : oTenDangNhap).focus();
}

/** Gắn sự kiện cho các thẻ tài khoản dùng thử (điền sẵn thông tin). */
function ganTaiKhoanGoiY() {
  for (const the of document.querySelectorAll('.the-goi-y')) {
    the.addEventListener('click', () => {
      const [tenDangNhap, matKhau] = String(the.dataset.dien ?? '').split('|');
      oTenDangNhap.value = tenDangNhap ?? '';
      oMatKhau.value = matKhau ?? '';
      hienLoiDangNhap(null);
      (matKhau ? nutDangNhap : oTenDangNhap).focus();
    });
  }
}

/** Xử lý gửi biểu mẫu đăng nhập. */
async function xuLyDangNhap(suKien) {
  suKien.preventDefault();
  hienLoiDangNhap(null);

  const tenDangNhap = oTenDangNhap.value.trim();
  const matKhau = oMatKhau.value;
  if (!tenDangNhap || !matKhau) {
    hienLoiDangNhap('Vui lòng nhập tên đăng nhập và mật khẩu.');
    return;
  }

  dangXuLy(nutDangNhap, true);
  try {
    const phien = await api.post(laCongAdmin ? '/api/admin/login' : '/api/auth/login', { tenDangNhap, matKhau });
    // Phòng trường hợp client gọi nhầm tuyến: server cũng chặn Admin ở API trang chính.
    await vaoUngDung(dangChayTrenMobile ? phien.user : null);
  } catch (loi) {
    hienLoiDangNhap(thongDiepLoi(loi));
  } finally {
    dangXuLy(nutDangNhap, false);
  }
}

/** Xử lý gửi biểu mẫu đăng ký tài khoản khách hàng. */
async function xuLyDangKy(suKien) {
  suKien.preventDefault();
  hienLoiDangKy(null);

  const hoTen = oDkHoTen.value.trim();
  const sdt = oDkSdt.value.trim();
  const matKhau = oDkMatKhau.value;
  const nhapLai = oDkNhapLai.value;

  const gioiTinh = oDkGioiTinh.value;
  if (!hoTen || !sdt || !gioiTinh || !matKhau || !nhapLai) {
    hienLoiDangKy('Vui lòng nhập đầy đủ thông tin, bao gồm giới tính.');
    return;
  }
  if (!/^0\d{9,10}$/.test(sdt)) {
    hienLoiDangKy('Số điện thoại không đúng định dạng (ví dụ: 0912345678).');
    oDkSdt.focus();
    return;
  }
  const loiMatKhauText = loiMatKhau(matKhau);
  if (loiMatKhauText) {
    hienLoiDangKy(loiMatKhauText);
    oDkMatKhau.focus();
    return;
  }
  if (matKhau !== nhapLai) {
    hienLoiDangKy('Mật khẩu nhập lại không khớp.');
    oDkNhapLai.focus();
    return;
  }

  dangXuLy(nutDangKy, true);
  try {
    await api.post('/api/auth/register', { hoTen, sdt, gioiTinh, matKhau, xacNhanMatKhau: nhapLai });
    thanhCong('Đăng ký thành công', `Bạn có thể đăng nhập bằng số điện thoại ${sdt}.`);
    bieuMauDangKy.reset();
    oTenDangNhap.value = sdt;
    oMatKhau.value = '';
    datCheDo('dang-nhap');
  } catch (loi) {
    hienLoiDangKy(thongDiepLoi(loi));
  } finally {
    dangXuLy(nutDangKy, false);
  }
}

oDkMatKhau.addEventListener('input', capNhatXacNhanMatKhau);
oDkNhapLai.addEventListener('input', capNhatXacNhanMatKhau);

/** Đăng xuất và quay về màn hình đăng nhập. */
async function xuLyDangXuat() {
  const dangLaAdmin = laQuanTri();
  try {
    await api.post('/api/auth/logout', {});
  } catch {
    // Dù máy chủ báo lỗi vẫn đưa người dùng về màn hình đăng nhập.
  }
  xoaPhien();
  window.location.replace(dangChayTrenMobile ? '/' : dangLaAdmin ? '/admin' : '/');
}

/** Chuyển sang màn hình đăng nhập. */
function hienThiManDangNhap() {
  khungUngDung.hidden = true;
  manDangNhap.hidden = false;
  oMatKhau.value = '';
  hienLoiDangNhap(null);
  hienLoiDangKy(null);
  datCheDo('dang-nhap');
  if (window.location.hash) window.location.hash = '';
}

/* ========================== KHUNG ỨNG DỤNG ============================= */

const thanhBen = document.getElementById('thanh-ben');
const dieuHuongEl = document.getElementById('dieu-huong');
const tieuDeTrang = document.getElementById('tieu-de-trang');
const moTaTrang = document.getElementById('mo-ta-trang');
const noiDungEl = document.getElementById('noi-dung');
const thongTinNguoiDungEl = document.getElementById('thong-tin-nguoi-dung');
const nhanBanHeThongEl = document.getElementById('nhan-ban-he-thong');
const chanTrangCsdlEl = document.getElementById('chan-trang-csdl');

/** Cập nhật thẻ người dùng ở góc phải thanh trên. */
function veThongTinNguoiDung() {
  const nguoiDung = layNguoiDung();
  xoaHet(thongTinNguoiDungEl);
  if (!nguoiDung) return;

  const vaiTroText = nguoiDung.chucVu ? `${nguoiDung.vaiTro} · ${nguoiDung.chucVu}` : nguoiDung.vaiTro;

  const chuongThongBao = laKhachHang()
    ? taoChuongThongBao()
    : coQuyen('order.manage')
      ? taoChuongThongBao({ noiBo: true })
      : null;
  thongTinNguoiDungEl.append(
    el('div', { lop: 'anh-dai-dien', vanBan: chuCaiDau(nguoiDung.hoTen) }),
    el('div', { lop: 'thong-tin' }, [
      el('strong', { vanBan: nguoiDung.hoTen || nguoiDung.tenDangNhap }),
      el('small', { vanBan: vaiTroText }),
    ]),
    chuongThongBao,
    nut({
      nhan: 'Thoát',
      bieuTuong: 'dang-xuat',
      lop: 'nut-trong nut-nho nut-dang-xuat',
      nghe: xuLyDangXuat,
    })
  );
}

/** Dựng thanh điều hướng theo quyền của người dùng hiện tại. */
function veDieuHuong() {
  const viTriCuon = dieuHuongEl.scrollTop;
  xoaHet(dieuHuongEl);
  const tuyenHienTai = (window.location.hash.match(/^#\/([^/?]+)/) ?? [])[1] ?? '';
  const nhomTaiApp = el('div', { lop: 'nhom-dieu-huong' }, [
    el('p', { vanBan: 'Ứng dụng di động' }),
    el('a', {
      lop: 'muc-dieu-huong',
      thuocTinh: {
        href: '/downloads/Coffee-uohp.apk',
        download: 'Coffee-uohp.apk',
        'aria-label': 'Tải ứng dụng Coffee uoHP cho Android',
      },
    }, [icon('tai-xuong'), el('span', { lop: 'nhan', vanBan: 'Tải ứng dụng Coffee👓uoHP' })]),
  ]);

  if (laKhachHang()) {
    const tabHienTai = new URLSearchParams(window.location.hash.split('?')[1] ?? '').get('tab') ?? 'mua-hang';
    const mucKhachHang = [
      ['mua-hang', 'Mua hàng', 'cua-toi'],
      ['ho-so', 'Hồ sơ của tôi', 'nguoi-dung'],
      ['don-hang', 'Đơn hàng của tôi', 'don-hang'],
      ['diem', 'Điểm thưởng', 'diem'],
      ['uu-dai', 'Ưu đãi của tôi', 'khuyen-mai'],
      ['phan-hoi', 'Phản hồi của tôi', 'phan-hoi'],
      ['khao-sat', 'Khảo sát của tôi', 'khao-sat'],
    ];
    const khoi = el('div', { lop: 'nhom-dieu-huong' }, [el('p', { vanBan: 'Tài khoản của tôi' })]);
    for (const [ma, tieuDe, bieuTuong] of mucKhachHang) {
      khoi.append(el('button', {
        lop: `muc-dieu-huong ${tuyenHienTai === 'cua-toi' && tabHienTai === ma ? 'dang-chon' : ''}`,
        kieu: 'button',
        nghe: () => {
          dongThanhBen();
          window.location.hash = `#/cua-toi?tab=${encodeURIComponent(ma)}`;
        },
      }, [icon(bieuTuong), el('span', { lop: 'nhan', vanBan: tieuDe })]));
    }
    dieuHuongEl.append(khoi);
    if (!dangChayTrenMobile) dieuHuongEl.append(nhomTaiApp);
    dieuHuongEl.scrollTop = viTriCuon;
    return;
  }

  for (const nhom of NHOM_DIEU_HUONG) {
    const mucHopLe = nhom.muc
      .map((ma) => layManHinh(ma))
      .filter((manHinh) => manHinh && !manHinh.anKhoiDieuHuong && duocPhep(manHinh));
    if (mucHopLe.length === 0) continue;

    const khoi = el('div', { lop: 'nhom-dieu-huong' }, [el('p', { vanBan: nhom.tieuDe })]);
    for (const manHinh of mucHopLe) {
      const dangChon = manHinh.ma === tuyenHienTai;
      const muc = el(
        'button',
        {
          lop: `muc-dieu-huong ${dangChon ? 'dang-chon' : ''}`,
          kieu: 'button',
          nghe: () => {
            dongThanhBen();
            window.location.hash = `#/${manHinh.ma}`;
          },
        },
        [
          icon(manHinh.bieuTuong ?? 'thong-tin'),
          el('span', { lop: 'nhan', vanBan: manHinh.tieuDe }),
        ]
      );
      khoi.append(muc);
    }
    dieuHuongEl.append(khoi);
  }
  if (!dangChayTrenMobile) dieuHuongEl.append(nhomTaiApp);
  dieuHuongEl.scrollTop = viTriCuon;
}

/** Hiển thị tóm tắt tình trạng hệ thống ở chân thanh bên. */
async function veNhanBanHeThong() {
  const nguoiDung = layNguoiDung();
  xoaHet(nhanBanHeThongEl);
  nhanBanHeThongEl.append(
    el('strong', { vanBan: 'Cà phê & Khách hàng' }),
    el('span', { vanBan: `Đăng nhập: ${nguoiDung?.vaiTro ?? '—'}` })
  );
  if (laQuanTri()) {
    try {
      const thongTin = await api.doc('/api/admin/he-thong');
      const he = thongTin?.heCSDL ?? 'CSDL';
      const soBang = Number(thongTin?.soBang ?? 0);
      const moTa = soBang > 0 ? `${so(soBang)} bảng` : '';
      nhanBanHeThongEl.append(
        el('div', { lop: 'dong-csdl' }, [
          el('span', { lop: 'cham-xanh' }),
          el('span', { vanBan: moTa ? `${he} — ${moTa}` : he }),
        ])
      );
      chanTrangCsdlEl.textContent = `CSDL: ${he}${moTa ? ` — ${moTa}` : ''}`;
    } catch {
      chanTrangCsdlEl.textContent = '';
    }
  } else {
    chanTrangCsdlEl.textContent = '';
  }
}

/* ---------------------- THANH BÊN TRÊN MÀN HÌNH HẸP --------------------- */

const nutMoThanhBen = document.getElementById('nut-mo-thanh-ben');
const lopPhuThanhBen = document.getElementById('lop-phu-thanh-ben');

/** Đóng ngăn kéo điều hướng trên màn hình hẹp. */
function dongThanhBen() {
  khungUngDung.classList.remove('mo-thanh-ben');
  lopPhuThanhBen.hidden = true;
}

nutMoThanhBen.addEventListener('click', () => {
  if (khungUngDung.classList.contains('mo-thanh-ben')) {
    dongThanhBen();
    return;
  }
  const gioHangDangMo = document.querySelector('.khu-mua-hang-layout.gio-hang-mo');
  gioHangDangMo?.classList.remove('gio-hang-mo');
  gioHangDangMo?.querySelector('.gio-hang-dock')?.setAttribute('aria-expanded', 'false');
  gioHangDangMo?.querySelector('.gio-hang-dock')?.setAttribute('aria-label', 'Mở giỏ hàng');
  khungUngDung.classList.remove('mo-gio-hang');
  khungUngDung.classList.add('mo-thanh-ben');
  lopPhuThanhBen.hidden = false;
});
lopPhuThanhBen.addEventListener('click', dongThanhBen);

/* ---------------------------- XỬ LÝ TUYẾN ------------------------------- */

/** Hiển thị thông báo khi không đủ quyền hoặc không tìm thấy màn hình. */
function veKhongChoPhep(container, thongDiep) {
  xoaHet(container);
  container.append(
    el('div', { lop: 'the' }, [
      el('div', { lop: 'o-trong' }, [
        el('div', { lop: 'bieu-tuong-lon', html: icon('khoa').innerHTML }),
        el('strong', { vanBan: 'Không thể mở chức năng này' }),
        el('p', { vanBan: thongDiep }),
      ]),
    ])
  );
}

/** Xử lý khi tuyến thay đổi: kiểm tra quyền rồi vẽ màn hình. */
async function xuLyTuyen(tuyen) {
  const manHinh = layManHinh(tuyen.ma);
  if (!manHinh) {
    veKhongChoPhep(noiDungEl, `Không tồn tại chức năng "${tuyen.ma}".`);
    return;
  }
  if (!duocPhep(manHinh)) {
    veKhongChoPhep(noiDungEl, 'Tài khoản của bạn không được cấp quyền truy cập chức năng này.');
    return;
  }

  tieuDeTrang.textContent = manHinh.tieuDe;
  moTaTrang.textContent = manHinh.moTa ?? '';
  document.title = `${manHinh.tieuDe} — Coffee`;
  veDieuHuong();

  xoaHet(noiDungEl);
  const khung = el('div', {});
  noiDungEl.append(khung);
  window.scrollTo({ top: 0, behavior: 'instant' });

  try {
    await manHinh.hienThi(khung, {
      duongDan: tuyen.duongDan.slice(1),
      query: tuyen.query,
      taiLai: () => xuLyTuyen(tuyen),
    });
  } catch (loi) {
    xoaHet(khung);
    if (loi?.hetPhien) return; // đã chuyển về màn hình đăng nhập
    khung.append(
      el('div', { lop: 'the' }, [
        el('div', { lop: 'the-than' }, [
          el('strong', { vanBan: 'Không tải được dữ liệu' }),
          el('p', { lop: 'mo-chu', vanBan: thongDiepLoi(loi) }),
          el('div', { lop: 'nhom-nut', thuocTinh: { style: 'margin-top:12px' } }, [
            nut({ nhan: 'Thử lại', bieuTuong: 'lam-moi', nghe: () => xuLyTuyen(tuyen) }),
          ]),
        ]),
      ])
    );
  }
}

/** Vào ứng dụng sau khi đăng nhập hoặc khi phiên còn hiệu lực. */
async function vaoUngDung(nguoiDungDaNap = null) {
  const nguoiDung = nguoiDungDaNap ?? await napPhien();
  if (!nguoiDung) {
    if (laCongAdmin) {
      window.location.replace(duongDanDangNhapAdmin);
      return;
    }
    manDangNhap.hidden = true;
    khungUngDung.hidden = true;
    hienThiManDangNhap();
    return;
  }
  // Khi đăng nhập trên app, thông tin user lấy ngay từ phản hồi login.
  // Ghi vào store trước khi dựng menu/quyền; nếu không, quyền chỉ được nạp
  // sau khi đóng/mở app và khôi phục phiên qua /api/auth/me.
  if (nguoiDungDaNap) datNguoiDung(nguoiDung);
  if (laCongAdmin && nguoiDung.vaiTro !== 'Admin') {
    window.location.replace('/');
    return;
  }
  if (!laCongAdmin && nguoiDung.vaiTro === 'Admin') {
    window.location.replace(duongDanKhuVucAdmin);
    return;
  }

  manDangNhap.hidden = true;
  khungUngDung.hidden = false;

  khungUngDung.classList.toggle('giao-dien-admin', laQuanTri());

  try {
    await napDanhMuc();
  } catch (loi) {
    baoLoiApi(loi, 'Không nạp được danh mục trạng thái');
  }

  veThongTinNguoiDung();
  await veNhanBanHeThong();

  datMacDinh(manHinhMacDinh());
  const tuyen = docHash();
  if (!tuyen.ma) {
    await xuLyTuyen({ ma: manHinhMacDinh(), duongDan: [], query: {} });
  } else if (layManHinh(tuyen.ma)) {
    await xuLyTuyen(tuyen);
  }
  batDauRouter();
  dongThanhBen();
}

/* ================================ KHỞI ĐỘNG ============================= */

/** Đăng ký mọi màn hình và thiết lập các sự kiện toàn cục. */
function khoiDong() {
  for (const manHinh of CAC_MAN_HINH) dangKy(manHinh);
  datMacDinh('tong-quan');
  datKhiDoiTuyen(xuLyTuyen);

  datXuLyHetPhien(() => {
    if (laCongAdmin) {
      window.location.replace(duongDanDangNhapAdmin);
      return;
    }
    baoLoi('Phiên đăng nhập đã hết hạn', 'Vui lòng đăng nhập lại để tiếp tục.');
    xoaPhien();
    hienThiManDangNhap();
  });

  bieuMauDangNhap.addEventListener('submit', xuLyDangNhap);
  bieuMauDangKy.addEventListener('submit', xuLyDangKy);
  ganTaiKhoanGoiY();

  // Chuyển giữa Đăng nhập và Đăng ký.
  for (const nutCheDo of document.querySelectorAll('.muc-che-do')) {
    nutCheDo.addEventListener('click', () => datCheDo(nutCheDo.dataset.cheDo));
  }
  // Đánh dấu quy tắc mật khẩu ngay khi khách gõ.
  ganQuyTacMatKhau(oDkMatKhau, danhSachQuyTacMatKhau);

  // Nếu cookie phiên còn hiệu lực thì vào thẳng ứng dụng.
  manDangNhap.hidden = true;
  khungUngDung.hidden = true;
  hienTai(true);
  napPhien()
    .then((nguoiDung) => {
      if (nguoiDung) return vaoUngDung(nguoiDung);
      if (laCongAdmin) {
        window.location.replace(duongDanDangNhapAdmin);
        return undefined;
      }
      hienThiManDangNhap();
      return undefined;
    })
    .catch(() => {
      if (laCongAdmin) window.location.replace(duongDanDangNhapAdmin);
      else hienThiManDangNhap();
    })
    .finally(() => hienTai(false));
}

khoiDong();
