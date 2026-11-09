/**
 * Điểm khởi động giao diện: đăng nhập, dựng thanh điều hướng và chạy router.
 */
'use strict';

import { api, datXuLyHetPhien, thongDiepLoi } from './api.js';
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
import { chuCaiDau } from './format.js';
import { batDauRouter, dangKy, datKhiDoiTuyen, datMacDinh, layManHinh } from './router.js';

/* ------------------------------ MÀN HÌNH ------------------------------- */
import { manHinh as manTongQuan } from './pages/tong-quan.js';
import { manHinh as manLoaiSanPham } from './pages/loaisanpham.js';
import { manHinh as manSanPham } from './pages/sanpham.js';
import { manHinh as manNhaCungCap } from './pages/nhacungcap.js';
import { manHinh as manNhanVien } from './pages/nhanvien.js';
import { manHinh as manKhachHang } from './pages/khachhang.js';
import { manHinh as manPhieuNhap } from './pages/phieunhap.js';
import { manHinh as manDonHang } from './pages/donhang.js';
import { manHinh as manDiem } from './pages/diem.js';
import { manHinh as manKhuyenMai } from './pages/khuyenmai.js';
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
  { tieuDe: 'Chăm sóc khách hàng', muc: ['khuyenmai', 'phanhoi', 'khaosat'] },
  { tieuDe: 'Phân tích', muc: ['baocao'] },
  { tieuDe: 'Khu vực quản trị', muc: ['quan-tri'] },
  { tieuDe: 'Tài khoản của tôi', muc: ['cua-toi'] },
];

/** Màn hình mặc định theo vai trò. */
function manHinhMacDinh() {
  return laKhachHang() ? 'cua-toi' : 'tong-quan';
}

/** Người dùng có được phép mở màn hình này không. */
function duocPhep(manHinh) {
  if (!manHinh) return false;
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
    await api.post('/api/auth/login', { tenDangNhap, matKhau });
    await vaoUngDung();
  } catch (loi) {
    hienLoiDangNhap(thongDiepLoi(loi));
  } finally {
    dangXuLy(nutDangNhap, false);
  }
}

/** Đăng xuất và quay về màn hình đăng nhập. */
async function xuLyDangXuat() {
  try {
    await api.post('/api/auth/logout', {});
  } catch {
    // Dù máy chủ báo lỗi vẫn đưa người dùng về màn hình đăng nhập.
  }
  xoaPhien();
  hienThiManDangNhap();
}

/** Chuyển sang màn hình đăng nhập. */
function hienThiManDangNhap() {
  khungUngDung.hidden = true;
  manDangNhap.hidden = false;
  oMatKhau.value = '';
  hienLoiDangNhap(null);
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

  thongTinNguoiDungEl.append(
    el('div', { lop: 'anh-dai-dien', vanBan: chuCaiDau(nguoiDung.hoTen) }),
    el('div', { lop: 'thong-tin' }, [
      el('strong', { vanBan: nguoiDung.hoTen || nguoiDung.tenDangNhap }),
      el('small', { vanBan: vaiTroText }),
    ]),
    nut({
      nhan: 'Đăng xuất',
      bieuTuong: 'dang-xuat',
      lop: 'nut-trong nut-nho',
      nghe: xuLyDangXuat,
    })
  );
}

/** Dựng thanh điều hướng theo quyền của người dùng hiện tại. */
function veDieuHuong() {
  xoaHet(dieuHuongEl);
  const tuyenHienTai = (window.location.hash.match(/^#\/([^/?]+)/) ?? [])[1] ?? '';

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
      const he = thongTin?.coSoDuLieu?.he ?? thongTin?.he ?? 'CSDL';
      const moTa = thongTin?.coSoDuLieu?.moTa ?? '';
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
  document.title = `${manHinh.tieuDe} — Coffee CRM`;
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
async function vaoUngDung() {
  manDangNhap.hidden = true;
  khungUngDung.hidden = false;

  const nguoiDung = await napPhien();
  if (!nguoiDung) {
    hienThiManDangNhap();
    return;
  }

  khungUngDung.classList.toggle('giao-dien-admin', laQuanTri());

  try {
    await napDanhMuc();
  } catch (loi) {
    baoLoiApi(loi, 'Không nạp được danh mục trạng thái');
  }

  veThongTinNguoiDung();
  await veNhanBanHeThong();

  datMacDinh(manHinhMacDinh());
  if (!window.location.hash || layManHinh((window.location.hash.match(/^#\/([^/?]+)/) ?? [])[1] ?? '')) {
    await xuLyTuyen({ ma: (window.location.hash.match(/^#\/([^/?]+)/) ?? [])[1] ?? manHinhMacDinh(), duongDan: [], query: {} });
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
    baoLoi('Phiên đăng nhập đã hết hạn', 'Vui lòng đăng nhập lại để tiếp tục.');
    xoaPhien();
    hienThiManDangNhap();
  });

  bieuMauDangNhap.addEventListener('submit', xuLyDangNhap);
  ganTaiKhoanGoiY();

  // Nếu cookie phiên còn hiệu lực thì vào thẳng ứng dụng.
  napPhien()
    .then((nguoiDung) => {
      if (nguoiDung) return vaoUngDung();
      hienThiManDangNhap();
      return undefined;
    })
    .catch(() => hienThiManDangNhap());

