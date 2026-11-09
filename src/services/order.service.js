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
const voucherService = require('./voucher.service');
const internalNotificationService = require('./internal-notification.service');
const { FilterBuilder, parsePagination, paginate, executePaged, buildOrderBy } = require('../core/query');

const SELECT_SQL = `
  SELECT d.maDH, d.maKH, kh.hoTen AS tenKhachHang, kh.sdt AS sdtKhachHang,
         d.maNV, nv.hoTen AS tenNhanVien, d.ngayDat, d.tienHang, d.diemSuDung,
         d.tienGiamDiem, d.maPG, d.tienGiamPhieu, pg.maCode AS maCodePhieu, pg.tieuDe AS tenPhieuGiamGia,
         d.tongTien, d.hinhThuc, d.phuongThucThanhToan,
         d.diaChiGiaoHang, d.ghiChu, d.lyDoHuy, d.trangThai,
         (SELECT COUNT(*) FROM CHITIETDONHANG ct WHERE ct.maDH = d.maDH) AS soMatHang
    FROM DONHANG d
    JOIN KHACHHANG kh ON kh.maKH = d.maKH
    LEFT JOIN NHANVIEN nv ON nv.maNV = d.maNV
    LEFT JOIN PHIEUGIAMGIA pg ON pg.maPG = d.maPG`;
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
  const maKHPreflight = user?.vaiTro === ROLES.CUSTOMER
    ? Number(user.maKH)
    : Number(payload.maKH);
  if (Number.isInteger(maKHPreflight) && maKHPreflight > 0) {
    await loyaltyService.layDiemHienTai(maKHPreflight);
  }
  const donHangDaTao = await db.transaction(async () => {
  const laKhachHang = user?.vaiTro === ROLES.CUSTOMER;
  const maKH = laKhachHang ? Number(user.maKH) : requiredInt(payload.maKH, 'Khách hàng', 1);

  const khachHang = await db.get(
    'SELECT maKH, hoTen, diaChi, diemTichLuy, trangThai FROM KHACHHANG WHERE maKH = :maKH',
    { maKH }
  );
  if (!khachHang) throw badRequest(`Khách hàng có mã ${maKH} không tồn tại.`);
  if (khachHang.trangThai !== 'Hoạt động') {
    throw loiKhachKhongHoatDong(khachHang.trangThai);
  }

  const hinhThuc = oneOf(payload.hinhThuc ?? HINH_THUC_DH[0], HINH_THUC_DH, 'Hình thức');
  const phuongThucThanhToan = oneOf(
    payload.phuongThucThanhToan ?? 'Tiền mặt',
    ['Tiền mặt', 'Chuyển khoản'],
    'Phương thức thanh toán'
  );
  const diaChiGiaoHang = optionalText(
    payload.diaChiGiaoHang ?? (hinhThuc === 'Giao hàng' ? khachHang.diaChi : null),
    255
  );
  if (hinhThuc === 'Giao hàng' && !diaChiGiaoHang) {
    throw badRequest('Vui lòng nhập địa chỉ giao hàng trong đơn hàng hoặc cập nhật hồ sơ khách hàng.');
  }
  const ghiChu = optionalText(payload.ghiChu, 255);
  const { dongHang, tienHang } = await chuanHoaGioHang(payload.chiTiet, { kiemTraTonKho: true });
  const diemSuDung = Number(payload.diemSuDung ?? 0);
  const tienGiamDiem = diemSuDung > 0 ? loyaltyService.tinhTienGiamTuDiem(diemSuDung) : 0;

  let phieuGiamGia = null;
  let tienGiamPhieu = 0;
  if (payload.maPG !== null && payload.maPG !== undefined && payload.maPG !== '') {
    const maPG = requiredInt(payload.maPG, 'Phiếu giảm giá', 1);
    phieuGiamGia = await db.get(
      `SELECT maPG, maKH, maCTPG, phanTramGiam, giamToiDa, soLanSuDungToiDa, soLanDaSuDung, loai
         FROM PHIEUGIAMGIA
        WHERE maPG = :maPG AND maKH = :maKH AND trangThai = N'Chưa dùng'
          AND (ngayHetHan IS NULL OR ngayHetHan >= :now)
          AND soLanDaSuDung < soLanSuDungToiDa
        FOR UPDATE`,
      { maPG, maKH, now: nowSql() }
    );
    if (!phieuGiamGia) {
      const hetLuot = await db.get(
        `SELECT ct.maCTPG FROM PHIEUGIAMGIA pg JOIN CHUONGTRINHPHIEU ct ON ct.maCTPG = pg.maCTPG
          WHERE pg.maPG = :maPG AND pg.maKH = :maKH AND ct.trangThai = N'Hết lượt'`, { maPG, maKH }
      );
      if (hetLuot) throw badRequest('Phiếu giảm giá này đã hết lượt sử dụng. Hãy chọn ưu đãi khác.');
      throw badRequest('Phiếu giảm giá không còn hiệu lực hoặc không thuộc tài khoản này.');
    }
    if (phieuGiamGia.maCTPG) {
      const ct = await db.get('SELECT maCTPG, soLuongToiDa, soLuongDaDung, trangThai FROM CHUONGTRINHPHIEU WHERE maCTPG = :maCTPG FOR UPDATE', { maCTPG: phieuGiamGia.maCTPG });
      if (!ct || ct.trangThai !== 'Đang áp dụng' || (ct.soLuongToiDa !== null && Number(ct.soLuongDaDung) >= Number(ct.soLuongToiDa))) {
        throw badRequest('Phiếu giảm giá này đã hết lượt sử dụng. Hãy chọn ưu đãi khác.');
      }
    }
    const coSoTinhGiam = phieuGiamGia.loai === 'Sinh nhật'
      ? Math.max(...dongHang.map((dong) => Number(dong.donGia)))
      : tienHang;
    tienGiamPhieu = coSoTinhGiam * Number(phieuGiamGia.phanTramGiam) / 100;
    if (phieuGiamGia.giamToiDa !== null) tienGiamPhieu = Math.min(tienGiamPhieu, Number(phieuGiamGia.giamToiDa));
    tienGiamPhieu = Math.min(tienGiamPhieu, Math.max(0, tienHang - tienGiamDiem));
  }

  if (diemSuDung > Number(khachHang.diemTichLuy)) {
    throw conflict(
      `Khách hàng chỉ có ${khachHang.diemTichLuy} điểm, không đủ để dùng ${diemSuDung} điểm.`
    );
  }
  if (tienGiamDiem > tienHang) {
    throw badRequest('Số tiền giảm từ điểm vượt quá giá trị đơn hàng.');
  }
  const tongTien = tienHang - tienGiamDiem - tienGiamPhieu;
  const maNV = laKhachHang ? null : payload.maNV ? Number(payload.maNV) : (user?.maNV ?? null);

    const result = await db.run(
      `INSERT INTO DONHANG (maKH, maNV, ngayDat, tongTien, tienHang, diemSuDung,
                            tienGiamDiem, maPG, tienGiamPhieu, hinhThuc, phuongThucThanhToan, diaChiGiaoHang,
                            ghiChu, trangThai)
       VALUES (:maKH, :maNV, :ngayDat, :tongTien, :tienHang, :diemSuDung,
               :tienGiamDiem, :maPG, :tienGiamPhieu, :hinhThuc, :phuongThucThanhToan, :diaChiGiaoHang,
               :ghiChu, N'Chờ xử lý')`,
      {
        maKH,
        maNV,
        ngayDat: nowSql(),
        tongTien,
        tienHang,
        diemSuDung,
        tienGiamDiem,
        maPG: phieuGiamGia?.maPG ?? null,
        tienGiamPhieu,
        hinhThuc,
        phuongThucThanhToan,
        diaChiGiaoHang,
        ghiChu,
      }
    );
    const maDH = result.lastInsertRowid;

    await db.run(
      `UPDATE KHACHHANG SET ngayMuaHangCuoi = :ngayMuaHangCuoi,
             ngayNhacHetHanDiem = NULL
        WHERE maKH = :maKH`,
      { maKH, ngayMuaHangCuoi: nowSql() }
    );

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
    if (phieuGiamGia) {
      await db.run(
        `UPDATE PHIEUGIAMGIA SET soLanDaSuDung = soLanDaSuDung + 1,
             trangThai = CASE WHEN soLanDaSuDung + 1 >= soLanSuDungToiDa THEN N'Đã dùng' ELSE trangThai END
          WHERE maPG = :maPG`,
        { maPG: phieuGiamGia.maPG }
      );
      if (phieuGiamGia.maCTPG) {
        await db.run(
          `UPDATE CHUONGTRINHPHIEU
              SET soLuongDaDung = soLuongDaDung + 1,
                  trangThai = CASE WHEN soLuongToiDa IS NOT NULL AND soLuongDaDung + 1 >= soLuongToiDa
                                   THEN N'Hết lượt' ELSE trangThai END
            WHERE maCTPG = :maCTPG`,
          { maCTPG: phieuGiamGia.maCTPG }
        );
      }
    }
    return getDonHang(maDH);
  });
  try { await voucherService.dongBoHetHan(); }
  catch (error) { console.error('[don-hang] Không đồng bộ được trạng thái phiếu giảm giá:', error.message); }
  try { await internalNotificationService.thongBaoDonMoi(donHangDaTao); }
  catch (error) { console.error('[don-hang] Không gửi được thông báo đơn mới:', error.message); }
  return donHangDaTao;
}

/**
 * CN7.2 — Cập nhật trạng thái đơn hàng.
 * Chỉ cho phép chuyển theo đúng luồng; khi 'Hoàn thành' thì tự động cộng điểm.
 */
async function capNhatTrangThai(maDH, trangThaiMoi, user = null) {
  return db.transaction(async () => {
  const current = await getDonHang(maDH);
  const maNVXuLy = await layMaNhanVienDangXuLy(user);
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

  if (trangThai === 'Đã hủy') return huyDonHang(maDH, 'Hủy qua cập nhật trạng thái', user);

    const capNhat = await db.run(
      `UPDATE DONHANG SET trangThai = :trangThai,
                          maNV = COALESCE(:maNV, maNV)
        WHERE maDH = :maDH AND trangThai = :trangThaiHienTai`,
      {
      trangThai,
      maNV: maNVXuLy,
      maDH,
        trangThaiHienTai: current.trangThai,
      }
    );
    if (capNhat.changes === 0) {
      throw conflict('Trạng thái đơn hàng vừa thay đổi. Hãy tải lại đơn rồi thử lại.');
    }
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
async function huyDonHang(maDH, lyDo, user = null) {
  return db.transaction(async () => {
  const current = await getDonHang(maDH);
  const maNVXuLy = await layMaNhanVienDangXuLy(user);
  if (current.trangThai === 'Đã hủy') throw badRequest('Đơn hàng này đã được hủy trước đó.');
  if (current.trangThai === 'Hoàn thành') {
    throw badRequest('Đơn hàng đã hoàn thành, không thể hủy. Hãy tạo phiếu trả hàng nếu cần.');
  }
  const lyDoHuy = optionalText(lyDo, 255) ?? 'Không nêu lý do';

    const capNhat = await db.run(
      `UPDATE DONHANG SET trangThai = N'Đã hủy', lyDoHuy = :lyDoHuy,
                          maNV = COALESCE(:maNV, maNV)
        WHERE maDH = :maDH AND trangThai = :trangThaiHienTai`,
      { lyDoHuy, maNV: maNVXuLy, maDH, trangThaiHienTai: current.trangThai }
    );
    if (capNhat.changes === 0) {
      throw conflict('Trạng thái đơn hàng vừa thay đổi. Hãy tải lại đơn rồi thử lại.');
    }
    for (const dong of current.chiTiet) {
      await productService.dieuChinhTonKho(dong.maSP, dong.soLuong);
    }
    const ketQuaDiem = await loyaltyService.hoanDiemKhiHuyDon(maDH);
    await db.run(
      `UPDATE KHACHHANG
          SET ngayMuaHangCuoi = COALESCE(
                (SELECT MAX(d.ngayDat) FROM DONHANG d
                  WHERE d.maKH = :maKH AND d.trangThai <> N'Đã hủy'),
                (SELECT MAX(l.ngayGD) FROM LICHSUDIEM l
                  WHERE l.maKH = :maKH AND l.loaiGD IN (N'Cộng', N'Hoàn')),
                CASE WHEN diemTichLuy > 0 THEN CURRENT_TIMESTAMP ELSE NULL END
              ),
              ngayNhacHetHanDiem = NULL
        WHERE maKH = :maKH`,
      { maKH: current.maKH }
    );
    if (current.maPG) {
      const phieuDaDung = await db.get('SELECT maCTPG FROM PHIEUGIAMGIA WHERE maPG = :maPG', { maPG: current.maPG });
      await db.run(
        `UPDATE PHIEUGIAMGIA
            SET soLanDaSuDung = CASE WHEN soLanDaSuDung > 0 THEN soLanDaSuDung - 1 ELSE 0 END,
                trangThai = N'Chưa dùng'
          WHERE maPG = :maPG AND trangThai = N'Đã dùng'`,
        { maPG: current.maPG }
      );
      if (phieuDaDung?.maCTPG) {
        await db.run(
          `UPDATE CHUONGTRINHPHIEU
              SET soLuongDaDung = CASE WHEN soLuongDaDung > 0 THEN soLuongDaDung - 1 ELSE 0 END,
                  trangThai = CASE WHEN trangThai = N'Hết lượt' AND (ngayHetHan IS NULL OR ngayHetHan >= :now)
                                   THEN N'Đang áp dụng' ELSE trangThai END,
                  daThongBaoHetLuot = CASE WHEN trangThai = N'Hết lượt' AND (ngayHetHan IS NULL OR ngayHetHan >= :now)
                                           THEN FALSE ELSE daThongBaoHetLuot END
            WHERE maCTPG = :maCTPG`,
          { maCTPG: phieuDaDung.maCTPG, now: nowSql() }
        );
        await db.run("UPDATE PHIEUGIAMGIA SET trangThai = N'Chưa dùng' WHERE maCTPG = :maCTPG AND trangThai = N'Hết lượt'", { maCTPG: phieuDaDung.maCTPG });
      }
    }
    return { ...(await getDonHang(maDH)), ketQuaDiem };
  });
}

/** Resolve the acting employee even for legacy staff accounts missing TAIKHOAN.maNV. */
async function layMaNhanVienDangXuLy(user) {
  if (user?.maNV) {
    const employee = await db.get('SELECT maNV FROM NHANVIEN WHERE maNV = :maNV', { maNV: user.maNV });
    if (employee) return employee.maNV;
  }
  if (!user?.tenDangNhap || user.vaiTro === ROLES.CUSTOMER || user.vaiTro === ROLES.ADMIN) return null;
  const employee = await db.get(
    `SELECT maNV FROM NHANVIEN
      WHERE LOWER(email) = LOWER(:tenDangNhap) OR sdt = :tenDangNhap
      ORDER BY maNV ASC LIMIT 1`,
    { tenDangNhap: user.tenDangNhap }
  );
  if (employee) return employee.maNV;
  if (user.vaiTro === ROLES.STAFF || user.vaiTro === ROLES.MANAGER) {
    throw badRequest('Tài khoản nhân viên chưa được liên kết với hồ sơ nhân viên nên không thể ghi nhận người xử lý đơn.');
  }
  return null;
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
