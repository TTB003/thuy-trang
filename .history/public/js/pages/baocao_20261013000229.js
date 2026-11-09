/**
 * Trang NHÓM 12 — Báo cáo và thống kê (CN12.1 → CN12.6).
 * Gồm: doanh thu, sản phẩm bán chạy, nhập hàng, tồn kho, khách hàng,
 * khách hàng thân thiết — kèm chức năng kết xuất CSV.
 */
'use strict';

import { api } from '../api.js';
import { phanTram, so, taiTep, tenTepCoNgay, tien, tienRutGon, vietTat } from '../format.js';
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
  xoaHet,
} from '../ui.js';

/** Bộ lọc thời gian dùng chung cho các báo cáo. */
const BO_LOC = { tuNgay: '', denNgay: '' };

/** Chuyển cấu trúc báo cáo của máy chủ thành nội dung CSV. */
export function baoCaoSangCsv(baoBieu) {
  const thoat = (giaTri) => {
    const chuoi = giaTri === null || giaTri === undefined ? '' : String(giaTri);
    return `"${chuoi.replace(/"/g, '""')}"`;
  };
  const dong = [baoBieu.cot.map(thoat).join(',')];
  for (const hang of baoBieu.dong) dong.push(hang.map(thoat).join(','));
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

/** Màn hình báo cáo và thống kê. */
export const manHinh = {
  ma: 'baocao',
  tieuDe: 'Báo cáo & thống kê',
  moTa: 'Doanh thu, sản phẩm bán chạy, nhập hàng, tồn kho và hành vi khách hàng.',
  bieuTuong: 'bao-cao',
  quyen: 'report.view',

  async hienThi(container) {
    /** Hàm nạp lại của từng tab, dùng cho bộ lọc thời gian dùng chung. */
    const hamTaiLai = {};

    /** Tab 1 — doanh thu theo ngày/tháng/năm. */
    function tabDoanhThu() {
      hamTaiLai['doanh-thu'] = taiLai;
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
      hamTaiLai['san-pham'] = taiLai;
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
      hamTaiLai['nhap-hang'] = taiLai;
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
                        .slice(0, 12)
                        .map((muc) => ({ nhan: String(muc.thang), giaTri: Number(muc.chiPhi) })),
                      { dinhDang: (v) => tienRutGon(v) }
                    ),
                  })
                : null,
              theoNcc.length
                ? el('div', { lop: 'the' }, [
                    el('div', { lop: 'the-dau' }, [
                      el('div', {}, [el('h2', { vanBan: 'Chi phí theo nhà cung cấp' })]),
                    ]),
                    el('div', { lop: 'the-than day' }, [
                      bangPhu({
                        cot: [
                          { tieuDe: 'Mã NCC', lop: 'so', truong: 'maNCC' },
                          { tieuDe: 'Nhà cung cấp', truong: 'tenNCC' },
                          { tieuDe: 'Số phiếu', lop: 'so', truong: 'soPhieu' },
                          { tieuDe: 'Tổng chi phí', lop: 'so', lay: (dong) => tien(dong.tongChiPhi) },
                        ],
                        duLieu: theoNcc,
                      }),
                    ]),
                  ])
                : null,
              sanPhamNhapNhieu.length
                ? el('div', { lop: 'the' }, [
                    el('div', { lop: 'the-dau' }, [
                      el('div', {}, [el('h2', { vanBan: 'Nguyên liệu nhập nhiều nhất' })]),
                    ]),
                    el('div', { lop: 'the-than day' }, [
                      bangPhu({
                        cot: [
                          { tieuDe: 'Sản phẩm', truong: 'tenSP' },
                          { tieuDe: 'Tổng số lượng', lop: 'so', lay: (dong) => so(dong.tongSoLuong) },
                          { tieuDe: 'Tổng chi phí', lop: 'so', lay: (dong) => tien(dong.tongChiPhi) },
                          {
                            tieuDe: 'Giá nhập trung bình',
                            lop: 'so',
                            lay: (dong) => tien(dong.donGiaTrungBinh),
                          },
                        ],
                        duLieu: sanPhamNhapNhieu.slice(0, 10),
                      }),
                    ]),
                  ])
                : null,
              theoNcc.length === 0
                ? oTrong({
                    tieuDe: 'Chưa có phiếu nhập nào hoàn thành',
                    moTa: 'Duyệt phiếu nhập ở trang Phiếu nhập hàng để số liệu được ghi nhận.',
                    bieuTuong: 'phieu-nhap',
                  })
                : null,
            ])
          );
        } catch (loi) {
          vung.append(el('p', { lop: 'mo-chu', vanBan: `Không tải được báo cáo nhập hàng: ${loi.message}` }));
        }
      }

      taiLai();
      return el('div', {}, [
        el('div', { lop: 'thanh-cong-cu' }, [
          el('div', { lop: 'day-khoang-cach' }),
          nutXuat('nhaphang'),
        ]),
        vung,
      ]);
    }

    /** Tab 4 — tồn kho. */
    function tabTonKho() {
      hamTaiLai['ton-kho'] = taiLai;
      const vung = el('div', {});
      let chiDuoiNguong = false;
      let nguongSapHet = 20;

      const nutLocNguong = nut({
        nhan: 'Lọc dưới ngưỡng cảnh báo',
        bieuTuong: 'loc',
        lop: 'nut-trong nut-nho',
        nghe: () => {
          chiDuoiNguong = !chiDuoiNguong;
          nutLocNguong.classList.toggle('dang-chon', chiDuoiNguong);
          taiLai();
        },
      });

      /** Nạp báo cáo tồn kho; ngưỡng cảnh báo lấy từ chính phản hồi trước đó. */
      async function taiLai() {
        xoaHet(vung);
        try {
          const du = await api.doc('/api/baocao/ton-kho', {
            duoiNguong: chiDuoiNguong ? nguongSapHet : '',
          });
          if (Number.isFinite(Number(du.nguongSapHet))) nguongSapHet = Number(du.nguongSapHet);
          vung.append(veBaoCaoTonKho(du));
        } catch (loi) {
          vung.append(
            el('p', { lop: 'mo-chu', vanBan: `Không tải được báo cáo tồn kho: ${loi.message}` })
          );
        }
      }

      nutLocNguong.addEventListener('click', () => {
        // Nhãn đổi theo trạng thái lọc để người dùng biết đang bật hay tắt.
        nutLocNguong.querySelector('.nhan').textContent = chiDuoiNguong
          ? 'Bỏ lọc dưới ngưỡng'
          : 'Lọc dưới ngưỡng cảnh báo';
      });

      taiLai();
      return el('div', {}, [
        el('div', { lop: 'thanh-cong-cu' }, [
          el('div', { lop: 'day-khoang-cach' }),
          nutLocNguong,
          nutXuat('tonkho'),
        ]),
        vung,
      ]);
    }

    /** Tab 5 — khách hàng theo độ tuổi, giới tính và sở thích. */
    function tabKhachHang() {
      hamTaiLai['khach-hang'] = taiLai;
      const vung = el('div', {});

      /** Nạp báo cáo khách hàng. */
      async function taiLai() {
        xoaHet(vung);
        try {
          const du = await api.doc('/api/baocao/khach-hang');
          const tq = du.tongQuan ?? {};
          vung.append(
            el('div', { lop: 'luoi-thong-ke', thuocTinh: { style: 'padding:16px 18px 0' } }, [
              theSoLieu({
                nhan: 'Tổng khách hàng',
                giaTri: so(tq.tongKhachHang ?? 0),
                bieuTuong: 'khach-hang',
              }),
              theSoLieu({
                nhan: 'Đang hoạt động',
                giaTri: so(tq.dangHoatDong ?? 0),
                sac: 'sac-matcha',
                bieuTuong: 'tick',
              }),
              theSoLieu({
                nhan: 'Đang bị khóa',
                giaTri: so(tq.biKhoa ?? 0),
                sac: 'sac-chili',
                bieuTuong: 'khoa',
              }),
              theSoLieu({
                nhan: 'Tổng điểm đang lưu hành',
                giaTri: so(tq.tongDiem ?? 0),
                sac: 'sac-honey',
                bieuTuong: 'diem-thuong',
              }),
            ]),
            el('div', { thuocTinh: { style: 'padding:16px 18px;display:grid;gap:16px' } }, [
              the({
                tieuDe: 'Phân bố theo nhóm tuổi',
                than: (du.theoDoTuoi ?? []).length
                  ? bieuDoNgang(
                      du.theoDoTuoi.map((muc) => ({
                        nhan: String(muc.nhomTuoi),
                        giaTri: Number(muc.soLuong),
                      })),
                      { dinhDang: (v) => `${so(v)} khách` }
                    )
                  : oTrong({ tieuDe: 'Chưa có dữ liệu ngày sinh', bieuTuong: 'khach-hang' }),
              }),
              el('div', { lop: 'bao-cao-luoi' }, [
                the({
                  tieuDe: 'Phân bố theo giới tính',
                  than: (du.theoGioiTinh ?? []).length
                    ? bangPhu({
                        cot: [
                          { tieuDe: 'Giới tính', truong: 'gioiTinh' },
                          { tieuDe: 'Số lượng', lop: 'so', lay: (dong) => so(dong.soLuong) },
                          { tieuDe: 'Tỷ lệ', lop: 'so', lay: (dong) => phanTram(dong.tyLe) },
                        ],
                        duLieu: du.theoGioiTinh,
                      })
                    : oTrong({ tieuDe: 'Chưa có dữ liệu', bieuTuong: 'khach-hang' }),
                }),
                the({
                  tieuDe: 'Khách hàng mới theo tháng',
                  than: (du.khachMoiTheoThang ?? []).length
                    ? bangPhu({
                        cot: [
                          { tieuDe: 'Tháng', truong: 'thang' },
                          { tieuDe: 'Số khách mới', lop: 'so', lay: (dong) => so(dong.soLuong) },
                        ],
                        duLieu: du.khachMoiTheoThang.slice(0, 12),
                      })
                    : oTrong({ tieuDe: 'Chưa có dữ liệu', bieuTuong: 'lich' }),
                }),
              ]),
              the({
                tieuDe: 'Sở thích theo ngành hàng đã mua',
                ghiChu: 'Số khách hàng khác nhau đã mua từng loại sản phẩm.',
                than: (du.soThichTheoNganhHang ?? []).length
                  ? bangPhu({
                      cot: [
                        { tieuDe: 'Loại sản phẩm', truong: 'soThich' },
                        { tieuDe: 'Số khách hàng', lop: 'so', lay: (dong) => so(dong.soKhachHang) },
                        { tieuDe: 'Tổng số lượng', lop: 'so', lay: (dong) => so(dong.tongSoLuong) },
                      ],
                      duLieu: du.soThichTheoNganhHang,
                    })
                  : oTrong({ tieuDe: 'Chưa có đơn hàng hoàn thành', bieuTuong: 'bao-cao' }),
              }),
              the({
                tieuDe: 'Sở thích khách hàng tự khai báo',
                than: (du.soThichTuKhaiBao ?? []).length
                  ? bangPhu({
                      cot: [
                        { tieuDe: 'Sở thích', truong: 'soThich' },
                        { tieuDe: 'Số khách hàng', lop: 'so', lay: (dong) => so(dong.soLuong) },
                      ],
                      duLieu: du.soThichTuKhaiBao,
                    })
                  : oTrong({ tieuDe: 'Chưa có khách hàng khai báo sở thích', bieuTuong: 'khach-hang' }),
              }),
            ])
          );
        } catch (loi) {
          vung.append(el('p', { lop: 'mo-chu', vanBan: `Không tải được báo cáo khách hàng: ${loi.message}` }));
        }
      }

      taiLai();
      return el('div', {}, [
        el('div', { lop: 'thanh-cong-cu' }, [el('div', { lop: 'day-khoang-cach' }), nutXuat('khachhang')]),
        vung,
      ]);
    }

    /** Tab 6 — khách hàng thân thiết. */
    function tabThanThiet() {
      hamTaiLai['than-thiet'] = taiLai;
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

      /** Nạp danh sách khách hàng chi tiêu cao nhất. */
      async function taiLai() {
        xoaHet(vung);
        try {
          const du = await api.doc('/api/baocao/khach-hang-than-thiet', { top });
          const items = du.items ?? [];
          vung.append(
            el('div', { thuocTinh: { style: 'padding:16px 18px' } }, [
              items.length
                ? the({
                    tieuDe: `Top ${top} khách hàng thân thiết`,
                    ghiChu: 'Xếp theo tổng chi tiêu của các đơn đã hoàn thành.',
                    than: el('div', { lop: 'the-than day' }, [
                      bang({
                        cot: [
                          { tieuDe: 'Mã', truong: 'maKH', lop: 'so' },
                          { tieuDe: 'Họ tên', truong: 'hoTen', lop: 'manh' },
                          { tieuDe: 'Điện thoại', truong: 'sdt', lop: 'so' },
                          { tieuDe: 'Điểm tích lũy', lop: 'so', lay: (ban) => so(ban.diemTichLuy) },
                          { tieuDe: 'Số đơn', lop: 'so', lay: (ban) => so(ban.soDon) },
                          { tieuDe: 'Tổng chi tiêu', lop: 'so', lay: (ban) => tien(ban.tongChiTieu) },
                          { tieuDe: 'Trạng thái', dung: (ban) => nhan(ban.trangThai) },
                        ],
                        duLieu: items,
                      }),
                    ]),
                  })
                : oTrong({
                    tieuDe: 'Chưa có khách hàng thân thiết',
                    moTa: 'Số liệu dựa trên các đơn hàng đã hoàn thành.',
                    bieuTuong: 'khach-hang',
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
          nutXuat('khachhangthanthiet', { top }),
        ]),
        vung,
      ]);
    }

    const tabs = khuTab([
      { ma: 'doanh-thu', nhan: 'Doanh thu', dung: tabDoanhThu },
      { ma: 'san-pham', nhan: 'Sản phẩm bán chạy', dung: tabSanPham },
      { ma: 'nhap-hang', nhan: 'Nhập hàng & chi phí', dung: tabNhapHang },
      { ma: 'ton-kho', nhan: 'Tồn kho', dung: tabTonKho },
      { ma: 'khach-hang', nhan: 'Khách hàng', dung: tabKhachHang },
      { ma: 'than-thiet', nhan: 'Khách hàng thân thiết', dung: tabThanThiet },
    ]);

    container.append(
      el('div', { lop: 'the', thuocTinh: { style: 'margin-bottom:16px' } }, [
        thanhLocThoiGian({ khiDoi: () => taiLaiTatCa() }),
      ]),
      the({
        tieuDe: 'Báo cáo & thống kê',
        ghiChu: 'Chọn nhóm báo cáo cần xem. Nút "Xuất CSV" tải tệp theo bộ lọc đang áp dụng.',
        than: el('div', {}, [tabs.tabEl, tabs.thanEl]),
        lopThan: 'the-than day',
      })
    );

    /* Bộ lọc thời gian dùng chung chỉ nạp lại đúng tab đang mở. */
    function taiLaiTatCa() {
      const ham = hamTaiLai[tabs.dangChon];
      if (typeof ham === 'function') ham();
    }
  },
};

/** Vẽ toàn bộ nội dung báo cáo tồn kho (dùng chung cho tab tồn kho). */
function veBaoCaoTonKho(du) {
  const tq = du.tongQuan ?? {};
  const items = du.items ?? [];
  const theoLoai = du.theoLoai ?? [];
  return el('div', {}, [
    el('div', { lop: 'luoi-thong-ke', thuocTinh: { style: 'padding:16px 18px 0' } }, [
      theSoLieu({
        nhan: 'Số sản phẩm',
        giaTri: so(tq.tongSanPham ?? 0),
        bieuTuong: 'san-pham',
      }),
      theSoLieu({
        nhan: 'Tổng số lượng tồn',
        giaTri: so(tq.tongSoLuong ?? 0),
        sac: 'sac-steel',
        bieuTuong: 'kho',
      }),
      theSoLieu({
        nhan: 'Tổng giá trị tồn kho',
        giaTri: tien(tq.tongGiaTriTon ?? 0),
        sac: 'sac-matcha',
        bieuTuong: 'tien',
      }),
      theSoLieu({
        nhan: 'Sản phẩm dưới ngưỡng',
        giaTri: so(du.canhBao?.soLuongCanhBao ?? 0),
        phu: `Ngưỡng cảnh báo: ${so(du.nguongSapHet ?? 0)} đơn vị`,
        sac: 'sac-chili',
        bieuTuong: 'canh-bao',
      }),
    ]),
    el('div', { thuocTinh: { style: 'padding:16px 18px;display:grid;gap:16px' } }, [
      theoLoai.length
        ? the({
            tieuDe: 'Giá trị tồn kho theo loại sản phẩm',
            than: bieuDoNgang(
              theoLoai.map((loai) => ({ nhan: loai.tenLoai, giaTri: Number(loai.tongGiaTriTon) })),
              { dinhDang: (v) => tienRutGon(v) }
            ),
          })
        : null,
      items.length
        ? el('div', { lop: 'the' }, [
            el('div', { lop: 'the-dau' }, [
              el('div', {}, [
                el('h2', { vanBan: 'Chi tiết tồn kho từng sản phẩm' }),
                el('p', {
                  lop: 'ghi-chu',
                  vanBan: 'Sắp xếp theo số lượng tồn tăng dần để dễ nhận biết mặt hàng cần nhập.',
                }),
              ]),
            ]),
            el('div', { lop: 'the-than day' }, [
              bang({
                cot: [
                  { tieuDe: 'Mã', truong: 'maSP', lop: 'so' },
                  { tieuDe: 'Sản phẩm', truong: 'tenSP', lop: 'manh' },
                  { tieuDe: 'Loại', truong: 'tenLoai', lop: 'mo' },
                  { tieuDe: 'Giá bán', lop: 'so', lay: (ban) => tien(ban.gia) },
                  { tieuDe: 'Tồn kho', lop: 'so', lay: (ban) => so(ban.soLuong) },
                  { tieuDe: 'Giá trị tồn', lop: 'so', lay: (ban) => tien(ban.giaTriTon) },
                  { tieuDe: 'Trạng thái', dung: (ban) => nhan(ban.trangThai) },
                ],
                duLieu: items,
              }),
            ]),
          ])
        : oTrong({ tieuDe: 'Chưa có sản phẩm nào', bieuTuong: 'san-pham' }),
    ]),
  ]);
}
