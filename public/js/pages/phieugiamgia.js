'use strict';

import { api } from '../api.js';
import { ngayGio, tien } from '../format.js';
import { baoLoiApi, el, truong, nut, bangPhu, thanhCong, canhBao, xoaHet } from '../ui.js';

/** Quản lý phiếu giảm giá cho Admin, quản lý và nhân viên CSKH. */
export const manHinh = {
  ma: 'phieugiamgia',
  tieuDe: 'Phiếu giảm giá',
  moTa: 'Tạo phiếu riêng cho khách hàng và theo dõi tình trạng sử dụng.',
  bieuTuong: 'khuyen-mai',
  quyen: 'voucher.manage',
  async hienThi(container) {
    const doiTuong = truong({ ten: 'doiTuong', nhan: 'Đối tượng áp dụng', loai: 'select', batBuoc: true, giaTri: 'Tất cả', tuyChon: { muc: ['Tất cả', 'Nam', 'Nữ', 'Khách mới'] } });
    const ten = truong({ ten: 'tieuDe', nhan: 'Tên phiếu', batBuoc: true, thuocTinh: { maxlength: 150 }, goiY: 'Ví dụ: Ưu đãi khách hàng thân thiết' });
    const moTa = truong({ ten: 'moTa', nhan: 'Mô tả', loai: 'textarea', thuocTinh: { maxlength: 500 } });
    const phanTram = truong({ ten: 'phanTramGiam', nhan: 'Giảm (%)', loai: 'number', batBuoc: true, thuocTinh: { min: 1, max: 100, step: 1 } });
    const mucToiDa = truong({ ten: 'giamToiDa', nhan: 'Giảm tối đa (đồng, để trống nếu không giới hạn)', loai: 'number', thuocTinh: { min: 1, step: 1 } });
    const soLan = truong({ ten: 'soLuongToiDa', nhan: 'Tổng lượt sử dụng (để trống nếu không giới hạn)', loai: 'number', thuocTinh: { min: 1, step: 1, placeholder: 'Không giới hạn' } });
    const loai = truong({ ten: 'loai', nhan: 'Loại phiếu', loai: 'select', giaTri: 'CSKH', tuyChon: { muc: ['CSKH', 'Khuyến mãi', 'Bù đơn', 'Khác'] } });
    const hetHan = truong({ ten: 'ngayHetHan', nhan: 'Ngày hết hạn (không bắt buộc)', loai: 'date' });
    const form = el('form', { lop: 'luoi-truong form-phieu-giam-gia' }, [
      doiTuong, ten, moTa, phanTram, mucToiDa, soLan, loai, hetHan,
      el('p', { lop: 'mo-chu nho-chu', vanBan: 'Khách mới là khách đăng ký trong 30 ngày gần đây. Mỗi khách nhận một phiếu và chỉ dùng được một lần.' }),
      nut({ nhan: 'Tạo phiếu và gửi thông báo', bieuTuong: 'them', chinh: true, loai: 'submit' }),
    ]);
    const danhSach = el('div', { lop: 'bang-phieu-giam-gia' });
    const tim = el('input', { kieu: 'search', thuocTinh: { placeholder: 'Tìm theo mã, tên phiếu hoặc khách nhận' } });
    const loc = el('select', {});
    for (const trangThai of ['', 'Đang áp dụng', 'Chưa dùng', 'Đã dùng', 'Hết lượt', 'Hết hạn']) loc.append(el('option', { vanBan: trangThai || 'Tất cả trạng thái', thuocTinh: { value: trangThai } }));
    const taiBang = async () => {
      try {
        const data = await api.doc('/api/phieugiamgia', { q: tim.value, trangThai: loc.value, pageSize: 100 });
        xoaHet(danhSach);
        danhSach.append(bangPhu({
          cot: [
            { tieuDe: 'Mã phiếu', truong: 'maCode' },
            { tieuDe: 'Phiếu', truong: 'tieuDe' },
            { tieuDe: 'Loại', truong: 'loaiPhieu' },
            { tieuDe: 'Khách nhận', truong: 'tenKhach' },
            { tieuDe: 'Mức giảm', lay: (r) => `${r.phanTramGiam}%${r.giamToiDa ? ` · tối đa ${tien(r.giamToiDa)}` : ''}` },
            { tieuDe: 'Lượt dùng', lay: (r) => `${r.soLuongDaDung}/${r.soLuongToiDa ?? '∞'}` },
            { tieuDe: 'Khách nhận', truong: 'soKhachNhan' },
            { tieuDe: 'Hạn dùng', lay: (r) => r.ngayHetHan ? ngayGio(r.ngayHetHan) : 'Không giới hạn' },
            { tieuDe: 'Trạng thái', truong: 'trangThai' },
          ],
          duLieu: data?.items ?? [],
        }));
      } catch (error) { baoLoiApi(error, 'Không tải được danh sách phiếu'); }
    };
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const body = Object.fromEntries(new FormData(form));
      body.phanTramGiam = Number(body.phanTramGiam);
      if (body.soLuongToiDa) body.soLuongToiDa = Number(body.soLuongToiDa);
      if (body.giamToiDa) body.giamToiDa = Number(body.giamToiDa);
      try {
        const result = await api.post('/api/phieugiamgia', body);
        thanhCong('Đã tạo và gửi phiếu giảm giá', `${result.maCode} · đã phát cho ${result.soKhachNhan} khách hàng`);
        form.reset(); soLan.querySelector('input').value = ''; loai.querySelector('select').value = 'CSKH';
        await taiBang();
      } catch (error) { baoLoiApi(error, 'Không tạo được phiếu giảm giá'); }
    });
    let timer;
    tim.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(taiBang, 250); });
    loc.addEventListener('change', taiBang);
    container.append(el('section', { lop: 'the' }, [
      el('header', { lop: 'the-dau' }, [el('h2', { vanBan: 'Tạo phiếu giảm giá' })]),
      el('div', { lop: 'the-than' }, [form]),
    ]), el('section', { lop: 'the' }, [
      el('header', { lop: 'the-dau' }, [el('h2', { vanBan: 'Phiếu đã tạo' })]),
      el('div', { lop: 'the-than' }, [el('div', { lop: 'thanh-cong-cu' }, [tim, loc]), danhSach]),
    ]));
    await taiBang();
  },
};
