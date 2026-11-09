/**
 * API NHÓM 6, 7, 8 — nhập hàng, đơn hàng, tích lũy điểm.
 */
'use strict';

const inventoryService = require('../services/inventory.service');
const orderService = require('../services/order.service');
const loyaltyService = require('../services/loyalty.service');
const { ok, created, toId, queryParams } = require('./helpers');

/** Đăng ký các route bán hàng vào router. */
function register(router) {
  /* ------------------------- NHÓM 6: PHIEUNGUONHANG ----------------------- */
  router.get(
    '/api/phieunhap',
    { capability: 'purchase.view' },
    ok((ctx) => inventoryService.listPhieuNhap(queryParams(ctx)))
  );
  router.get(
    '/api/phieunhap/:maPNH',
    { capability: 'purchase.view' },
    ok((ctx) => inventoryService.getPhieuNhap(toId(ctx.params.maPNH, 'Mã phiếu nhập')))
  );
  router.post(
    '/api/phieunhap',
    { capability: 'purchase.manage' },
    created((ctx) => inventoryService.createPhieuNhap(ctx.body, ctx.user))
  );
  router.put(
    '/api/phieunhap/:maPNH',
    { capability: 'purchase.manage' },
    ok((ctx) => inventoryService.updatePhieuNhap(toId(ctx.params.maPNH, 'Mã phiếu nhập'), ctx.body))
  );
  router.post(
    '/api/phieunhap/:maPNH/duyet',
    { capability: 'purchase.manage' },
    ok((ctx) => inventoryService.duyetPhieuNhap(toId(ctx.params.maPNH, 'Mã phiếu nhập')))
  );
  router.post(
    '/api/phieunhap/:maPNH/huy',
    { capability: 'purchase.manage' },
    ok((ctx) =>
      inventoryService.huyPhieuNhap(
        toId(ctx.params.maPNH, 'Mã phiếu nhập'),
        ctx.body?.lyDo
      )
    )
  );

  /* -------------------------- NHÓM 7: DONHANG ---------------------------- */
  // Tính trước tiền hàng mà chưa tạo đơn (dùng cho giỏ hàng trên giao diện).
  router.post(
    '/api/donhang/tinh-tien',
    { capability: 'order.manage' },
    ok(async (ctx) => {
      const { dongHang, tienHang } = await orderService.chuanHoaGioHang(ctx.body?.chiTiet, {
        kiemTraTonKho: false,
      });
      const diemSuDung = Number(ctx.body?.diemSuDung ?? 0);
      const tienGiamDiem = diemSuDung > 0 ? loyaltyService.tinhTienGiamTuDiem(diemSuDung) : 0;
      return {
        dongHang,
        tienHang,
        diemSuDung,
        tienGiamDiem,
        tongTien: Math.max(0, tienHang - tienGiamDiem),
      };
    })
  );
  router.get(
    '/api/donhang',
    { capability: 'order.view.all' },
    ok((ctx) => orderService.listDonHang(queryParams(ctx), ctx.user))
  );
  router.get(
    '/api/donhang/:maDH',
    { capability: 'order.view.all' },
    ok((ctx) => orderService.getDonHang(toId(ctx.params.maDH, 'Mã đơn hàng'), ctx.user))
  );
  router.post(
    '/api/donhang',
    { auth: true },
    created((ctx) => orderService.createDonHang(ctx.body, ctx.user))
  );
  router.patch(
    '/api/donhang/:maDH/trang-thai',
    { capability: 'order.manage' },
    ok((ctx) =>
      orderService.capNhatTrangThai(toId(ctx.params.maDH, 'Mã đơn hàng'), ctx.body.trangThai)
    )
  );
  router.post(
    '/api/donhang/:maDH/huy',
    { auth: true },
    ok((ctx) => orderService.huyDonHang(toId(ctx.params.maDH, 'Mã đơn hàng'), ctx.body?.lyDo))
  );

  /* --------------------------- NHÓM 8: DIEM ------------------------------ */
  router.get(
    '/api/diem/lich-su',
    { capability: 'loyalty.manage' },
    ok((ctx) => loyaltyService.xemLichSuDiemToanHeThong(queryParams(ctx)))
  );
  router.get(
    '/api/diem/khachhang/:maKH',
    { capability: 'loyalty.manage' },
    ok((ctx) => loyaltyService.xemLichSuDiem(toId(ctx.params.maKH, 'Mã khách hàng'), queryParams(ctx)))
  );
  router.get(
    '/api/diem/khachhang/:maKH/hien-tai',
    { capability: 'loyalty.manage' },
    ok((ctx) => loyaltyService.layDiemHienTai(toId(ctx.params.maKH, 'Mã khách hàng')))
  );
}

module.exports = { register };
