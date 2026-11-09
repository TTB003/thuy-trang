/**
 * API QUẢN TRỊ (mục II của đồ án) — giao diện ADMIN tách biệt:
 * quản lý tài khoản, phân quyền, sao lưu / phục hồi cơ sở dữ liệu.
 * Mọi route trong file này chỉ dành cho vai trò Admin.
 */
'use strict';

const systemService = require('../services/system.service');
const { ok, created, toId, queryParams } = require('./helpers');

/** Đăng ký các route quản trị vào router. */
function register(router) {
  /* ------------------------- QUẢN LÝ TÀI KHOẢN ---------------------------- */
  router.get(
    '/api/admin/taikhoan/thong-ke',
    { adminOnly: true },
    ok(() => systemService.thongKeTaiKhoan())
  );
  router.get(
    '/api/admin/taikhoan',
    { adminOnly: true },
    ok((ctx) => systemService.listTaiKhoan(queryParams(ctx)))
  );
  router.get(
    '/api/admin/taikhoan/:maTK',
    { adminOnly: true },
    ok((ctx) => systemService.getTaiKhoan(toId(ctx.params.maTK, 'Mã tài khoản')))
  );
  router.post(
    '/api/admin/taikhoan',
    { adminOnly: true },
    created((ctx) => systemService.createTaiKhoan(ctx.body))
  );
  // Phân quyền: đổi vai trò của tài khoản
  router.patch(
    '/api/admin/taikhoan/:maTK/vai-tro',
    { adminOnly: true },
    ok((ctx) => systemService.doiVaiTro(toId(ctx.params.maTK, 'Mã tài khoản'), ctx.body.vaiTro))
  );
  // Khóa / mở khóa tài khoản
  router.patch(
    '/api/admin/taikhoan/:maTK/trang-thai',
    { adminOnly: true },
    ok((ctx) =>
      systemService.doiTrangThaiTaiKhoan(
        toId(ctx.params.maTK, 'Mã tài khoản'),
        ctx.body.trangThai,
        ctx.user
      )
    )
  );
  router.post(
    '/api/admin/taikhoan/:maTK/dat-lai-mat-khau',
    { adminOnly: true },
    ok((ctx) =>
      systemService.datLaiMatKhauTaiKhoan(toId(ctx.params.maTK, 'Mã tài khoản'), ctx.body.matKhau)
    )
  );
  router.delete(
    '/api/admin/taikhoan/:maTK',
    { adminOnly: true },
    ok((ctx) => systemService.xoaTaiKhoan(toId(ctx.params.maTK, 'Mã tài khoản'), ctx.user))
  );

  /* ------------------------ SAO LƯU / PHỤC HỒI CSDL ----------------------- */
  router.get(
    '/api/admin/sao-luu',
    { adminOnly: true },
    ok(async () => ({ danhSach: await systemService.danhSachSaoLuu() }))
  );
  router.post(
    '/api/admin/sao-luu',
    { adminOnly: true },
    created((ctx) => systemService.saoLuuCsdl(ctx.body?.ghiChu))
  );
  router.post(
    '/api/admin/phuc-hoi',
    { adminOnly: true },
    ok((ctx) => systemService.phucHoiCsdl(ctx.body?.tenFile))
  );
  router.delete(
    '/api/admin/sao-luu/:tenFile',
    { adminOnly: true },
    ok((ctx) => systemService.xoaSaoLuu(ctx.params.tenFile))
  );

  /* ---------------------------- THÔNG TIN HỆ THỐNG ----------------------- */
  router.get(
    '/api/admin/he-thong',
    { adminOnly: true },
    ok(() => systemService.thongTinHeThong())
  );
  router.get(
    '/api/admin/toan-ven',
    { adminOnly: true },
    ok(() => systemService.kiemTraToanVen())
  );
}

module.exports = { register };
