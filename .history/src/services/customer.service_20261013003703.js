/**
 * NGHIỆP VỤ NHÓM 5 — Quản lý khách hàng (CN5.1 → CN5.4).
 * Bảng: KHACHHANG, TAIKHOAN, DONHANG, LICHSUDIEM, PHANHOI.
 */
'use strict';

const db = require('../db');
const auth = require('../core/auth');
const { ROLES, TRANG_THAI_KH } = require('../config');
const { badRequest, notFound, conflict } = require('../core/errors');
const {
  requiredText,
  optionalText,
  optionalEmail,
  phone,
  dateOnly,
  oneOf,
  strongPassword,
} = require('../core/validation');
const { ageFromBirthDate } = require('../core/time');
const { FilterBuilder, parsePagination, paginate, executePaged, buildOrderBy } = require('../core/query');

const GIOI_TINH = ['Nam', 'Nữ', 'Khác'];
const MAT_KHAU_KHACH_HANG = 'Khach@123';

const SELECT_SQL = `
  SELECT kh.maKH, kh.hoTen, kh.sdt, kh.email, kh.ngaySinh, kh.gioiTinh, kh.diaChi,
         kh.soThich, kh.diemTichLuy, kh.trangThai, kh.ngayDangKy,
         tk.maTK, tk.tenDangNhap, tk.trangThai AS trangThaiTaiKhoan, tk.lanDangNhapCuoi,
         (SELECT COUNT(*) FROM DONHANG d WHERE d.maKH = kh.maKH) AS soDonHang,
         COALESCE((SELECT SUM(d.tongTien) FROM DONHANG d
                    WHERE d.maKH = kh.maKH AND d.trangThai = N'Hoàn thành'), 0) AS tongChiTieu,
         COALESCE((SELECT GROUP_CONCAT(DISTINCT s.tenSP) FROM CHITIETDONHANG ct
                     JOIN DONHANG d2 ON d2.maDH = ct.maDH AND d2.trangThai = N'Hoàn thành'
                     JOIN SANPHAM s ON s.maSP = ct.maSP
                    WHERE d2.maKH = kh.maKH), '') AS soThichSanPham
    FROM KHACHHANG kh
    LEFT JOIN TAIKHOAN tk ON tk.maKH = kh.maKH`;
const COUNT_SQL = 'SELECT COUNT(*) AS total FROM KHACHHANG kh';

const SORT_MAP = {
  maKH: 'kh.maKH',
  hoTen: 'kh.hoTen',
  diemTichLuy: 'kh.diemTichLuy',
  ngayDangKy: 'kh.ngayDangKy',
  soDonHang: 'soDonHang',
  tongChiTieu: 'tongChiTieu',
};

/** Bổ sung trường tuổi tính từ ngày sinh. */
function decorate(row) {
  if (!row) return row;
  return { ...row, tuoi: ageFromBirthDate(row.ngaySinh) };
}

/** CN5.4 — Tìm kiếm / lọc / sắp xếp khách hàng. */
async function listKhachHang(query = {}) {
  const pagination = parsePagination(query);
  const filter = new FilterBuilder()
    .search(query.q, ['kh.hoTen', 'kh.sdt', 'kh.email', 'kh.diaChi', 'kh.soThich'])
    .equals('kh.gioiTinh', query.gioiTinh ? optionalText(query.gioiTinh, 10) : null)
    .equals('kh.trangThai', query.trangThai ? optionalText(query.trangThai, 30) : null)
    .between(
      'kh.diemTichLuy',
      query.diemFrom === '' ? null : query.diemFrom,
      query.diemTo === '' ? null : query.diemTo
    );

  const orderBy = buildOrderBy(query, SORT_MAP, 'hoTen');
  const { items, total } = await executePaged({
    selectSql: SELECT_SQL,
    countSql: COUNT_SQL,
    filter,
    orderBy,
    pagination,
    runAll: db.all,
    runGet: db.get,
  });
  return paginate(items.map(decorate), total, pagination);
}

/** Lấy hồ sơ khách hàng kèm lịch sử mua hàng và điểm. */
async function getKhachHang(maKH) {
  const row = await db.get(`${SELECT_SQL} WHERE kh.maKH = :maKH`, { maKH });
  if (!row) throw notFound(`Không tìm thấy khách hàng có mã ${maKH}.`);

  const donHangGanDay = await db.all(
    `SELECT d.maDH, d.ngayDat, d.tongTien, d.hinhThuc, d.trangThai,
            (SELECT COUNT(*) FROM CHITIETDONHANG ct WHERE ct.maDH = d.maDH) AS soMatHang
       FROM DONHANG d
      WHERE d.maKH = :maKH
      ORDER BY d.ngayDat DESC
      LIMIT 20`,
    { maKH }
  );

  const lichSuDiem = await db.all(
    `SELECT maLS, maDH, soDiem, loaiGD, ghiChu, ngayGD
       FROM LICHSUDIEM WHERE maKH = :maKH ORDER BY ngayGD DESC LIMIT 30`,
    { maKH }
  );

  return { ...decorate(row), donHangGanDay, lichSuDiem };
}

/** Kiểm tra số điện thoại / email không trùng. */
async function assertKhongTrung(sdt, emailValue, excludeMaKH = null) {
  const trungSdt = await db.get(
    'SELECT maKH, hoTen FROM KHACHHANG WHERE sdt = :sdt AND maKH <> :exclude',
    { sdt, exclude: excludeMaKH ?? -1 }
  );
  if (trungSdt) throw conflict(`Số điện thoại "${sdt}" đã được dùng bởi khách hàng ${trungSdt.hoTen}.`);
  if (emailValue) {
    const trungEmail = await db.get(
      'SELECT maKH, hoTen FROM KHACHHANG WHERE email = :email AND maKH <> :exclude',
      { email: emailValue, exclude: excludeMaKH ?? -1 }
    );
    if (trungEmail) {
      throw conflict(`Email "${emailValue}" đã được dùng bởi khách hàng ${trungEmail.hoTen}.`);
    }
  }
}

/** CN5.1 — Thêm khách hàng (kèm tài khoản đăng nhập cho khách). */
async function createKhachHang(payload) {
  const hoTen = requiredText(payload.hoTen, 'Họ tên khách hàng', 100);
  const sdt = phone(payload.sdt);
  const emailValue = optionalEmail(payload.email);
  const ngaySinh = dateOnly(payload.ngaySinh, 'Ngày sinh', { allowNull: true });
  const gioiTinh = payload.gioiTinh ? oneOf(payload.gioiTinh, GIOI_TINH, 'Giới tính') : null;
  const diaChi = optionalText(payload.diaChi, 255);
  const soThich = optionalText(payload.soThich, 150);
  const matKhau = payload.matKhau ? String(payload.matKhau) : MAT_KHAU_KHACH_HANG;
  const taoTaiKhoan = payload.taoTaiKhoan !== false;
  await assertKhongTrung(sdt, emailValue);

  return db.transaction(async () => {
    const result = await db.run(
      `INSERT INTO KHACHHANG (hoTen, sdt, email, ngaySinh, gioiTinh, diaChi, soThich,
                              diemTichLuy, trangThai, ngayDangKy)
       VALUES (:hoTen, :sdt, :email, :ngaySinh, :gioiTinh, :diaChi, :soThich,
               0, N'Hoạt động', CURRENT_TIMESTAMP)`,
      { hoTen, sdt, email: emailValue, ngaySinh, gioiTinh, diaChi, soThich }
    );
    const maKH = result.lastInsertRowid;
    if (taoTaiKhoan) {
      await auth.createAccount({
        tenDangNhap: sdt,
        matKhau,
        vaiTro: ROLES.CUSTOMER,
        maKH,
      });
    }
    return getKhachHang(maKH);
  });
}

/** CN5.2 — Sửa thông tin khách hàng. */
async function updateKhachHang(maKH, payload) {
  const current = await getKhachHang(maKH);
  const hoTen = requiredText(payload.hoTen ?? current.hoTen, 'Họ tên khách hàng', 100);
  const sdt = phone(payload.sdt ?? current.sdt);
  const emailValue =
    payload.email === undefined ? current.email : optionalEmail(payload.email);
  const ngaySinh =
    payload.ngaySinh === undefined
      ? current.ngaySinh
      : dateOnly(payload.ngaySinh, 'Ngày sinh', { allowNull: true });
  const gioiTinh =
    payload.gioiTinh === undefined
      ? current.gioiTinh
      : payload.gioiTinh
        ? oneOf(payload.gioiTinh, GIOI_TINH, 'Giới tính')
        : null;
  const diaChi = optionalText(payload.diaChi ?? current.diaChi, 255);
  const soThich = optionalText(payload.soThich ?? current.soThich, 150);
  await assertKhongTrung(sdt, emailValue, current.maKH);

  await db.run(
    `UPDATE KHACHHANG
        SET hoTen = :hoTen, sdt = :sdt, email = :email, ngaySinh = :ngaySinh,
            gioiTinh = :gioiTinh, diaChi = :diaChi, soThich = :soThich
      WHERE maKH = :maKH`,
    { hoTen, sdt, email: emailValue, ngaySinh, gioiTinh, diaChi, soThich, maKH: current.maKH }
  );
  return getKhachHang(current.maKH);
}

/**
 * 4.3.1 — Khách hàng tự cập nhật hồ sơ cá nhân.
 *
 * Số điện thoại chính là tên đăng nhập nên khách KHÔNG được tự đổi; chỉ được
 * sửa họ tên, email và ngày sinh. Các trường khác giữ nguyên giá trị hiện có.
 */
async function capNhatHoSoCaNhan(maKH, payload = {}) {
  const duLieu = {};
  if (payload.hoTen !== undefined) duLieu.hoTen = payload.hoTen;
  if (payload.email !== undefined) duLieu.email = payload.email;
  if (payload.ngaySinh !== undefined) duLieu.ngaySinh = payload.ngaySinh;
  return updateKhachHang(maKH, duLieu);
}

/** CN5.3 — Khóa / mở khóa khách hàng. */
async function doiTrangThaiKhachHang(maKH, trangThaiMoi) {
  const current = await getKhachHang(maKH);
  const trangThai = oneOf(trangThaiMoi ?? current.trangThai, TRANG_THAI_KH, 'Trạng thái');
  return db.transaction(async () => {
    await db.run('UPDATE KHACHHANG SET trangThai = :trangThai WHERE maKH = :maKH', {
      trangThai,
      maKH: current.maKH,
    });
    const trangThaiTaiKhoan = trangThai === 'Bị khóa' ? 'Bị khóa' : 'Hoạt động';
    await db.run('UPDATE TAIKHOAN SET trangThai = :trangThai WHERE maKH = :maKH', {
      trangThai: trangThaiTaiKhoan,
      maKH: current.maKH,
    });
    if (trangThai === 'Bị khóa') {
      await db.run(
        'DELETE FROM PHIENDANGNHAP WHERE maTK IN (SELECT maTK FROM TAIKHOAN WHERE maKH = :maKH)',
        { maKH: current.maKH }
      );
    }
    return getKhachHang(current.maKH);
  });
}

/** Đặt lại mật khẩu tài khoản khách hàng. */
async function datLaiMatKhau(maKH, matKhauMoi) {
  const current = await getKhachHang(maKH);
  if (!current.maTK) throw badRequest('Khách hàng này chưa có tài khoản đăng nhập.');
  const matKhau = requiredText(matKhauMoi ?? MAT_KHAU_KHACH_HANG, 'Mật khẩu', 100);
  await auth.changePassword(current.maTK, matKhau);
  return { maKH: current.maKH, matKhau, thongBao: 'Đã đặt lại mật khẩu khách hàng.' };
}

/** CN5.4 — Xóa khách hàng (chỉ khi chưa phát sinh đơn hàng / phản hồi). */
async function deleteKhachHang(maKH) {
  const current = await getKhachHang(maKH);
  if (current.soDonHang > 0) {
    throw badRequest(
      `Không thể xóa: khách hàng "${current.hoTen}" đã có ${current.soDonHang} đơn hàng. Hãy chuyển sang trạng thái "Bị khóa".`
    );
  }
  const rangBuocKhac =
    Number(
      await db.scalar('SELECT COUNT(*) FROM PHANHOI WHERE maKH = :maKH', { maKH: current.maKH })
    ) +
    Number(
      await db.scalar('SELECT COUNT(*) FROM PHIEUTRALOI WHERE maKH = :maKH', { maKH: current.maKH })
    );
  if (rangBuocKhac > 0) {
    throw badRequest(
      `Không thể xóa: khách hàng "${current.hoTen}" đã gửi phản hồi hoặc trả lời khảo sát.`
    );
  }

  return db.transaction(async () => {
    await db.run('DELETE FROM LICHSUDIEM WHERE maKH = :maKH', { maKH: current.maKH });
    await db.run('DELETE FROM TAIKHOAN WHERE maKH = :maKH', { maKH: current.maKH });
    await db.run('DELETE FROM KHACHHANG WHERE maKH = :maKH', { maKH: current.maKH });
    return { maKH: current.maKH, hoTen: current.hoTen, thongBao: 'Đã xóa khách hàng.' };
  });
}

/** Danh sách khách hàng đang hoạt động (dùng cho combobox). */
async function listKhachHangHoatDong() {
  return db.all(
    `SELECT maKH, hoTen, sdt, email, diemTichLuy FROM KHACHHANG
      WHERE trangThai = N'Hoạt động' ORDER BY hoTen ASC`
  );
}

/** Tìm khách hàng theo số điện thoại (dùng khi lập đơn hàng nhanh). */
async function timKhachHangTheoSdt(sdt) {
  const soDienThoai = String(sdt ?? '').trim();
  if (!soDienThoai) return null;
  const row = await db.get(
    `SELECT maKH, hoTen, sdt, email, diemTichLuy, trangThai
       FROM KHACHHANG WHERE sdt = :sdt`,
    { sdt: soDienThoai }
  );
  return row ?? null;
}

/**
 * 4.3.1 — Khách hàng tự đăng ký tài khoản.
 * Bắt buộc có họ tên, số điện thoại và mật khẩu.
 */
async function dangKyKhachHang(payload) {
  const matKhau = strongPassword(payload.matKhau);
  const nhapLai = payload.xacNhanMatKhau ?? payload.nhapLaiMatKhau;
  if (nhapLai !== undefined && nhapLai !== null && String(nhapLai) !== '') {
    if (String(nhapLai) !== matKhau) throw badRequest('Mật khẩu nhập lại không khớp.');
  }
  const khachHang = await createKhachHang({ ...payload, matKhau, taoTaiKhoan: true });
  return {
    maKH: khachHang.maKH,
    hoTen: khachHang.hoTen,
    sdt: khachHang.sdt,
    thongBao: `Đăng ký thành công. Bạn có thể đăng nhập bằng số điện thoại ${khachHang.sdt}.`,
  };
}

/** Thống kê khách hàng theo nhóm tuổi và giới tính (phục vụ báo cáo). */
async function thongKeNhomTuoi() {
  const bieuThucTuoi = db.bieuThucNhomTuoi('kh.ngaySinh');
  const theoNhomTuoi = await db.all(
    `SELECT ${bieuThucTuoi} AS nhomTuoi, COUNT(*) AS soLuong
       FROM KHACHHANG kh
      GROUP BY ${bieuThucTuoi}
      ORDER BY nhomTuoi ASC`
  );
  const theoGioiTinh = await db.all(
    `SELECT COALESCE(kh.gioiTinh, N'Chưa rõ') AS gioiTinh, COUNT(*) AS soLuong
       FROM KHACHHANG kh
      GROUP BY kh.gioiTinh
      ORDER BY soLuong DESC`
  );
  return { theoNhomTuoi, theoGioiTinh };
}

/** Thống kê sở thích khách hàng (tổng hợp từ trường soThich). */
async function thongKeSoThich() {
  const rows = await db.all(
    `SELECT soThich, COUNT(*) AS soLuong
       FROM KHACHHANG
      WHERE soThich IS NOT NULL AND soThich <> ''
      GROUP BY soThich
      ORDER BY soLuong DESC
      LIMIT 15`
  );
  return rows;
}

/** Khách hàng mới theo từng tháng (dùng cho báo cáo). */
async function khachMoiTheoThang(soThang = 12) {
  const bieuThucThang = db.bieuThucThang('ngayDangKy');
  const rows = await db.all(
    `SELECT ${bieuThucThang} AS thang, COUNT(*) AS soLuong
       FROM KHACHHANG
      GROUP BY ${bieuThucThang}
      ORDER BY thang DESC
      LIMIT :soThang`,
    { soThang: Number(soThang) }
  );
  return rows.reverse();
}

/** Top khách hàng chi tiêu nhiều nhất. */
async function topKhachHang(soLuong = 10) {
  return db.all(
    `SELECT kh.maKH, kh.hoTen, kh.sdt, kh.diemTichLuy,
            COUNT(d.maDH) AS soDonHang,
            COALESCE(SUM(d.tongTien), 0) AS tongChiTieu
       FROM KHACHHANG kh
       JOIN DONHANG d ON d.maKH = kh.maKH AND d.trangThai = N'Hoàn thành'
      GROUP BY kh.maKH, kh.hoTen, kh.sdt, kh.diemTichLuy
      ORDER BY tongChiTieu DESC
      LIMIT :soLuong`,
    { soLuong: Number(soLuong) }
  );
}

module.exports = {
  listKhachHang,
  getKhachHang,
  createKhachHang,
  updateKhachHang,
  capNhatHoSoCaNhan,
  doiTrangThaiKhachHang,
  datLaiMatKhau,
  deleteKhachHang,
  listKhachHangHoatDong,
  timKhachHangTheoSdt,
  dangKyKhachHang,
  thongKeNhomTuoi,
  thongKeSoThich,
  khachMoiTheoThang,
  topKhachHang,
  GIOI_TINH,
  MAT_KHAU_KHACH_HANG,
};
