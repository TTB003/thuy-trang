/**
 * Bảng chọn mặt hàng dùng chung cho phiếu nhập hàng và đơn hàng.
 *
 * Mỗi dòng gồm: chọn sản phẩm, số lượng, đơn giá (tùy chọn) và thành tiền.
 * Người dùng có thể thêm dòng, xóa dòng; số lượng và đơn giá nhập trực tiếp.
 */
'use strict';

import { so, tien } from './format.js';
import { el, nutBieuTuong, xoaHet } from './ui.js';

/** Định dạng số cho ô nhập: 15000 -> "15.000". */
function dinhDangSoO(giaTri) {
  const so_ = Number(String(giaTri ?? '').replace(/\./g, '').replace(/[^\d-]/g, ''));
  return Number.isFinite(so_) && so_ !== 0 ? so(so_) : '';
}

/** Đọc số từ ô nhập có dấu phân cách nghìn. */
function docSoO(giaTri) {
  const chuSo = String(giaTri ?? '').replace(/\./g, '').replace(/[^\d-]/g, '');
  const so_ = Number(chuSo);
  return Number.isFinite(so_) ? so_ : 0;
}

/**
 * Tạo bảng chọn mặt hàng.
 * @param {object} tuyChon
 * @param {Array<{maSP:number, tenSP:string, gia:number, tonKho?:number}>} tuyChon.danhSachSanPham
 * @param {boolean} [tuyChon.hienDonGia] hiện cột đơn giá (phiếu nhập cần, đơn hàng lấy giá bán)
 * @param {Array<{maSP:number, soLuong:number, donGia?:number}>} [tuyChon.giaTriBanDau]
 * @param {(dong:object) => void} [tuyChon.khiDoi] gọi lại mỗi khi bảng thay đổi
 * @returns {{ el: HTMLElement, layChiTiet: Function, tongTien: Function }}
 */
export function taoBangMatHang(tuyChon = {}) {
  const {
    danhSachSanPham = [],
    hienDonGia = true,
    giaTriBanDau = [],
    khiDoi = null,
  } = tuyChon;

  const bangSanPham = new Map(danhSachSanPham.map((sp) => [Number(sp.maSP), sp]));
  const vungDong = el('div', {});
  const vungTong = el('div', { lop: 'bang-tong' });
  const hop = el('div', {});

  /** Gọi lại hàm theo dõi sau mỗi thay đổi. */
  function thayDoi() {
    if (khiDoi) khiDoi({ tongTien: tinhTongTien(), soDong: demDong() });
  }

  /** Tính tổng tiền của toàn bộ dòng hợp lệ. */
  function tinhTongTien() {
    let tong = 0;
    for (const dong of vungDong.querySelectorAll('.gio-hang-dong')) {
      const soLuong = docSoO(dong.querySelector('[data-vai-tro="soLuong"]')?.value);
      const donGia = hienDonGia
        ? docSoO(dong.querySelector('[data-vai-tro="donGia"]')?.value)
        : giaCuaDong(dong);
      tong += soLuong * donGia;
    }
    return tong;
  }

  /** Giá bán của sản phẩm đang chọn trong một dòng. */
  function giaCuaDong(dong) {
    const maSP = Number(dong.querySelector('[data-vai-tro="maSP"]')?.value);
    return Number(bangSanPham.get(maSP)?.gia ?? 0);
  }

  /** Đếm số dòng đang có. */
  function demDong() {
    return vungDong.querySelectorAll('.gio-hang-dong').length;
  }

  /** Vẽ lại phần tổng tiền. */
  function veTong() {
    xoaHet(vungTong);
    const tong = tinhTongTien();
    vungTong.append(
      el('div', { lop: 'dong-tong tong-cuoi' }, [
        el('span', { vanBan: 'Tổng cộng' }),
        el('span', { lop: 'so', vanBan: tien(tong) }),
      ])
    );
  }

  /** Cập nhật thành tiền của một dòng. */
  function capNhatDong(dong) {
    const soLuong = docSoO(dong.querySelector('[data-vai-tro="soLuong"]')?.value);
    const donGia = hienDonGia
      ? docSoO(dong.querySelector('[data-vai-tro="donGia"]')?.value)
      : giaCuaDong(dong);
    const oThanhTien = dong.querySelector('[data-vai-tro="thanhTien"]');
    if (oThanhTien) oThanhTien.textContent = tien(soLuong * donGia);
    veTong();
    thayDoi();
  }

  /** Tạo một dòng mặt hàng. */
  function taoDong(giaTri = {}) {
    const oChon = el('select', {
      thuocTinh: { 'data-vai-tro': 'maSP' },
      nghe: {
        change: (suKien) => {
          const maSP = Number(suKien.target.value);
          const sp = bangSanPham.get(maSP);
          const oDonGia = dong.querySelector('[data-vai-tro="donGia"]');
          if (oDonGia && sp) oDonGia.value = dinhDangSoO(sp.gia);
          const oTon = dong.querySelector('[data-vai-tro="tonKho"]');
          if (oTon && sp) {
            oTon.textContent = sp.tonKho === undefined || sp.tonKho === null ? '' : `Tồn: ${so(sp.tonKho)}`;
          }
          capNhatDong(dong);
        },
      },
    });
    oChon.append(el('option', { vanBan: '— Chọn sản phẩm —', thuocTinh: { value: '' } }));
    for (const sp of danhSachSanPham) {
      const dangChon = Number(giaTri.maSP) === Number(sp.maSP);
      oChon.append(
        el('option', {
          vanBan: sp.tenSP,
          thuocTinh: { value: String(sp.maSP), selected: dangChon },
        })
      );
    }

    const oSoLuong = el('input', {
      thuocTinh: { 'data-vai-tro': 'soLuong', inputmode: 'numeric', placeholder: 'SL' },
    });
    oSoLuong.value = giaTri.soLuong ? dinhDangSoO(giaTri.soLuong) : '1';

    const oDonGia = hienDonGia
      ? el('input', { thuocTinh: { 'data-vai-tro': 'donGia', inputmode: 'numeric', placeholder: 'Đơn giá' } })
      : null;
    if (oDonGia) {
      const giaMacDinh = giaTri.donGia ?? bangSanPham.get(Number(giaTri.maSP))?.gia ?? 0;
      oDonGia.value = giaMacDinh ? dinhDangSoO(giaMacDinh) : '';
    }

    const dong = el('div', { lop: 'gio-hang-dong' }, [
      el('div', { lop: 'ten-mon' }, [
        oChon,
        el('small', { thuocTinh: { 'data-vai-tro': 'tonKho' } }),
      ]),
      el('label', { lop: 'truong' }, [el('span', { vanBan: 'Số lượng' }), oSoLuong]),
      oDonGia
        ? el('label', { lop: 'truong cot-an-hep' }, [el('span', { vanBan: 'Đơn giá' }), oDonGia])
        : el('span', { lop: 'cot-an-hep' }),
      el('label', { lop: 'truong' }, [
        el('span', { vanBan: 'Thành tiền' }),
        el('span', { lop: 'o-chi-doc so', thuocTinh: { 'data-vai-tro': 'thanhTien' }, vanBan: '0 ₫' }),
      ]),
      nutBieuTuong({
        bieuTuong: 'xoa',
        nhan: 'Xóa dòng',
        nghe: () => {
          dong.remove();
          if (demDong() === 0) taoDong();
          veTong();
          thayDoi();
        },
      }),
    ]);

    for (const o of [oSoLuong, oDonGia]) {
      if (!o) continue;
      o.addEventListener('input', (suKien) => {
        suKien.target.value = dinhDangSoO(suKien.target.value);
        capNhatDong(dong);
      });
    }

    return dong;
  }

  /** Thêm một dòng mới vào cuối bảng. */
  function themDong(giaTri = {}) {
    vungDong.append(taoDong(giaTri));
  }

  /** Đọc danh sách mặt hàng hiện tại (bỏ các dòng chưa chọn sản phẩm). */
  function layChiTiet() {
    const ketQua = [];
    for (const dong of vungDong.querySelectorAll('.gio-hang-dong')) {
      const maSP = Number(dong.querySelector('[data-vai-tro="maSP"]').value);
      if (!maSP) continue;
      const soLuong = docSoO(dong.querySelector('[data-vai-tro="soLuong"]').value);
      const donGia = hienDonGia
        ? docSoO(dong.querySelector('[data-vai-tro="donGia"]').value)
        : giaCuaDong(dong);
      ketQua.push({ maSP, soLuong, donGia });
    }
    return ketQua;
  }

  hop.append(
    el('div', { lop: 'bang-truot' }, [
      el('div', { lop: 'gio-hang-dau' }, [
        el('span', { vanBan: 'Mặt hàng' }),
        el('span', { vanBan: 'Số lượng' }),
        hienDonGia ? el('span', { lop: 'cot-an-hep', vanBan: 'Đơn giá' }) : el('span', { lop: 'cot-an-hep' }),
        el('span', { vanBan: 'Thành tiền' }),
        el('span', {}),
      ]),
    ]),
    vungDong,
    vungTong,
    el('div', { lop: 'nhom-nut', thuocTinh: { style: 'margin-top:10px' } }, [
      el('button', {
        lop: 'nut nut-trong nut-nho',
        kieu: 'button',
        vanBan: '+ Thêm dòng mặt hàng',
        nghe: () => {
          themDong();
          veTong();
          thayDoi();
        },
      }),
    ])
  );

  if (Array.isArray(giaTriBanDau) && giaTriBanDau.length > 0) {
    for (const dong of giaTriBanDau) themDong(dong);
  } else {
    themDong();
  }
  veTong();

  return { el: hop, layChiTiet, tongTien: tinhTongTien };
}
