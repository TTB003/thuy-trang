/**
 * Trang QUẢN TRỊ (mục II của đồ án) — giao diện dành riêng cho vai trò Admin:
 * quản lý tài khoản & phân quyền, sao lưu – phục hồi CSDL, thông tin hệ thống.
 */
'use strict';

import { api } from '../api.js';
import { ngayGio, soDienThoai, so, soDungLuong, vietTat } from '../format.js';
import {
  bang,
  bangPhu,
  baoLoiApi,
  canhBao,
  dangXuLy,
  docBieuMau,
  el,
  hopThoai,
  khuTab,
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
  xacNhan,
  xoaHet,
} from '../ui.js';

/** Danh sách vai trò — khớp ROLES ở máy chủ. */
const VAI_TRO = ['Admin', 'Quản lý', 'Nhân viên', 'Khách hàng'];
/** Trạng thái tài khoản — khớp TRANG_THAI_TK ở máy chủ. */
const TRANG_THAI_TK = ['Hoạt động', 'Bị khóa'];

/** Mật khẩu mặc định khi đặt lại tài khoản. */
const MAT_KHAU_MAC_DINH = 'Coffee@123';

/** Dữ liệu dùng chung nạp trước cho biểu mẫu tạo tài khoản. */
const DU_LIEU = { nhanVien: [], khachHang: [] };

/** Nạp nhân viên và khách hàng để gán cho tài khoản mới. */
async function napDuLieu() {
  const [nv, kh] = await Promise.all([
    api.doc('/api/nhanvien', { pageSize: 100 }),
    api.doc('/api/khachhang', { pageSize: 100, trangThai: 'Hoạt động' }),
  ]);
  DU_LIEU.nhanVien = Array.isArray(nv?.items) ? nv.items : [];
  DU_LIEU.khachHang = Array.isArray(kh?.items) ? kh.items : [];
}

/** Màn hình quản trị hệ thống. */
export const manHinh = {
  ma: 'quan-tri',
  tieuDe: 'Quản trị hệ thống',
  moTa: 'Quản lý tài khoản và phân quyền, sao lưu – phục hồi cơ sở dữ liệu.',
  bieuTuong: 'quan-tri',
  chiQuanTri: true,

  async hienThi(container, ctx) {
    await napDuLieu();

    const tabs = khuTab([
      { ma: 'tai-khoan', nhan: 'Tài khoản & phân quyền', dung: () => tabTaiKhoan(ctx) },
      { ma: 'sao-luu', nhan: 'Sao lưu & phục hồi', dung: () => tabSaoLuu() },
      { ma: 'he-thong', nhan: 'Thông tin hệ thống', dung: () => tabHeThong() },
    ]);

    container.append(
      the({
        tieuDe: 'Quản trị hệ thống',
        ghiChu: 'Khu vực chỉ dành cho tài khoản có vai trò Admin.',
        than: el('div', {}, [tabs.tabEl, tabs.thanEl]),
        lopThan: 'the-than day',
      })
    );
  },
};

/* ============================ TAB 1: TÀI KHOẢN ========================== */

/** Tab quản lý tài khoản, phân quyền và trạng thái đăng nhập. */
function tabTaiKhoan(ctx) {
  const trangThai = {
    page: Number(ctx.query.page) || 1,
    pageSize: Number(ctx.query.pageSize) || 20,
    q: ctx.query.q ?? '',
    vaiTro: ctx.query.vaiTro ?? '',
    trangThai: ctx.query.trangThai ?? '',
  };

  const vungThongKe = el('div', { lop: 'luoi-thong-ke', thuocTinh: { style: 'margin-bottom:16px' } });
  const thanhCongCu = el('div', { lop: 'thanh-cong-cu' });
  const vungBang = el('div', {});

  /** Vẽ các thẻ thống kê tài khoản theo vai trò. */
  async function veThongKe() {
    xoaHet(vungThongKe);
    try {
      const thongKe = await api.doc('/api/admin/taikhoan/thong-ke');
      vungThongKe.append(
        theSoLieu({
          nhan: 'Tổng số tài khoản',
          giaTri: so(thongKe.tongTaiKhoan ?? 0),
          bieuTuong: 'tai-khoan',
        }),
        theSoLieu({
          nhan: 'Phiên đang mở',
          giaTri: so(thongKe.dangOnline ?? 0),
          phu: 'Tài khoản đang có phiên đăng nhập hiệu lực',
          sac: 'sac-matcha',
          bieuTuong: 'tick',
        }),
        theSoLieu({
          nhan: 'Tài khoản Admin',
          giaTri: so(
            (thongKe.theoVaiTro ?? [])
              .filter((muc) => muc.vaiTro === 'Admin')
              .reduce((tong, muc) => tong + Number(muc.soLuong), 0)
          ),
          sac: 'sac-chili',
          bieuTuong: 'khoa',
        })
      );
    } catch {
      // Bỏ qua nếu chưa tải được thống kê.
    }
  }

  /** Vẽ bảng tài khoản theo bộ lọc hiện tại. */
  async function veBang() {
    xoaHet(vungBang);
    try {
      const ketQua = await api.doc('/api/admin/taikhoan', {
        page: trangThai.page,
        pageSize: trangThai.pageSize,
        q: trangThai.q,
        vaiTro: trangThai.vaiTro,
        trangThai: trangThai.trangThai,
      });
      const items = Array.isArray(ketQua?.items) ? ketQua.items : [];
      const phan = ketQua?.pagination ?? { page: 1, pageSize: trangThai.pageSize, total: 0, totalPages: 1 };

      vungBang.append(
        bang({
          cot: [
            { tieuDe: 'Mã', truong: 'maTK', lop: 'so' },
            { tieuDe: 'Tên đăng nhập', truong: 'tenDangNhap', lop: 'manh' },
            { tieuDe: 'Vai trò', dung: (ban) => nhan(ban.vaiTro) },
            {
              tieuDe: 'Gắn với',
              lay: (ban) => ban.tenNhanVien ?? ban.tenKhachHang ?? '—',
            },
            {
              tieuDe: 'Điện thoại',
              lop: 'so',
              lay: (ban) => (ban.sdtKhachHang ? soDienThoai(ban.sdtKhachHang) : '—'),
            },
            { tieuDe: 'Trạng thái', dung: (ban) => nhan(ban.trangThai) },
            { tieuDe: 'Đăng nhập cuối', lop: 'so', lay: (ban) => ngayGio(ban.lanDangNhapCuoi) },
            {
              tieuDe: 'Thao tác',
              lop: 'cot-thao-tac',
              dung: (ban) =>
                el('div', { lop: 'gon', thuocTinh: { style: 'justify-content:flex-end' } }, [
                  nut({
                    nhan: 'Phân quyền',
                    bieuTuong: 'phan-quyen',
                    nho: true,
                    nghe: () => moDoiVaiTro(ban),
                  }),
                  nut({
                    nhan: 'Đặt lại mật khẩu',
                    bieuTuong: 'khoa',
                    nho: true,
                    nghe: () => datLaiMatKhau(ban),
                  }),
                  nut({
                    nhan: ban.trangThai === 'Hoạt động' ? 'Khóa' : 'Mở khóa',
                    bieuTuong: ban.trangThai === 'Hoạt động' ? 'khoa' : 'tick',
                    nho: true,
                    nghe: () => doiTrangThai(ban),
                  }),
                  nut({
                    nhan: 'Xóa',
                    bieuTuong: 'xoa',
                    nho: true,
                    nguyHiem: true,
                    nghe: () => xoaTaiKhoan(ban),
                  }),
                ]),
            },
          ],
          duLieu: items,
          khiRong: oTrong({
            tieuDe: 'Không có tài khoản nào',
            moTa: 'Thử đổi từ khóa tìm kiếm hoặc bộ lọc vai trò.',
            bieuTuong: 'tai-khoan',
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
      baoLoiApi(loi, 'Không tải được danh sách tài khoản');
    }
  }

  /** Hộp thoại tạo tài khoản mới (Admin). */
  function moTaoTaiKhoan() {
    const oVaiTro = truong({
      ten: 'vaiTro',
      nhan: 'Vai trò',
      loai: 'select',
      batBuoc: true,
      giaTri: 'Nhân viên',
      tuyChon: { muc: VAI_TRO },
    });

    const oTenDangNhap = truong({
      ten: 'tenDangNhap',
      nhan: 'Tên đăng nhập',
      loai: 'text',
      goiY: 'Bỏ trống để dùng email nhân viên hoặc số điện thoại khách hàng.',
      thuocTinh: { maxlength: 100 },
    });

    const oMatKhau = truong({
      ten: 'matKhau',
      nhan: 'Mật khẩu',
      loai: 'password',
      batBuoc: true,
      giaTri: MAT_KHAU_MAC_DINH,
      goiY: 'Tối thiểu 6 ký tự.',
      thuocTinh: { maxlength: 100 },
    });

    const oNhanVien = truong({
      ten: 'maNV',
      nhan: 'Nhân viên',
      loai: 'select',
      tuyChon: {
        muc: DU_LIEU.nhanVien.map((nv) => ({
          giaTri: nv.maNV,
          nhan: `${nv.hoTen} — ${nv.chucVu ?? 'Nhân viên'}`,
        })),
        mucRong: '— Chọn nhân viên —',
      },
    });

    const oKhachHang = truong({
      ten: 'maKH',
      nhan: 'Khách hàng',
      loai: 'select',
      tuyChon: {
        muc: DU_LIEU.khachHang.map((kh) => ({
          giaTri: kh.maKH,
          nhan: `${kh.hoTen} — ${soDienThoai(kh.sdt)}`,
        })),
        mucRong: '— Chọn khách hàng —',
      },
      goiY: 'Chỉ dùng khi vai trò là "Khách hàng".',
      an: true,
    });

    const bieuMau = el('form', { thuocTinh: { novalidate: true } }, [
      luoiTruong([oVaiTro, oTenDangNhap, oMatKhau, oNhanVien, oKhachHang]),
    ]);

    const oChonVaiTro = bieuMau.querySelector('[name="vaiTro"]');
    const oChonNhanVien = bieuMau.querySelector('[name="maNV"]');
    const oChonKhachHang = bieuMau.querySelector('[name="maKH"]');
    const truongKhachHang = oChonKhachHang.closest('.truong');
    const truongNhanVien = oChonNhanVien.closest('.truong');

    /** Hiện đúng ô chọn theo vai trò đang chọn. */
    function capNhatTheoVaiTro() {
      const laKhachHang = oChonVaiTro.value === 'Khách hàng';
      truongKhachHang.style.display = laKhachHang ? '' : 'none';
      truongNhanVien.style.display = laKhachHang ? 'none' : '';
    }
    oChonVaiTro.addEventListener('change', capNhatTheoVaiTro);
    capNhatTheoVaiTro();

    const nutLuu = nut({
      nhan: 'Tạo tài khoản',
      bieuTuong: 'tick',
      chinh: true,
      nghe: () => gui(),
    });

    const hop = hopThoai({
      tieuDe: 'Tạo tài khoản mới',
      moTa: 'Mỗi tài khoản nội bộ phải gắn với một nhân viên; tài khoản khách hàng gắn với một khách hàng.',
      than: bieuMau,
      nutChan: [nut({ nhan: 'Hủy bỏ', lop: 'nut-trong', nghe: () => hop.dong() }), nutLuu],
      rong: true,
    });

    /** Gửi yêu cầu tạo tài khoản. */
    async function gui() {
      const duLieu = docBieuMau(bieuMau);
      const vaiTro = oChonVaiTro.value;
      if (!duLieu.matKhau || duLieu.matKhau.length < 6) {
        canhBao('Mật khẩu chưa hợp lệ', 'Mật khẩu phải có ít nhất 6 ký tự.');
        return;
      }
      const maNV = Number(oChonNhanVien.value) || null;
      const maKH = Number(oChonKhachHang.value) || null;
      if (vaiTro === 'Khách hàng' && !maKH) {
        canhBao('Thiếu thông tin', 'Vui lòng chọn khách hàng cho tài khoản này.');
        return;
      }
      if (vaiTro !== 'Khách hàng' && !maNV) {
        canhBao('Thiếu thông tin', 'Vui lòng chọn nhân viên cho tài khoản này.');
        return;
      }

      dangXuLy(nutLuu, true);
      try {
        await api.post('/api/admin/taikhoan', {
          vaiTro,
          tenDangNhap: duLieu.tenDangNhap || null,
          matKhau: duLieu.matKhau,
          maNV,
          maKH,
        });
        thanhCong('Đã tạo tài khoản mới');
        hop.dong();
        await veBang();
        await veThongKe();
      } catch (loi) {
        baoLoiApi(loi, 'Không tạo được tài khoản');
      } finally {
        dangXuLy(nutLuu, false);
      }
    }

    bieuMau.addEventListener('submit', (suKien) => {
      suKien.preventDefault();
      gui();
    });
  }

  /** Hộp thoại đổi vai trò (phân quyền) cho tài khoản. */
  function moDoiVaiTro(ban) {
    const oVaiTroMoi = truong({
      ten: 'vaiTro',
      nhan: 'Vai trò mới',
      loai: 'select',
      batBuoc: true,
      giaTri: ban.vaiTro,
      tuyChon: { muc: VAI_TRO.filter((vaiTro) => vaiTro !== ban.vaiTro) },
      goiY: 'Đổi vai trò sẽ thu hồi mọi phiên đăng nhập hiện có của tài khoản.',
    });

    const nutLuu = nut({
      nhan: 'Cập nhật vai trò',
      bieuTuong: 'phan-quyen',
      chinh: true,
      nghe: () => gui(),
    });

    const hop = hopThoai({
      tieuDe: `Phân quyền: ${ban.tenDangNhap}`,
      than: el('form', { thuocTinh: { novalidate: true } }, [
        moTaCot([
          { nhan: 'Vai trò hiện tại', node: nhan(ban.vaiTro) },
          { nhan: 'Gắn với', giaTri: ban.tenNhanVien ?? ban.tenKhachHang },
          { nhan: 'Trạng thái', node: nhan(ban.trangThai) },
        ]),
        el('div', { thuocTinh: { style: 'margin-top:16px' } }, [oVaiTroMoi]),
      ]),
      nutChan: [nut({ nhan: 'Đóng', lop: 'nut-trong', nghe: () => hop.dong() }), nutLuu],
      rong: true,
    });

    /** Gửi yêu cầu đổi vai trò. */
    async function gui() {
      const vaiTro = oVaiTroMoi.querySelector('select').value;
      dangXuLy(nutLuu, true);
      try {
        await api.patch(`/api/admin/taikhoan/${ban.maTK}/vai-tro`, { vaiTro });
        thanhCong(`Đã đổi vai trò thành "${vaiTro}"`);
        hop.dong();
        await veBang();
        await veThongKe();
      } catch (loi) {
        baoLoiApi(loi, 'Không đổi được vai trò');
      } finally {
        dangXuLy(nutLuu, false);
      }
    }
  }

  /** Đặt lại mật khẩu tài khoản. */
  async function datLaiMatKhau(ban) {
    const dongY = await xacNhan({
      tieuDe: 'Đặt lại mật khẩu',
      noiDung: `Đặt lại mật khẩu của "${ban.tenDangNhap}" về "${MAT_KHAU_MAC_DINH}"?`,
      nhanDongY: 'Đặt lại mật khẩu',
    });
    if (!dongY) return;
    try {
      const ketQua = await api.post(`/api/admin/taikhoan/${ban.maTK}/dat-lai-mat-khau`, {
        matKhau: MAT_KHAU_MAC_DINH,
      });
      thanhCong('Đã đặt lại mật khẩu', ketQua?.matKhau ? `Mật khẩu mới: ${ketQua.matKhau}` : null);
    } catch (loi) {
      baoLoiApi(loi, 'Không đặt lại được mật khẩu');
    }
  }

  /** Khóa hoặc mở khóa tài khoản. */
  async function doiTrangThai(ban) {
    const trangThaiMoi = ban.trangThai === 'Hoạt động' ? 'Bị khóa' : 'Hoạt động';
    const dongY = await xacNhan({
      tieuDe: trangThaiMoi === 'Bị khóa' ? 'Khóa tài khoản' : 'Mở khóa tài khoản',
      noiDung: `${trangThaiMoi === 'Bị khóa' ? 'Khóa' : 'Mở khóa'} tài khoản "${ban.tenDangNhap}"?${
        trangThaiMoi === 'Bị khóa'
          ? ' Mọi phiên đăng nhập của tài khoản này sẽ bị thu hồi ngay.'
          : ''
      }`,
      nhanDongY: trangThaiMoi === 'Bị khóa' ? 'Khóa tài khoản' : 'Mở khóa',
      nguyHiem: trangThaiMoi === 'Bị khóa',
    });
    if (!dongY) return;
    try {
      await api.patch(`/api/admin/taikhoan/${ban.maTK}/trang-thai`, { trangThai: trangThaiMoi });
      thanhCong(`Đã chuyển trạng thái sang "${trangThaiMoi}"`);
      await veBang();
    } catch (loi) {
      baoLoiApi(loi, 'Không đổi được trạng thái tài khoản');
    }
  }

  /** Xóa tài khoản khỏi hệ thống. */
  async function xoaTaiKhoan(ban) {
    const dongY = await xacNhan({
      tieuDe: 'Xóa tài khoản',
      noiDung: `Xóa vĩnh viễn tài khoản "${ban.tenDangNhap}"? Dữ liệu nghiệp vụ liên quan vẫn được giữ lại.`,
      nhanDongY: 'Xóa tài khoản',
      nguyHiem: true,
    });
    if (!dongY) return;
    try {
      const ketQua = await api.xoa(`/api/admin/taikhoan/${ban.maTK}`);
      thanhCong('Đã xóa tài khoản', ketQua?.tenDangNhap ?? null);
      await veBang();
      await veThongKe();
    } catch (loi) {
      baoLoiApi(loi, 'Không xóa được tài khoản');
    }
  }

  /* ----------------------------- THANH CÔNG CỤ ---------------------------- */

  const oTim = el('input', {
    kieu: 'search',
    thuocTinh: { placeholder: 'Tìm theo tên đăng nhập, họ tên hoặc email…' },
    giaTri: trangThai.q,
  });
  let henGio = null;
  oTim.addEventListener('input', () => {
    window.clearTimeout(henGio);
    henGio = window.setTimeout(() => {
      trangThai.q = oTim.value.trim();
      trangThai.page = 1;
      veBang();
    }, 280);
  });
  thanhCongCu.append(
    el('label', { lop: 'truong truong-tim-kiem' }, [el('span', { vanBan: 'Từ khóa' }), oTim])
  );

  const oVaiTroLoc = el('select', {
    nghe: {
      change: (suKien) => {
        trangThai.vaiTro = suKien.target.value;
        trangThai.page = 1;
        veBang();
      },
    },
  });
  oVaiTroLoc.append(el('option', { vanBan: 'Tất cả vai trò', thuocTinh: { value: '' } }));
  for (const vaiTro of VAI_TRO) {
    oVaiTroLoc.append(el('option', { vanBan: vaiTro, thuocTinh: { value: vaiTro } }));
  }
  thanhCongCu.append(
    el('label', { lop: 'truong truong-ngan' }, [el('span', { vanBan: 'Vai trò' }), oVaiTroLoc])
  );

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
  for (const giaTri of TRANG_THAI_TK) {
    oTrangThaiLoc.append(el('option', { vanBan: giaTri, thuocTinh: { value: giaTri } }));
  }
  thanhCongCu.append(
    el('label', { lop: 'truong truong-ngan' }, [
      el('span', { vanBan: 'Trạng thái' }),
      oTrangThaiLoc,
    ])
  );

  thanhCongCu.append(el('div', { lop: 'day-khoang-cach' }));
  thanhCongCu.append(
    nut({
      nhan: 'Làm mới',
      bieuTuong: 'lam-moi',
      nghe: () => {
        trangThai.page = 1;
        veBang();
      },
    }),
    nut({
      nhan: 'Tạo tài khoản',
      bieuTuong: 'them',
      chinh: true,
      nghe: () => moTaoTaiKhoan(),
    })
  );

  veThongKe();
  veBang();

  return el('div', {}, [
    vungThongKe,
    thanhCongCu,
    vungBang,
  ]);
}

/* ========================= TAB 2: SAO LƯU – PHỤC HỒI ===================== */

/** Tab sao lưu và phục hồi cơ sở dữ liệu. */
function tabSaoLuu() {
  const vungBang = el('div', {});
  const thanhCongCu = el('div', { lop: 'thanh-cong-cu' });

  /** Nạp danh sách các bản sao lưu hiện có. */
  async function veBang() {
    xoaHet(vungBang);
    try {
      const ketQua = await api.doc('/api/admin/sao-luu');
      const danhSach = Array.isArray(ketQua?.danhSach) ? ketQua.danhSach : [];

      vungBang.append(
        bang({
          cot: [
            { tieuDe: 'Tên tệp', truong: 'tenFile', lop: 'manh' },
            {
              tieuDe: 'Kích thước',
              lop: 'so',
              lay: (ban) => soDungLuong(ban.kichThuoc),
            },
            { tieuDe: 'Thời điểm tạo', lop: 'so', lay: (ban) => ngayGio(ban.thoiDiem) },
            {
              tieuDe: 'Thao tác',
              lop: 'cot-thao-tac',
              dung: (ban) =>
                el('div', { lop: 'gon', thuocTinh: { style: 'justify-content:flex-end' } }, [
                  nut({
                    nhan: 'Phục hồi',
                    bieuTuong: 'lam-moi',
                    nho: true,
                    nguyHiem: true,
                    nghe: () => phucHoi(ban),
                  }),
                  nut({
                    nhan: 'Xóa',
                    bieuTuong: 'xoa',
                    nho: true,
                    nguyHiem: true,
                    nghe: () => xoaBanSao(ban),
                  }),
                ]),
            },
          ],
          duLieu: danhSach,
          khiRong: oTrong({
            tieuDe: 'Chưa có bản sao lưu nào',
            moTa: 'Bấm "Tạo bản sao lưu" để lưu trạng thái cơ sở dữ liệu hiện tại.',
            bieuTuong: 'sao-luu',
          }),
        })
      );
    } catch (loi) {
      xoaHet(vungBang);
      vungBang.append(
        el('p', { lop: 'mo-chu', vanBan: `Không tải được danh sách sao lưu: ${loi?.message ?? ''}` })
      );
    }
  }

  /** Tạo một bản sao lưu mới. */
  function moTaoSaoLuu() {
    const oGhiChu = truong({
      ten: 'ghiChu',
      nhan: 'Ghi chú cho bản sao lưu',
      loai: 'textarea',
      giaTri: 'Sao lưu thủ công từ giao diện quản trị',
      thuocTinh: { maxlength: 255 },
    });

    const nutLuu = nut({
      nhan: 'Tạo bản sao lưu',
      bieuTuong: 'sao-luu',
      chinh: true,
      nghe: () => gui(),
    });

    const hop = hopThoai({
      tieuDe: 'Tạo bản sao lưu cơ sở dữ liệu',
      moTa: 'Hệ thống xuất toàn bộ dữ liệu ra tệp trong thư mục sao lưu.',
      than: el('form', { thuocTinh: { novalidate: true } }, [oGhiChu]),
      nutChan: [nut({ nhan: 'Hủy bỏ', lop: 'nut-trong', nghe: () => hop.dong() }), nutLuu],
      rong: true,
    });

    /** Gửi yêu cầu tạo bản sao lưu. */
    async function gui() {
      const ghiChu = oGhiChu.querySelector('textarea').value.trim();
      dangXuLy(nutLuu, true);
      try {
        const ketQua = await api.post('/api/admin/sao-luu', { ghiChu });
        thanhCong('Đã tạo bản sao lưu', ketQua?.tenFile ?? null);
        hop.dong();
        await veBang();
      } catch (loi) {
        baoLoiApi(loi, 'Không tạo được bản sao lưu');
      } finally {
        dangXuLy(nutLuu, false);
      }
    }
  }

  /** Phục hồi cơ sở dữ liệu từ một bản sao lưu. */
  async function phucHoi(ban) {
    const dongY = await xacNhan({
      tieuDe: 'Phục hồi cơ sở dữ liệu',
      noiDung:
        `Phục hồi từ "${ban.tenFile}" sẽ THAY THẾ toàn bộ dữ liệu hiện tại. ` +
        'Hệ thống tự động tạo một bản sao lưu an toàn trước khi phục hồi.',
      nhanDongY: 'Phục hồi ngay',
      nguyHiem: true,
    });
    if (!dongY) return;
    try {
      const ketQua = await api.post('/api/admin/phuc-hoi', { tenFile: ban.tenFile });
      thanhCong('Đã phục hồi cơ sở dữ liệu', ketQua?.thongBao ?? null);
      await veBang();
    } catch (loi) {
      baoLoiApi(loi, 'Không phục hồi được cơ sở dữ liệu');
    }
  }

  /** Xóa một tệp sao lưu. */
  async function xoaBanSao(ban) {
    const dongY = await xacNhan({
      tieuDe: 'Xóa bản sao lưu',
      noiDung: `Xóa vĩnh viễn tệp sao lưu "${ban.tenFile}"?`,
      nhanDongY: 'Xóa tệp',
      nguyHiem: true,
    });
    if (!dongY) return;
    try {
      await api.xoa(`/api/admin/sao-luu/${encodeURIComponent(ban.tenFile)}`);
      thanhCong('Đã xóa bản sao lưu');
      await veBang();
    } catch (loi) {
      baoLoiApi(loi, 'Không xóa được bản sao lưu');
    }
  }

  thanhCongCu.append(
    el('p', {
      lop: 'mo-chu nho-chu',
      vanBan:
        'Bản sao lưu giúp khôi phục dữ liệu khi xảy ra sự cố. Với PostgreSQL, tệp sao lưu là script .sql; với SQLite là tệp .db.',
    }),
    el('div', { lop: 'day-khoang-cach' }),
    nut({
      nhan: 'Làm mới',
      bieuTuong: 'lam-moi',
      nghe: () => veBang(),
    }),
    nut({
      nhan: 'Tạo bản sao lưu',
      bieuTuong: 'sao-luu',
      chinh: true,
      nghe: () => moTaoSaoLuu(),
    })
  );

  veBang();
