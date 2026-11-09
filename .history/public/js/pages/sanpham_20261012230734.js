/**
 * Trang NHÓM 2 — Quản lý sản phẩm (CN2.1 → CN2.7).
 * Xem dạng thẻ hoặc dạng bảng, cảnh báo tồn kho và áp dụng khuyến mãi.
 */
'use strict';

import { api } from '../api.js';
import { danhSach } from '../store.js';
import { ngay, so, tien } from '../format.js';
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
  xacNhan,
  xoaHet,
} from '../ui.js';

/** Dữ liệu nạp trước cho biểu mẫu sản phẩm. */
const DU_LIEU = { loaiSanPham: [] };

/** Nạp danh sách loại sản phẩm cho ô chọn. */
async function napLoaiSanPham() {
  const ketQua = await api.doc('/api/loaisanpham', { pageSize: 100 });
  DU_LIEU.loaiSanPham = Array.isArray(ketQua?.items) ? ketQua.items : [];
}

/** Nhãn trạng thái tồn kho của một sản phẩm. */
function nhanTonKho(ban) {
  if (Number(ban.soLuong) <= 0) return nhan('Hết hàng', 'nhan-do');
  if (ban.sapHetHang) return nhan(`Sắp hết (${so(ban.soLuong)})`, 'nhan-vang');
  return nhan(`Còn ${so(ban.soLuong)}`, 'nhan-xanh');
}

/** Màn hình quản lý sản phẩm. */
export const manHinh = {
  ma: 'sanpham',
  tieuDe: 'Sản phẩm',
  moTa: 'Danh mục đồ uống kèm giá bán, tồn kho và khuyến mãi đang áp dụng.',
  bieuTuong: 'san-pham',
  quyen: 'catalog.view',

  async hienThi(container, ctx) {
    await napLoaiSanPham();

    const trangThai = {
      page: Number(ctx.query.page) || 1,
      pageSize: Number(ctx.query.pageSize) || 12,
      q: ctx.query.q ?? '',
      maLoai: ctx.query.maLoai ?? '',
      trangThai: ctx.query.trangThai ?? '',
      chiKhuyenMai: ctx.query.chiKhuyenMai === 'true',
      sapHet: ctx.query.sapHet === 'true',
      sortBy: ctx.query.sortBy ?? 'tenSP',
      sortDir: ctx.query.sortDir ?? 'asc',
      kieuXem: ctx.query.kieuXem ?? 'the',
    };

    const thanhCongCu = el('div', { lop: 'thanh-cong-cu' });
    const vungNoiDung = el('div', {});
    const vungThongKe = el('div', { lop: 'luoi-thong-ke', thuocTinh: { style: 'margin-bottom:16px' } });

    /** Gọi API danh sách sản phẩm theo trạng thái hiện tại. */
    async function taiDuLieu() {
      const ketQua = await api.doc('/api/sanpham', {
        page: trangThai.page,
        pageSize: trangThai.pageSize,
        q: trangThai.q,
        maLoai: trangThai.maLoai,
        trangThai: trangThai.trangThai,
        chiKhuyenMai: trangThai.chiKhuyenMai ? 'true' : '',
        sapHet: trangThai.sapHet ? 'true' : '',
        sortBy: trangThai.sortBy,
        sortDir: trangThai.sortDir,
      });
      return {
        items: Array.isArray(ketQua?.items) ? ketQua.items : [],
        phan: ketQua?.pagination ?? { page: 1, pageSize: trangThai.pageSize, total: 0, totalPages: 1 },
      };
    }

    /** Vẽ các thẻ số liệu tồn kho. */
    async function veThongKe() {
      xoaHet(vungThongKe);
      try {
        const canhBaoTon = await api.doc('/api/sanpham/canh-bao-ton');
        const hetHang = (canhBaoTon.items ?? []).filter((sp) => Number(sp.soLuong) === 0).length;
        vungThongKe.append(
          theSoLieu({
            nhan: 'Ngưỡng cảnh báo',
            giaTri: so(canhBaoTon.nguong),
            phu: 'Số lượng tồn tối thiểu nên duy trì',
            bieuTuong: 'kho',
          }),
          theSoLieu({
            nhan: 'Sản phẩm sắp hết',
            giaTri: so((canhBaoTon.items ?? []).length - hetHang),
            sac: 'sac-honey',
            bieuTuong: 'canh-bao',
          }),
          theSoLieu({
            nhan: 'Sản phẩm đã hết',
            giaTri: so(hetHang),
            sac: 'sac-chili',
            bieuTuong: 'canh-bao',
          })
        );
      } catch {
        // Bỏ qua nếu chưa tải được cảnh báo tồn kho.
      }
    }

    /** Thẻ sản phẩm cho chế độ xem dạng lưới. */
    function theSanPham(ban) {
      const chanThe = el('div', { lop: 'chan-the' }, [
        el('span', { lop: 'ton', vanBan: `Tồn: ${so(ban.soLuong)}` }),
        el('div', { lop: 'gon' }, [
          ban.coKhuyenMai ? nhan('Giảm giá', 'nhan-cam') : null,
          nhan(ban.trangThai),
        ]),
      ]);

      const gium = el('div', { lop: 'than' }, [
        el('h3', { vanBan: ban.tenSP }),
        el('div', { lop: 'danh-muc', vanBan: ban.tenLoai }),
        el('div', { lop: 'gia' }, [
          el('span', { vanBan: tien(ban.giaSauGiam) }),
          ban.coKhuyenMai
            ? el('span', { lop: 'gia-goc', vanBan: tien(ban.gia) })
            : null,
        ]),
        chanThe,
        el('div', { lop: 'nhom-nut', thuocTinh: { style: 'margin-top:10px' } }, [
          nut({
            nhan: 'Chi tiết',
            bieuTuong: 'ho-so',
            nho: true,
            nghe: () => moChiTiet(ban),
          }),
          nut({ nhan: 'Sửa', bieuTuong: 'sua', nho: true, nghe: () => moBieuMau('sua', ban) }),
        ]),
      ]);

      return el('div', { lop: 'the-san-pham' }, [
        el('div', { lop: 'anh', html: icon('san-pham').innerHTML }),
        gium,
      ]);
    }

    /** Vẽ nội dung theo chế độ xem đang chọn. */
    async function veNoiDung() {
      xoaHet(vungNoiDung);
      const { items, phan } = await taiDuLieu();

      if (items.length === 0) {
        vungNoiDung.append(
          oTrong({
            tieuDe: 'Không có sản phẩm nào',
            moTa: 'Thử đổi từ khóa tìm kiếm hoặc bộ lọc loại sản phẩm.',
            bieuTuong: 'san-pham',
          })
        );
        return;
      }

      if (trangThai.kieuXem === 'the') {
        vungNoiDung.append(el('div', { lop: 'uu-tien-hang' }, items.map(theSanPham)));
      } else {
        vungNoiDung.append(
          bang({
            cot: [
              { tieuDe: 'Mã', truong: 'maSP', lop: 'so' },
              { tieuDe: 'Tên sản phẩm', truong: 'tenSP', lop: 'manh', sapXepTheo: 'tenSP' },
              { tieuDe: 'Loại', truong: 'tenLoai', sapXepTheo: 'tenLoai' },
              { tieuDe: 'Giá bán', lop: 'so', sapXepTheo: 'gia', lay: (ban) => tien(ban.gia) },
              {
                tieuDe: 'Giá sau giảm',
                lop: 'so',
                lay: (ban) =>
                  ban.coKhuyenMai ? tien(ban.giaSauGiam) : '—',
              },
              { tieuDe: 'Tồn kho', lop: 'so', sapXepTheo: 'soLuong', dung: (ban) => nhanTonKho(ban) },
              { tieuDe: 'Trạng thái', dung: (ban) => nhan(ban.trangThai) },
              {
                tieuDe: 'Thao tác',
                lop: 'cot-thao-tac',
                dung: (ban) =>
                  el('div', { lop: 'gon', thuocTinh: { style: 'justify-content:flex-end' } }, [
                    nut({
                      nhan: 'Chi tiết',
                      bieuTuong: 'ho-so',
                      nho: true,
                      nghe: () => moChiTiet(ban),
                    }),
                    nut({ nhan: 'Sửa', bieuTuong: 'sua', nho: true, nghe: () => moBieuMau('sua', ban) }),
                    nut({
                      nhan: 'Xóa',
                      bieuTuong: 'xoa',
                      nho: true,
                      nguyHiem: true,
                      nghe: () => xoaSanPham(ban),
                    }),
                  ]),
              },
            ],
            duLieu: items,
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
                veNoiDung();
              },
            },
          })
        );
      }

      vungNoiDung.append(
        phanTrang({
          phan,
          khiDoiTrang: (trang) => {
            trangThai.page = trang;
            veNoiDung();
          },
          khiDoiCoTrang: (co) => {
            trangThai.pageSize = co;
            trangThai.page = 1;
            veNoiDung();
          },
        })
      );
    }

    /** Hộp thoại thêm / sửa sản phẩm (CN2.1, CN2.2). */
    function moBieuMau(cheDo, ban = null) {
      const bieuMau = el('form', { thuocTinh: { novalidate: true } }, [
        luoiTruong([
          truong({
            ten: 'tenSP',
            nhan: 'Tên sản phẩm',
            loai: 'text',
            batBuoc: true,
            giaTri: ban?.tenSP ?? '',
            thuocTinh: { maxlength: 150 },
          }),
          truong({
            ten: 'maLoai',
            nhan: 'Loại sản phẩm',
            loai: 'select',
            batBuoc: true,
            so: true,
            giaTri: ban?.maLoai ?? '',
            tuyChon: {
              muc: DU_LIEU.loaiSanPham.map((loai) => ({ giaTri: loai.maLoai, nhan: loai.tenLoai })),
              mucRong: '— Chọn loại sản phẩm —',
            },
          }),
          truong({
            ten: 'gia',
            nhan: 'Giá bán (đồng)',
            loai: 'number',
            so: true,
            batBuoc: true,
            giaTri: ban?.gia ?? '',
            thuocTinh: { min: 0, step: 1000 },
          }),
          truong({
            ten: 'soLuong',
            nhan: 'Số lượng tồn kho',
            loai: 'number',
            so: true,
            giaTri: ban?.soLuong ?? 0,
            goiY: 'Tồn kho sẽ tự đổi trạng thái khi về 0.',
            thuocTinh: { min: 0, step: 1 },
          }),
          truong({
            ten: 'trangThai',
            nhan: 'Trạng thái',
            loai: 'select',
            giaTri: ban?.trangThai ?? danhSach('trangThaiSanPham')[0] ?? 'Đang bán',
            tuyChon: { muc: danhSach('trangThaiSanPham') },
          }),
          truong({
            ten: 'hinhAnh',
            nhan: 'Đường dẫn hình ảnh',
            loai: 'text',
            giaTri: ban?.hinhAnh ?? '',
            goiY: 'Không bắt buộc. Ví dụ: /images/ca-phe-sua.jpg',
            thuocTinh: { maxlength: 255 },
          }),
          truong({
            ten: 'moTa',
            nhan: 'Mô tả',
            loai: 'textarea',
            rong: true,
            giaTri: ban?.moTa ?? '',
            thuocTinh: { maxlength: 255 },
          }),
        ]),
      ]);

      const nutLuu = nut({
        nhan: cheDo === 'tao' ? 'Thêm sản phẩm' : 'Lưu thay đổi',
        bieuTuong: 'tick',
        chinh: true,
        nghe: () => gui(),
      });

      const hop = hopThoai({
        tieuDe: cheDo === 'tao' ? 'Thêm sản phẩm mới' : `Cập nhật: ${ban?.tenSP ?? ''}`,
        moTa: cheDo === 'tao' ? 'Sản phẩm mới sẽ hiển thị ngay trong danh mục.' : `Mã sản phẩm ${ban?.maSP}`,
        than: bieuMau,
        nutChan: [nut({ nhan: 'Hủy bỏ', lop: 'nut-trong', nghe: () => hop.dong() }), nutLuu],
        rong: true,
      });

      /** Gửi dữ liệu sản phẩm lên máy chủ. */
      async function gui() {
        const duLieu = docBieuMau(bieuMau);
        if (!duLieu.tenSP) {
          canhBao('Thiếu thông tin', 'Vui lòng nhập tên sản phẩm.');
          return;
        }
        if (!duLieu.maLoai) {
          canhBao('Thiếu thông tin', 'Vui lòng chọn loại sản phẩm.');
          return;
        }
        const duLieuSo = {
          ...duLieu,
          maLoai: Number(duLieu.maLoai),
          gia: Number(duLieu.gia) || 0,
          soLuong: Number(duLieu.soLuong) || 0,
        };

        dangXuLy(nutLuu, true);
        try {
          if (cheDo === 'tao') {
            await api.post('/api/sanpham', duLieuSo);
            thanhCong('Đã thêm sản phẩm mới');
          } else {
            await api.put(`/api/sanpham/${ban.maSP}`, duLieuSo);
            thanhCong('Đã lưu sản phẩm');
          }
          hop.dong();
          await veNoiDung();
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

    /** Xác nhận xóa / ngừng bán sản phẩm (CN2.3). */
    async function xoaSanPham(ban) {
      const dongY = await xacNhan({
        tieuDe: 'Xóa sản phẩm',
        noiDung: `Xóa "${ban.tenSP}"? Sản phẩm đã phát sinh giao dịch sẽ được chuyển sang trạng thái "Ngừng bán" thay vì xóa.`,
        nhanDongY: 'Xóa / Ngừng bán',
        nguyHiem: true,
      });
      if (!dongY) return;
      try {
        const ketQua = await api.xoa(`/api/sanpham/${ban.maSP}`);
        thanhCong(
          ketQua?.hanhDong === 'ngung-ban' ? 'Đã chuyển sang "Ngừng bán"' : 'Đã xóa sản phẩm',
          ketQua?.thongBao ?? null
        );
        await veNoiDung();
        await veThongKe();
      } catch (loi) {
        baoLoiApi(loi, 'Không xóa được sản phẩm');
      }
    }

    /** Xem chi tiết sản phẩm kèm khuyến mãi và đánh giá (CN2.5). */
    async function moChiTiet(ban) {
      let chiTiet;
      try {
        chiTiet = await api.doc(`/api/sanpham/${ban.maSP}`);
      } catch (loi) {
        baoLoiApi(loi, 'Không tải được chi tiết sản phẩm');
        return;
      }

      const than = el('div', {}, [
        moTaCot([
          { nhan: 'Tên sản phẩm', giaTri: chiTiet.tenSP },
          { nhan: 'Loại', giaTri: chiTiet.tenLoai },
          { nhan: 'Giá niêm yết', giaTri: tien(chiTiet.gia), so: true },
          {
            nhan: 'Giảm giá đang áp dụng',
            giaTri: chiTiet.coKhuyenMai ? tien(chiTiet.giamGia) : 'Không có',
            so: true,
          },
          { nhan: 'Giá bán thực tế', giaTri: tien(chiTiet.giaSauGiam), so: true },
          { nhan: 'Tồn kho', giaTri: `${so(chiTiet.soLuong)} đơn vị`, so: true },
          { nhan: 'Trạng thái', node: nhan(chiTiet.trangThai) },
          { nhan: 'Mô tả', giaTri: chiTiet.moTa },
          { nhan: 'Đường dẫn ảnh', giaTri: chiTiet.hinhAnh },
          {
            nhan: 'Đánh giá khách hàng',
            giaTri: chiTiet.danhGia?.soPhanHoi
              ? `${chiTiet.danhGia.diemTrungBinh}/5 (${chiTiet.danhGia.soPhanHoi} phản hồi)`
              : 'Chưa có đánh giá',
          },
        ]),
        el('h3', {
          vanBan: `Khuyến mãi đang áp dụng (${chiTiet.khuyenMai?.length ?? 0})`,
          thuocTinh: { style: 'margin-top:20px;font-size:14px' },
        }),
        el('div', { thuocTinh: { style: 'margin-top:10px' } }, [
          chiTiet.khuyenMai?.length
            ? bangPhu({
                cot: [
                  { tieuDe: 'Mã', lop: 'so', truong: 'maKM' },
                  { tieuDe: 'Chương trình', truong: 'tenKM' },
                  { tieuDe: 'Giảm', lop: 'so', lay: (dong) => tien(dong.giaTriGiam) },
                  { tieuDe: 'Bắt đầu', lop: 'so', lay: (dong) => ngay(dong.ngayBatDau) },
                  { tieuDe: 'Kết thúc', lop: 'so', lay: (dong) => ngay(dong.ngayKetThuc) },
                ],
                duLieu: chiTiet.khuyenMai,
              })
            : el('p', { lop: 'mo-chu', vanBan: 'Sản phẩm chưa tham gia chương trình khuyến mãi nào.' }),
        ]),
      ]);

      hopThoai({
        tieuDe: `Chi tiết sản phẩm: ${chiTiet.tenSP}`,
        than,
        rong: true,
        nutChan: [
          nut({ nhan: 'Đóng', lop: 'nut-trong', nghe: () => hop.dong() }),
          nut({
            nhan: 'Sửa sản phẩm',
            bieuTuong: 'sua',
            nghe: () => {
              hop.dong();
              moBieuMau('sua', ban);
            },
          }),
        ],
      });
    }

    /** Hộp thoại danh sách sản phẩm cần nhập thêm (CN2.7). */
    async function moCanhBaoTon() {
      let ketQua;
      try {
        ketQua = await api.doc('/api/sanpham/canh-bao-ton');
      } catch (loi) {
        baoLoiApi(loi, 'Không tải được cảnh báo tồn kho');
        return;
      }

      hopThoai({
        tieuDe: 'Cảnh báo tồn kho',
        moTa: `Các sản phẩm có tồn kho ≤ ${so(ketQua.nguong)} đơn vị.`,
        than:
          ketQua.items?.length
            ? bangPhu({
                cot: [
                  { tieuDe: 'Mã', lop: 'so', truong: 'maSP' },
                  { tieuDe: 'Sản phẩm', truong: 'tenSP' },
                  { tieuDe: 'Loại', truong: 'tenLoai', lop: 'mo' },
                  { tieuDe: 'Tồn kho', lop: 'so', lay: (dong) => so(dong.soLuong) },
                  {
                    tieuDe: 'Mức độ',
                    dung: (dong) =>
                      dong.mucDo === 'Hết hàng' ? nhan('Hết hàng', 'nhan-do') : nhan('Sắp hết', 'nhan-vang'),
                  },
                ],
                duLieu: ketQua.items,
              })
            : oTrong({
                tieuDe: 'Tồn kho đang ở mức an toàn',
                moTa: 'Không có sản phẩm nào dưới ngưỡng cảnh báo.',
                bieuTuong: 'kho',
              }),
        rong: true,
        nutChan: [nut({ nhan: 'Đóng', lop: 'nut-trong', nghe: () => hop.dong() })],
      });
    }

    /* ----------------------------- THANH CÔNG CỤ ---------------------------- */

    const oTim = el('input', {
      kieu: 'search',
      thuocTinh: { placeholder: 'Tìm theo tên sản phẩm hoặc mô tả…' },
      giaTri: trangThai.q,
    });
    let henGio = null;
    oTim.addEventListener('input', () => {
      window.clearTimeout(henGio);
      henGio = window.setTimeout(() => {
        trangThai.q = oTim.value.trim();
        trangThai.page = 1;
        veNoiDung();
      }, 280);
    });
    thanhCongCu.append(
      el('label', { lop: 'truong truong-tim-kiem' }, [el('span', { vanBan: 'Từ khóa' }), oTim])
    );

    const oLoai = el('select', {
      nghe: {
        change: (suKien) => {
          trangThai.maLoai = suKien.target.value;
          trangThai.page = 1;
          veNoiDung();
        },
      },
    });
    oLoai.append(el('option', { vanBan: 'Tất cả loại', thuocTinh: { value: '' } }));
    for (const loai of DU_LIEU.loaiSanPham) {
      oLoai.append(el('option', { vanBan: loai.tenLoai, thuocTinh: { value: String(loai.maLoai) } }));
    }
    thanhCongCu.append(
      el('label', { lop: 'truong truong-ngan' }, [el('span', { vanBan: 'Loại sản phẩm' }), oLoai])
    );

    const oTrangThaiLoc = el('select', {
      nghe: {
        change: (suKien) => {
          trangThai.trangThai = suKien.target.value;
          trangThai.page = 1;
          veNoiDung();
        },
      },
    });
    oTrangThaiLoc.append(el('option', { vanBan: 'Tất cả trạng thái', thuocTinh: { value: '' } }));
    for (const giaTri of danhSach('trangThaiSanPham')) {
      oTrangThaiLoc.append(el('option', { vanBan: giaTri, thuocTinh: { value: giaTri } }));
    }
    thanhCongCu.append(
      el('label', { lop: 'truong truong-ngan' }, [
        el('span', { vanBan: 'Trạng thái' }),
        oTrangThaiLoc,
      ])
    );

    const oChiKhuyenMai = truong({
      ten: 'chiKhuyenMai',
      nhan: 'Chỉ hiện sản phẩm đang giảm giá',
      loai: 'checkbox',
      giaTri: trangThai.chiKhuyenMai,
      nghe: {
        change: (suKien) => {
          trangThai.chiKhuyenMai = suKien.target.checked;
          trangThai.page = 1;
          veNoiDung();
        },
      },
    });
    const oSapHet = truong({
      ten: 'sapHet',
      nhan: 'Chỉ hiện sản phẩm sắp hết',
      loai: 'checkbox',
      giaTri: trangThai.sapHet,
      nghe: {
        change: (suKien) => {
          trangThai.sapHet = suKien.target.checked;
          trangThai.page = 1;
          veNoiDung();
        },
      },
    });
    thanhCongCu.append(
      el('div', { lop: 'truong', thuocTinh: { style: 'gap:8px' } }, [oChiKhuyenMai, oSapHet])
    );

    thanhCongCu.append(el('div', { lop: 'day-khoang-cach' }));

    /** Nút đổi chế độ xem thẻ/bảng; tự vẽ lại chính nó sau mỗi lần bấm. */
    function taoNutDoiKieuXem() {
      const nutDoi = nut({
        nhan: trangThai.kieuXem === 'the' ? 'Xem dạng bảng' : 'Xem dạng thẻ',
        bieuTuong: 'bang-dieu-khien',
        nghe: () => {
          trangThai.kieuXem = trangThai.kieuXem === 'the' ? 'bang' : 'the';
          nutDoi.replaceWith(taoNutDoiKieuXem());
          veNoiDung();
        },
      });
      return nutDoi;
    }

    thanhCongCu.append(
      taoNutDoiKieuXem(),
      nut({
        nhan: 'Cảnh báo tồn kho',
        bieuTuong: 'canh-bao',
        nghe: () => moCanhBaoTon(),
      }),
      nut({
        nhan: 'Thêm sản phẩm',
        bieuTuong: 'them',
        chinh: true,
        nghe: () => moBieuMau('tao'),
      })
    );

    container.append(
      vungThongKe,
      the({
        tieuDe: 'Danh mục sản phẩm',
        ghiChu: 'Giá hiển thị đã trừ khuyến mãi còn hiệu lực.',
        than: el('div', {}, [thanhCongCu, vungNoiDung]),
        lopThan: 'the-than day',
      })
    );

    await veThongKe();
    await veNoiDung();
  },
};
