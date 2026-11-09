/**
 * Trang NHÓM 11 — Quản lý khảo sát khách hàng (CN11.1 → CN11.6),
 * bao gồm soạn câu hỏi, gửi đến tài khoản khách hàng và xem kết quả.
 */
'use strict';

import { api } from '../api.js';
import { danhSach, layNguoiDung } from '../store.js';
import { ngay, ngayChoInput, phanTram, so, soDienThoai, vietTat } from '../format.js';
import {
  bangPhu,
  baoLoiApi,
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

const NHAN_VIEN_TAO_KHAO_SAT = [];

async function napNhanVienTaoKhaoSat() {
  const nguoiDung = layNguoiDung();
  if (nguoiDung?.maNV) {
    NHAN_VIEN_TAO_KHAO_SAT.splice(0, NHAN_VIEN_TAO_KHAO_SAT.length, {
      maNV: nguoiDung.maNV,
      hoTen: nguoiDung.hoTen,
    });
    return;
  }
  const nhanVien = await api.doc('/api/nhanvien/dang-lam-viec');
  NHAN_VIEN_TAO_KHAO_SAT.splice(0, NHAN_VIEN_TAO_KHAO_SAT.length, ...(Array.isArray(nhanVien) ? nhanVien : []));
}

const MUC_NHAN_VIEN_TAO_KHAO_SAT = () => NHAN_VIEN_TAO_KHAO_SAT.map((nv) => ({
  giaTri: nv.maNV,
  nhan: nv.hoTen,
}));

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
        el('span', { lop: 'mo-chu nho-chu', vanBan: 'Hãy hoàn tất câu hỏi trước khi mở khảo sát; khảo sát đã gửi sẽ không nhận thêm câu hỏi.' }),
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

    nutThem.disabled = Boolean(khaoSat.daGui) || Number(khaoSat.soPhieuTraLoi) > 0;

    if (!khaoSat.cauHoi || khaoSat.cauHoi.length === 0) {
      vungDanhSach.append(
        oTrong({
          tieuDe: 'Khảo sát chưa có câu hỏi',
          moTa: 'Thêm câu hỏi khi khảo sát còn ở trạng thái nháp. Khi mở khảo sát, hệ thống sẽ tự gửi đến khách phù hợp.',
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
      tuyChon: { muc: () => danhSach('loaiCauHoi') },
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
      nhan: 'Đáp án để khách chọn',
      loai: 'textarea',
      giaTri: cauHoi?.luaChon ?? '',
      goiY: 'Nhập mỗi đáp án cách nhau bằng dấu |. Ví dụ: Rất hài lòng|Hài lòng|Bình thường|Không hài lòng',
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

  const oLoaiCauHoi = bieuMau.querySelector('[name="loaiCauHoi"]');
  const oLuaChon = bieuMau.querySelector('[name="luaChon"]');
  const truongLuaChon = oLuaChon.closest('.truong');
  const capNhatHienThiLuaChon = () => {
    const canChonDapAn = !['Trả lời ngắn', 'Thang điểm'].includes(oLoaiCauHoi.value);
    truongLuaChon.style.display = canChonDapAn ? '' : 'none';
  };
  oLoaiCauHoi.addEventListener('change', capNhatHienThiLuaChon);
  capNhatHienThiLuaChon();

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
      loaiCauHoi: oLoaiCauHoi.value,
      luaChon: ['Trả lời ngắn', 'Thang điểm'].includes(oLoaiCauHoi.value)
        ? null
        : oLuaChon.value.trim() || null,
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
  const than = el('div', {}, [
    moTaCot([
      { nhan: 'Khảo sát', giaTri: ban.tieuDe },
      { nhan: 'Đối tượng', giaTri: ban.doiTuong || 'Tất cả khách hàng' },
      { nhan: 'Số câu hỏi', giaTri: ban.soCauHoi, so: true },
      { nhan: 'Phần thưởng', giaTri: ban.loaiPhanThuong === 'Phiếu giảm giá' ? `Phiếu giảm ${ban.giaTriPhanThuong}%${ban.giamToiDa ? ` · tối đa ${so(ban.giamToiDa)}đ` : ''}` : `${ban.giaTriPhanThuong ?? 5} điểm` },
      { nhan: 'Giới hạn', giaTri: ban.soLuongToiDa == null ? 'Không giới hạn lượt trả lời' : `${ban.soLuongToiDa} lượt trả lời` },
    ]),
    el('p', {
      lop: 'mo-chu nho-chu',
      vanBan: 'Khảo sát sẽ được gửi tự động đến khách hàng đang hoạt động phù hợp với đối tượng đã chọn. Tài khoản mới cũng sẽ tự nhận khảo sát này.',
      thuocTinh: { style: 'margin-top:14px' },
    }),
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
    dangXuLy(nutGui, true);
    try {
      const ketQua = await api.post(`/api/khaosat/${ban.maKS}/gui`, {});
      thanhCong(
        'Đã gửi khảo sát',
        `Gửi thành công cho ${ketQua?.soGui ?? 0} khách hàng.`
      );
      hop.dong();
      if (veBang) await veBang();
    } catch (loi) {
      baoLoiApi(loi);
    } finally {
      dangXuLy(nutGui, false);
    }
  }
}

/* ------------------------------- KẾT QUẢ -------------------------------- */

/** Mở hộp thoại xem kết quả và thống kê khảo sát (CN11.6). */
async function moKetQua(ban) {
  let thongKe;
  try {
    thongKe = await api.doc(`/api/khaosat/${ban.maKS}/thong-ke`);
  } catch (loi) {
    baoLoiApi(loi, 'Không tải được kết quả khảo sát');
    return;
  }

  const than = el('div', {}, [
    el('div', { lop: 'luoi-thong-ke' }, [
      theSoLieu({
        nhan: 'Người nhận',
        giaTri: so(thongKe.soNguoiNhan),
        bieuTuong: 'nguoi-nhom',
      }),
      theSoLieu({
        nhan: 'Phiếu trả lời',
        giaTri: so(thongKe.soPhieu),
        sac: 'sac-matcha',
        bieuTuong: 'khao-sat',
      }),
      theSoLieu({
        nhan: 'Tỷ lệ phản hồi',
        giaTri: phanTram(thongKe.tyLePhanHoi),
        sac: 'sac-honey',
        bieuTuong: 'bao-cao',
      }),
    ]),
    el('div', { thuocTinh: { style: 'margin-top:20px' } }, [
      thongKe.chiTiet?.length
        ? el('div', { lop: 'ket-qua-khao-sat' }, thongKe.chiTiet.map(veCauHoiKetQua))
        : oTrong({
            tieuDe: 'Chưa có câu trả lời',
            moTa: 'Khách hàng chưa gửi phiếu trả lời nào cho khảo sát này.',
            bieuTuong: 'bao-cao',
          }),
    ]),
    thongKe.chiTiet?.length
      ? el('div', { thuocTinh: { style: 'margin-top:22px' } }, [
          el('h3', { vanBan: 'Danh sách người nhận', thuocTinh: { style: 'font-size:14px;margin-bottom:10px' } }),
          vungNguoiNhan(ban.maKS),
        ])
      : null,
  ]);

  const hop = hopThoai({
    tieuDe: `Kết quả khảo sát: ${thongKe.khaoSat?.tieuDe ?? ban.tieuDe}`,
    moTa: `Mã khảo sát ${ban.maKS} · Loại: ${thongKe.khaoSat?.loaiKS ?? '—'}`,
    than,
    rong: true,
    nutChan: [nut({ nhan: 'Đóng', lop: 'nut-trong', nghe: () => hop.dong() })],
  });
}

/** Khối kết quả của một câu hỏi (biểu đồ tần suất hoặc điểm trung bình). */
function veCauHoiKetQua(cauHoi) {
  const khoi = el('div', { lop: 'dong-ket-qua' }, [
    el('div', { lop: 'cau-hoi', vanBan: cauHoi.noiDung }),
    el('div', { lop: 'gon', thuocTinh: { style: 'margin-bottom:9px' } }, [
      nhan(`${cauHoi.loaiCauHoi}`, 'nhan-xam'),
      el('span', {
        lop: 'nho-chu mo-chu',
        vanBan: `${so(cauHoi.soTraLoi)} câu trả lời`,
      }),
      cauHoi.diemTrungBinh !== null && cauHoi.diemTrungBinh !== undefined
        ? nhan(`Điểm trung bình ${cauHoi.diemTrungBinh}`, 'nhan-cam')
        : null,
    ]),
  ]);

  if (cauHoi.thongKe?.length) {
    for (const muc of cauHoi.thongKe) {
      khoi.append(
        el('div', { lop: 'lua-chon-ket-qua' }, [
          el('span', { lop: 'ten-lua-chon', vanBan: vietTat(muc.giaTri, 40), thuocTinh: { title: muc.giaTri } }),
          el('div', { lop: 'thanh-cot', thuocTinh: { style: 'height:16px;border-radius:5px;background:var(--milk);overflow:hidden' } }, [
            el('span', {
              thuocTinh: {
                style: `display:block;height:100%;width:${Math.max(2, Math.round(muc.tyLe))}%;background:linear-gradient(90deg,var(--caramel),#d8912f);border-radius:5px`,
              },
            }),
          ]),
          el('span', { lop: 'ty-le', vanBan: `${so(muc.soLuong)} · ${phanTram(muc.tyLe)}` }),
        ])
      );
    }
  } else if (cauHoi.traLoi?.length) {
    khoi.append(
      el('div', { thuocTinh: { style: 'max-height:180px;overflow-y:auto' } }, [
        bangPhu({
          cot: [
            { tieuDe: 'Khách hàng', truong: 'hoTen' },
            { tieuDe: 'Trả lời', truong: 'noiDungTraLoi' },
          ],
          duLieu: cauHoi.traLoi,
        }),
      ])
    );
  } else {
    khoi.append(el('p', { lop: 'mo-chu nho-chu', vanBan: 'Chưa có câu trả lời cho câu hỏi này.' }));
  }
  return khoi;
}

/** Vùng hiển thị danh sách khách hàng đã nhận khảo sát (nạp bất đồng bộ). */
function vungNguoiNhan(maKS) {
  const vung = el('div', {}, [el('p', { lop: 'mo-chu nho-chu', vanBan: 'Đang tải…' })]);
  api
    .doc(`/api/khaosat/${maKS}/nguoi-nhan`)
    .then((duLieu) => {
      xoaHet(vung);
      if (!duLieu?.length) {
        vung.append(el('p', { lop: 'mo-chu nho-chu', vanBan: 'Khảo sát chưa được gửi cho ai.' }));
        return;
      }
      vung.append(
        bangPhu({
          cot: [
            { tieuDe: 'Khách hàng', truong: 'hoTen' },
            { tieuDe: 'Điện thoại', lop: 'so', lay: (dong) => soDienThoai(dong.sdt) },
            { tieuDe: 'Ngày gửi', lop: 'so', lay: (dong) => ngay(dong.ngayGui) },
            {
              tieuDe: 'Đã xem',
              dung: (dong) => (Number(dong.daXem) === 1 ? nhan('Đã xem', 'nhan-xam') : nhan('Chưa xem', 'nhan-trung-tinh')),
            },
            {
              tieuDe: 'Đã trả lời',
              dung: (dong) =>
                Number(dong.daTraLoi) === 1 ? nhan('Đã trả lời', 'nhan-xanh') : nhan('Chưa', 'nhan-vang'),
            },
          ],
          duLieu,
        })
      );
    })
    .catch(() => {
      xoaHet(vung);
      vung.append(el('p', { lop: 'mo-chu nho-chu', vanBan: 'Không tải được danh sách người nhận.' }));
    });
  return vung;
}

/* ------------------------------- MÀN HÌNH -------------------------------- */

/** Màn hình quản lý khảo sát. */
export const manHinh = taoTrangCrud({
  ma: 'khaosat',
  tieuDe: 'Khảo sát',
  moTa: 'Soạn câu hỏi cho khảo sát nháp. Khi chuyển khảo sát sang Đang mở, hệ thống tự gửi đến khách phù hợp.',
  bieuTuong: 'khao-sat',
  quyen: 'survey.view',
  duongDanApi: '/api/khaosat',
  tenKhoa: 'maKS',
  truongHienThi: 'tieuDe',
  nhanThem: 'Tạo khảo sát',
  tenTepCsv: 'khao-sat',
  chuanBi: napNhanVienTaoKhaoSat,

  boLoc: [
    { ten: 'loaiKS', nhan: 'Loại khảo sát', danhMuc: 'loaiKhaoSat' },
    { ten: 'trangThai', nhan: 'Trạng thái', danhMuc: 'trangThaiKhaoSat' },
  ],

  cot: [
    { tieuDe: 'Mã', truong: 'maKS', lop: 'so' },
    { tieuDe: 'Tiêu đề', truong: 'tieuDe', lop: 'manh' },
    { tieuDe: 'Loại', truong: 'loaiKS' },
    { tieuDe: 'Đối tượng', truong: 'doiTuong', lop: 'mo' },
    { tieuDe: 'Người tạo', truong: 'tenNhanVien', lop: 'mo' },
    { tieuDe: 'Ngày tạo', lop: 'so', lay: (ban) => ngay(ban.ngayTao) },
    { tieuDe: 'Hạn chót', lop: 'so', lay: (ban) => ngay(ban.hanChot) },
    cotSo('Số câu hỏi', 'soCauHoi'),
    { tieuDe: 'Phần thưởng', lay: (ban) => ban.loaiPhanThuong === 'Phiếu giảm giá' ? `Phiếu ${ban.giaTriPhanThuong}%${ban.giamToiDa ? ` · tối đa ${so(ban.giamToiDa)}đ` : ''}` : `${ban.giaTriPhanThuong ?? 5} điểm` },
    { tieuDe: 'Lượt trả lời', lay: (ban) => ban.soLuongToiDa == null ? `${ban.soPhieuTraLoi} / Không giới hạn` : `${ban.soPhieuTraLoi} / ${ban.soLuongToiDa}` },
    cotTrangThai('Trạng thái', 'trangThai'),
  ],

  truong: [
    {
      ten: 'maNV',
      nhan: 'Nhân viên tạo khảo sát',
      loai: 'select',
      so: true,
      batBuoc: true,
      anKhiSua: true,
      giaTriMacDinh: () => layNguoiDung()?.maNV ?? '',
      tuyChon: { muc: MUC_NHAN_VIEN_TAO_KHAO_SAT, mucRong: '— Chọn nhân viên tạo —' },
    },
    {
      ten: 'tieuDe',
      nhan: 'Tiêu đề khảo sát',
      loai: 'text',
      batBuoc: true,
      goiY: 'Ví dụ: Khảo sát mức độ hài lòng quý IV',
      thuocTinh: { maxlength: 200 },
    },
    {
      ten: 'loaiKS',
      nhan: 'Loại khảo sát',
      loai: 'select',
      batBuoc: true,
      tuyChon: { muc: () => danhSach('loaiKhaoSat'), mucRong: '— Chọn loại khảo sát —' },
    },
    {
      ten: 'doiTuong',
      nhan: 'Đối tượng khảo sát',
      loai: 'select',
      batBuoc: true,
      giaTriMacDinh: 'Tất cả khách hàng',
      tuyChon: {
        muc: [
          { giaTri: 'Tất cả khách hàng', nhan: 'Tất cả' },
          { giaTri: 'Nam', nhan: 'Nam' },
          { giaTri: 'Nữ', nhan: 'Nữ' },
        ],
      },
    },
    {
      ten: 'loaiPhanThuong',
      nhan: 'Phần thưởng khi hoàn thành',
      loai: 'select',
      batBuoc: true,
      giaTriMacDinh: 'Điểm',
      tuyChon: { muc: ['Điểm', 'Phiếu giảm giá'] },
      goiY: 'Chọn điểm tích lũy hoặc phiếu giảm giá một lần.',
    },
    {
      ten: 'giaTriPhanThuong',
      nhan: 'Số điểm hoặc phần trăm giảm',
      loai: 'number',
      batBuoc: true,
      giaTriMacDinh: 5,
      thuocTinh: { min: 1, step: 1 },
      goiY: 'Nếu chọn phiếu giảm giá, nhập phần trăm giảm từ 1 đến 100; nếu chọn điểm, nhập số điểm thưởng.',
    },
    {
      ten: 'giamToiDa',
      nhan: 'Mức giảm tối đa (đồng)',
      loai: 'number',
      thuocTinh: { min: 1, step: 1, placeholder: 'Không giới hạn' },
      goiY: 'Chỉ áp dụng khi phần thưởng là phiếu giảm giá; để trống nếu không giới hạn.',
    },
    {
      ten: 'kieuHetHanPhieu',
      nhan: 'Thời hạn phiếu thưởng',
      loai: 'select',
      giaTriMacDinh: 'Không giới hạn',
      tuyChon: { muc: ['Không giới hạn', 'Sau số ngày', 'Chọn ngày hết hạn'] },
    },
    { ten: 'soNgayHieuLucPhieu', nhan: 'Hết hạn sau (ngày)', loai: 'number', thuocTinh: { min: 1, step: 1 } },
    { ten: 'ngayHetHanPhieu', nhan: 'Ngày hết hạn phiếu', loai: 'date' },
    {
      ten: 'soLuongToiDa',
      nhan: 'Số lượt trả lời tối đa',
      loai: 'number',
      thuocTinh: { min: 1, step: 1, placeholder: 'Để trống để không giới hạn' },
      goiY: 'Khi đủ số lượt, khảo sát sẽ không nhận thêm câu trả lời.',
    },
    {
      ten: 'hanChot',
      nhan: 'Hạn chót trả lời',
      loai: 'date',
      goiY: 'Để trống nếu không giới hạn thời gian.',
    },
    {
      ten: 'trangThai',
      nhan: 'Trạng thái',
      loai: 'select',
      anKhiTao: true,
      tuyChon: { muc: () => danhSach('trangThaiKhaoSat') },
      goiY: 'Khảo sát "Đã đóng" sẽ không nhận thêm câu trả lời.',
    },
    {
      ten: 'moTa',
      nhan: 'Mô tả / mục đích khảo sát',
      loai: 'textarea',
      rong: true,
      thuocTinh: { maxlength: 500 },
    },
  ],

  sauKhiTaoBieuMau: (form) => {
    const loaiThuong = form.querySelector('[name="loaiPhanThuong"]');
    const loaiHan = form.querySelector('[name="kieuHetHanPhieu"]');
    const cap = form.querySelector('[name="giamToiDa"]')?.closest('.truong');
    const han = loaiHan?.closest('.truong');
    const soNgay = form.querySelector('[name="soNgayHieuLucPhieu"]')?.closest('.truong');
    const ngay = form.querySelector('[name="ngayHetHanPhieu"]')?.closest('.truong');
    const capNhat = () => {
      const laPhieu = loaiThuong?.value === 'Phiếu giảm giá';
      if (cap) cap.hidden = !laPhieu;
      if (han) han.hidden = !laPhieu;
      if (soNgay) soNgay.hidden = !laPhieu || loaiHan?.value !== 'Sau số ngày';
      if (ngay) ngay.hidden = !laPhieu || loaiHan?.value !== 'Chọn ngày hết hạn';
    };
    loaiThuong?.addEventListener('change', capNhat);
    loaiHan?.addEventListener('change', capNhat);
    capNhat();
  },

  truocKhiGui: (duLieu) => {
    if (duLieu.hanChot) duLieu.hanChot = ngayChoInput(duLieu.hanChot);
    if (duLieu.ngayHetHanPhieu) duLieu.ngayHetHanPhieu = ngayChoInput(duLieu.ngayHetHanPhieu);
    return duLieu;
  },

  thaoTacThem: [
    {
      nhan: 'Câu hỏi',
      bieuTuong: 'khao-sat',
      thucHien: (ban, veBang) => {
        cauHoi_maKS = ban.maKS;
        return moQuanLyCauHoi(ban, veBang);
      },
    },
  ],

  hanhDongThem: [
    {
      nhan: 'Kết quả',
      bieuTuong: 'bao-cao',
      thucHien: (ban) => moKetQua(ban),
    },
  ],
});
