/**
 * API NHÓM 9, 10, 11 — khuyến mãi, phản hồi khách hàng, khảo sát.
 */
'use strict';

const promotionService = require('../services/promotion.service');
const feedbackService = require('../services/feedback.service');
const surveyService = require('../services/survey.service');
const { ROLES } = require('../config');
const { forbidden } = require('../core/errors');
const { ok, created, toId, queryParams } = require('./helpers');

/** Lấy mã khách hàng đang đăng nhập (dùng cho cổng khách hàng). */
function maKhachHangCuaToi(ctx) {
  if (ctx.user?.vaiTro !== ROLES.CUSTOMER || !ctx.user.maKH) {
    throw forbidden('Chức năng này chỉ dành cho tài khoản khách hàng.');
  }
  return Number(ctx.user.maKH);
}

/** Đăng ký các route CRM vào router. */
function register(router) {
  /* ------------------------- NHÓM 9: KHUYENMAI --------------------------- */
  router.get(
    '/api/khuyenmai/dang-hieu-luc',
    { capability: 'promotion.view' },
    ok(() => promotionService.listKhuyenMaiDangHieuLuc())
  );
  router.post(
    '/api/khuyenmai/chay-job-het-han',
    { capability: 'promotion.manage' },
    ok(() => promotionService.ketThucKhuyenMaiHetHan())
  );
  router.get(
    '/api/khuyenmai',
    { capability: 'promotion.view' },
    ok((ctx) => promotionService.listKhuyenMai(queryParams(ctx)))
  );
  router.get(
    '/api/khuyenmai/:maKM',
    { capability: 'promotion.view' },
    ok((ctx) => promotionService.getKhuyenMai(toId(ctx.params.maKM, 'Mã khuyến mãi')))
  );
  router.post(
    '/api/khuyenmai',
    { capability: 'promotion.manage' },
    created((ctx) => promotionService.createKhuyenMai(ctx.body))
  );
  router.put(
    '/api/khuyenmai/:maKM',
    { capability: 'promotion.manage' },
    ok((ctx) => promotionService.updateKhuyenMai(toId(ctx.params.maKM, 'Mã khuyến mãi'), ctx.body))
  );
  router.delete(
    '/api/khuyenmai/:maKM',
    { capability: 'promotion.manage' },
    ok((ctx) => promotionService.deleteKhuyenMai(toId(ctx.params.maKM, 'Mã khuyến mãi')))
  );
  router.post(
    '/api/khuyenmai/:maKM/ket-thuc-som',
    { capability: 'promotion.manage' },
    ok((ctx) => promotionService.ketThucSom(toId(ctx.params.maKM, 'Mã khuyến mãi')))
  );
  router.post(
    '/api/khuyenmai/:maKM/ap-dung',
    { capability: 'promotion.manage' },
    ok((ctx) =>
      promotionService.apDungKhuyenMai(
        toId(ctx.params.maKM, 'Mã khuyến mãi'),
        ctx.body?.danhSachMaSP
      )
    )
  );
  router.delete(
    '/api/khuyenmai/:maKM/san-pham/:maSP',
    { capability: 'promotion.manage' },
    ok((ctx) =>
      promotionService.goKhuyenMai(
        toId(ctx.params.maKM, 'Mã khuyến mãi'),
        toId(ctx.params.maSP, 'Mã sản phẩm')
      )
    )
  );

  /* --------------------------- NHÓM 10: PHANHOI -------------------------- */
  // Cổng khách hàng (mục 4.3.4)
  router.get(
    '/api/cua-toi/phan-hoi',
    { auth: true },
    ok((ctx) =>
      feedbackService.listPhanHoi(queryParams(ctx), {
        vaiTro: ROLES.CUSTOMER,
        maKH: maKhachHangCuaToi(ctx),
      })
    )
  );
  router.post(
    '/api/cua-toi/phan-hoi',
    { auth: true },
    created((ctx) =>
      feedbackService.createPhanHoi(ctx.body, {
        vaiTro: ROLES.CUSTOMER,
        maKH: maKhachHangCuaToi(ctx),
      })
    )
  );

  router.get(
    '/api/phanhoi/thong-ke',
    { capability: 'feedback.view' },
    ok((ctx) => feedbackService.thongKeHaiLong(queryParams(ctx)))
  );
  router.get(
    '/api/phanhoi/chua-xu-ly',
    { capability: 'feedback.view' },
    ok(() => ({ soLuong: feedbackService.demPhanHoiChuaXuLy() }))
  );
  router.get(
    '/api/phanhoi',
    { capability: 'feedback.view' },
    ok((ctx) => feedbackService.listPhanHoi(queryParams(ctx), ctx.user))
  );
  router.get(
    '/api/phanhoi/:maPH',
    { capability: 'feedback.view' },
    ok((ctx) => feedbackService.getPhanHoi(toId(ctx.params.maPH, 'Mã phản hồi'), ctx.user))
  );
  router.post(
    '/api/phanhoi',
    { capability: 'feedback.handle' },
    created((ctx) => feedbackService.createPhanHoi(ctx.body, ctx.user))
  );
  router.post(
    '/api/phanhoi/:maPH/xu-ly',
    { capability: 'feedback.handle' },
    ok((ctx) => feedbackService.xuLyPhanHoi(toId(ctx.params.maPH, 'Mã phản hồi'), ctx.body, ctx.user))
  );

  /* --------------------------- NHÓM 11: KHAOSAT -------------------------- */
  // Cổng khách hàng (mục 4.3.5)
  router.get(
    '/api/cua-toi/khaosat',
    { auth: true },
    ok((ctx) => surveyService.listKhaoSatCuaKhach(maKhachHangCuaToi(ctx)))
  );
  router.post(
    '/api/cua-toi/khaosat/:maKS/tra-loi',
    { auth: true },
    ok((ctx) =>
      surveyService.traLoiKhaoSat(
        toId(ctx.params.maKS, 'Mã khảo sát'),
        ctx.body,
        { vaiTro: ROLES.CUSTOMER, maKH: maKhachHangCuaToi(ctx) }
      )
    )
  );

  // Đặt các đường dẫn con trước '/:maKS' để không bị khớp nhầm.
  router.put(
    '/api/khaosat/cau-hoi/:maCauHoi',
    { capability: 'survey.manage' },
    ok((ctx) => surveyService.suaCauHoi(toId(ctx.params.maCauHoi, 'Mã câu hỏi'), ctx.body))
  );
  router.delete(
    '/api/khaosat/cau-hoi/:maCauHoi',
    { capability: 'survey.manage' },
    ok((ctx) => surveyService.xoaCauHoi(toId(ctx.params.maCauHoi, 'Mã câu hỏi')))
  );
  router.get(
    '/api/khaosat/:maKS/nguoi-nhan',
    { capability: 'survey.view' },
    ok((ctx) => surveyService.listNguoiNhan(toId(ctx.params.maKS, 'Mã khảo sát')))
  );
  router.get(
    '/api/khaosat/:maKS/thong-ke',
    { capability: 'survey.view' },
    ok((ctx) => surveyService.thongKeKhaoSat(toId(ctx.params.maKS, 'Mã khảo sát')))
  );
  router.post(
    '/api/khaosat/:maKS/gui',
    { capability: 'survey.manage' },
    ok((ctx) =>
      surveyService.guiKhaoSat(
        toId(ctx.params.maKS, 'Mã khảo sát'),
        ctx.body?.danhSachMaKH ?? 'all'
      )
    )
  );
  router.post(
    '/api/khaosat/:maKS/tra-loi',
    { capability: 'survey.manage' },
    ok((ctx) =>
      surveyService.traLoiKhaoSat(toId(ctx.params.maKS, 'Mã khảo sát'), ctx.body, ctx.user)
    )
  );
  router.post(
    '/api/khaosat/:maKS/cau-hoi',
    { capability: 'survey.manage' },
    created((ctx) => surveyService.themCauHoi(toId(ctx.params.maKS, 'Mã khảo sát'), ctx.body))
  );
  router.get(
    '/api/khaosat',
    { capability: 'survey.view' },
    ok((ctx) => surveyService.listKhaoSat(queryParams(ctx), ctx.user))
  );
  router.get(
    '/api/khaosat/:maKS',
    { capability: 'survey.view' },
    ok((ctx) => surveyService.getKhaoSat(toId(ctx.params.maKS, 'Mã khảo sát')))
  );
  router.post(
    '/api/khaosat',
    { capability: 'survey.manage' },
    created((ctx) => surveyService.createKhaoSat(ctx.body, ctx.user))
  );
  router.put(
    '/api/khaosat/:maKS',
    { capability: 'survey.manage' },
    ok((ctx) => surveyService.updateKhaoSat(toId(ctx.params.maKS, 'Mã khảo sát'), ctx.body))
  );
  router.delete(
    '/api/khaosat/:maKS',
    { capability: 'survey.manage' },
    ok((ctx) => surveyService.deleteKhaoSat(toId(ctx.params.maKS, 'Mã khảo sát')))
  );
}

module.exports = { register };
