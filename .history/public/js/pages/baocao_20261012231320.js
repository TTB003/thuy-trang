/**
 * Trang NHÓM 12 — Báo cáo và thống kê (CN12.1 → CN12.6).
 * Gồm: doanh thu, sản phẩm bán chạy, nhập hàng, tồn kho, khách hàng,
 * khách hàng thân thiết — kèm chức năng kết xuất CSV.
 */
'use strict';

import { api } from '../api.js';
import {
  ngay,
  ngayChoInput,
  phanTram,
  so,
  soThapPhan,
  taiTep,
  tenTepCoNgay,
  tien,
  tienRutGon,
  vietTat,
} from '../format.js';
import {
  bang,
  bangPhu,
  baoLoiApi,
  bieuDoCot,
  bieuDoNgang,
  dangXuLy,
  el,
  khuTab,
  nhan,
  nut,
  oTrong,
  the,
  theSoLieu,
  truong,
  xoaHet,
} from '../ui.js';

/** Bộ lọc thời gian dùng chung cho các báo cáo. */
const BO_LOC = { tuNgay: '', denNgay: '' };

/** Chuyển cấu trúc báo cáo của máy chủ thành nội dung CSV. */
function baoCaoSangCsv(bao cao) {
  const thoat = (giaTri) => {
    const chuoi = giaTri === null || giaTri === undefined ? '' : String(giaTri);
    return `"${chuoi.replace(/"/g, '""')}"`;
  };
  const dong = [bao cao.cot.map(thoat).join(',')];
  for (const hang of bao cao.dong) dong.push(hang.map(thoat).join(','));
  return `\ufeff${dong.join('\r\n')}`;
}

/** Nút kết xuất một loại báo cáo thành tệp CSV (CN12.6). */
function nutXuat(loai, thamSoThem = {}) {
  const nutTai = nut({
    nhan: 'Xuất CSV',
    bieuTuong: 'tai-xuong',
    lop: 'nut-trong nut-nho',
    nghe: async () => {
      dangXuLy(nutTai, true);
      try {
        const baoCao = await api.doc('/api/baocao/xuat', {
          loai,
          ...BO_LOC,
          ...thamSoThem,
        });
        if (!baoCao?.cot) {
          baoLoiApi(new Error('Máy chủ không trả về dữ liệu báo cáo.'), 'Không xuất được tệp');
          return;
        }
        taiTep(tenTepCoNgay(`bao-cao-${loai}`), baoCaoSangCsv(baoCao));
      } catch (loi) {
        baoLoiApi(loi, 'Không xuất được tệp');
      } finally {
        dangXuLy(nutTai, false);
      }
    },
  });
  return nutTai;
}

/** Dựng thanh công cụ lọc thời gian cho một báo cáo. */
function thanhLocThoiGian({ khiDoi, congCuThem = null }) {
  const oTuNgay = el('input', { kieu: 'date', giaTri: BO_LOC.tuNgay });
  const oDenNgay = el('input', { kieu: 'date', giaTri: BO_LOC.denNgay });

  const apDung = () => {
    BO_LOC.tuNgay = oTuNgay.value;
    BO_LOC.denNgay = oDenNgay.value;
    khiDoi();
  };
  oTuNgay.addEventListener('change', apDung);
  oDenNgay.addEventListener('change', apDung);

  const thanh = el('div', { lop: 'thanh-cong-cu' }, [
    el('label', { lop: 'truong truong-ngan' }, [el('span', { vanBan: 'Từ ngày' }), oTuNgay]),
    el('label', { lop: 'truong truong-ngan' }, [el('span', { vanBan: 'Đến ngày' }), oDenNgay]),
    el('div', { lop: 'day-khoang-cach' }),
  ]);

  if (congCuThem) thanh.append(congCuThem);
  thanh.append(
    nut({
      nhan: 'Xóa lọc thời gian',
      bieuTuong: 'lam-moi',
      lop: 'nut-trong nut-nho',
      nghe: () => {
        oTuNgay.value = '';
        oDenNgay.value = '';
        BO_LOC.tuNgay = '';
        BO_LOC.denNgay = '';
        khiDoi();
      },
    })
  );
  return thanh;
}

/** Khối báo cáo với vùng nội dung tự vẽ lại. */
function khoiBaoCao({ tieuDe, ghiChu, ve }) {
  const vung = el('div', {});
  const khung = el('div', {});

  /** Nạp lại nội dung báo cáo. */
  async function taiLai() {
    xoaHet(vung);
    vung.append(el('p', { lop: 'mo-chu nho-chu', vanBan: 'Đang tải dữ liệu…' }));
    try {
      const noiDung = await ve();
      xoaHet(vung);
      vung.append(noiDung);
    } catch (loi) {
      xoaHet(vung);
      vung.append(
        el('p', { lop: 'mo-chu', vanBan: `Không tải được báo cáo: ${loi?.message ?? 'lỗi không xác định'}` })
      );
    }
  }

  khung.taiLai = taiLai;
  khung.el = el('div', {}, [
    el('div', { lop: 'the-dau' }, [
      el('div', {}, [el('h2', { vanBan: tieuDe }), ghiChu ? el('p', { lop: 'ghi-chu', vanBan: ghiChu }) : null]),
    ]),
    thanhLocThoiGian({ khiDoi: taiLai, congCuThem: null }),
    vung,
  ]);

  const bao = the({ than: khung.el, lopThan: 'the-than day' });
  taiLai();
  return khung;
}

/** Màn hình báo cáo và thống kê. */
export const manHinh = {
  ma: 'baocao',
  tieuDe: 'Báo cáo & thống kê',
  moTa: 'Doanh thu, sản phẩm bán chạy, nhập hàng, tồn kho và hành vi khách hàng.',
  bieuTuong: 'bao-cao',
  quyen: 'report.view',

  async hienThi(container) {
    /** Tab 1 — doanh thu theo ngày/tháng/năm. */
    function tabDoanhThu() {
      const kieu = { giaTri: 'thang' };

      const vung = el('div', {});
      const oKieu = el('select', {
        nghe: {
          change: (suKien) => {
            kieu.giaTri = suKien.target.value;
            taiLai();
          },
        },
      });
      for (const [giaTri, nhanKieu] of [
        ['ngay', 'Theo ngày'],
        ['thang', 'Theo tháng'],
        ['nam', 'Theo năm'],
      ]) {
        oKieu.append(
          el('option', {
            vanBan: nhanKieu,
            thuocTinh: { value: giaTri, selected: giaTri === kieu.giaTri },
          })
        );
      }

      /** Nạp số liệu doanh thu và vẽ lại. */
      async function taiLai() {
        xoaHet(vung);
        try {
          const du = await api.doc('/api/baocao/doanh-thu', {
            kieu: kieu.giaTri,
            ...BO_LOC,
          });
          const chiTiet = du.chiTiet ?? [];

          vung.append(
            el('div', { lop: 'luoi-thong-ke', thuocTinh: { style: 'padding:16px 18px 0' } }, [
              theSoLieu({
                nhan: 'Tổng doanh thu',
                giaTri: tien(du.tongQuan?.tongDoanhThu ?? 0),
                phu: `${so(du.tongQuan?.tongDon ?? 0)} đơn hoàn thành`,
                bieuTuong: 'tien',
              }),
              theSoLieu({
                nhan: 'Giá trị đơn trung bình',
                giaTri: tien(du.tongQuan?.giaTriDonTrungBinh ?? 0),
                sac: 'sac-matcha',
                bieuTuong: 'bao-cao',
              }),
              theSoLieu({
                nhan: 'Điểm đã dùng để giảm giá',
                giaTri: tien(du.tongQuan?.tongGiamTuDiem ?? 0),
                sac: 'sac-honey',
                bieuTuong: 'diem-thuong',
              }),
            ]),
            el('div', { thuocTinh: { style: 'padding:16px 18px' } }, [
              chiTiet.length
                ? the({
                    tieuDe: `Doanh thu ${kieu.giaTri === 'ngay' ? 'theo ngày' : kieu.giaTri === 'thang' ? 'theo tháng' : 'theo năm'}`,
                    than: bieuDoCot(
                      chiTiet
                        .slice()
                        .reverse()
                        .map((muc) => ({
                          nhan: String(muc.mocThoiGian),
                          giaTri: Number(muc.doanhThu) || 0,
                        })),
                      { dinhDang: (v) => tienRutGon(v) }
                    ),
                  })
                : oTrong({
                    tieuDe: 'Chưa có doanh thu trong khoảng đã chọn',
                    moTa: 'Thử mở rộng khoảng thời gian hoặc bỏ bộ lọc.',
                    bieuTuong: 'bao-cao',
                  }),
              chiTiet.length
                ? el('div', { lop: 'the', thuocTinh: { style: 'margin-top:16px' } }, [
                    el('div', { lop: 'the-than day' }, [
                      bang({
                        cot: [
                          { tieuDe: 'Mốc thời gian', truong: 'mocThoiGian', lop: 'manh' },
                          { tieuDe: 'Số đơn', lop: 'so', lay: (ban) => so(ban.soDon) },
                          { tieuDe: 'Doanh thu', lop: 'so', lay: (ban) => tien(ban.doanhThu) },
                          {
                            tieuDe: 'Đơn trung bình',
                            lop: 'so',
                            lay: (ban) => tien(ban.giaTriDonTrungBinh),
                          },
                          { tieuDe: 'Điểm đã dùng', lop: 'so', lay: (ban) => so(ban.diemDaDung) },
                        ],
                        duLieu: chiTiet,
                      }),
                    ]),
                  ])
                : null,
            ])
          );
        } catch (loi) {
          vung.append(el('p', { lop: 'mo-chu', vanBan: `Không tải được báo cáo doanh thu: ${loi.message}` }));
        }
      }

      taiLai();
      return el('div', {}, [
        el('div', { lop: 'thanh-cong-cu' }, [
          el('label', { lop: 'truong truong-ngan' }, [el('span', { vanBan: 'Nhóm theo' }), oKieu]),
          el('div', { lop: 'day-khoang-cach' }),
          nutXuat('doanhthu', { kieu: kieu.giaTri }),
        ]),
        vung,
      ]);
    }

    /** Tab 2 — sản phẩm bán chạy. */
    function tabSanPham() {
      const vung = el('div', {});
      let top = 10;
      const oTop = el('select', {
        nghe: {
          change: (suKien) => {
            top = Number(suKien.target.value);
            taiLai();
          },
        },
      });
      for (const giaTri of [5, 10, 20, 50]) {
        oTop.append(
          el('option', { vanBan: `Top ${giaTri}`, thuocTinh: { value: String(giaTri), selected: giaTri === top } })
        );
      }

      /** Nạp danh sách sản phẩm bán chạy. */
      async function taiLai() {
        xoaHet(vung);
        try {
          const du = await api.doc('/api/baocao/san-pham-ban-chay', { top, ...BO_LOC });
          const items = du.items ?? [];
          vung.append(
            items.length
              ? el('div', { thuocTinh: { style: 'padding:16px 18px;display:grid;gap:16px' } }, [
                  the({
                    tieuDe: 'Số lượng bán ra',
                    than: bieuDoNgang(
                      items.map((sp) => ({ nhan: vietTat(sp.tenSP, 28), giaTri: Number(sp.tongSoLuong) })),
                      { dinhDang: (v) => `${so(v)} ly` }
                    ),
                  }),
                  the({
                    tieuDe: 'Doanh thu theo loại sản phẩm',
                    than: bieuDoNgang(
                      (du.theoLoai ?? []).map((loai) => ({
                        nhan: loai.tenLoai,
                        giaTri: Number(loai.tongDoanhThu),
                      })),
                      { dinhDang: (v) => tienRutGon(v) }
                    ),
                  }),
                  el('div', { lop: 'the' }, [
                    el('div', { lop: 'the-than day' }, [
                      bang({
                        cot: [
                          { tieuDe: 'Mã', lop: 'so', truong: 'maSP' },
                          { tieuDe: 'Sản phẩm', truong: 'tenSP', lop: 'manh' },
                          { tieuDe: 'Loại', truong: 'tenLoai', lop: 'mo' },
                          { tieuDe: 'Số lượng bán', lop: 'so', lay: (ban) => so(ban.tongSoLuong) },
                          { tieuDe: 'Doanh thu', lop: 'so', lay: (ban) => tien(ban.tongDoanhThu) },
                          { tieuDe: 'Số đơn', lop: 'so', lay: (ban) => so(ban.soDon) },
                        ],
                        duLieu: items,
                      }),
                    ]),
                  ]),
                ])
              : el('div', { thuocTinh: { style: 'padding:16px' } }, [
                  oTrong({
                    tieuDe: 'Chưa có sản phẩm nào được bán',
                    moTa: 'Số liệu xuất hiện khi có đơn hàng hoàn thành.',
                    bieuTuong: 'san-pham',
                  }),
                ])
          );
        } catch (loi) {
          vung.append(el('p', { lop: 'mo-chu', vanBan: `Không tải được báo cáo: ${loi.message}` }));
        }
      }

      taiLai();
      return el('div', {}, [
        el('div', { lop: 'thanh-cong-cu' }, [
          el('label', { lop: 'truong truong-ngan' }, [el('span', { vanBan: 'Số lượng' }), oTop]),
          el('div', { lop: 'day-khoang-cach' }),
          nutXuat('sanpham', { top }),
        ]),
        vung,
      ]);
    }

    /** Tab 3 — nhập hàng và chi phí. */
    function tabNhapHang() {
      const vung = el('div', {});

      /** Nạp báo cáo nhập hàng theo nhà cung cấp và theo tháng. */
      async function taiLai() {
        xoaHet(vung);
        try {
          const du = await api.doc('/api/baocao/nhap-hang', { ...BO_LOC });
          const tongQuan = du.tongQuan ?? {};
          const theoNcc = du.theoNhaCungCap ?? [];
          const theoThang = du.theoThang ?? [];
          const sanPhamNhapNhieu = du.sanPhamNhapNhieu ?? [];

          vung.append(
            el('div', { lop: 'luoi-thong-ke', thuocTinh: { style: 'padding:16px 18px 0' } }, [
              theSoLieu({
                nhan: 'Tổng chi phí nhập hàng',
                giaTri: tien(tongQuan.tongChiPhi ?? 0),
                phu: 'Chỉ tính phiếu đã hoàn thành',
                bieuTuong: 'tien',
              }),
              theSoLieu({
                nhan: 'Số phiếu nhập',
                giaTri: so(tongQuan.tongPhieu ?? 0),
                sac: 'sac-steel',
                bieuTuong: 'phieu-nhap',
              }),
              theSoLieu({
                nhan: 'Nhà cung cấp tham gia',
                giaTri: so(theoNcc.length),
                sac: 'sac-matcha',
                bieuTuong: 'nha-cung-cap',
              }),
            ]),
            el('div', { thuocTinh: { style: 'padding:16px 18px;display:grid;gap:16px' } }, [
              theoThang.length
                ? the({
                    tieuDe: 'Chi phí nhập hàng theo tháng',
                    than: bieuDoNgang(
                      theoThang
