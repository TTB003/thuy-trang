/**
 * CỔNG KHÁCH HÀNG (mục 4.3) — dành cho tài khoản vai trò Khách hàng:
 * hồ sơ cá nhân, đơn hàng của tôi, điểm thưởng, phản hồi và khảo sát được giao.
 */
'use strict';

import { api } from '../api.js';
import { chuCaiDau, ngay, ngayChoInput, ngayGio, phanTram, so, tien } from '../format.js';
import {
  bang,
  bangPhu,
  baoLoiApi,
  canhBao,
  dangXuLy,
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
  xoaHet,
} from '../ui.js';

/** Giới tính hợp lệ — khớp danh sách ở máy chủ. */
const GIOI_TINH = ['Nam', 'Nữ', 'Khác'];

/** Màn hình cổng khách hàng. */
export const manHinh = {
  ma: 'cua-toi',
  tieuDe: 'Cổng khách hàng',
  moTa: 'Xem hồ sơ, đơn hàng, điểm thưởng, gửi phản hồi và trả lời khảo sát.',
  bieuTuong: 'khach-hang',
  chiKhachHang: true,

  async hienThi(container, ctx) {
    const tabs = khuTab([
      { ma: 'ho-so', nhan: 'Hồ sơ của tôi', dung: () => tabHoSo() },
      { ma: 'don-hang', nhan: 'Đơn hàng của tôi', dung: () => tabDonHang(ctx) },
      { ma: 'diem', nhan: 'Điểm thưởng', dung: () => tabDiem(ctx) },
      { ma: 'phan-hoi', nhan: 'Phản hồi của tôi', dung: () => tabPhanHoi(ctx) },
      { ma: 'khao-sat', nhan: 'Khảo sát của tôi', dung: () => tabKhaoSat() },
    ]);

    container.append(
      the({
        tieuDe: 'Cổng khách hàng',
        ghiChu: 'Khu vực dành riêng cho tài khoản khách hàng của cửa hàng.',
        than: el('div', {}, [tabs.tabEl, tabs.thanEl]),
        lopThan: 'the-than day',
      })
    );
  },
};

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
          nhan: 'Họ tên',
          loai: 'text',
          batBuoc: true,
          giaTri: hoSo.hoTen,
          thuocTinh: { maxlength: 100 },
        }),
        truong({
          ten: 'sdt',
          nhan: 'Số điện thoại',
          loai: 'text',
          batBuoc: true,
          giaTri: hoSo.sdt,
          goiY: 'Số điện thoại cũng là tên đăng nhập của bạn.',
          thuocTinh: { maxlength: 15 },
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
          tuyChon: { muc: GIOI_TINH, mucRong: '— Chưa chọn —' },
        }),
        truong({
          ten: 'diaChi',
          nhan: 'Địa chỉ',
          loai: 'text',
          giaTri: hoSo.diaChi,
          thuocTinh: { maxlength: 255 },
        }),
        truong({
          ten: 'soThich',
          nhan: 'Sở thích',
          loai: 'text',
          rong: true,
          giaTri: hoSo.soThich,
          goiY: 'Ví dụ: cà phê sữa ít đường, bánh ngọt…',
          thuocTinh: { maxlength: 150 },
        }),
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
      const duLieu = {};
      for (const the of bieuMau.elements) {
        if (!the.name) continue;
        const giaTri = String(the.value ?? '').trim();
        duLieu[the.name] = giaTri === '' ? null : giaTri;
      }
      if (!duLieu.hoTen) {
        canhBao('Thiếu thông tin', 'Vui lòng nhập họ tên.');
        return;
      }
      if (!duLieu.sdt) {
        canhBao('Thiếu thông tin', 'Vui lòng nhập số điện thoại.');
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
                ]),
            },
          ],
          duLieu: items,
          khiRong: oTrong({
            tieuDe: 'Bạn chưa có đơn hàng nào',
            moTa: 'Đơn hàng sẽ xuất hiện ở đây sau khi bạn mua tại quán.',
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

    hopThoai({
      tieuDe: `Đơn hàng #${don.maDH}`,
      moTa: `${ngayGio(don.ngayDat)} · ${don.trangThai}`,
      than: el('div', {}, [
        moTaCot([
          { nhan: 'Hình thức', giaTri: don.hinhThuc },
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

      const quyDoi = lichSu?.quyDoi ?? { vndPerPoint: 10000, vndPerPointRedeem: 1000 };
      vungThongKe.append(
        theSoLieu({
          nhan: 'Điểm hiện có',
          giaTri: so(hoSo.diemTichLuy),
          phu: 'Dùng ngay khi thanh toán tại quán',
          sac: 'sac-matcha',
          bieuTuong: 'diem-thuong',
        }),
        theSoLieu({
          nhan: 'Giá trị quy đổi',
          giaTri: tien(Number(hoSo.diemTichLuy) * Number(quyDoi.vndPerPointRedeem)),
          phu: `1 điểm = ${tien(quyDoi.vndPerPointRedeem)}`,
          sac: 'sac-honey',
          bieuTuong: 'tien',
        }),
        theSoLieu({
          nhan: 'Cách tích điểm',
          giaTri: `${tien(quyDoi.vndPerPoint)} = 1 điểm`,
          phu: 'Áp dụng cho mọi hoá đơn đã hoàn thành',
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

/* ========================== TAB 4: PHẢN HỒI ============================= */

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
            { tieuDe: 'Phản hồi của quán', truong: 'phanHoiCuaQuan', lop: 'mo' },
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

/* =========================== TAB 5: KHẢO SÁT ============================ */

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
    return the({
      tieuDe: khaoSat.tieuDe,
      ghiChu: khaoSat.moTa ?? null,
      congCu: el('div', { lop: 'gon' }, [
        daTraLoi
          ? nhan('Đã trả lời', 'nhan-xanh')
          : nhan('Chưa trả lời', 'nhan-vang'),
        daTraLoi
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
        { nhan: 'Ngày gửi khảo sát', giaTri: ngay(khaoSat.ngayTao), so: true },
        {
          nhan: 'Hạn trả lời',
          giaTri: khaoSat.hanChot ? `${ngay(khaoSat.hanChot)} · Bạn nhận 5 điểm khi hoàn thành` : 'Không giới hạn',
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
      const nhanCauHoi = `${thuTu}. ${cauHoiMuc.noiDung}${Number(cauHoiMuc.batBuoc) === 1 ? ' *' : ''}`;
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
          thuocTinh: { min: 1, max: 5, step: 1, placeholder: 'Từ 1 đến 5' },
        });
      } else {
        oNhap = el('textarea', {
          dinhDanh: `cauhoi-${cauHoiMuc.maCauHoi}`,
          thuocTinh: { rows: 3, maxlength: 1000, placeholder: 'Nhập câu trả lời của bạn…' },
        });
      }

      cacOTraLoi.push({ maCauHoi: cauHoiMuc.maCauHoi, oNhap, batBuoc: Number(cauHoiMuc.batBuoc) === 1 });

      return el('div', { lop: 'cau-hoi-khao-sat' }, [
        el('span', { lop: 'nhan-cau-hoi', vanBan: nhanCauHoi }),
        cauHoiMuc.loaiCauHoi === 'Nhiều lựa chọn'
          ? el('span', { lop: 'goi-y', vanBan: 'Giữ Ctrl (hoặc Cmd) để chọn nhiều đáp án.' })
          : null,
        oNhap,
      ]);
    }

    const bieuMau = el('form', { thuocTinh: { novalidate: true } }, [
      el('div', { lop: 'danh-sach-cau-hoi' }, cauHoi.map((muc, chi) => oTraLoi(muc, chi + 1))),
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

/* Định dạng phần trăm dùng khi mở rộng phần thống kê cho khách hàng. */
void phanTram;
