/**
 * NGHIỆP VỤ NHÓM 12 — Báo cáo và thống kê (CN12.1 → CN12.6).
 * Ngoài ra cung cấp số liệu tổng quan cho trang Dashboard.
 * Bảng: Tổng hợp nhiều bảng.
 */
'use strict';

const db = require('../db');
const { NGUONG_SAP_HET } = require('../config');
const { todaySql, daysFromToday } = require('../core/time');
const feedbackService = require('./feedback.service');
const productService = require('./product.service');

/** Điều kiện khoảng thời gian dùng chung. */
function dieuKienThoiGian(query, columnSql = 'd.ngayDat') {
  const dieuKien = [];
  const params = {};
  if (query.tuNgay) {
    dieuKien.push(`date(${columnSql}) >= date(:tuNgay)`);
    params.tuNgay = query.tuNgay;
  }
  if (query.denNgay) {
    dieuKien.push(`date(${columnSql}) <= date(:denNgay)`);
    params.denNgay = query.denNgay;
  }
  return { sql: dieuKien.length ? ` AND ${dieuKien.join(' AND ')}` : '', params };
}

/** CN12.1 — Thống kê doanh thu theo ngày / tháng / năm. */
async function thongKeDoanhThu(query = {}) {
  const kieu = ['ngay', 'thang', 'nam'].includes(query.kieu) ? query.kieu : 'ngay';
  const bieuThuc = db.bieuThucMocThoiGian('d.ngayDat', kieu);
  const { sql: thoiGianSql, params } = dieuKienThoiGian(query);

  const chiTiet = await db.all(
    `SELECT ${bieuThuc} AS mocThoiGian,
            COUNT(*) AS soDon,
            COALESCE(SUM(d.tongTien), 0) AS doanhThu,
            COALESCE(SUM(d.diemSuDung), 0) AS diemDaDung
       FROM DONHANG d
      WHERE d.trangThai = N'Hoàn thành' ${thoiGianSql}
      GROUP BY mocThoiGian
      ORDER BY mocThoiGian DESC`,
    params
  );

  const tongQuan = await db.get(
    `SELECT COUNT(*) AS tongDon,
            COALESCE(SUM(d.tongTien), 0) AS tongDoanhThu,
            COALESCE(SUM(d.tienHang), 0) AS tongTienHang,
            COALESCE(SUM(d.tienGiamDiem), 0) AS tongGiamTuDiem
       FROM DONHANG d
      WHERE d.trangThai = N'Hoàn thành' ${thoiGianSql}`,
    params
  );

  const tongDon = Number(tongQuan?.tongDon ?? 0);
  const tongDoanhThu = Number(tongQuan?.tongDoanhThu ?? 0);

  return {
    kieu,
    tongQuan: {
      ...tongQuan,
      tongDon,
      tongDoanhThu,
      giaTriDonTrungBinh: tongDon > 0 ? Math.round(tongDoanhThu / tongDon) : 0,
    },
    chiTiet: chiTiet.map((row) => ({
      ...row,
      soDon: Number(row.soDon),
      doanhThu: Number(row.doanhThu ?? 0),
      giaTriDonTrungBinh:
        Number(row.soDon) > 0 ? Math.round(Number(row.doanhThu ?? 0) / Number(row.soDon)) : 0,
    })),
  };
}

/** CN12.2 — Thống kê sản phẩm bán chạy (top N). */
async function thongKeSanPhamBanChay(query = {}) {
  const top = Math.min(Math.max(Number(query.top) || 10, 1), 100);
  const { sql: thoiGianSql, params } = dieuKienThoiGian(query);

  const items = await db.all(
    `SELECT sp.maSP, sp.tenSP, l.tenLoai,
            SUM(ct.soLuong)   AS tongSoLuong,
            SUM(ct.thanhTien) AS tongDoanhThu,
            COUNT(DISTINCT ct.maDH) AS soDon
       FROM CHITIETDONHANG ct
       JOIN DONHANG d ON d.maDH = ct.maDH AND d.trangThai = N'Hoàn thành'
       JOIN SANPHAM sp ON sp.maSP = ct.maSP
       JOIN LOAISANPHAM l ON l.maLoai = sp.maLoai
      WHERE 1 = 1 ${thoiGianSql}
      GROUP BY sp.maSP, sp.tenSP, l.tenLoai
      ORDER BY tongSoLuong DESC
      LIMIT :top`,
    { ...params, top }
  );

  const theoLoai = await db.all(
    `SELECT l.tenLoai, SUM(ct.soLuong) AS tongSoLuong, SUM(ct.thanhTien) AS tongDoanhThu
       FROM CHITIETDONHANG ct
       JOIN DONHANG d ON d.maDH = ct.maDH AND d.trangThai = N'Hoàn thành'
       JOIN SANPHAM sp ON sp.maSP = ct.maSP
       JOIN LOAISANPHAM l ON l.maLoai = sp.maLoai
      WHERE 1 = 1 ${thoiGianSql}
      GROUP BY l.tenLoai
      ORDER BY tongDoanhThu DESC`,
    params
  );

  return { top, items, theoLoai };
}

/** CN12.3 — Thống kê nhập hàng và chi phí. */
async function thongKeNhapHang(query = {}) {
  const { sql: thoiGianSql, params } = dieuKienThoiGian(query, 'p.ngayNhap');
  const theoNhaCungCapSql = query.maNCC ? ' AND p.maNCC = :maNCC' : '';
  const thamSo = query.maNCC ? { ...params, maNCC: Number(query.maNCC) } : params;

  const tongQuan = await db.get(
    `SELECT COUNT(*) AS tongPhieu, COALESCE(SUM(p.tongTien), 0) AS tongChiPhi
       FROM PHIEUNGUONHANG p
      WHERE p.trangThai = N'Hoàn thành' ${thoiGianSql} ${theoNhaCungCapSql}`,
    thamSo
  );

  const bieuThucThang = db.bieuThucThang('p.ngayNhap');
  const theoThang = await db.all(
    `SELECT ${bieuThucThang} AS thang,
            COUNT(*) AS soPhieu, COALESCE(SUM(p.tongTien), 0) AS chiPhi
       FROM PHIEUNGUONHANG p
      WHERE p.trangThai = N'Hoàn thành' ${thoiGianSql} ${theoNhaCungCapSql}
      GROUP BY thang
      ORDER BY thang DESC`,
    thamSo
  );

  const theoNcc = await db.all(
    `SELECT n.maNCC, n.tenNCC, COUNT(p.maPNH) AS soPhieu,
            COALESCE(SUM(p.tongTien), 0) AS tongChiPhi
       FROM PHIEUNGUONHANG p
       JOIN NHACUNGCAP n ON n.maNCC = p.maNCC
      WHERE p.trangThai = N'Hoàn thành' ${thoiGianSql}
      GROUP BY n.maNCC, n.tenNCC
      ORDER BY tongChiPhi DESC`,
    params
  );

  const sanPhamNhapNhieu = await db.all(
    `SELECT sp.maSP, sp.tenSP, SUM(ct.soLuong) AS tongSoLuong,
            SUM(ct.thanhTien) AS tongChiPhi, AVG(ct.donGia) AS donGiaTrungBinh
       FROM CTPNH ct
       JOIN PHIEUNGUONHANG p ON p.maPNH = ct.maPNH AND p.trangThai = N'Hoàn thành'
       JOIN SANPHAM sp ON sp.maSP = ct.maSP
      WHERE 1 = 1 ${thoiGianSql}
      GROUP BY sp.maSP, sp.tenSP
      ORDER BY tongChiPhi DESC
      LIMIT 20`,
    params
  );

  return { tongQuan, theoThang, theoNhaCungCap: theoNcc, sanPhamNhapNhieu };
}

/** CN12.4 — Báo cáo tồn kho. */
async function baoCaoTonKho(query = {}) {
  const dieuKien = [];
  const params = {};
  if (query.maLoai) {
    dieuKien.push('sp.maLoai = :maLoai');
    params.maLoai = Number(query.maLoai);
  }
  if (query.trangThai) {
    dieuKien.push('sp.trangThai = :trangThai');
    params.trangThai = query.trangThai;
  }
  if (query.duoiNguong) {
    dieuKien.push('sp.soLuong <= :nguong');
    params.nguong = Number(query.duoiNguong);
  }
  const whereSql = dieuKien.length ? `WHERE ${dieuKien.join(' AND ')}` : '';

  const items = await db.all(
    `SELECT sp.maSP, sp.tenSP, l.tenLoai, sp.gia, sp.soLuong, sp.trangThai,
            (sp.soLuong * sp.gia) AS giaTriTon
       FROM SANPHAM sp
       JOIN LOAISANPHAM l ON l.maLoai = sp.maLoai
       ${whereSql}
      ORDER BY sp.soLuong ASC, sp.tenSP ASC`,
    params
  );

  const theoLoai = await db.all(
    `SELECT l.maLoai, l.tenLoai,
            COUNT(sp.maSP) AS soSanPham,
            COALESCE(SUM(sp.soLuong), 0) AS tongSoLuong,
            COALESCE(SUM(sp.soLuong * sp.gia), 0) AS tongGiaTriTon
       FROM LOAISANPHAM l
       LEFT JOIN SANPHAM sp ON sp.maLoai = l.maLoai
      GROUP BY l.maLoai, l.tenLoai
      ORDER BY tongGiaTriTon DESC`
  );

  const tongQuan = await db.get(
    `SELECT COUNT(*) AS tongSanPham,
            COALESCE(SUM(sp.soLuong), 0) AS tongSoLuong,
            COALESCE(SUM(sp.soLuong * sp.gia), 0) AS tongGiaTriTon
       FROM SANPHAM sp ${whereSql}`,
    params
  );

  return {
    nguongSapHet: NGUONG_SAP_HET,
    tongQuan,
    theoLoai,
    items,
    canhBao: await productService.canhBaoTonKho(),
  };
}

/** CN12.5 / 4.1.5 — Thống kê khách hàng thân thiết. */
async function thongKeKhachHangThanThiet(query = {}) {
  const top = Math.min(Math.max(Number(query.top) || 10, 1), 100);
  const items = await db.all(
    `SELECT kh.maKH, kh.hoTen, kh.sdt, kh.diemTichLuy, kh.trangThai,
            COUNT(d.maDH) AS soDon,
            COALESCE(SUM(CASE WHEN d.trangThai = N'Hoàn thành' THEN d.tongTien ELSE 0 END), 0) AS tongChiTieu
       FROM KHACHHANG kh
       LEFT JOIN DONHANG d ON d.maKH = kh.maKH
      WHERE kh.trangThai <> N'Đã xóa'
      GROUP BY kh.maKH, kh.hoTen, kh.sdt, kh.diemTichLuy, kh.trangThai
      ORDER BY tongChiTieu DESC, kh.diemTichLuy DESC
      LIMIT :top`,
    { top }
  );
  return { top, items };
}

/**
 * Báo cáo khách hàng: tổng quan, tỷ lệ độ tuổi, giới tính, sở thích,
 * nguồn điểm tích lũy (phục vụ mục 4.1.5 của đồ án).
 */
async function thongKeKhachHang() {
  const bieuThucTuoi = db.bieuThucNhomTuoi('kh.ngaySinh');
  const bieuThucThang = db.bieuThucThang('kh.ngayDangKy');

  const tongQuan = await db.get(
    `SELECT COUNT(*) AS tongKhachHang,
            SUM(CASE WHEN trangThai = N'Hoạt động' THEN 1 ELSE 0 END) AS dangHoatDong,
            SUM(CASE WHEN trangThai = N'Bị khóa' THEN 1 ELSE 0 END) AS biKhoa,
            SUM(CASE WHEN trangThai = N'Đã xóa' THEN 1 ELSE 0 END) AS daXoa,
            COALESCE(SUM(diemTichLuy), 0) AS tongDiem
       FROM KHACHHANG`
  );

  const theoDoTuoi = await db.all(
    `SELECT ${bieuThucTuoi} AS nhomTuoi, COUNT(*) AS soLuong
       FROM KHACHHANG kh
      WHERE kh.trangThai <> N'Đã xóa'
      GROUP BY nhomTuoi
      ORDER BY soLuong DESC`
  );

  const theoGioiTinh = await db.all(
    `SELECT COALESCE(kh.gioiTinh, N'Chưa rõ') AS gioiTinh, COUNT(*) AS soLuong
       FROM KHACHHANG kh
      WHERE kh.trangThai <> N'Đã xóa'
      GROUP BY kh.gioiTinh
      ORDER BY soLuong DESC`
  );

  const soThichTheoNganhHang = await db.all(
    `SELECT l.tenLoai AS soThich, COUNT(DISTINCT d.maKH) AS soKhachHang,
            SUM(ct.soLuong) AS tongSoLuong
       FROM DONHANG d
       JOIN CHITIETDONHANG ct ON ct.maDH = d.maDH
       JOIN SANPHAM sp ON sp.maSP = ct.maSP
       JOIN LOAISANPHAM l ON l.maLoai = sp.maLoai
      WHERE d.trangThai = N'Hoàn thành'
      GROUP BY l.tenLoai
      ORDER BY soKhachHang DESC`
  );

  const soThichTuKhaiBao = await db.all(
    `SELECT TRIM(kh.soThich) AS soThich, COUNT(*) AS soLuong
       FROM KHACHHANG kh
      WHERE kh.soThich IS NOT NULL AND TRIM(kh.soThich) <> ''
      GROUP BY TRIM(kh.soThich)
      ORDER BY soLuong DESC
      LIMIT 20`
  );

  const khachMoiTheoThang = await db.all(
    `SELECT ${bieuThucThang} AS thang, COUNT(*) AS soLuong
       FROM KHACHHANG kh
      GROUP BY thang
      ORDER BY thang DESC
      LIMIT 12`
  );

  const tongKhachHang = Number(tongQuan?.tongKhachHang ?? 0);
  const tinhTyLe = (soLuong) =>
    tongKhachHang > 0 ? Math.round((Number(soLuong) / tongKhachHang) * 1000) / 10 : 0;

  return {
    tongQuan: {
      ...tongQuan,
      tongKhachHang,
      dangHoatDong: Number(tongQuan?.dangHoatDong ?? 0),
      biKhoa: Number(tongQuan?.biKhoa ?? 0),
      daXoa: Number(tongQuan?.daXoa ?? 0),
      tongDiem: Number(tongQuan?.tongDiem ?? 0),
    },
    theoDoTuoi: theoDoTuoi.map((row) => ({ ...row, tyLe: tinhTyLe(row.soLuong) })),
    theoGioiTinh: theoGioiTinh.map((row) => ({ ...row, tyLe: tinhTyLe(row.soLuong) })),
    soThichTheoNganhHang,
    soThichTuKhaiBao,
    khachMoiTheoThang,
  };
}

/** Số liệu tổng quan cho Dashboard. */
async function tongQuanDashboard() {
  const homNay = todaySql();
  const doanhThuHomNay = await db.get(
    `SELECT COUNT(*) AS soDon, COALESCE(SUM(tongTien), 0) AS doanhThu
       FROM DONHANG WHERE date(ngayDat) = date(:homNay) AND trangThai <> N'Đã hủy'`,
    { homNay }
  );
  const bieuThucThang = db.bieuThucThang('ngayDat');
  const doanhThuThang = await db.get(
  const donChoXuLy = Number(
    db.scalar(
      `SELECT COUNT(*) FROM DONHANG WHERE trangThai IN (N'Chờ xử lý', N'Đã xác nhận', N'Đang giao')`
    )
  );
  const soKhachHang = Number(
    db.scalar(`SELECT COUNT(*) FROM KHACHHANG WHERE trangThai = N'Hoạt động'`)
  );
  const soSanPham = Number(db.scalar('SELECT COUNT(*) FROM SANPHAM'));
  const soNhanVien = Number(
    db.scalar(`SELECT COUNT(*) FROM NHANVIEN WHERE trangThai = N'Đang làm việc'`)
  );
  const canhBaoTon = productService.canhBaoTonKho();
  const khachMoi30Ngay = Number(
    db.scalar(`SELECT COUNT(*) FROM KHACHHANG WHERE date(ngayDangKy) >= date(:tuNgay)`, {
      tuNgay: daysFromToday(-30),
    })
  );

  return {
    homNay: { ...doanhThuHomNay, ngay: homNay },
    thangNay: doanhThuThang,
    donChoXuLy,
    soKhachHang,
    soSanPham,
    soNhanVien,
    khachMoi30Ngay,
    canhBaoTonKho: { nguong: canhBaoTon.nguong, soLuong: canhBaoTon.soLuongCanhBao },
    phanHoiChuaXuLy: feedbackService.demPhanHoiChuaXuLy(),
    doanhThu7Ngay: db.all(
      `SELECT date(ngayDat) AS ngay, COUNT(*) AS soDon, COALESCE(SUM(tongTien), 0) AS doanhThu
         FROM DONHANG
        WHERE trangThai = N'Hoàn thành' AND date(ngayDat) >= date(:tuNgay)
        GROUP BY date(ngayDat)
        ORDER BY ngay ASC`,
      { tuNgay: daysFromToday(-6) }
    ),
    sanPhamBanChay: thongKeSanPhamBanChay({ top: 5 }).items,
  };
}

/**
 * CN12.6 — Kết xuất báo cáo.
 * Trả về cấu trúc bảng (tiêu đề + dòng dữ liệu) để tải về CSV/Excel.
 * @param {string} loaiBaoCao doanhthu | sanpham | nhaphang | tonkho | khachhang | khachhangthanthiet
 */
function xuatBaoCao(loaiBaoCao, query = {}) {
  switch (loaiBaoCao) {
    case 'doanhthu': {
      const du = thongKeDoanhThu(query);
      return {
        tieuDe: `Báo cáo doanh thu theo ${du.kieu}`,
        cot: ['Mốc thời gian', 'Số đơn', 'Doanh thu (VND)', 'Giá trị đơn trung bình'],
        dong: du.chiTiet.map((row) => [
          row.mocThoiGian,
          row.soDon,
          row.doanhThu,
          row.giaTriDonTrungBinh,
        ]),
      };
    }
    case 'sanpham': {
      const du = thongKeSanPhamBanChay(query);
      return {
        tieuDe: `Báo cáo sản phẩm bán chạy (top ${du.top})`,
        cot: ['Mã SP', 'Tên sản phẩm', 'Loại', 'Số lượng bán', 'Doanh thu (VND)', 'Số đơn'],
        dong: du.items.map((row) => [
          row.maSP,
          row.tenSP,
          row.tenLoai,
          row.tongSoLuong,
          row.tongDoanhThu,
          row.soDon,
        ]),
      };
    }
    case 'nhaphang': {
      const du = thongKeNhapHang(query);
      return {
        tieuDe: 'Báo cáo nhập hàng và chi phí theo nhà cung cấp',
        cot: ['Mã NCC', 'Nhà cung cấp', 'Số phiếu', 'Tổng chi phí (VND)'],
        dong: du.theoNhaCungCap.map((row) => [row.maNCC, row.tenNCC, row.soPhieu, row.tongChiPhi]),
      };
    }
    case 'tonkho': {
      const du = baoCaoTonKho(query);
      return {
        tieuDe: 'Báo cáo tồn kho',
        cot: ['Mã SP', 'Tên sản phẩm', 'Loại', 'Giá (VND)', 'Tồn kho', 'Giá trị tồn (VND)', 'Trạng thái'],
        dong: du.items.map((row) => [
          row.maSP,
          row.tenSP,
          row.tenLoai,
          row.gia,
          row.soLuong,
          row.giaTriTon,
          row.trangThai,
        ]),
      };
    }
    case 'khachhang': {
      const du = thongKeKhachHang();
      return {
        tieuDe: 'Báo cáo khách hàng theo độ tuổi',
        cot: ['Nhóm tuổi', 'Số khách hàng', 'Tỷ lệ (%)'],
        dong: du.theoDoTuoi.map((row) => [row.nhomTuoi, row.soLuong, row.tyLe]),
      };
    }
    case 'khachhangthanthiet': {
      const du = thongKeKhachHangThanThiet(query);
      return {
        tieuDe: 'Báo cáo khách hàng thân thiết',
        cot: ['Mã KH', 'Họ tên', 'SĐT', 'Điểm tích lũy', 'Số đơn', 'Tổng chi tiêu (VND)'],
        dong: du.items.map((row) => [
          row.maKH,
          row.hoTen,
          row.sdt,
          row.diemTichLuy,
          row.soDon,
          row.tongChiTieu,
        ]),
      };
    }
    default:
      return null;
  }
}

/** Danh sách loại báo cáo hỗ trợ kết xuất. */
const LOAI_BAO_CAO = [
  { ma: 'doanhthu', ten: 'Doanh thu', moTa: 'CN12.1 — Thống kê doanh thu theo ngày/tháng/năm' },
  { ma: 'sanpham', ten: 'Sản phẩm bán chạy', moTa: 'CN12.2 — Top sản phẩm theo số lượng và doanh thu' },
  { ma: 'nhaphang', ten: 'Nhập hàng & chi phí', moTa: 'CN12.3 — Chi phí nhập hàng theo nhà cung cấp' },
  { ma: 'tonkho', ten: 'Tồn kho', moTa: 'CN12.4 — Tồn kho hiện tại và giá trị tồn' },
  { ma: 'khachhang', ten: 'Khách hàng theo độ tuổi', moTa: '4.1.5 — Tỷ lệ độ tuổi khách hàng' },
  { ma: 'khachhangthanthiet', ten: 'Khách hàng thân thiết', moTa: 'CN12.5 — Khách hàng chi tiêu cao nhất' },
];

module.exports = {
  thongKeDoanhThu,
  thongKeSanPhamBanChay,
  thongKeNhapHang,
  baoCaoTonKho,
  thongKeKhachHangThanThiet,
  thongKeKhachHang,
  tongQuanDashboard,
  xuatBaoCao,
  LOAI_BAO_CAO,
};
