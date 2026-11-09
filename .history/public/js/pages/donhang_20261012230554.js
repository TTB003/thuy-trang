/**
 * Trang NHÓM 7 — Quản lý đơn hàng (CN7.1 → CN7.5).
 * Đặt hàng, chuyển trạng thái theo đúng luồng, hủy đơn và in hoá đơn.
 */
'use strict';

import { api } from '../api.js';
import { layDanhMuc } from '../store.js';
import { ngayGio, phanTram, so, tien, vietTat } from '../format.js';
import { taoBangMatHang } from '../gio-hang.js';
import {
  bang,
  bangPhu,
  baoLoiApi,
  canhBao,
  dangXuLy,
  el,
  hopThoai,
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

/** Dữ liệu nạp trước cho biểu mẫu đặt hàng. */
const DU_LIEU = { khachHang: [], sanPham: [] };

/** Nạp danh sách khách hàng hoạt động và sản phẩm đang bán. */
async function napDuLieu() {
  const [kh, sp] = await Promise.all([
    api.doc('/api/khachhang', { pageSize: 100, trangThai: 'Hoạt động' }),
    api.doc('/api/sanpham', { pageSize: 100, conHang: 'true' }),
  ]);
  DU_LIEU.khachHang = Array.isArray(kh?.items) ? kh.items : [];
  DU_LIEU.sanPham = Array.isArray(sp?.items) ? sp.items : [];
}

/** Các trạng thái có thể chuyển tới từ trạng thái hiện tại. */
function trangThaiKeTiep(trangThai) {
  const luong = layDanhMuc()?.luongDonHang ?? {};
  return Array.isArray(luong[trangThai]) ? luong[trangThai] : [];
}

/** Màn hình quản lý đơn hàng. */
export const manHinh = {
  ma: 'donhang',
  tieuDe: 'Đơn hàng',
  moTa: 'Tiếp nhận đơn, theo dõi luồng xử lý, hủy đơn và in hoá đơn.',
  bieuTuong: 'don-hang',
  quyen: 'order.view.all',

  async hienThi(container, ctx) {
    await napDuLieu();

    const trangThai = {
      page: Number(ctx.query.page) || 1,
      pageSize: Number(ctx.query.pageSize) || 20,
      q: ctx.query.q ?? '',
      trangThai: ctx.query.trangThai ?? '',
      hinhThuc: ctx.query.hinhThuc ?? '',
      sortBy: ctx.query.sortBy ?? '',
      sortDir: ctx.query.sortDir ?? 'desc',
    };

    const thanhCongCu = el('div', { lop: 'thanh-cong-cu' });
    const vungBang = el('div', {});
    const vungThongKe = el('div', { lop: 'luoi-thong-ke', thuocTinh: { style: 'margin-bottom:16px' } });

    /** Gọi API danh sách đơn hàng theo trạng thái hiện tại. */
    async function taiDuLieu() {
      const ketQua = await api.doc('/api/donhang', {
        page: trangThai.page,
        pageSize: trangThai.pageSize,
        q: trangThai.q,
        trangThai: trangThai.trangThai,
        hinhThuc: trangThai.hinhThuc,
        sortBy: trangThai.sortBy,
        sortDir: trangThai.sortDir,
      });
      return {
        items: Array.isArray(ketQua?.items) ? ketQua.items : [],
        phan: ketQua?.pagination ?? { page: 1, pageSize: trangThai.pageSize, total: 0, totalPages: 1 },
      };
    }

    /** Vẽ các thẻ số liệu tóm tắt tình hình đơn hàng. */
    async function veThongKe() {
      xoaHet(vungThongKe);
      try {
        const thongKe = await api.doc('/api/baocao/dashboard');
        const theoTrangThai = new Map(
          (thongKe.donHangTheoTrangThai ?? []).map((muc) => [muc.trangThai, muc])
        );
        const choXuLy = theoTrangThai.get('Chờ xử lý');
        const dangGiao = theoTrangThai.get('Đang giao');
        vungThongKe.append(
          theSoLieu({
            nhan: 'Tổng số đơn hàng',
            giaTri: so(thongKe.tongDonHang),
            bieuTuong: 'don-hang',
          }),
          theSoLieu({
            nhan: 'Đơn chờ xử lý',
            giaTri: so(choXuLy?.soDon ?? 0),
            sac: 'sac-honey',
            bieuTuong: 'gio',
          }),
          theSoLieu({
            nhan: 'Đang giao',
            giaTri: so(dangGiao?.soDon ?? 0),
            sac: 'sac-steel',
            bieuTuong: 'van-chuyen',
          }),
          theSoLieu({
            nhan: 'Doanh thu hôm nay',
            giaTri: tien(thongKe.doanhThuHomNay),
            sac: 'sac-matcha',
            bieuTuong: 'tien',
          })
        );
      } catch {
        // Bỏ qua nếu chưa tải được số liệu tổng quan.
      }
    }

    /** Vẽ bảng đơn hàng và thanh phân trang. */
    async function veBang() {
      xoaHet(vungBang);
      const { items, phan } = await taiDuLieu();

      vungBang.append(
        bang({
          cot: [
            { tieuDe: 'Mã đơn', truong: 'maDH', lop: 'so' },
            { tieuDe: 'Khách hàng', truong: 'tenKhachHang', lop: 'manh' },
            { tieuDe: 'Nhân viên', truong: 'tenNhanVien', lop: 'mo' },
            { tieuDe: 'Ngày đặt', lop: 'so', lay: (ban) => ngayGio(ban.ngayDat) },
            { tieuDe: 'Hình thức', truong: 'hinhThuc' },
            { tieuDe: 'Số món', lop: 'so', lay: (ban) => so(ban.soMatHang) },
            { tieuDe: 'Tiền hàng', lop: 'so', lay: (ban) => tien(ban.tienHang) },
            {
              tieuDe: 'Giảm từ điểm',
              lop: 'so',
              lay: (ban) =>
                Number(ban.diemSuDung) > 0
                  ? `${so(ban.diemSuDung)} điểm · ${tien(ban.tienGiamDiem)}`
                  : '—',
            },
            { tieuDe: 'Thành tiền', lop: 'so', lay: (ban) => tien(ban.tongTien) },
            { tieuDe: 'Trạng thái', dung: (ban) => nhan(ban.trangThai) },
            {
              tieuDe: 'Thao tác',
              lop: 'cot-thao-tac',
              dung: (ban) =>
                el('div', { lop: 'gon', thuocTinh: { style: 'justify-content:flex-end' } }, [
                  trangThaiKeTiep(ban.trangThai).length
                    ? nut({
                        nhan: 'Chuyển trạng thái',
                        bieuTuong: 'phai',
                        nho: true,
                        chinh: true,
                        nghe: () => moChuyenTrangThai(ban),
                      })
                    : null,
                  nut({
                    nhan: 'Chi tiết',
                    bieuTuong: 'ho-so',
                    nho: true,
                    nghe: () => moChiTiet(ban),
                  }),
                ]),
            },
          ],
          duLieu: items,
          khiRong: oTrong({
            tieuDe: 'Chưa có đơn hàng nào',
            moTa: 'Hãy tạo đơn hàng đầu tiên hoặc điều chỉnh bộ lọc.',
            bieuTuong: 'don-hang',
          }),
          sapXep: {
            truong: trangThai.sortBy,
            chieu: trangThai.sortDir,
            khiDoi: (ten) => {
              if (trangThai.sortBy === ten) {
                trangThai.sortDir = trangThai.sortDir === 'asc' ? 'desc' : 'asc';
              } else {
                trangThai.sortBy = ten;
                trangThai.sortDir = 'asc';
              }
              veBang();
            },
          },
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

    /** Hộp thoại tạo đơn hàng mới (CN7.1). */
    function moTaoDon() {
      const oKhachHang = truong({
        ten: 'maKH',
        nhan: 'Khách hàng',
        loai: 'select',
        batBuoc: true,
        tuyChon: {
          muc: DU_LIEU.khachHang.map((kh) => ({
            giaTri: kh.maKH,
            nhan: `${kh.hoTen} — ${kh.sdt ?? ''} (${so(kh.diemTichLuy)} điểm)`,
          })),
          mucRong: '— Chọn khách hàng —',
        },
      });

      const oHinhThuc = truong({
        ten: 'hinhThuc',
        nhan: 'Hình thức',
        loai: 'select',
        batBuoc: true,
        giaTri: 'Tại quán',
        tuyChon: { muc: layDanhMuc()?.hinhThucDonHang ?? ['Tại quán', 'Giao hàng'] },
      });

      const oDiem = truong({
        ten: 'diemSuDung',
        nhan: 'Điểm sử dụng',
        loai: 'number',
        giaTri: 0,
        goiY: 'Quy đổi 1 điểm = 1.000 ₫. Kiểm tra lại bằng nút "Kiểm tra tiền".',
        thuocTinh: { min: 0, step: 1 },
      });

      const oGhiChu = truong({
        ten: 'ghiChu',
        nhan: 'Ghi chú',
        loai: 'textarea',
        rong: true,
        thuocTinh: { maxlength: 255 },
      });

      const bangMatHang = taoBangMatHang({
        danhSachSanPham: DU_LIEU.sanPham,
        hienDonGia: false,
      });

      const vungTamTinh = el('div', { lop: 'bang-tong' }, [
        el('div', { lop: 'dong-tong' }, [
          el('span', { vanBan: 'Tạm tính' }),
          el('span', { lop: 'so', vanBan: tien(0) }),
        ]),
      ]);

      const bieuMau = el('form', { thuocTinh: { novalidate: true } }, [
        el('div', { lop: 'luoi-hai-cot' }, [oKhachHang, oHinhThuc]),
        el('div', { lop: 'luoi-hai-cot', thuocTinh: { style: 'margin-top:12px' } }, [oDiem, oGhiChu]),
        el('div', { thuocTinh: { style: 'margin-top:16px' } }, [
          el('p', { lop: 'mo-chu nho-chu', thuocTinh: { style: 'margin-bottom:8px' } }, [
            'Các món trong đơn',
          ]),
          bangMatHang.el,
        ]),
      ]);

      const nutKiemTra = nut({
        nhan: 'Kiểm tra tiền',
        bieuTuong: 'tien',
        nghe: () => kiemTraTien(),
      });

      const nutLuu = nut({
        nhan: 'Tạo đơn hàng',
        bieuTuong: 'tick',
        chinh: true,
        nghe: () => gui(),
      });

      const hop = hopThoai({
        tieuDe: 'Tạo đơn hàng mới',
        moTa: 'Giá bán đã tự động trừ khuyến mãi còn hiệu lực.',
        than: bieuMau,
        nutChan: [
          nut({ nhan: 'Hủy bỏ', lop: 'nut-trong', nghe: () => hop.dong() }),
          nutKiemTra,
          nutLuu,
        ],
        rong: true,
      });

      /** Đọc dữ liệu biểu mẫu thành payload gửi máy chủ. */
      function layDuLieu() {
        return {
          maKH: Number(oKhachHang.querySelector('select').value) || null,
          hinhThuc: oHinhThuc.querySelector('select').value,
          diemSuDung: Number(oDiem.querySelector('input').value) || 0,
          ghiChu: oGhiChu.querySelector('textarea').value.trim() || null,
          chiTiet: bangMatHang.layChiTiet().map((dong) => ({
            maSP: dong.maSP,
            soLuong: dong.soLuong,
          })),
        };
      }

      /** Gọi API tính tiền để xem trước tổng tiền và tiền giảm. */
      async function kiemTraTien() {
        const duLieu = layDuLieu();
        if (duLieu.chiTiet.length === 0) {
          canhBao('Chưa có món', 'Vui lòng chọn ít nhất một sản phẩm.');
          return;
        }
        dangXuLy(nutKiemTra, true);
        try {
          const ketQua = await api.post('/api/donhang/tinh-tien', {
            chiTiet: duLieu.chiTiet,
            diemSuDung: duLieu.diemSuDung,
            maKH: duLieu.maKH,
          });
          xoaHet(vungTamTinh);
          const dong = [
            ['Tiền hàng', tien(ketQua.tienHang)],
            [
              `Giảm từ ${so(ketQua.diemSuDung ?? duLieu.diemSuDung)} điểm`,
              `− ${tien(ketQua.tienGiamDiem ?? 0)}`,
            ],
          ];
          for (const [nhanDong, giaTriDong] of dong) {
            vungTamTinh.append(
              el('div', { lop: 'dong-tong' }, [
                el('span', { vanBan: nhanDong }),
                el('span', { lop: 'so', vanBan: giaTriDong }),
              ])
            );
          }
          vungTamTinh.append(
            el('div', { lop: 'dong-tong tong-cuoi' }, [
              el('span', { vanBan: 'Khách phải trả' }),
              el('span', { lop: 'so', vanBan: tien(ketQua.tongTien) }),
            ])
          );
        } catch (loi) {
          baoLoiApi(loi, 'Không tính được tiền đơn hàng');
        } finally {
          dangXuLy(nutKiemTra, false);
        }
      }

      /** Gửi yêu cầu tạo đơn hàng. */
      async function gui() {
        const duLieu = layDuLieu();
        if (!duLieu.maKH) {
          canhBao('Thiếu thông tin', 'Vui lòng chọn khách hàng.');
          return;
        }
        if (duLieu.chiTiet.length === 0) {
          canhBao('Chưa có món', 'Vui lòng chọn ít nhất một sản phẩm.');
          return;
        }
        if (duLieu.chiTiet.some((dong) => !dong.soLuong || dong.soLuong <= 0)) {
          canhBao('Số lượng chưa hợp lệ', 'Mỗi món phải có số lượng lớn hơn 0.');
          return;
        }

        dangXuLy(nutLuu, true);
        try {
          const ketQua = await api.post('/api/donhang', duLieu);
          thanhCong(
            `Đã tạo đơn hàng #${ketQua?.maDH ?? ''}`,
            `Khách phải trả: ${tien(ketQua?.tongTien ?? 0)}`
          );
          hop.dong();
          await veBang();
        } catch (loi) {
          baoLoiApi(loi);
        } finally {
          dangXuLy(nutLuu, false);
        }
      }

      bieuMau.addEventListener('submit', (suKien) => {
        suKien.preventDefault();
        gui();
      });
    }

    /** Hộp thoại chuyển trạng thái đơn theo đúng luồng (CN7.2). */
    function moChuyenTrangThai(ban) {
      const choPhep = trangThaiKeTiep(ban.trangThai);
      const nutTheoTrangThai = choPhep.map((trangThaiMoi) =>
        nut({
          nhan: `→ ${trangThaiMoi}`,
          bieuTuong: trangThaiMoi === 'Đã hủy' ? 'xoa' : 'tick',
          nguyHiem: trangThaiMoi === 'Đã hủy',
          chinh: trangThaiMoi !== 'Đã hủy',
          nghe: () => doiTrangThai(ban, trangThaiMoi),
        })
      );

      const hop = hopThoai({
        tieuDe: `Chuyển trạng thái đơn #${ban.maDH}`,
        moTa: `${ban.tenKhachHang} · ${tien(ban.tongTien)}`,
        than: el('div', {}, [
          moTaCot([
            { nhan: 'Trạng thái hiện tại', node: nhan(ban.trangThai) },
            { nhan: 'Ngày đặt', giaTri: ngayGio(ban.ngayDat), so: true },
            { nhan: 'Số món', giaTri: so(ban.soMatHang), so: true },
          ]),
          el('p', {
            lop: 'mo-chu nho-chu',
            vanBan:
              'Hệ thống chỉ cho phép chuyển theo đúng luồng nghiệp vụ. Khi đơn "Hoàn thành", điểm tích lũy sẽ tự động được cộng cho khách hàng.',
            thuocTinh: { style: 'margin-top:14px' },
          }),
          el('div', { lop: 'nhom-nut', thuocTinh: { style: 'margin-top:12px' } }, nutTheoTrangThai),
        ]),
        nutChan: [nut({ nhan: 'Đóng', lop: 'nut-trong', nghe: () => hop.dong() })],
        rong: true,
      });

      /** Thực hiện đổi trạng thái sau khi xác nhận. */
      async function doiTrangThai(don, trangThaiMoi) {
        const laHuy = trangThaiMoi === 'Đã hủy';
        const dongY = await xacNhan({
          tieuDe: `Xác nhận ${laHuy ? 'hủy đơn' : 'chuyển trạng thái'}`,
          noiDung: laHuy
            ? `Hủy đơn #${don.maDH} sẽ hoàn lại tồn kho và hoàn/thu hồi điểm liên quan.`
            : `Chuyển đơn #${don.maDH} từ "${don.trangThai}" sang "${trangThaiMoi}"?`,
          nhanDongY: laHuy ? 'Hủy đơn hàng' : 'Xác nhận chuyển',
          nguyHiem: laHuy,
        });
        if (!dongY) return;

        try {
          const ketQua = await api.patch(`/api/donhang/${don.maDH}/trang-thai`, {
            trangThai: trangThaiMoi,
          });
          const diemCong = ketQua?.ketQuaDiem?.soDiem;
          thanhCong(
            'Đã cập nhật đơn hàng',
            diemCong ? `Đã cộng ${so(diemCong)} điểm tích lũy cho khách hàng.` : null
          );
          hop.dong();
          await veBang();
        } catch (loi) {
          baoLoiApi(loi, 'Không đổi được trạng thái');
        }
      }
    }

    /** Xem chi tiết hoá đơn của một đơn hàng (CN7.5). */
    async function moChiTiet(ban) {
      let chiTiet;
      try {
        chiTiet = await api.doc(`/api/donhang/${ban.maDH}`);
      } catch (loi) {
        baoLoiApi(loi, 'Không tải được chi tiết đơn hàng');
        return;
      }

      const than = el('div', {}, [
        moTaCot([
          { nhan: 'Khách hàng', giaTri: chiTiet.tenKhachHang },
          { nhan: 'Số điện thoại', giaTri: chiTiet.sdtKhachHang, so: true },
          { nhan: 'Nhân viên lập', giaTri: chiTiet.tenNhanVien ?? 'Khách tự đặt' },
          { nhan: 'Ngày đặt', giaTri: ngayGio(chiTiet.ngayDat), so: true },
          { nhan: 'Hình thức', giaTri: chiTiet.hinhThuc },
          { nhan: 'Trạng thái', node: nhan(chiTiet.trangThai) },
          { nhan: 'Ghi chú', giaTri: chiTiet.ghiChu },
          { nhan: 'Lý do hủy', giaTri: chiTiet.lyDoHuy },
        ]),
        el('h3', {
          vanBan: `Chi tiết món (${chiTiet.chiTiet?.length ?? 0})`,
          thuocTinh: { style: 'margin-top:20px;font-size:14px' },
        }),
        el('div', { thuocTinh: { style: 'margin-top:10px' } }, [
          bangPhu({
            cot: [
              { tieuDe: 'Mã', lop: 'so', truong: 'maSP' },
              { tieuDe: 'Sản phẩm', truong: 'tenSP' },
              { tieuDe: 'Loại', truong: 'tenLoai', lop: 'mo' },
              { tieuDe: 'Số lượng', lop: 'so', lay: (dong) => so(dong.soLuong) },
              { tieuDe: 'Đơn giá', lop: 'so', lay: (dong) => tien(dong.donGia) },
              { tieuDe: 'Thành tiền', lop: 'so', lay: (dong) => tien(dong.thanhTien) },
            ],
            duLieu: chiTiet.chiTiet ?? [],
            chanBang: [
              { giaTri: 'Tổng cộng' },
              { giaTri: '' },
              { giaTri: '' },
              { giaTri: '' },
              { giaTri: tien(chiTiet.tienHang), lop: 'so' },
              { giaTri: tien(chiTiet.tongTien), lop: 'so' },
            ],
          }),
        ]),
        el('div', { lop: 'bang-tong', thuocTinh: { style: 'margin-top:14px' } }, [
          el('div', { lop: 'dong-tong' }, [
            el('span', { vanBan: 'Tiền hàng' }),
            el('span', { lop: 'so', vanBan: tien(chiTiet.tienHang) }),
          ]),
          el('div', { lop: 'dong-tong' }, [
            el('span', {
              vanBan: `Giảm từ điểm (${so(chiTiet.diemSuDung)} điểm × 1.000 ₫)`,
            }),
            el('span', { lop: 'so', vanBan: `− ${tien(chiTiet.tienGiamDiem)}` }),
          ]),
          el('div', { lop: 'dong-tong tong-cuoi' }, [
            el('span', { vanBan: 'Khách phải trả' }),
            el('span', { lop: 'so', vanBan: tien(chiTiet.tongTien) }),
          ]),
        ]),
        chiTiet.lichSuDiem?.length
          ? el('div', { thuocTinh: { style: 'margin-top:20px' } }, [
              el('h3', { vanBan: 'Giao dịch điểm phát sinh', thuocTinh: { style: 'font-size:14px;margin-bottom:10px' } }),
              bangPhu({
                cot: [
                  { tieuDe: 'Ngày', lop: 'so', lay: (dong) => ngayGio(dong.ngayGD) },
                  { tieuDe: 'Loại', truong: 'loaiGD' },
                  { tieuDe: 'Số điểm', lop: 'so', lay: (dong) => so(dong.soDiem) },
                  { tieuDe: 'Ghi chú', truong: 'ghiChu', lop: 'mo' },
                ],
                duLieu: chiTiet.lichSuDiem,
              }),
            ])
          : null,
      ]);

      hopThoai({
        tieuDe: `Hoá đơn đơn hàng #${chiTiet.maDH}`,
        moTa: `${chiTiet.tenKhachHang} · ${ngayGio(chiTiet.ngayDat)}`,
        than,
        rong: true,
        nutChan: [nut({ nhan: 'Đóng', lop: 'nut-trong', nghe: () => hop.dong() })],
      });
    }

    /* ----------------------------- THANH CÔNG CỤ ---------------------------- */

    const oTim = el('input', {
      kieu: 'search',
      thuocTinh: { placeholder: 'Tìm theo tên khách hàng, số điện thoại hoặc mã đơn…' },
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
    for (const giaTri of layDanhMuc()?.trangThaiDonHang ?? []) {
      oTrangThaiLoc.append(el('option', { vanBan: giaTri, thuocTinh: { value: giaTri } }));
    }
    thanhCongCu.append(
      el('label', { lop: 'truong truong-ngan' }, [
        el('span', { vanBan: 'Trạng thái' }),
        oTrangThaiLoc,
      ])
    );

    const oHinhThucLoc = el('select', {
      nghe: {
        change: (suKien) => {
          trangThai.hinhThuc = suKien.target.value;
          trangThai.page = 1;
          veBang();
        },
      },
    });
    oHinhThucLoc.append(el('option', { vanBan: 'Tất cả hình thức', thuocTinh: { value: '' } }));
    for (const giaTri of layDanhMuc()?.hinhThucDonHang ?? []) {
      oHinhThucLoc.append(el('option', { vanBan: giaTri, thuocTinh: { value: giaTri } }));
    }
    thanhCongCu.append(
      el('label', { lop: 'truong truong-ngan' }, [
        el('span', { vanBan: 'Hình thức' }),
        oHinhThucLoc,
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
        nhan: 'Tạo đơn hàng',
        bieuTuong: 'them',
        chinh: true,
        nghe: () => moTaoDon(),
      })
    );

    container.append(
      vungThongKe,
      the({
        tieuDe: 'Danh sách đơn hàng',
        ghiChu: 'Đơn hàng chỉ được chuyển trạng thái theo đúng luồng nghiệp vụ.',
        than: el('div', {}, [thanhCongCu, vungBang]),
        lopThan: 'the-than day',
      })
    );

    await veThongKe();
    await veBang();
  },
};

/** Hiển thị tỉ lệ phần trăm dùng cho báo cáo tổng quan của trang. */
export const dinhDangTiLe = phanTram;
/** Cắt ngắn tên khách hàng dài trong các thẻ tóm tắt. */
export const rutGonTen = vietTat;
