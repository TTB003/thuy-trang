/**
 * Trang NHÓM 6 — Quản lý nhập hàng (CN6.1 → CN6.5).
 * Lập phiếu, duyệt nhập kho, hủy phiếu và xem chi tiết để in.
 */
'use strict';

import { api } from '../api.js';
import { ngay, ngayGio, so, tien, vietTat } from '../format.js';
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
  xacNhan,
  xoaHet,
} from '../ui.js';

/** Trạng thái phiếu nhập — khớp TRANG_THAI_PNH ở máy chủ. */
const TRANG_THAI_PHIEU = ['Chờ duyệt', 'Hoàn thành', 'Đã hủy'];

/** Dữ liệu dùng chung nạp trước cho biểu mẫu. */
const DU_LIEU = { nhaCungCap: [], sanPham: [] };

/** Nạp danh sách nhà cung cấp đang hợp tác và toàn bộ sản phẩm. */
async function napDuLieu() {
  const [ncc, sp] = await Promise.all([
    api.doc('/api/nhacungcap/dang-hop-tac'),
    api.doc('/api/sanpham', { pageSize: 100 }),
  ]);
  DU_LIEU.nhaCungCap = Array.isArray(ncc) ? ncc : (ncc?.items ?? []);
  DU_LIEU.sanPham = Array.isArray(sp?.items) ? sp.items : [];
}

/** Màn hình quản lý phiếu nhập hàng. */
export const manHinh = {
  ma: 'phieunhap',
  tieuDe: 'Phiếu nhập hàng',
  moTa: 'Lập phiếu nhập nguyên liệu từ nhà cung cấp, duyệt nhập kho và hủy phiếu.',
  bieuTuong: 'phieu-nhap',
  quyen: 'purchase.view',

  async hienThi(container, ctx) {
    await napDuLieu();

    const trangThai = {
      page: Number(ctx.query.page) || 1,
      pageSize: Number(ctx.query.pageSize) || 20,
      q: ctx.query.q ?? '',
      maNCC: ctx.query.maNCC ?? '',
      trangThai: ctx.query.trangThai ?? '',
    };

    const thanhCongCu = el('div', { lop: 'thanh-cong-cu' });
    const vungBang = el('div', {});
    const vungThongKe = el('div', { lop: 'luoi-thong-ke', thuocTinh: { style: 'margin-bottom:16px' } });

    /** Gọi API danh sách theo trạng thái hiện tại. */
    async function taiDuLieu() {
      const ketQua = await api.doc('/api/phieunhap', {
        page: trangThai.page,
        pageSize: trangThai.pageSize,
        q: trangThai.q,
        maNCC: trangThai.maNCC,
        trangThai: trangThai.trangThai,
      });
      return {
        items: Array.isArray(ketQua?.items) ? ketQua.items : [],
        phan: ketQua?.pagination ?? { page: 1, pageSize: trangThai.pageSize, total: 0, totalPages: 1 },
      };
    }

    /** Vẽ ba thẻ số liệu tổng quan của trang. */
    async function veThongKe() {
      xoaHet(vungThongKe);
      try {
        const thongKe = await api.doc('/api/baocao/nhap-hang');
        const tongQuan = thongKe.tongQuan ?? {};
        const theoNhaCungCap = thongKe.theoNhaCungCap ?? [];
        vungThongKe.append(
          theSoLieu({
            nhan: 'Tổng chi phí nhập hàng',
            giaTri: tien(tongQuan.tongChiPhi ?? 0),
            phu: `${so(tongQuan.tongPhieu ?? 0)} phiếu đã hoàn thành`,
            bieuTuong: 'tien',
          }),
          theSoLieu({
            nhan: 'Số nhà cung cấp đã nhập',
            giaTri: so(theoNhaCungCap.length),
            sac: 'sac-steel',
            bieuTuong: 'nha-cung-cap',
          }),
          theSoLieu({
            nhan: 'Nhà cung cấp lớn nhất',
            giaTri: vietTat(theoNhaCungCap[0]?.tenNCC ?? '—', 22),
            phu: theoNhaCungCap[0] ? tien(theoNhaCungCap[0].tongChiPhi) : null,
            sac: 'sac-matcha',
            bieuTuong: 'bao-cao',
          })
        );
      } catch {
        // Không hiển thị thẻ số liệu nếu máy chủ không trả dữ liệu báo cáo.
      }
    }

    /** Vẽ bảng phiếu nhập và thanh phân trang. */
    async function veBang() {
      xoaHet(vungBang);
      const { items, phan } = await taiDuLieu();

      vungBang.append(
        bang({
          cot: [
            { tieuDe: 'Mã phiếu', truong: 'maPNH', lop: 'so' },
            { tieuDe: 'Nhà cung cấp', truong: 'tenNCC', lop: 'manh' },
            { tieuDe: 'Nhân viên lập', truong: 'tenNhanVien', lop: 'mo' },
            { tieuDe: 'Ngày nhập', lop: 'so', lay: (ban) => ngayGio(ban.ngayNhap) },
            { tieuDe: 'Số mặt hàng', lop: 'so', lay: (ban) => so(ban.soMatHang) },
            { tieuDe: 'Tổng số lượng', lop: 'so', lay: (ban) => so(ban.tongSoLuong) },
            { tieuDe: 'Tổng tiền', lop: 'so', lay: (ban) => tien(ban.tongTien) },
            {
              tieuDe: 'Trạng thái',
              dung: (ban) => nhan(ban.trangThai),
            },
            {
              tieuDe: 'Thao tác',
              lop: 'cot-thao-tac',
              dung: (ban) =>
                el('div', { lop: 'gon', thuocTinh: { style: 'justify-content:flex-end' } }, [
                  ban.trangThai === 'Chờ duyệt'
                    ? nut({
                        nhan: 'Duyệt',
                        bieuTuong: 'tick',
                        nho: true,
                        chinh: true,
                        nghe: () => duyetPhieu(ban),
                      })
                    : null,
                  ban.trangThai !== 'Đã hủy'
                    ? nut({
                        nhan: 'Sửa',
                        bieuTuong: 'sua',
                        nho: true,
                        nghe: () => moBieuMau('sua', ban),
                      })
                    : null,
                  ban.trangThai !== 'Đã hủy'
                    ? nut({
                        nhan: 'Hủy phiếu',
                        bieuTuong: 'xoa',
                        nho: true,
                        nguyHiem: true,
                        nghe: () => huyPhieu(ban),
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
            tieuDe: 'Chưa có phiếu nhập nào',
            moTa: 'Hãy lập phiếu nhập đầu tiên hoặc điều chỉnh bộ lọc.',
            bieuTuong: 'phieu-nhap',
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

    /** Hộp thoại lập hoặc sửa phiếu nhập (kèm bảng mặt hàng). */
    function moBieuMau(cheDo, ban = null) {
      const oNhaCungCap = truong({
        ten: 'maNCC',
        nhan: 'Nhà cung cấp',
        loai: 'select',
        batBuoc: true,
        giaTri: ban?.maNCC ?? '',
        tuyChon: {
          muc: DU_LIEU.nhaCungCap.map((ncc) => ({
            giaTri: ncc.maNCC,
            nhan: `${ncc.tenNCC}${ncc.sdt ? ` — ${ncc.sdt}` : ''}`,
          })),
          mucRong: '— Chọn nhà cung cấp —',
        },
      });

      const oTrangThai = truong({
        ten: 'trangThai',
        nhan: 'Trạng thái phiếu',
        loai: 'select',
        giaTri: ban?.trangThai ?? 'Chờ duyệt',
        tuyChon: { muc: ['Chờ duyệt', 'Hoàn thành'] },
        goiY: '"Hoàn thành" sẽ cộng ngay số lượng vào tồn kho.',
      });

      const bangMatHang = taoBangMatHang({
        danhSachSanPham: DU_LIEU.sanPham,
        hienDonGia: true,
        giaTriBanDau: (ban?.chiTiet ?? []).map((dong) => ({
          maSP: dong.maSP,
          soLuong: dong.soLuong,
          donGia: dong.donGia,
        })),
      });

      const bieuMau = el('form', { thuocTinh: { novalidate: true } }, [
        el('div', { lop: 'luoi-hai-cot' }, [oNhaCungCap, oTrangThai]),
        el('div', { thuocTinh: { style: 'margin-top:16px' } }, [
          el('p', { lop: 'mo-chu nho-chu', thuocTinh: { style: 'margin-bottom:8px' } }, [
            'Danh sách mặt hàng nhập',
          ]),
          bangMatHang.el,
        ]),
      ]);

      const nutLuu = nut({
        nhan: cheDo === 'tao' ? 'Lập phiếu nhập' : 'Lưu thay đổi',
        bieuTuong: 'tick',
        chinh: true,
        nghe: () => gui(),
      });

      const hop = hopThoai({
        tieuDe: cheDo === 'tao' ? 'Lập phiếu nhập hàng' : `Sửa phiếu nhập #${ban?.maPNH}`,
        moTa:
          cheDo === 'tao'
            ? 'Chọn nhà cung cấp và các mặt hàng nhập kho.'
            : 'Số lượng tồn kho sẽ được điều chỉnh lại tương ứng.',
        than: bieuMau,
        nutChan: [nut({ nhan: 'Hủy bỏ', lop: 'nut-trong', nghe: () => hop.dong() }), nutLuu],
        rong: true,
      });

      /** Gửi phiếu nhập lên máy chủ. */
      async function gui() {
        const maNCC = Number(oNhaCungCap.querySelector('select').value);
        if (!maNCC) {
          canhBao('Thiếu thông tin', 'Vui lòng chọn nhà cung cấp.');
          return;
        }
        const chiTiet = bangMatHang.layChiTiet();
        if (chiTiet.length === 0) {
          canhBao('Chưa có mặt hàng', 'Vui lòng chọn ít nhất một mặt hàng để nhập.');
          return;
        }
        const thieuSoLuong = chiTiet.some((dong) => !dong.soLuong || dong.soLuong <= 0);
        if (thieuSoLuong) {
          canhBao('Số lượng chưa hợp lệ', 'Mỗi mặt hàng phải có số lượng lớn hơn 0.');
          return;
        }

        const duLieu = {
          maNCC,
          chiTiet,
          trangThai: oTrangThai.querySelector('select').value,
        };

        dangXuLy(nutLuu, true);
        try {
          if (cheDo === 'tao') {
            await api.post('/api/phieunhap', duLieu);
            thanhCong('Đã lập phiếu nhập', `Tổng tiền: ${tien(bangMatHang.tongTien())}`);
          } else {
            await api.put(`/api/phieunhap/${ban.maPNH}`, { chiTiet });
            thanhCong('Đã lưu phiếu nhập');
          }
          hop.dong();
          await veBang();
          await veThongKe();
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

    /** Duyệt phiếu nhập đang chờ (CN6.4). */
    async function duyetPhieu(ban) {
      const dongY = await xacNhan({
        tieuDe: 'Duyệt phiếu nhập',
        noiDung: `Duyệt phiếu #${ban.maPNH} sẽ cộng ${so(ban.tongSoLuong)} đơn vị vào tồn kho. Tiếp tục?`,
        nhanDongY: 'Duyệt và nhập kho',
      });
      if (!dongY) return;
      try {
        await api.post(`/api/phieunhap/${ban.maPNH}/duyet`, {});
        thanhCong('Đã duyệt phiếu nhập', 'Tồn kho đã được cập nhật.');
        await veBang();
      } catch (loi) {
        baoLoiApi(loi, 'Không duyệt được phiếu');
      }
    }

    /** Hủy phiếu nhập kèm lý do (CN6.3). */
    function huyPhieu(ban) {
      const oLyDo = truong({
        ten: 'lyDo',
        nhan: 'Lý do hủy phiếu',
        loai: 'textarea',
        batBuoc: true,
        goiY:
          ban.trangThai === 'Hoàn thành'
            ? 'Phiếu đã nhập kho nên khi hủy hệ thống sẽ trừ lại tồn kho tương ứng.'
            : 'Phiếu chưa nhập kho nên chỉ đổi trạng thái.',
        thuocTinh: { maxlength: 255 },
      });

      const nutHuy = nut({
        nhan: 'Hủy phiếu nhập',
        bieuTuong: 'xoa',
        nguyHiem: true,
        nghe: () => gui(),
      });

      const hop = hopThoai({
        tieuDe: `Hủy phiếu nhập #${ban.maPNH}`,
        moTa: `${ban.tenNCC} · ${tien(ban.tongTien)}`,
        than: el('form', { thuocTinh: { novalidate: true } }, [
          moTaCot([
            { nhan: 'Ngày nhập', giaTri: ngayGio(ban.ngayNhap), so: true },
            { nhan: 'Trạng thái hiện tại', node: nhan(ban.trangThai) },
            { nhan: 'Số mặt hàng', giaTri: so(ban.soMatHang), so: true },
          ]),
          el('div', { thuocTinh: { style: 'margin-top:16px' } }, [oLyDo]),
        ]),
        nutChan: [nut({ nhan: 'Đóng', lop: 'nut-trong', nghe: () => hop.dong() }), nutHuy],
        rong: true,
      });

      async function gui() {
        const lyDo = oLyDo.querySelector('textarea').value.trim();
        if (!lyDo) {
          canhBao('Thiếu lý do', 'Vui lòng nhập lý do hủy phiếu.');
          return;
        }
        dangXuLy(nutHuy, true);
        try {
          await api.post(`/api/phieunhap/${ban.maPNH}/huy`, { lyDo });
          thanhCong('Đã hủy phiếu nhập');
          hop.dong();
          await veBang();
          await veThongKe();
        } catch (loi) {
          baoLoiApi(loi, 'Không hủy được phiếu');
        } finally {
          dangXuLy(nutHuy, false);
        }
      }
    }

    /** Xem chi tiết phiếu nhập (đủ dữ liệu để in) — CN6.5. */
    async function moChiTiet(ban) {
      let chiTiet;
      try {
        chiTiet = await api.doc(`/api/phieunhap/${ban.maPNH}`);
      } catch (loi) {
        baoLoiApi(loi, 'Không tải được chi tiết phiếu');
        return;
      }

      const than = el('div', {}, [
        moTaCot([
          { nhan: 'Nhà cung cấp', giaTri: chiTiet.tenNCC },
          { nhan: 'Nhân viên lập phiếu', giaTri: chiTiet.tenNhanVien },
          { nhan: 'Ngày nhập', giaTri: ngayGio(chiTiet.ngayNhap), so: true },
          { nhan: 'Trạng thái', node: nhan(chiTiet.trangThai) },
          {
            nhan: 'Lý do hủy',
            giaTri: chiTiet.lyDoHuy,
          },
          { nhan: 'Tổng số lượng', giaTri: so(chiTiet.tongSoLuong), so: true },
          { nhan: 'Tổng tiền', giaTri: tien(chiTiet.tongTien), so: true },
        ]),
        el('h3', {
          vanBan: `Chi tiết mặt hàng (${chiTiet.chiTiet?.length ?? 0})`,
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
              { giaTri: so(chiTiet.tongSoLuong), lop: 'so' },
              { giaTri: '' },
              { giaTri: tien(chiTiet.tongTien), lop: 'so' },
            ],
          }),
        ]),
      ]);

      hopThoai({
        tieuDe: `Phiếu nhập #${chiTiet.maPNH}`,
        moTa: `${chiTiet.tenNCC} · ${ngay(chiTiet.ngayNhap)}`,
        than,
        rong: true,
        nutChan: [nut({ nhan: 'Đóng', lop: 'nut-trong', nghe: () => hop.dong() })],
      });
    }

    /* ----------------------------- THANH CÔNG CỤ ---------------------------- */

    const oTim = el('input', {
      kieu: 'search',
      thuocTinh: { placeholder: 'Tìm theo nhà cung cấp hoặc mã phiếu…' },
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

    const oNhaCungCapLoc = el('select', {
      nghe: {
        change: (suKien) => {
          trangThai.maNCC = suKien.target.value;
          trangThai.page = 1;
          veBang();
        },
      },
    });
    oNhaCungCapLoc.append(el('option', { vanBan: 'Tất cả nhà cung cấp', thuocTinh: { value: '' } }));
    for (const ncc of DU_LIEU.nhaCungCap) {
      oNhaCungCapLoc.append(
        el('option', { vanBan: ncc.tenNCC, thuocTinh: { value: String(ncc.maNCC) } })
      );
    }
    thanhCongCu.append(
      el('label', { lop: 'truong truong-ngan' }, [
        el('span', { vanBan: 'Nhà cung cấp' }),
        oNhaCungCapLoc,
      ])
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
    for (const giaTri of TRANG_THAI_PHIEU) {
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
        nhan: 'Lập phiếu nhập',
        bieuTuong: 'them',
        chinh: true,
        nghe: () => moBieuMau('tao'),
      })
    );

    container.append(
      vungThongKe,
      the({
        tieuDe: 'Danh sách phiếu nhập hàng',
        ghiChu: 'Mỗi phiếu ghi nhận một lần nhập nguyên liệu từ nhà cung cấp.',
        than: el('div', {}, [thanhCongCu, vungBang]),
        lopThan: 'the-than day',
      })
    );

    await veThongKe();
    await veBang();
  },
};
