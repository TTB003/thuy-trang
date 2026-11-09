/**
 * Bộ khung trang danh sách + thêm/sửa/xóa dùng chung.
 *
 * Nhờ lớp này, mỗi trang nghiệp vụ chỉ cần khai báo: đường dẫn API, khoá chính,
 * danh sách cột hiển thị và danh sách trường của biểu mẫu.
 */
'use strict';

import { api } from './api.js';
import { danhSach } from './store.js';
import { so, taiTep, taoCsv, tenTepCoNgay, tien } from './format.js';
import {
  bang,
  baoLoi,
  baoLoiApi,
  canhBao,
  dangXuLy,
  docBieuMau,
  el,
  hopThoai,
  luoiTruong,
  nhan,
  nut,
  nutBieuTuong,
  oTrong,
  phanTrang,
  thanhCong,
  the,
  truong,
  xacNhan,
  xoaHet,
} from './ui.js';

/** Giá trị mặc định của bộ lọc trạng thái khi khai báo bằng tên danh mục. */
function mucLocTheoDanhMuc(tenDanhMuc) {
  return danhSach(tenDanhMuc);
}

/** Chuyển giá trị ô nhập sang kiểu số nếu trường được khai báo `so: true`. */
function chuanHoaGiaTri(duLieu, cacTruong, cheDo) {
  const ketQua = { ...duLieu };
  for (const truongKhaiBao of cacTruong) {
    const { ten, so: laSo, anKhiTao, anKhiSua } = truongKhaiBao;
    if (!ten) continue;
    if (cheDo === 'tao' && anKhiTao) delete ketQua[ten];
    if (cheDo === 'sua' && anKhiSua) delete ketQua[ten];
    if (laSo && ketQua[ten] !== null && ketQua[ten] !== undefined && ketQua[ten] !== '') {
      ketQua[ten] = Number(ketQua[ten]);
    }
  }
  return ketQua;
}

/** Dựng biểu mẫu từ khai báo trường. */
function dungBieuMau(cacTruong, ban = null, cheDo = 'tao') {
  const bieuMau = el('form', { lop: '', thuocTinh: { novalidate: true } });
  const truongThuong = [];

  for (const khaiBao of cacTruong) {
    const { anKhiTao, anKhiSua, chiDoc, rong, ...tuyChon } = khaiBao;
    if (cheDo === 'tao' && anKhiTao) continue;
    if (cheDo === 'sua' && anKhiSua) continue;

    const giaTriMacDinh = typeof tuyChon.giaTriMacDinh === 'function'
      ? tuyChon.giaTriMacDinh()
      : tuyChon.giaTriMacDinh;
    const giaTri = ban && tuyChon.ten in ban ? ban[tuyChon.ten] : (giaTriMacDinh ?? '');

    const cauHinhTruong = {
      ...tuyChon,
      ...(typeof tuyChon.tuyChon?.muc === 'function'
        ? { tuyChon: { ...tuyChon.tuyChon, muc: tuyChon.tuyChon.muc() } }
        : {}),
    };
    const o = truong({
      ...cauHinhTruong,
      giaTri,
      thuocTinh: { ...(cauHinhTruong.thuocTinh ?? {}), ...(chiDoc ? { disabled: true } : {}) },
    });
    if (rong) o.classList.add('rong');
    truongThuong.push(o);
  }

  bieuMau.append(luoiTruong(truongThuong));
  return bieuMau;
}

/**
 * Tạo một màn hình CRUD.
 * @param {object} khaiBao
 * @returns {{ ma, tieuDe, moTa, bieuTuong, quyen, chiQuanTri, hienThi }}
 */
export function taoTrangCrud(khaiBao) {
  const {
    ma,
    tieuDe,
    moTa = '',
    bieuTuong = 'phan-loai',
    quyen = null,
    chiQuanTri = false,
    duongDanApi,
    tenKhoa,
    cot,
    truong: cacTruong = [],
    boLoc = [],
    timKiem = true,
    sapXepMacDinh = null,
    chieuMacDinh = 'asc',
    nhanThem = 'Thêm mới',
    tenTepCsv = `danh-sach-${ma}`,
    xuatCsv = true,
    kichThuocHop = '',
    hanhDongThem = [],
    truocKhiGui = null,
    sauKhiTaoBieuMau = null,
    thaoTacThem = [],
    chuanBi = null,
  } = khaiBao;

  async function xuLy(container, ctx) {
    const trangThai = {
      page: Number(ctx.query.page) || 1,
      pageSize: Number(ctx.query.pageSize) || 20,
      q: ctx.query.q ?? '',
      sortBy: ctx.query.sortBy ?? sapXepMacDinh,
      sortDir: ctx.query.sortDir ?? chieuMacDinh,
      loc: {},
    };
    for (const muc of boLoc) {
      trangThai.loc[muc.ten] = ctx.query[muc.ten] ?? muc.giaTriMacDinh ?? '';
    }

    const phanBoLoc = el('div', { lop: 'thanh-cong-cu' });
    const phanThan = el('div', { lop: '' });
    const vungBang = el('div', {});

    /** Gọi API danh sách theo trạng thái hiện tại. */
    async function taiDuLieu() {
      // Nạp lại dữ liệu cho các ô chọn động (khách hàng, sản phẩm, ...).
      if (chuanBi) await chuanBi();
      const query = {
        page: trangThai.page,
        pageSize: trangThai.pageSize,
        q: trangThai.q,
        sortBy: trangThai.sortBy,
        sortDir: trangThai.sortDir,
        ...trangThai.loc,
      };
      const ketQua = await api.doc(duongDanApi, query);
      return {
        items: Array.isArray(ketQua?.items) ? ketQua.items : [],
        phan: ketQua?.pagination ?? { page: 1, pageSize: trangThai.pageSize, total: 0, totalPages: 1 },
      };
    }

    /** Vẽ lại bảng và thanh phân trang. */
    async function veBang() {
      xoaHet(vungBang);
      const { items, phan } = await taiDuLieu();

      const cotBang = [...cot];
      const coThaoTac = true;
      if (coThaoTac) {
        cotBang.push({
          tieuDe: 'Thao tác',
          lop: 'cot-thao-tac',
          dung: (ban) => {
            const nhom = el('div', { lop: 'gon', thuocTinh: { style: 'justify-content:flex-end' } });
            for (const hanhDong of [...thaoTacThem, ...hanhDongThem]) {
              if (hanhDong.hienThi && !hanhDong.hienThi(ban)) continue;
              nhom.append(
                nut({
                  nhan: hanhDong.nhan,
                  bieuTuong: hanhDong.bieuTuong ?? null,
                  nho: true,
                  nguyHiem: hanhDong.nguyHiem ?? false,
                  nghe: () => hanhDong.thucHien(ban, veBang),
                })
              );
            }
            if (khaiBao.choSua !== false) {
              nhom.append(
                nut({
                  nhan: 'Sửa',
                  bieuTuong: 'sua',
                  nho: true,
                  nghe: () => moBieuMauSua(ban),
                })
              );
            }
            if (khaiBao.choXoa !== false) {
              nhom.append(
                nut({
                  nhan: 'Xóa',
                  bieuTuong: 'xoa',
                  nho: true,
                  nguyHiem: true,
                  nghe: () => xoaBan(ban),
                })
              );
            }
            return nhom;
          },
        });
      }

      vungBang.append(
        bang({
          cot: cotBang,
          duLieu: items,
          khiRong: oTrong({
            tieuDe: 'Chưa có bản ghi nào',
            moTa: 'Hãy thêm bản ghi mới hoặc điều chỉnh bộ lọc tìm kiếm.',
            bieuTuong,
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
          dongNhanBam: khaiBao.khiBamDong ?? null,
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

    /** Mở hộp thoại biểu mẫu (thêm hoặc sửa). */
    function moBieuMau(cheDo, ban = null) {
      const bieuMau = dungBieuMau(cacTruong, ban, cheDo);
      if (sauKhiTaoBieuMau) sauKhiTaoBieuMau(bieuMau, cheDo, ban);
      const nutLuu = nut({
        nhan: cheDo === 'tao' ? 'Thêm mới' : 'Lưu thay đổi',
        bieuTuong: cheDo === 'tao' ? 'them' : 'tick',
        chinh: true,
        nghe: () => guiBieuMau(),
      });
      const nutHuy = nut({
        nhan: 'Hủy bỏ',
        lop: 'nut-trong',
        nghe: () => hop.dong(),
      });

      const hop = hopThoai({
        tieuDe: cheDo === 'tao' ? nhanThem : `Cập nhật ${tieuDe.toLowerCase()}`,
        moTa: cheDo === 'tao' ? moTa : `Mã số: ${ban?.[tenKhoa] ?? '—'}`,
        than: bieuMau,
        nutChan: [nutHuy, nutLuu],
        rong: kichThuocHop === 'hop-rong',
      });

      /** Kiểm tra các trường bắt buộc trước khi gửi. */
      function kiemTraBatBuoc() {
        for (const khaiBaoTruong of cacTruong) {
          const { ten, batBuoc, nhan: tenNhan, anKhiTao, anKhiSua } = khaiBaoTruong;
          if (!batBuoc || !ten || !tenNhan) continue;
          if (cheDo === 'tao' && anKhiTao) continue;
          if (cheDo === 'sua' && anKhiSua) continue;
          const o = bieuMau.querySelector(`[name="${ten}"]`);
          if (o && !String(o.value ?? '').trim()) {
            canhBao('Thiếu thông tin', `Vui lòng nhập ${tenNhan.toLowerCase()}.`);
            if (o.focus) o.focus();
            return false;
          }
        }
        return true;
      }

      /** Gửi dữ liệu biểu mẫu lên máy chủ. */
      async function guiBieuMau() {
        if (!kiemTraBatBuoc()) return;
        let duLieu = chuanHoaGiaTri(docBieuMau(bieuMau), cacTruong, cheDo);
        if (truocKhiGui) duLieu = truocKhiGui(duLieu, cheDo, ban);

        dangXuLy(nutLuu, true);
        try {
          if (cheDo === 'tao') {
            await api.post(duongDanApi, duLieu);
            thanhCong('Đã thêm bản ghi mới');
          } else {
            await api.put(`${duongDanApi}/${ban[tenKhoa]}`, duLieu);
            thanhCong('Đã lưu thay đổi');
          }
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
        guiBieuMau();
      });
    }

    const moBieuMauThem = () => moBieuMau('tao');
    const moBieuMauSua = (ban) => moBieuMau('sua', ban);

    /** Xác nhận rồi xóa một bản ghi. */
    async function xoaBan(ban) {
      const dongY = await xacNhan({
        tieuDe: 'Xóa bản ghi',
        noiDung: `Bạn có chắc chắn muốn xóa bản ghi "${ban?.[khaiBao.truongHienThi ?? tenKhoa] ?? ban?.[tenKhoa]}"? Thao tác này không thể hoàn tác.`,
        nhanDongY: 'Xóa bản ghi',
        nguyHiem: true,
      });
      if (!dongY) return;
      try {
        await api.xoa(`${duongDanApi}/${ban[tenKhoa]}`);
        thanhCong('Đã xóa bản ghi');
        await veBang();
      } catch (loi) {
        baoLoiApi(loi, 'Không xóa được');
      }
    }

    /* ------------------------------ THANH CÔNG CỤ ----------------------------- */

    if (timKiem) {
      const oTim = el('input', {
        kieu: 'search',
        thuocTinh: { name: 'q', placeholder: 'Tìm kiếm (không cần dấu)…' },
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
      phanBoLoc.append(el('label', { lop: 'truong truong-tim-kiem' }, [
        el('span', { vanBan: 'Từ khóa' }),
        oTim,
      ]));
    }

    for (const muc of boLoc) {
      const cacMuc = muc.danhMuc ? mucLocTheoDanhMuc(muc.danhMuc) : (muc.muc ?? []);
      const chon = el('select', {
        thuocTinh: { name: muc.ten },
        nghe: {
          change: (suKien) => {
            trangThai.loc[muc.ten] = suKien.target.value;
            trangThai.page = 1;
            veBang();
          },
        },
      });
      chon.append(
        el('option', { vanBan: muc.nhanTatCa ?? 'Tất cả', thuocTinh: { value: '' } })
      );
      for (const giaTri of cacMuc) {
        chon.append(
          el('option', {
            vanBan: typeof giaTri === 'string' ? giaTri : giaTri.nhan,
            thuocTinh: { value: String(typeof giaTri === 'string' ? giaTri : giaTri.giaTri) },
          })
        );
      }
      chon.value = trangThai.loc[muc.ten] ?? '';
      phanBoLoc.append(
        el('label', { lop: 'truong truong-ngan' }, [el('span', { vanBan: muc.nhan }), chon])
      );
    }

    phanBoLoc.append(el('div', { lop: 'day-khoang-cach' }));
    phanBoLoc.append(
      nut({
        nhan: 'Làm mới',
        bieuTuong: 'lam-moi',
        nghe: () => {
          trangThai.page = 1;
          veBang();
        },
      })
    );

    if (xuatCsv) {
      phanBoLoc.append(
        nut({
          nhan: 'Xuất CSV',
          bieuTuong: 'tai-xuong',
          nghe: async () => {
            try {
              const { items } = await taiDuLieu();
              // Chuẩn hóa cột để mọi cột đều có hàm `lay` trước khi xuất CSV.
              const cotCsv = cot.map((muc) => ({
                tieuDe: muc.tieuDe,
                lay:
                  muc.lay ??
                  ((ban) => (ban[muc.truong] === null || ban[muc.truong] === undefined ? '' : ban[muc.truong])),
              }));
              const noiDung = taoCsv(items, cotCsv);
              taiTep(tenTepCoNgay(tenTepCsv), noiDung);
              thanhCong('Đã xuất tệp CSV', `${items.length} dòng.`);
            } catch (loi) {
              baoLoiApi(loi, 'Không xuất được tệp');
            }
          },
        })
      );
    }

    if (khaiBao.choTao !== false) {
      phanBoLoc.append(nut({ nhan: nhanThem, bieuTuong: 'them', chinh: true, nghe: moBieuMauThem }));
    }

    phanThan.append(phanBoLoc, vungBang);
    container.append(
      the({
        tieuDe,
        ghiChu: moTa,
        than: phanThan,
        lopThan: 'the-than day',
      })
    );

    await veBang();
    return { moBieuMauThem, moBieuMauSua, veBang };
  }

  return {
    ma,
    tieuDe,
    moTa,
    bieuTuong,
    quyen,
    chiQuanTri,
    hienThi: xuLy,
  };
}

/** Tiện ích dùng chung cho các trang: cột tiền và cột số. */
export const cotSo = (tieuDe, truong, { sapXepTheo = truong, tienTe = false } = {}) => ({
  tieuDe,
  lop: 'so',
  sapXepTheo,
  lay: (ban) => (tienTe ? tien(ban[truong]) : so(ban[truong])),
});

/** Cột nhãn trạng thái. */
export const cotTrangThai = (tieuDe, truong, sapXepTheo = truong) => ({
  tieuDe,
  sapXepTheo,
  dung: (ban) => nhan(ban[truong]),
});

/** Nút thao tác nhanh dùng cho các trang tùy biến. */
export const nutThaoTac = nutBieuTuong;
