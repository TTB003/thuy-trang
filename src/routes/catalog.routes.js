/**
 * API NHÓM 1, 2, 3 — loại sản phẩm, sản phẩm, nhà cung cấp.
 */
'use strict';

const categoryService = require('../services/category.service');
const productService = require('../services/product.service');
const supplierService = require('../services/supplier.service');
const { ok, created, toId, queryParams } = require('./helpers');

/** Đăng ký các route danh mục sản phẩm vào router. */
function register(router) {
  /* ------------------------- NHÓM 1: LOAISANPHAM ------------------------- */
  router.get(
    '/api/loaisanpham',
    { capability: 'catalog.view' },
    ok((ctx) => categoryService.listLoaiSanPham(queryParams(ctx)))
  );
  router.get(
    '/api/loaisanpham/:maLoai',
    { capability: 'catalog.view' },
    ok((ctx) => categoryService.getLoaiSanPham(toId(ctx.params.maLoai, 'Mã loại')))
  );
  router.post(
    '/api/loaisanpham',
    { capability: 'catalog.manage' },
    created((ctx) => categoryService.createLoaiSanPham(ctx.body))
  );
  router.put(
    '/api/loaisanpham/:maLoai',
    { capability: 'catalog.manage' },
    ok((ctx) => categoryService.updateLoaiSanPham(toId(ctx.params.maLoai, 'Mã loại'), ctx.body))
  );
  router.delete(
    '/api/loaisanpham/:maLoai',
    { capability: 'catalog.manage' },
    ok((ctx) => categoryService.deleteLoaiSanPham(toId(ctx.params.maLoai, 'Mã loại')))
  );

  /* --------------------------- NHÓM 2: SANPHAM --------------------------- */
  // Đặt trước '/:maSP' để không bị khớp nhầm thành mã sản phẩm.
  router.get(
    '/api/sanpham/canh-bao-ton',
    { capability: 'report.inventory' },
    ok(() => productService.canhBaoTonKho())
  );
  router.get(
    '/api/sanpham',
    { capability: 'catalog.view' },
    ok((ctx) => productService.listSanPham(queryParams(ctx), ctx.user))
  );
  router.get(
    '/api/sanpham/:maSP',
    { capability: 'catalog.view' },
    ok((ctx) => productService.getSanPham(toId(ctx.params.maSP, 'Mã sản phẩm'), ctx.user))
  );
  router.post(
    '/api/sanpham',
    { capability: 'catalog.manage' },
    created((ctx) => productService.createSanPham(ctx.body))
  );
  router.put(
    '/api/sanpham/:maSP',
    { capability: 'catalog.manage' },
    ok((ctx) => productService.updateSanPham(toId(ctx.params.maSP, 'Mã sản phẩm'), ctx.body))
  );
  router.delete(
    '/api/sanpham/:maSP',
    { capability: 'catalog.manage' },
    ok((ctx) => productService.deleteSanPham(toId(ctx.params.maSP, 'Mã sản phẩm')))
  );

  /* ------------------------- NHÓM 3: NHACUNGCAP ------------------------- */
  router.get(
    '/api/nhacungcap/dang-hop-tac',
    { capability: 'supplier.select' },
    ok(() => supplierService.listNhaCungCapDangHopTac())
  );
  router.get(
    '/api/nhacungcap',
    { capability: 'supplier.view' },
    ok((ctx) => supplierService.listNhaCungCap(queryParams(ctx)))
  );
  router.get(
    '/api/nhacungcap/:maNCC',
    { capability: 'supplier.view' },
    ok((ctx) => supplierService.getNhaCungCap(toId(ctx.params.maNCC, 'Mã nhà cung cấp')))
  );
  router.post(
    '/api/nhacungcap',
    { capability: 'supplier.manage' },
    created((ctx) => supplierService.createNhaCungCap(ctx.body))
  );
  router.put(
    '/api/nhacungcap/:maNCC',
    { capability: 'supplier.manage' },
    ok((ctx) => supplierService.updateNhaCungCap(toId(ctx.params.maNCC, 'Mã nhà cung cấp'), ctx.body))
  );
  router.delete(
    '/api/nhacungcap/:maNCC',
    { capability: 'supplier.manage' },
    ok((ctx) => supplierService.deleteNhaCungCap(toId(ctx.params.maNCC, 'Mã nhà cung cấp')))
  );
}

module.exports = { register };
