/**
 * NGHIỆP VỤ NHÓM 7 — Quản lý đơn hàng (CN7.1 → CN7.5).
 * Mọi thao tác thay đổi nhiều bảng đều nằm trong một transaction.
 * Bảng: DONHANG, CHITIETDONHANG, SANPHAM, KHACHHANG, LICHSUDIEM, CTKM, KHUYENMAI.
 */
'use strict';

const db = require('../db');
const productService = require('./product.service');
const loyaltyService = require('./loyalty.service');
const { ROLES, LUONG_DON_HANG, TRANG_THAI_DH, HINH_THUC_DH } = require('../config');
const { badRequest, notFound, conflict } = require('../core/errors');
const { requiredInt, optionalText, oneOf, asArray } = require('../core/validation');
const { nowSql } = require('../core/time');
const { FilterBuilder, parsePagination, paginate, executePaged, buildOrderBy } = require('../core/query');

const SELECT_SQL = `
  SELECT d.maDH, d.maKH, kh.hoTen AS tenKhachHang, kh.sdt AS sdtKhachHang,
         d.maNV, nv.hoTen AS tenNhanVien, d.ngayDat, d.tienHang, d.diemSuDung,
         d.tienGiamDiem, d.tongTien, d.hinhThuc, d.ghiChu, d.lyDoHuy, d.trangThai,
         (SELECT COUNT(*) FROM CHITIETDONHANG ct WHERE ct.maDH = d.maDH) AS soMatHang
    FROM DONHANG d
    JOIN KHACHHANG kh ON kh.maKH = d.maKH
    LEFT JOIN NHANVIEN nv ON nv.maNV = d.maNV`;
const COUNT_SQL = `
  SELECT COUNT(*) AS total
    FROM DONHANG d
    JOIN KHACHHANG kh ON kh.maKH = d.maKH`;

const SORT_MAP = {
  maDH: 'd.maDH',
  ngayDat: 'd.ngayDat',
  tongTien: 'd.tongTien',
  trangThai: 'd.trangThai',
};

/**
 * CN7.4 — Tra cứu / xem danh sách đơn hàng.
 * Khách hàng chỉ được xem đơn của chính mình.
 */
async function listDonHang(query = {}, user = null) {
  const pagination = parsePagination(query);
  const filter = new FilterBuilder()
    .search(query.q, ['kh.hoTen', 'kh.sdt', 'd.maDH'])
    .equals('d.trangThai', query.trangThai ? optionalText(query.trangThai, 30) : null)
    .equals('d.hinhThuc', query.hinhThuc ? optionalText(query.hinhThuc, 30) : null)
    .equals('d.maKH', query.maKH ? Number(query.maKH) : null);

  if (user?.vaiTro === ROLES.CUSTOMER) {
    filter.equals('d.maKH', user.maKH);
  }
  if (query.tuNgay) filter.raw('date(d.ngayDat) >= date(:tuNgay)', { tuNgay: query.tuNgay });
  if (query.denNgay) filter.raw('date(d.ngayDat) <= date(:denNgay)', { denNgay: query.denNgay });

  const orderBy = buildOrderBy(query, SORT_MAP, 'ngayDat');
  const orderByCuoi = query.sortBy ? orderBy : 'ORDER BY d.ngayDat DESC, d.maDH DESC';
  const { items, total } = await executePaged({
    selectSql: SELECT_SQL,
    countSql: COUNT_SQL,
    filter,
    orderBy: orderByCuoi,
    pagination,
    runAll: db.all,
    runGet: db.get,
  });
  return paginate(items, total, pagination);
}

/** CN7.4/CN7.5 — Chi tiết đơn hàng (dữ liệu đủ để in hoá đơn). */
async function getDonHang(maDH, user = null) {
  const header = await db.get(`${SELECT_SQL} WHERE d.maDH = :maDH`, { maDH });
  if (!header) throw notFound(`Không tìm thấy đơn hàng có mã ${maDH}.`);
  if (user?.vaiTro === ROLES.CUSTOMER && Number(header.maKH) !== Number(user.maKH)) {
    throw notFound(`Không tìm thấy đơn hàng có mã ${maDH}.`);
  }
  const chiTiet = await db.all(
    `SELECT ct.maSP, sp.tenSP, l.tenLoai, ct.soLuong, ct.donGia, ct.thanhTien
       FROM CHITIETDONHANG ct
       JOIN SANPHAM sp ON sp.maSP = ct.maSP
       JOIN LOAISANPHAM l ON l.maLoai = sp.maLoai
      WHERE ct.maDH = :maDH
      ORDER BY sp.tenSP ASC`,
    { maDH }
  );
  const lichSuDiem = await db.all(
    `SELECT maLS, soDiem, loaiGD, ghiChu, ngayGD FROM LICHSUDIEM
      WHERE maDH = :maDH ORDER BY ngayGD ASC, maLS ASC`,
    { maDH }
  );
  return { ...header, chiTiet, lichSuDiem };
}

/** Lấy sản phẩm kèm giá đã trừ khuyến mãi còn hiệu lực. */
async function laySanPhamDeBan(maSP) {
  return db.get(
    `SELECT sp.maSP, sp.tenSP, sp.gia, sp.soLuong, sp.trangThai,
            COALESCE((
              SELECT MAX(km.giaTriGiam)
                FROM CTKM c
                JOIN KHUYENMAI km ON km.maKM = c.maKM
               WHERE c.maSP = sp.maSP
                 AND km.trangThai = 'Đang diễn ra'
                 AND date('now','localtime') BETWEEN km.ngayBatDau AND km.ngayKetThuc
            ), 0) AS giamGia
       FROM SANPHAM sp WHERE sp.maSP = :maSP`,
    { maSP }
  );
}

/**
 * Kiểm tra giỏ hàng và tính tiền.
 * @returns {Promise<{dongHang: Array<{maSP:number,soLuong:number,donGia:number,thanhTien:number}>, tienHang:number}>}
 */
async function chuanHoaGioHang(gioHangRaw, { kiemTraTonKho }) {
  const danhSach = asArray(gioHangRaw);
  if (danhSach.length === 0) throw badRequest('Đơn hàng phải có ít nhất một sản phẩm.');

  /** @type {Map<number, number>} */
  const gom = new Map();
  danhSach.forEach((dong, index) => {
    const maSP = requiredInt(dong.maSP, `Mã sản phẩm dòng ${index + 1}`, 1);
    const soLuong = requiredInt(dong.soLuong, `Số lượng dòng ${index + 1}`, 1);
    gom.set(maSP, (gom.get(maSP) ?? 0) + soLuong);
  });

  const dongHang = [];
  let tienHang = 0;
  for (const [maSP, soLuong] of gom) {
    const sanPham = await laySanPhamDeBan(maSP);
    if (!sanPham) throw badRequest(`Sản phẩm có mã ${maSP} không tồn tại.`);
    if (sanPham.trangThai !== 'Đang bán') {
      throw conflict(
        `Sản phẩm "${sanPham.tenSP}" hiện đang ở trạng thái "${sanPham.trangThai}", không thể đặt.`
      );
    }
    if (kiemTraTonKho && Number(sanPham.soLuong) < soLuong) {
      throw conflict(
        `Sản phẩm "${sanPham.tenSP}" chỉ còn ${sanPham.soLuong} trong kho, không đủ ${soLuong}.`
      );
    }
    const donGia = Math.max(0, Number(sanPham.gia) - Number(sanPham.giamGia));
    const thanhTien = donGia * soLuong;
    tienHang += thanhTien;
    dongHang.push({ maSP, soLuong, donGia, thanhTien });
  }
  return { dongHang, tienHang };
}

/** Lỗi khi khách hàng không ở trạng thái hoạt động. */
function loiKhachKhongHoatDong(trangThaiKhachHang) {
  return conflict(`Khách hàng đang ở trạng thái "${trangThaiKhachHang}", không thể đặt hàng.`);
}

/**
 * CN7.1 — Tạo giỏ hàng / đặt hàng.
 * @param {object} payload { maKH, chiTiet, diemSuDung, hinhThuc, ghiChu, maNV }
 * @param {object|null} user người đặt (khách hàng hoặc nhân viên)
 */
async function createDonHang(payload, user = null) {
  const laKhachHang = user?.vaiTro === ROLES.CUSTOMER;
  const maKH = laKhachHang ? Number(user.maKH) : requiredInt(payload.maKH, 'Khách hàng', 1);

  const khachHang = await db.get(
    'SELECT maKH, hoTen, diemTichLuy, trangThai FROM KHACHHANG WHERE maKH = :maKH',
    { maKH }
  );
  if (!khachHang) throw badRequest(`Khách hàng có mã ${maKH} không tồn tại.`);
  if (khachHang.trangThai !== 'Hoạt động') {
    throw loiKhachKhongHoatDong(khachHang.trangThai);
  }

  const hinhThuc = oneOf(payload.hinhThuc ?? HINH_THUC_DH[0], HINH_THUC_DH, 'Hình thức');
  const ghiChu = optionalText(payload.ghiChu, 255);
  const { dongHang, tienHang } = await chuanHoaGioHang(payload.chiTiet, { kiemTraTonKho: true });

  const diemSuDung = Number(payload.diemSuDung ?? 0);
  const tienGiamDiem = diemSuDung > 0 ? loyaltyService.tinhTienGiamTuDiem(diemSuDung) : 0;
  if (diemSuDung > Number(khachHang.diemTichLuy)) {
    throw conflict(
      `Khách hàng chỉ có ${khachHang.diemTichLuy} điểm, không đủ để dùng ${diemSuDung} điểm.`
    );
  }
  if (tienGiamDiem > tienHang) {
    throw badRequest('Số tiền giảm từ điểm vượt quá giá trị đơn hàng.');
  }
  const tongTien = tienHang - tienGiamDiem;
  const maNV = laKhachHang ? null : payload.maNV ? Number(payload.maNV) : (user?.maNV ?? null);

  return db.transaction(async () => {
    const result = await db.run(
      `INSERT INTO DONHANG (maKH, maNV, ngayDat, tongTien, tienHang, diemSuDung,
                            tienGiamDiem, hinhThuc, ghiChu, trangThai)
       VALUES (:maKH, :maNV, :ngayDat, :tongTien, :tienHang, :diemSuDung,
               :tienGiamDiem, :hinhThuc, :ghiChu, N'Chờ xử lý')`,
      {
        maKH,
        maNV,
        ngayDat: nowSql(),
        tongTien,
        tienHang,
        diemSuDung,
        tienGiamDiem,
        hinhThuc,
        ghiChu,
      }
    );
    const maDH = result.lastInsertRowid;

    for (const dong of dongHang) {
      await db.run(
        `INSERT INTO CHITIETDONHANG (maDH, maSP, soLuong, donGia, thanhTien)
         VALUES (:maDH, :maSP, :soLuong, :donGia, :thanhTien)`,
        { maDH, ...dong }
      );
      await productService.dieuChinhTonKho(dong.maSP, -dong.soLuong);
    }

    if (diemSuDung > 0) {
      await loyaltyService.suDungDiem(maKH, maDH, diemSuDung);
    }
    return getDonHang(maDH);
  });
}

/**
 * CN7.2 — Cập nhật trạng thái đơn hàng.
 * Chỉ cho phép chuyển theo đúng luồng; khi 'Hoàn thành' thì tự động cộng điểm.
 */
async function capNhatTrangThai(maDH, trangThaiMoi) {
  const current = await getDonHang(maDH);
  const trangThai = oneOf(trangThaiMoi, TRANG_THAI_DH, 'Trạng thái đơn hàng');
  if (trangThai === current.trangThai) {
    throw badRequest(`Đơn hàng đang ở trạng thái "${trangThai}".`);
  }
  const choPhep = LUONG_DON_HANG[current.trangThai] ?? [];
  if (!choPhep.includes(trangThai)) {
    throw badRequest(
      `Không thể chuyển đơn từ "${current.trangThai}" sang "${trangThai}". ` +
        (choPhep.length
          ? `Chỉ có thể chuyển sang: ${choPhep.join(', ')}.`
          : 'Đơn hàng đã kết thúc.')
    );
  }

  if (trangThai === 'Đã hủy') return huyDonHang(maDH, 'Hủy qua cập nhật trạng thái');

  return db.transaction(async () => {
    await db.run('UPDATE DONHANG SET trangThai = :trangThai WHERE maDH = :maDH', {
      trangThai,
      maDH,
    });
    let ketQuaDiem = null;
    if (trangThai === 'Hoàn thành') {
      ketQuaDiem = await loyaltyService.congDiemChoDonHang(maDH);
    }
    return { ...(await getDonHang(maDH)), ketQuaDiem };
  });
}

/**
 * CN7.3 — Hủy đơn hàng.
 * Hoàn lại tồn kho, hoàn/thu hồi điểm và đổi trạng thái sang 'Đã hủy'.
 */
async function huyDonHang(maDH, lyDo) {
  const current = await getDonHang(maDH);
  if (current.trangThai === 'Đã hủy') throw badRequest('Đơn hàng này đã được hủy trước đó.');
  if (current.trangThai === 'Hoàn thành') {
    throw badRequest('Đơn hàng đã hoàn thành, không thể hủy. Hãy tạo phiếu trả hàng nếu cần.');
  }
  const lyDoHuy = optionalText(lyDo, 255) ?? 'Không nêu lý do';

  return db.transaction(async () => {
    for (const dong of current.chiTiet) {
      await productService.dieuChinhTonKho(dong.maSP, dong.soLuong);
    }
    const ketQuaDiem = await loyaltyService.hoanDiemKhiHuyDon(maDH);
    await db.run(
      `UPDATE DONHANG SET trangThai = N'Đã hủy', lyDoHuy = :lyDoHuy WHERE maDH = :maDH`,
      { lyDoHuy, maDH }
    );
    return { ...(await getDonHang(maDH)), ketQuaDiem };
  });
}

/** Danh sách đơn hàng của một khách (dùng cho cổng khách hàng - mục 4.3). */
async function listDonHangCuaKhach(maKH, query = {}) {
  return listDonHang({ ...query, maKH }, null);
}

/** Thống kê doanh thu đơn hàng theo hình thức và trạng thái. */
async function thongKeDonHang(query = {}) {
  const filter = new FilterBuilder();
  if (query.tuNgay) filter.raw('date(d.ngayDat) >= date(:tuNgay)', { tuNgay: query.tuNgay });
  if (query.denNgay) filter.raw('date(d.ngayDat) <= date(:denNgay)', { denNgay: query.denNgay });
  const { sql: whereSql, params } = filter.toWhere();
  const theoTrangThai = await db.all(
    `SELECT d.trangThai, COUNT(*) AS soDon, COALESCE(SUM(d.tongTien), 0) AS tongTien
       FROM DONHANG d ${whereSql}
      GROUP BY d.trangThai
      ORDER BY soDon DESC`,
    params
  );
  const tongDon = await db.scalar(`SELECT COUNT(*) FROM DONHANG d ${whereSql}`, params);
  return { theoTrangThai, tongDon: Number(tongDon) };
}

module.exports = {
  listDonHang,
  getDonHang,
  createDonHang,
  capNhatTrangThai,
  huyDonHang,
  listDonHangCuaKhach,
  chuanHoaGioHang,
  thongKeDonHang,
};
