/**
 * API NHÓM 12 — báo cáo và thống kê.
 */
'use strict';

const reportService = require('../services/report.service');
const { badRequest } = require('../core/errors');
const { ok } = require('./helpers');

/** Đăng ký các route báo cáo vào router. */
function register(router) {
  router.get(
    '/api/baocao/dashboard',
    { capability: 'report.view' },
    ok(() => reportService.tongQuanDashboard())
  );
  router.get(
    '/api/baocao/doanh-thu',
    { capability: 'report.view' },
    ok((ctx) => reportService.thongKeDoanhThu(ctx.query))
  );
  router.get(
    '/api/baocao/san-pham-ban-chay',
    { capability: 'report.view' },
    ok((ctx) => reportService.thongKeSanPhamBanChay(ctx.query))
  );
  router.get(
    '/api/baocao/nhap-hang',
    { capability: 'report.view' },
    ok((ctx) => reportService.thongKeNhapHang(ctx.query))
  );
  router.get(
    '/api/baocao/ton-kho',
    { capability: 'report.inventory' },
    ok((ctx) => reportService.baoCaoTonKho(ctx.query))
  );
  router.get(
    '/api/baocao/khach-hang-than-thiet',
    { capability: 'report.view' },
    ok((ctx) => reportService.thongKeKhachHangThanThiet(ctx.query))
  );
  router.get(
    '/api/baocao/khach-hang',
    { capability: 'report.view' },
    ok(() => reportService.thongKeKhachHang())
  );
  // CN12.6 — Xuất báo cáo: trả về cấu trúc bảng để giao diện tải thành CSV.
  router.get(
    '/api/baocao/xuat',
    { capability: 'report.view' },
    ok(async (ctx) => {
      const loai = String(ctx.query.loai ?? '');
      const duLieu = await reportService.xuatBaoCao(loai, ctx.query);
      if (!duLieu) {
        throw badRequest(
          `Loại báo cáo "${loai}" không hợp lệ. Chỉ chấp nhận: ${reportService.LOAI_BAO_CAO.map((item) => item.ma).join(', ')}.`
        );
      }
      return { loai, ...duLieu };
    })
  );
}

module.exports = { register };
