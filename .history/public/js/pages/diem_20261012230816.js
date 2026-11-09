/**
 * Trang NHÓM 8 — Tích lũy điểm khách hàng (CN8.1 → CN8.4).
 * Xem lịch sử điểm toàn hệ thống và tra cứu điểm theo từng khách hàng.
 */
'use strict';

import { api } from '../api.js';
import { layDanhMuc } from '../store.js';
import { ngayGio, so, soDienThoai, tien, vietTat } from '../format.js';
import {
  bang,
  bangPhu,
  baoLoiApi,
  el,
  khuTab,
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

/** Quy tắc quy đổi mặc định nếu chưa nạp được danh mục. */
const QUY_DOI_MAC_DINH = { vndPerPoint: 10000, vndPerPointRedeem: 1000 };

/** Nhãn phân loại giao dịch điểm. */
function nhanLoaiGiaoDich(loai) {
  if (loai === 'Cộng') return nhan('Cộng điểm', 'nhan-xanh');
  if (loai === 'Trừ') return nhan('Dùng điểm', 'nhan-cam');
  if (loai === 'Hoàn') return nhan('Hoàn điểm', 'nhan-xam');
  return nhan('Thu hồi', 'nhan-do');
}

/** Màn hình quản lý điểm tích lũy. */
export const manHinh = {
  ma: 'diem',
  tieuDe: 'Điểm tích lũy',
  moTa: 'Theo dõi điểm thưởng của khách hàng và quy tắc quy đổi điểm.',
  bieuTuong: 'diem-thuong',
  quyen: 'loyalty.manage',

  async hienThi(container, ctx) {
    /* --------------------------- TAB 1: TOÀN HỆ THỐNG ---------------------- */

    /** Dựng nội dung tab lịch sử điểm toàn hệ thống. */
    function dungTabToanHeThong() {
      const trangThai = {
        page: Number(ctx.query.page) || 1,
        pageSize: Number(ctx.query.pageSize) || 20,
        q: ctx.query.q ?? '',
        loaiGD: ctx.query.loaiGD ?? '',
      };

      const thanhCongCu = el('div', { lop: 'thanh-cong-cu' });
      const vungBang = el('div', {});

      /** Gọi API lịch sử điểm toàn hệ thống. */
      async function taiDuLieu() {
        const ketQua = await api.doc('/api/diem/lich-su', {
          page: trangThai.page,
          pageSize: trangThai.pageSize,
          q: trangThai.q,
          loaiGD: trangThai.loaiGD,
        });
        return {
          items: Array.isArray(ketQua?.items) ? ketQua.items : [],
          phan: ketQua?.pagination ?? { page: 1, pageSize: trangThai.pageSize, total: 0, totalPages: 1 },
        };
      }

      /** Vẽ bảng lịch sử điểm. */
      async function veBang() {
        xoaHet(vungBang);
        const { items, phan } = await taiDuLieu();

        vungBang.append(
          bang({
            cot: [
              { tieuDe: 'Mã GD', truong: 'maLS', lop: 'so' },
              { tieuDe: 'Khách hàng', truong: 'hoTen', lop: 'manh' },
              { tieuDe: 'Điện thoại', lop: 'so', lay: (ban) => soDienThoai(ban.sdt) },
              {
                tieuDe: 'Đơn hàng',
                lop: 'so',
                lay: (ban) => (ban.maDH ? `#${ban.maDH}` : '—'),
              },
              { tieuDe: 'Loại', dung: (ban) => nhanLoaiGiaoDich(ban.loaiGD) },
              { tieuDe: 'Số điểm', lop: 'so', lay: (ban) => so(ban.soDiem) },
              {
                tieuDe: 'Biến động',
                lop: 'so',
                dung: (ban) =>
                  el('span', {
                    lop: Number(ban.bienDong) >= 0 ? 'nhan-xanh-chu' : 'nhan-do-chu',
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
              tieuDe: 'Chưa có giao dịch điểm nào',
              moTa: 'Giao dịch điểm phát sinh khi đơn hàng hoàn thành hoặc khách dùng điểm.',
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
      }

      const oTim = el('input', {
        kieu: 'search',
        thuocTinh: { placeholder: 'Tìm theo tên hoặc số điện thoại khách hàng…' },
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

      const oLoai = el('select', {
        nghe: {
          change: (suKien) => {
            trangThai.loaiGD = suKien.target.value;
            trangThai.page = 1;
            veBang();
          },
        },
      });
      oLoai.append(el('option', { vanBan: 'Tất cả loại giao dịch', thuocTinh: { value: '' } }));
      for (const giaTri of layDanhMuc()?.loaiGiaoDichDiem ?? ['Cộng', 'Trừ', 'Hoàn', 'Thu hồi']) {
        oLoai.append(el('option', { vanBan: giaTri, thuocTinh: { value: giaTri } }));
      }
      thanhCongCu.append(
        el('label', { lop: 'truong truong-ngan' }, [el('span', { vanBan: 'Loại giao dịch' }), oLoai])
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
        })
      );

      const khung = el('div', {}, [thanhCongCu, vungBang]);
      veBang();
      return khung;
    }

    /* ------------------------- TAB 2: THEO KHÁCH HÀNG --------------------- */

    /** Dựng nội dung tab tra cứu điểm theo khách hàng. */
    function dungTabTheoKhachHang() {
      let danhSachKhachHang = [];
      let maKhDangChon = null;

      const vungChon = el('div', { lop: 'cot-loc' });
      const vungKetQua = el('div', {});

      const oKhachHang = el('select', { lop: '', thuocTinh: { style: 'min-width:320px' } });
      oKhachHang.append(el('option', { vanBan: '— Chọn khách hàng —', thuocTinh: { value: '' } }));

      const nutTraCuu = nut({
        nhan: 'Tra cứu điểm',
        bieuTuong: 'tim',
        chinh: true,
        nghe: () => traCuu(),
      });

      vungChon.append(
        el('label', { lop: 'truong', thuocTinh: { style: 'min-width:320px' } }, [
          el('span', { vanBan: 'Khách hàng' }),
          oKhachHang,
        ]),
        nutTraCuu
      );

      /** Nạp danh sách khách hàng để chọn. */
      async function napKhachHang() {
        try {
          const ketQua = await api.doc('/api/khachhang', { pageSize: 100 });
          danhSachKhachHang = Array.isArray(ketQua?.items) ? ketQua.items : [];
          for (const kh of danhSachKhachHang) {
            oKhachHang.append(
              el('option', {
                vanBan: `${kh.hoTen} — ${soDienThoai(kh.sdt)} (${so(kh.diemTichLuy)} điểm)`,
                thuocTinh: { value: String(kh.maKH) },
              })
            );
          }
        } catch (loi) {
          baoLoiApi(loi, 'Không tải được danh sách khách hàng');
        }
      }

      /** Tra cứu điểm hiện tại và lịch sử của khách hàng đã chọn. */
      async function traCuu() {
        const maKH = Number(oKhachHang.value);
        if (!maKH) {
          xoaHet(vungKetQua);
          vungKetQua.append(
            oTrong({
              tieuDe: 'Chưa chọn khách hàng',
              moTa: 'Chọn một khách hàng rồi bấm "Tra cứu điểm" để xem chi tiết.',
              bieuTuong: 'khach-hang',
            })
          );
          return;
        }
        maKhDangChon = maKH;
        xoaHet(vungKetQua);
        vungKetQua.append(el('p', { lop: 'mo-chu nho-chu', vanBan: 'Đang tải dữ liệu điểm…' }));

        try {
          const [hienTai, lichSu] = await Promise.all([
            api.doc(`/api/diem/khachhang/${maKH}/hien-tai`),
            api.doc(`/api/diem/khachhang/${maKH}`, { pageSize: 50 }),
          ]);
          xoaHet(vungKetQua);
          vungKetQua.append(veKetQuaTraCuu(hienTai, lichSu));
        } catch (loi) {
          xoaHet(vungKetQua);
          vungKetQua.append(
            el('p', { lop: 'mo-chu', vanBan: `Không tra cứu được: ${loi?.message ?? 'lỗi không xác định'}` })
          );
        }
      }

      /** Khối kết quả: điểm hiện tại + quy đổi + lịch sử giao dịch. */
      function veKetQuaTraCuu(hienTai, lichSu) {
        const quyDoi = lichSu?.quyDoi ?? layDanhMuc()?.quyDoiDiem ?? QUY_DOI_MAC_DINH;
        const khachHang = danhSachKhachHang.find((kh) => Number(kh.maKH) === Number(hienTai.maKH));

        const khoi = el('div', {}, [
          el('div', { lop: 'luoi-thong-ke' }, [
            theSoLieu({
              nhan: 'Điểm hiện có',
              giaTri: so(hienTai.diemTichLuy),
              phu: 'Điểm có thể dùng ngay',
              sac: 'sac-matcha',
              bieuTuong: 'diem-thuong',
            }),
            theSoLieu({
              nhan: 'Giá trị quy đổi',
              giaTri: tien(Number(hienTai.diemTichLuy) * Number(quyDoi.vndPerPointRedeem)),
              phu: `1 điểm = ${tien(quyDoi.vndPerPointRedeem)}`,
              sac: 'sac-honey',
              bieuTuong: 'tien',
            }),
            theSoLieu({
              nhan: 'Tích điểm',
              giaTri: `${tien(quyDoi.vndPerPoint)} = 1 điểm`,
              phu: 'Áp dụng cho mọi hoá đơn hoàn thành',
              sac: 'sac-steel',
              bieuTuong: 'bao-cao',
            }),
          ]),
          el('div', { lop: 'the', thuocTinh: { style: 'margin-top:16px' } }, [
            el('div', { lop: 'the-dau' }, [
              el('div', {}, [
                el('h2', { vanBan: 'Lịch sử giao dịch điểm' }),
                el('p', {
                  lop: 'ghi-chu',
                  vanBan: khachHang
                    ? `${khachHang.hoTen} · ${soDienThoai(khachHang.sdt)}`
                    : `Khách hàng #${hienTai.maKH}`,
                }),
              ]),
            ]),
            el('div', { lop: 'the-than day' }, [
              lichSu?.items?.length
                ? bangPhu({
                    cot: [
                      { tieuDe: 'Mã GD', lop: 'so', truong: 'maLS' },
                      { tieuDe: 'Đơn hàng', lop: 'so', lay: (dong) => (dong.maDH ? `#${dong.maDH}` : '—') },
                      { tieuDe: 'Loại', dung: (dong) => nhanLoaiGiaoDich(dong.loaiGD) },
                      { tieuDe: 'Số điểm', lop: 'so', lay: (dong) => so(dong.soDiem) },
                      {
                        tieuDe: 'Biến động',
                        lop: 'so',
                        dung: (dong) =>
                          el('span', {
                            vanBan: `${Number(dong.bienDong) >= 0 ? '+' : '−'}${so(Math.abs(dong.bienDong))}`,
                            thuocTinh: {
                              style: `font-family:var(--phong-chu-so);font-weight:600;color:${
                                Number(dong.bienDong) >= 0 ? 'var(--matcha)' : 'var(--chili)'
                              }`,
                            },
                          }),
                      },
                      { tieuDe: 'Ghi chú', truong: 'ghiChu', lop: 'mo' },
                      { tieuDe: 'Thời điểm', lop: 'so', lay: (dong) => ngayGio(dong.ngayGD) },
                    ],
                    duLieu: lichSu.items,
                  })
                : oTrong({
                    tieuDe: 'Khách hàng chưa phát sinh giao dịch điểm',
                    moTa: 'Điểm sẽ được cộng khi đơn hàng chuyển sang trạng thái "Hoàn thành".',
                    bieuTuong: 'diem-thuong',
                  }),
            ]),
          ]),
        ]);
        return khoi;
      }

      napKhachHang();
      xoaHet(vungKetQua);
      vungKetQua.append(
        oTrong({
          tieuDe: 'Chưa chọn khách hàng',
          moTa: 'Chọn một khách hàng rồi bấm "Tra cứu điểm" để xem chi tiết.',
          bieuTuong: 'khach-hang',
        })
      );

      return el('div', {}, [vungChon, el('div', { thuocTinh: { style: 'margin-top:16px' } }, [vungKetQua])]);
    }

    /* -------------------------------- LẮP TAB ------------------------------ */

    const tabs = khuTab([
      { ma: 'toan-he-thong', nhan: 'Lịch sử toàn hệ thống', dung: dungTabToanHeThong },
      { ma: 'theo-khach-hang', nhan: 'Tra cứu theo khách hàng', dung: dungTabTheoKhachHang },
    ]);

    container.append(
      the({
        tieuDe: 'Điểm tích lũy khách hàng',
        ghiChu: 'Quy tắc: 10.000 ₫ chi tiêu = 1 điểm; 1 điểm = 1.000 ₫ khi sử dụng.',
        than: el('div', {}, [tabs.tabEl, tabs.thanEl]),
        lopThan: 'the-than day',
      })
    );

    /* Giữ tham chiếu để tránh cảnh báo biến không dùng khi mở rộng trang. */
    void nhan;
    void truong;
    void thanhCong;
    void vietTat;
    void maKhDangChon;
  },
};

/* `maKhDangChon` chỉ dùng khi cần làm mới sau thao tác; khai báo ở phạm vi mô-đun
   để không tạo biến rác bên trong hàm dựng tab. */
let maKhDangChon = null;
