/**
 * API NHÓM 4, 5 — nhân viên, khách hàng và hồ sơ cá nhân của khách hàng.
 */
'use strict';

const employeeService = require('../services/employee.service');
const customerService = require('../services/customer.service');
const loyaltyService = require('../services/loyalty.service');
const orderService = require('../services/order.service');
const thongbaoService = require('../services/thongbao.service');
const voucherService = require('../services/voucher.service');
const authCore = require('../core/auth');
const { ROLES } = require('../config');
const { forbidden } = require('../core/errors');
const { ok, created, toId, queryParams } = require('./helpers');

/** Lấy mã khách hàng của chính người đang đăng nhập (mục 4.3). */
function maKhachHangCuaToi(ctx) {
  if (ctx.user?.vaiTro !== ROLES.CUSTOMER || !ctx.user.maKH) {
    throw forbidden('Chức năng này chỉ dành cho tài khoản khách hàng.');
  }
  return Number(ctx.user.maKH);
}

/** Đăng ký các route nhân viên / khách hàng vào router. */
function register(router) {
  /* --------------------------- NHÓM 4: NHANVIEN --------------------------- */
  router.get(
    '/api/nhanvien/dang-lam-viec',
    { capability: 'order.manage' },
    ok(() => employeeService.listNhanVienDangLamViec())
  );
  router.get(
    '/api/nhanvien',
    { capability: 'employee.view' },
    ok((ctx) => employeeService.listNhanVien(queryParams(ctx)))
  );
  router.get(
    '/api/nhanvien/:maNV',
    { capability: 'employee.view' },
    ok((ctx) => employeeService.getNhanVien(toId(ctx.params.maNV, 'Mã nhân viên')))
  );
  router.post(
    '/api/nhanvien',
    { capability: 'employee.manage' },
    created((ctx) => employeeService.createNhanVien(ctx.body))
  );
  router.put(
    '/api/nhanvien/:maNV',
    { capability: 'employee.manage' },
    ok((ctx) => employeeService.updateNhanVien(toId(ctx.params.maNV, 'Mã nhân viên'), ctx.body))
  );
  router.delete(
    '/api/nhanvien/:maNV',
    { capability: 'employee.manage' },
    ok((ctx) => employeeService.deleteNhanVien(toId(ctx.params.maNV, 'Mã nhân viên')))
  );
  router.post(
    '/api/nhanvien/:maNV/dat-lai-mat-khau',
    { capability: 'employee.manage' },
    ok((ctx) =>
      employeeService.datLaiMatKhau(toId(ctx.params.maNV, 'Mã nhân viên'), ctx.body?.matKhau)
    )
  );

  /* -------------------- 4.3 — HỒ SƠ CÁ NHÂN CỦA KHÁCH HÀNG ------------------ */
  // Đặt trước '/api/khachhang/:maKH' để không bị khớp nhầm.
  router.get(
    '/api/cua-toi/ho-so',
    { auth: true },
    ok((ctx) => customerService.getKhachHang(maKhachHangCuaToi(ctx)))
  );
  router.put(
    '/api/cua-toi/ho-so',
    { auth: true },
    ok((ctx) => customerService.capNhatHoSoCaNhan(maKhachHangCuaToi(ctx), ctx.body))
  );
  // Chuông thông báo của khách hàng.
  router.get(
    '/api/cua-toi/thong-bao/tom-tat',
    { auth: true },
    ok((ctx) => thongbaoService.tomTatThongBao(maKhachHangCuaToi(ctx)))
  );
  router.post(
    '/api/cua-toi/thong-bao/doc-het',
    { auth: true },
    ok((ctx) => thongbaoService.danhDauTatCaDaDoc(maKhachHangCuaToi(ctx)))
  );
  router.get(
    '/api/cua-toi/thong-bao',
    { auth: true },
    ok((ctx) => thongbaoService.listThongBao(maKhachHangCuaToi(ctx), queryParams(ctx)))
  );
  router.post(
    '/api/cua-toi/thong-bao/:maTB/doc',
    { auth: true },
    ok((ctx) =>
      thongbaoService.danhDauDaDoc(
        maKhachHangCuaToi(ctx),
        toId(ctx.params.maTB, 'Mã thông báo')
      )
    )
  );
  // Ưu đãi (phiếu giảm giá) của khách hàng.
  router.get(
    '/api/cua-toi/uu-dai/thong-ke',
    { auth: true },
    ok((ctx) => voucherService.thongKePhieuCuaKhach(maKhachHangCuaToi(ctx)))
  );
  router.get(
    '/api/cua-toi/uu-dai',
    { auth: true },
    ok((ctx) => voucherService.listPhieuGiamGia(maKhachHangCuaToi(ctx), queryParams(ctx)))
  );
  router.get(
    '/api/cua-toi/diem',
    { auth: true },
    ok((ctx) => loyaltyService.xemLichSuDiem(maKhachHangCuaToi(ctx), queryParams(ctx)))
  );
  router.get(
    '/api/cua-toi/don-hang',
    { auth: true },
    ok((ctx) =>
      orderService.listDonHang(queryParams(ctx), { vaiTro: ROLES.CUSTOMER, maKH: maKhachHangCuaToi(ctx) })
    )
  );
  router.get(
    '/api/cua-toi/don-hang/:maDH',
    { auth: true },
    ok((ctx) =>
      orderService.getDonHang(toId(ctx.params.maDH, 'Mã đơn hàng'), {
        vaiTro: ROLES.CUSTOMER,
        maKH: maKhachHangCuaToi(ctx),
      })
    )
  );

  /* -------------------------- NHÓM 5: KHACHHANG -------------------------- */
  router.get(
    '/api/khachhang/hoat-dong',
    { capability: 'customer.view' },
    ok(() => customerService.listKhachHangHoatDong())
  );
  router.get(
    '/api/khachhang/tim-theo-sdt',
    { capability: 'customer.view' },
    ok((ctx) => customerService.timKhachHangTheoSdt(ctx.query.sdt ?? '') ?? null)
  );
  router.get(
    '/api/khachhang',
    { capability: 'customer.view' },
    ok((ctx) => customerService.listKhachHang(queryParams(ctx)))
  );
  router.get(
    '/api/khachhang/:maKH',
    { capability: 'customer.view' },
    ok((ctx) => customerService.getKhachHang(toId(ctx.params.maKH, 'Mã khách hàng')))
  );
  router.post(
    '/api/khachhang',
    { capability: 'customer.manage' },
    created((ctx) => customerService.createKhachHang(ctx.body))
  );
  router.put(
    '/api/khachhang/:maKH',
    { capability: 'customer.manage' },
    ok((ctx) => customerService.updateKhachHang(toId(ctx.params.maKH, 'Mã khách hàng'), ctx.body))
  );
  router.patch(
    '/api/khachhang/:maKH/trang-thai',
    { capability: 'customer.manage' },
    ok((ctx) =>
      customerService.doiTrangThaiKhachHang(
        toId(ctx.params.maKH, 'Mã khách hàng'),
        ctx.body.trangThai
      )
    )
  );
  router.delete(
    '/api/khachhang/:maKH',
    { capability: 'customer.manage' },
    ok((ctx) => customerService.deleteKhachHang(toId(ctx.params.maKH, 'Mã khách hàng')))
  );

  /* ------------------ Quyền hiện có của người đang đăng nhập ---------------- */
  router.get(
    '/api/quyen',
    { auth: true },
    ok(() => authCore.CAPABILITIES)
  );
}

module.exports = { register };
