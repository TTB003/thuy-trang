/**
 * Trang NHÓM 11 — Quản lý khảo sát khách hàng (CN11.1 → CN11.6),
 * bao gồm soạn câu hỏi, gửi đến tài khoản khách hàng và xem kết quả.
 */
'use strict';

import { api } from '../api.js';
import { danhSach } from '../store.js';
import { ngay, ngayChoInput, phanTram, so, soDienThoai, vietTat } from '../format.js';
import {
  bangPhu,
  baoLoiApi,
  bieuDoNgang,
  canhBao,
  dangXuLy,
  el,
  hopThoai,
  moTaCot,
  nhan,
  nut,
  nutBieuTuong,
  oTrong,
  thanhCong,
  theSoLieu,
  truong,
  xoaHet,
  xacNhan,
} from '../ui.js';
import { taoTrangCrud, cotSo, cotTrangThai } from '../trang-crud.js';

/* ----------------------------- QUẢN LÝ CÂU HỎI ---------------------------- */

/** Mở hộp thoại soạn danh sách câu hỏi của một khảo sát (CN11.3). */
async function moQuanLyCauHoi(ban, veBang) {
  const vungDanhSach = el('div', {});

  const nutThem = nut({
    nhan: 'Thêm câu hỏi',
    bieuTuong: 'them',
    chinh: true,
    nghe: () => moBieuMauCauHoi(null, taiLaiDanhSach),
  });

  const hop = hopThoai({
    tieuDe: `Câu hỏi khảo sát: ${ban.tieuDe}`,
    moTa: 'Câu hỏi lựa chọn cần ít nhất 2 lựa chọn, phân tách bằng dấu "|".',
    than: el('div', {}, [
      el('div', { lop: 'chia-deu', thuocTinh: { style: 'margin-bottom:12px' } }, [
        el('span', { lop: 'mo-chu nho-chu', vanBan: 'Không thể thêm câu hỏi khi khảo sát đã đóng.' }),
        nutThem,
      ]),
      vungDanhSach,
    ]),
    nutChan: [nut({ nhan: 'Đóng', lop: 'nut-trong', nghe: () => hop.dong() })],
    rong: true,
    khiDong: () => {
      if (veBang) veBang();
    },
  });

  /** Nạp và vẽ lại danh sách câu hỏi. */
  async function taiLaiDanhSach() {
    xoaHet(vungDanhSach);
    let khaoSat;
    try {
      khaoSat = await api.doc(`/api/khaosat/${ban.maKS}`);
    } catch (loi) {
      baoLoiApi(loi, 'Không tải được câu hỏi');
      return;
    }

    nutThem.disabled = khaoSat.trangThai !== 'Đang mở';

    if (!khaoSat.cauHoi || khaoSat.cauHoi.length === 0) {
      vungDanhSach.append(
        oTrong({
          tieuDe: 'Khảo sát chưa có câu hỏi',
          moTa: 'Hãy thêm ít nhất một câu hỏi trước khi gửi cho khách hàng.',
          bieuTuong: 'khao-sat',
        })
      );
      return;
    }

    vungDanhSach.append(
      bangPhu({
        cot: [
          { tieuDe: 'TT', lop: 'so', lay: (dong) => so(dong.thuTu) },
          { tieuDe: 'Nội dung câu hỏi', truong: 'noiDung' },
          { tieuDe: 'Loại', truong: 'loaiCauHoi', lop: 'mo' },
          {
            tieuDe: 'Lựa chọn',
            lop: 'mo',
            lay: (dong) => (dong.luaChonList?.length ? dong.luaChonList.join(' · ') : '—'),
          },
          {
            tieuDe: 'Bắt buộc',
            dung: (dong) =>
              Number(dong.batBuoc) === 1
                ? nhan('Bắt buộc', 'nhan-cam')
                : nhan('Không', 'nhan-trung-tinh'),
          },
          {
            tieuDe: 'Thao tác',
            lop: 'cot-thao-tac',
            dung: (dong) =>
              el('div', { lop: 'gon', thuocTinh: { style: 'justify-content:flex-end' } }, [
                nutBieuTuong({
                  bieuTuong: 'sua',
                  nhan: 'Sửa câu hỏi',
                  nghe: () => moBieuMauCauHoi(dong, taiLaiDanhSach),
                }),
                nutBieuTuong({
                  bieuTuong: 'xoa',
                  nhan: 'Xóa câu hỏi',
                  nghe: () => xoaCauHoi(dong, taiLaiDanhSach),
                }),
              ]),
          },
        ],
        duLieu: khaoSat.cauHoi,
      })
    );
  }

  await taiLaiDanhSach();
  return hop;
}

/** Hộp thoại thêm / sửa một câu hỏi. */
function moBieuMauCauHoi(cauHoi, sauKhiXong) {
  const laSua = Boolean(cauHoi);
  const bieuMau = el('form', { thuocTinh: { novalidate: true } }, [
    truong({
      ten: 'noiDung',
      nhan: 'Nội dung câu hỏi',
      loai: 'textarea',
      batBuoc: true,
      giaTri: cauHoi?.noiDung ?? '',
      rong: true,
      thuocTinh: { maxlength: 500 },
    }),
    truong({
      ten: 'loaiCauHoi',
      nhan: 'Loại câu hỏi',
      loai: 'select',
      batBuoc: true,
      giaTri: cauHoi?.loaiCauHoi ?? danhSach('loaiCauHoi')[0] ?? '',
      tuyChon: { muc: danhSach('loaiCauHoi') },
    }),
    truong({
      ten: 'thuTu',
      nhan: 'Thứ tự',
      loai: 'number',
      giaTri: cauHoi?.thuTu ?? '',
      goiY: 'Để trống sẽ tự động thêm vào cuối danh sách.',
      thuocTinh: { min: 1, step: 1 },
    }),
    truong({
      ten: 'luaChon',
      nhan: 'Các lựa chọn',
      loai: 'text',
      giaTri: cauHoi?.luaChon ?? '',
      goiY: 'Ví dụ: Rất hài lòng|Hài lòng|Bình thường|Không hài lòng',
      rong: true,
      thuocTinh: { maxlength: 500 },
    }),
    truong({
      ten: 'batBuoc',
      nhan: 'Câu hỏi bắt buộc trả lời',
      loai: 'checkbox',
      giaTri: cauHoi ? Number(cauHoi.batBuoc) === 1 : true,
    }),
  ]);

  const nutLuu = nut({
    nhan: laSua ? 'Lưu câu hỏi' : 'Thêm câu hỏi',
    bieuTuong: 'tick',
    chinh: true,
    nghe: () => gui(),
  });

  const hop = hopThoai({
    tieuDe: laSua ? 'Sửa câu hỏi khảo sát' : 'Thêm câu hỏi khảo sát',
    than: bieuMau,
    nutChan: [nut({ nhan: 'Hủy bỏ', lop: 'nut-trong', nghe: () => hop.dong() }), nutLuu],
    rong: true,
  });

  async function gui() {
    const noiDung = bieuMau.querySelector('[name="noiDung"]').value.trim();
    if (!noiDung) {
      canhBao('Thiếu nội dung', 'Vui lòng nhập nội dung câu hỏi.');
      return;
    }
    const duLieu = {
      noiDung,
      loaiCauHoi: bieuMau.querySelector('[name="loaiCauHoi"]').value,
      luaChon: bieuMau.querySelector('[name="luaChon"]').value.trim() || null,
      thuTu: Number(bieuMau.querySelector('[name="thuTu"]').value) || undefined,
      batBuoc: bieuMau.querySelector('[name="batBuoc"]').checked,
    };
    if (!laSua && duLieu.thuTu === undefined) delete duLieu.thuTu;

    dangXuLy(nutLuu, true);
    try {
      // Thêm câu hỏi đi qua địa chỉ của khảo sát; sửa đi qua mã câu hỏi.
      if (laSua) {
        await api.put(`/api/khaosat/cau-hoi/${cauHoi.maCauHoi}`, duLieu);
        thanhCong('Đã lưu câu hỏi');
      } else {
        await api.post(`/api/khaosat/${cauHoi_maKS}/cau-hoi`, duLieu);
        thanhCong('Đã thêm câu hỏi');
      }
      hop.dong();
      await sauKhiXong();
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

/** Xác nhận rồi xóa một câu hỏi khảo sát. */
async function xoaCauHoi(cauHoi, sauKhiXong) {
  const dongY = await xacNhan({
    tieuDe: 'Xóa câu hỏi',
    noiDung: `Xóa câu hỏi "${vietTat(cauHoi.noiDung, 60)}"? Câu hỏi đã có câu trả lời sẽ không xóa được.`,
    nhanDongY: 'Xóa câu hỏi',
    nguyHiem: true,
  });
  if (!dongY) return;
  try {
    await api.xoa(`/api/khaosat/cau-hoi/${cauHoi.maCauHoi}`);
    thanhCong('Đã xóa câu hỏi');
    await sauKhiXong();
  } catch (loi) {
    baoLoiApi(loi, 'Không xóa được câu hỏi');
  }
}

/** Mã khảo sát đang mở hộp thoại câu hỏi (dùng khi thêm câu hỏi mới). */
let cauHoi_maKS = null;

/* ------------------------------ GỬI KHẢO SÁT ----------------------------- */

/** Mở hộp thoại gửi khảo sát tới tài khoản khách hàng (mục 4.1.6). */
async function moGuiKhaoSat(ban, veBang) {
  let danhSachKhachHang = [];
  try {
    const ketQua = await api.doc('/api/khachhang/hoat-dong', { pageSize: 200 });
    danhSachKhachHang = Array.isArray(ketQua) ? ketQua : (ketQua?.items ?? []);
  } catch (loi) {
    baoLoiApi(loi, 'Không tải được danh sách khách hàng');
    return;
  }

  const khoiChon = el('div', { lop: 'danh-sach-chon' });
  for (const kh of danhSachKhachHang) {
    khoiChon.append(
      el('label', { lop: 'o-chon' }, [
        el('input', { kieu: 'checkbox', thuocTinh: { value: String(kh.maKH) } }),
        el('span', { vanBan: `${kh.hoTen} — ${soDienThoai(kh.sdt)}` }),
      ])
    );
  }

  let nguoiNhanDaGui = [];
  try {
    nguoiNhanDaGui = await api.doc(`/api/khaosat/${ban.maKS}/nguoi-nhan`);
  } catch {
    nguoiNhanDaGui = [];
  }
  const daGui = new Set((nguoiNhanDaGui ?? []).map((muc) => Number(muc.maKH)));

  const than = el('div', {}, [
    moTaCot([
      { nhan: 'Khảo sát', giaTri: ban.tieuDe },
      { nhan: 'Số câu hỏi', giaTri: ban.soCauHoi, so: true },
      {
        nhan: 'Đã gửi cho',
        giaTri: `${daGui.size} khách hàng`,
        so: true,
      },
    ]),
    el('p', {
      lop: 'mo-chu nho-chu',
      vanBan:
        'Chọn khách hàng cần gửi. Khách hàng đã nhận khảo sát này sẽ tự động được bỏ qua. Mỗi khách hàng hoàn thành khảo sát nhận 5 điểm thưởng.',
      thuocTinh: { style: 'margin-top:14px' },
    }),
    el('div', { lop: 'nhom-nut', thuocTinh: { style: 'margin:12px 0' } }, [
      nut({
        nhan: 'Chọn tất cả',
        lop: 'nut-trong nut-nho',
        nghe: () => {
          for (const o of khoiChon.querySelectorAll('input')) {
            if (!daGui.has(Number(o.value))) o.checked = true;
          }
        },
      }),
      nut({
        nhan: 'Bỏ chọn',
        lop: 'nut-trong nut-nho',
        nghe: () => {
          for (const o of khoiChon.querySelectorAll('input')) o.checked = false;
        },
      }),
    ]),
    khoiChon,
  ]);

  const nutGui = nut({
    nhan: 'Gửi khảo sát',
    bieuTuong: 'chia-se',
    chinh: true,
    nghe: () => gui(),
  });

  const hop = hopThoai({
    tieuDe: 'Gửi khảo sát đến khách hàng',
    moTa: `Mã khảo sát ${ban.maKS}`,
    than,
    nutChan: [nut({ nhan: 'Đóng', lop: 'nut-trong', nghe: () => hop.dong() }), nutGui],
    rong: true,
  });

  async function gui() {
    const danhSachMaKH = Array.from(khoiChon.querySelectorAll('input:checked'))
      .map((o) => Number(o.value))
      .filter((ma) => !daGui.has(ma));
