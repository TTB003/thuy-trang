/**
 * NGHIỆP VỤ HỆ THỐNG — Quản trị tài khoản, phân quyền, sao lưu / phục hồi CSDL.
 * Phục vụ mục II của đồ án: giao diện ADMIN tách biệt, thêm xóa & phân quyền
 * cho account, phương án sao lưu và phục hồi cơ sở dữ liệu.
 *
 * Phương án sao lưu khác nhau theo hệ CSDL:
 *   - PostgreSQL: xuất bản sao lưu luận lý (script INSERT) ra file .sql.
 *   - SQLite    : dùng VACUUM INTO để tạo file .db nhất quán.
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const db = require('../db');
const auth = require('../core/auth');
const { config, ROLES } = require('../config');
const { badRequest, notFound, conflict, forbidden } = require('../core/errors');
const { requiredText, optionalText, oneOf } = require('../core/validation');
const { nowSql, toSqlDateTime, parseSqlDateTime } = require('../core/time');
const { FilterBuilder, parsePagination, paginate, executePaged } = require('../core/query');

const VAI_TRO = Object.values(ROLES);
const TRANG_THAI_TK = ['Hoạt động', 'Bị khóa'];
/** Tên file sao lưu hợp lệ: coffee_crm_YYYYMMDD_HHMMSS.(db|sql) */
const TEN_FILE_SAO_LUU = /^coffee_crm_[0-9]{8}_[0-9]{6}\.(db|sql)$/;

const SELECT_SQL = `
  SELECT tk.maTK, tk.tenDangNhap, tk.vaiTro, tk.maNV, tk.maKH, tk.trangThai,
         tk.ngayTao, tk.lanDangNhapCuoi,
         nv.hoTen AS tenNhanVien, nv.chucVu,
         kh.hoTen AS tenKhachHang, kh.sdt AS sdtKhachHang
    FROM TAIKHOAN tk
    LEFT JOIN NHANVIEN nv ON nv.maNV = tk.maNV
    LEFT JOIN KHACHHANG kh ON kh.maKH = tk.maKH`;
const COUNT_SQL = 'SELECT COUNT(*) AS total FROM TAIKHOAN tk';

/** Mục II — Admin xem, tìm kiếm nâng cao, lọc và sắp xếp danh sách tài khoản. */
async function listTaiKhoan(query = {}) {
  const pagination = parsePagination(query);
  const filter = new FilterBuilder()
    .search(query.q, ['tk.tenDangNhap', 'nv.hoTen', 'kh.hoTen', 'nv.email', 'kh.sdt'])
    .equals('tk.vaiTro', query.vaiTro ? optionalText(query.vaiTro, 30) : null)
    .equals('tk.trangThai', query.trangThai ? optionalText(query.trangThai, 30) : null);

  const { items, total } = await executePaged({
    selectSql: SELECT_SQL,
    countSql: COUNT_SQL,
    filter,
    orderBy: 'ORDER BY tk.vaiTro ASC, tk.tenDangNhap ASC',
    pagination,
    runAll: db.all,
    runGet: db.get,
  });
  return paginate(items, total, pagination);
}

/** Thống kê số tài khoản theo vai trò (dùng cho trang quản trị). */
async function thongKeTaiKhoan() {
  const theoVaiTro = await db.all(
    `SELECT vaiTro, COUNT(*) AS soLuong,
            SUM(CASE WHEN trangThai = 'Hoạt động' THEN 1 ELSE 0 END) AS dangHoatDong,
            SUM(CASE WHEN trangThai = 'Bị khóa' THEN 1 ELSE 0 END) AS biKhoa
       FROM TAIKHOAN GROUP BY vaiTro ORDER BY soLuong DESC`
  );
  const tongTaiKhoan = Number(await db.scalar('SELECT COUNT(*) FROM TAIKHOAN'));
  const dangOnline = Number(
    await db.scalar(`SELECT COUNT(*) FROM PHIENDANGNHAP WHERE hetHan > :now`, { now: nowSql() })
  );
  return { tongTaiKhoan, dangOnline, theoVaiTro };
}

/** Lấy chi tiết tài khoản. */
async function getTaiKhoan(maTK) {
  const row = await db.get(`${SELECT_SQL} WHERE tk.maTK = :maTK`, { maTK });
  if (!row) throw notFound(`Không tìm thấy tài khoản có mã ${maTK}.`);
  return row;
}

/** Mục II — Admin thêm tài khoản mới. */
async function createTaiKhoan(payload) {
  const vaiTro = oneOf(payload.vaiTro, VAI_TRO, 'Vai trò');
  const matKhau = requiredText(payload.matKhau, 'Mật khẩu', 100);
  if (matKhau.length < 6) throw badRequest('Mật khẩu phải có ít nhất 6 ký tự.');

  let tenDangNhap = optionalText(payload.tenDangNhap, 100);
  let maNV = null;
  let maKH = null;

  if (vaiTro === ROLES.CUSTOMER) {
    maKH = Number(payload.maKH);
    if (!maKH) throw badRequest('Vui lòng chọn khách hàng cho tài khoản này.');
    const khachHang = await db.get('SELECT maKH, sdt FROM KHACHHANG WHERE maKH = :maKH', { maKH });
    if (!khachHang) throw badRequest(`Khách hàng có mã ${maKH} không tồn tại.`);
    tenDangNhap = tenDangNhap ?? khachHang.sdt;
    const daCo = await db.get('SELECT maTK FROM TAIKHOAN WHERE maKH = :maKH', { maKH });
    if (daCo) throw conflict('Khách hàng này đã có tài khoản đăng nhập.');
  } else {
    maNV = Number(payload.maNV);
    if (!maNV) throw badRequest('Vui lòng chọn nhân viên cho tài khoản này.');
    const nhanVien = await db.get('SELECT maNV, email FROM NHANVIEN WHERE maNV = :maNV', { maNV });
    if (!nhanVien) throw badRequest(`Nhân viên có mã ${maNV} không tồn tại.`);
    tenDangNhap = tenDangNhap ?? nhanVien.email;
  }
  if (!tenDangNhap) throw badRequest('Tên đăng nhập không được để trống.');

  const maTK = await db.transaction(() =>
    auth.createAccount({ tenDangNhap, matKhau, vaiTro, maNV, maKH })
  );
  return getTaiKhoan(maTK);
}

/** Đếm số tài khoản Admin đang hoạt động, trừ một tài khoản chỉ định. */
async function demAdminConLai(maTKTru = -1) {
  return Number(
    await db.scalar(
      `SELECT COUNT(*) FROM TAIKHOAN
        WHERE vaiTro = 'Admin' AND trangThai = 'Hoạt động' AND maTK <> :maTK`,
      { maTK: maTKTru }
    )
  );
}

/** Mục II — Admin phân quyền (đổi vai trò) cho tài khoản. */
async function doiVaiTro(maTK, vaiTroMoi) {
  const current = await getTaiKhoan(maTK);
  const vaiTro = oneOf(vaiTroMoi, VAI_TRO, 'Vai trò');
  if (vaiTro === current.vaiTro) {
    throw badRequest(`Tài khoản đang có vai trò "${vaiTro}".`);
  }
  if (vaiTro === ROLES.CUSTOMER && !current.maKH) {
    throw badRequest(
      'Tài khoản này không gắn với khách hàng nào nên không thể cấp vai trò "Khách hàng".'
    );
  }
  if (vaiTro !== ROLES.CUSTOMER && !current.maNV) {
    throw badRequest('Tài khoản này không gắn với nhân viên nào nên không thể cấp vai trò nội bộ.');
  }
  if (current.vaiTro === ROLES.ADMIN && vaiTro !== ROLES.ADMIN) {
    if ((await demAdminConLai(current.maTK)) === 0) {
      throw badRequest('Hệ thống phải còn ít nhất một tài khoản Admin đang hoạt động.');
    }
  }

  await db.transaction(async () => {
    await db.run('UPDATE TAIKHOAN SET vaiTro = :vaiTro WHERE maTK = :maTK', {
      vaiTro,
      maTK: current.maTK,
    });
    // Đổi vai trò thì thu hồi phiên để quyền mới có hiệu lực ngay.
    await db.run('DELETE FROM PHIENDANGNHAP WHERE maTK = :maTK', { maTK: current.maTK });
  });
  return getTaiKhoan(current.maTK);
}

/** Mục II — Khóa / mở khóa tài khoản. */
async function doiTrangThaiTaiKhoan(maTK, trangThaiMoi, nguoiThucHien) {
  const current = await getTaiKhoan(maTK);
  const trangThai = oneOf(trangThaiMoi, TRANG_THAI_TK, 'Trạng thái tài khoản');
  if (Number(nguoiThucHien?.maTK) === Number(current.maTK) && trangThai === 'Bị khóa') {
    throw forbidden('Bạn không thể tự khóa tài khoản đang đăng nhập.');
  }
  if (trangThai === current.trangThai) {
    throw badRequest(`Tài khoản đang ở trạng thái "${trangThai}".`);
  }
  if (current.vaiTro === ROLES.ADMIN && trangThai === 'Bị khóa') {
    if ((await demAdminConLai(current.maTK)) === 0) {
      throw badRequest('Hệ thống phải còn ít nhất một tài khoản Admin đang hoạt động.');
    }
  }

  await db.transaction(async () => {
    await db.run('UPDATE TAIKHOAN SET trangThai = :trangThai WHERE maTK = :maTK', {
      trangThai,
      maTK: current.maTK,
    });
    if (trangThai === 'Bị khóa') {
      await db.run('DELETE FROM PHIENDANGNHAP WHERE maTK = :maTK', { maTK: current.maTK });
    }
    // Đồng bộ trạng thái khách hàng tương ứng (CN5.3).
    if (current.maKH) {
      await db.run('UPDATE KHACHHANG SET trangThai = :trangThai WHERE maKH = :maKH', {
        trangThai: trangThai === 'Hoạt động' ? 'Hoạt động' : 'Bị khóa',
        maKH: current.maKH,
      });
    }
  });
  return getTaiKhoan(current.maTK);
}

/** Mục II — Đặt lại mật khẩu tài khoản. */
async function datLaiMatKhauTaiKhoan(maTK, matKhauMoi) {
  const current = await getTaiKhoan(maTK);
  const matKhau = requiredText(matKhauMoi, 'Mật khẩu mới', 100);
  if (matKhau.length < 6) throw badRequest('Mật khẩu phải có ít nhất 6 ký tự.');
  await auth.changePassword(current.maTK, matKhau);
  return {
    maTK: current.maTK,
    tenDangNhap: current.tenDangNhap,
    thongBao: 'Đã đặt lại mật khẩu.',
  };
}

/** Mục II — Admin xóa tài khoản (không xóa dữ liệu nghiệp vụ liên quan). */
async function xoaTaiKhoan(maTK, nguoiThucHien) {
  const current = await getTaiKhoan(maTK);
  if (Number(nguoiThucHien?.maTK) === Number(current.maTK)) {
    throw forbidden('Bạn không thể tự xóa tài khoản đang đăng nhập.');
  }
  if (current.vaiTro === ROLES.ADMIN) {
    const soAdminConLai = Number(
      await db.scalar(`SELECT COUNT(*) FROM TAIKHOAN WHERE vaiTro = 'Admin' AND maTK <> :maTK`, {
        maTK: current.maTK,
      })
    );
    if (soAdminConLai === 0) {
      throw badRequest('Không thể xóa tài khoản Admin cuối cùng của hệ thống.');
    }
  }
  await db.transaction(async () => {
    await db.run('DELETE FROM PHIENDANGNHAP WHERE maTK = :maTK', { maTK: current.maTK });
    await db.run('DELETE FROM TAIKHOAN WHERE maTK = :maTK', { maTK: current.maTK });
  });
  return { maTK: current.maTK, tenDangNhap: current.tenDangNhap, thongBao: 'Đã xóa tài khoản.' };
}

/** Đổi mật khẩu của chính mình (mọi vai trò). */
async function doiMatKhauCaNhan(nguoiDung, matKhauCu, matKhauMoi) {
  if (!nguoiDung) throw forbidden();
  const taiKhoan = await db.get('SELECT maTK, matKhau FROM TAIKHOAN WHERE maTK = :maTK', {
    maTK: nguoiDung.maTK,
  });
  if (!taiKhoan) throw notFound('Không tìm thấy tài khoản.');
  const { verifyPassword } = require('../core/security');
  if (!verifyPassword(String(matKhauCu ?? ''), taiKhoan.matKhau)) {
    throw badRequest('Mật khẩu hiện tại không đúng.');
  }
  const moi = requiredText(matKhauMoi, 'Mật khẩu mới', 100);
  if (moi.length < 6) throw badRequest('Mật khẩu mới phải có ít nhất 6 ký tự.');
  if (moi === String(matKhauCu)) throw badRequest('Mật khẩu mới phải khác mật khẩu hiện tại.');
  await auth.changePassword(taiKhoan.maTK, moi);
  return { thongBao: 'Đổi mật khẩu thành công. Vui lòng đăng nhập lại.' };
}

/* =====================================================================
 * SAO LƯU VÀ PHỤC HỒI CƠ SỞ DỮ LIỆU (yêu cầu 5 điểm - mục II.1)
 * ===================================================================== */

/** Bảo đảm thư mục sao lưu tồn tại. */
function damBaoThuMucSaoLuu() {
  fs.mkdirSync(config.backupDir, { recursive: true });
}

/** Phần mở rộng file sao lưu theo hệ CSDL đang dùng. */
function duoiFileSaoLuu() {
  return db.getClient() === 'postgres' ? '.sql' : '.db';
}

/** Sinh tên file sao lưu theo thời điểm hiện tại. */
function sinhTenFileSaoLuu() {
  const [ngay, gio] = toSqlDateTime().split(' ');
  return `coffee_crm_${ngay.replace(/-/g, '')}_${gio.replace(/:/g, '')}${duoiFileSaoLuu()}`;
}

/** Tạo bản sao lưu CSDL. */
async function saoLuuCsdl(ghiChu = null) {
  damBaoThuMucSaoLuu();
  const tenFile = sinhTenFileSaoLuu();
  const duongDan = path.join(config.backupDir, tenFile);
  if (fs.existsSync(duongDan)) {
    throw conflict('Đã tồn tại bản sao lưu trong cùng giây. Vui lòng thử lại.');
  }

  const kichThuoc = await db.taoBanSaoLuu(duongDan);
  const thoiDiem = toSqlDateTime(fs.statSync(duongDan).mtime);

  await db.run(
    `INSERT INTO NHATKYSAOLUU (tenFile, ghiChu, kichThuoc, thoiDiem)
     VALUES (:tenFile, :ghiChu, :kichThuoc, :thoiDiem)`,
    {
      tenFile,
      ghiChu: ghiChu ? String(ghiChu).slice(0, 255) : 'Sao lưu thủ công từ giao diện quản trị',
      kichThuoc,
      thoiDiem,
    }
  );

  return {
    tenFile,
    kichThuoc,
    thoiDiem,
    heCSDL: db.getClient(),
    thongBao: `Đã sao lưu cơ sở dữ liệu vào ${tenFile}.`,
  };
}

/** Danh sách các bản sao lưu hiện có. */
async function danhSachSaoLuu() {
  damBaoThuMucSaoLuu();
  return fs
    .readdirSync(config.backupDir)
    .filter((ten) => TEN_FILE_SAO_LUU.test(ten))
    .map((ten) => {
      const thongTin = fs.statSync(path.join(config.backupDir, ten));
      return {
        tenFile: ten,
        kichThuoc: thongTin.size,
        thoiDiem: toSqlDateTime(thongTin.mtime),
      };
    })
    .sort((a, b) => (a.thoiDiem < b.thoiDiem ? 1 : -1));
}

/** Ngày giờ trong tên file sao lưu, dạng 'YYYY-MM-DD HH:MM:SS'. */
function thoiDiemTuTenFile(ten) {
  const khop = /coffee_crm_(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})\./.exec(ten);
  if (!khop) return nowSql();
  return `${khop[1]}-${khop[2]}-${khop[3]} ${khop[4]}:${khop[5]}:${khop[6]}`;
}

/** Phục hồi CSDL PostgreSQL từ script sao lưu (xóa dữ liệu rồi nạp lại). */
async function phucHoiPostgres(duongDan) {
  const noiDung = fs.readFileSync(duongDan, 'utf8');
  const bang = await db.danhSachBang();
  await db.transaction(async () => {
    await db.execScript(
      `TRUNCATE TABLE ${bang.join(', ')} RESTART IDENTITY CASCADE;`
    );
    await db.execScript(noiDung);
  });
}

/** Phục hồi CSDL từ một bản sao lưu. */
async function phucHoiCsdl(tenFile) {
  const ten = requiredText(tenFile, 'Tên file sao lưu', 100);
  if (!TEN_FILE_SAO_LUU.test(ten)) throw badRequest('Tên file sao lưu không hợp lệ.');
  const nguon = path.join(config.backupDir, ten);
  if (!fs.existsSync(nguon)) throw notFound(`Không tìm thấy bản sao lưu "${ten}".`);

  // Tự động sao lưu trạng thái hiện tại trước khi phục hồi để có thể quay lại.
  const anToan = await saoLuuCsdl(`Tự động sao lưu trước khi phục hồi ${ten}`);

  if (db.getClient() === 'postgres') {
    await phucHoiPostgres(nguon);
  } else {
    await db.closeDb();
    fs.copyFileSync(nguon, config.databaseFile);
    ['-wal', '-shm'].forEach((hauTo) => {
      const phu = `${config.databaseFile}${hauTo}`;
      if (fs.existsSync(phu)) fs.unlinkSync(phu);
    });
    await db.init(); // mở lại kết nối với dữ liệu vừa phục hồi
  }

  return {
    tenFile: ten,
    banAnToan: anToan.tenFile,
    thongBao: `Đã phục hồi cơ sở dữ liệu từ "${ten}". Bản sao lưu an toàn: ${anToan.tenFile}.`,
  };
}

/** Xóa một bản sao lưu. */
async function xoaSaoLuu(tenFile) {
  const ten = requiredText(tenFile, 'Tên file sao lưu', 100);
  if (!TEN_FILE_SAO_LUU.test(ten)) throw badRequest('Tên file sao lưu không hợp lệ.');
  const duongDan = path.join(config.backupDir, ten);
  if (!fs.existsSync(duongDan)) throw notFound(`Không tìm thấy bản sao lưu "${ten}".`);
  fs.unlinkSync(duongDan);
  return { tenFile: ten, thongBao: `Đã xóa bản sao lưu "${ten}".` };
}

/** Nhật ký sao lưu gần đây. */
async function nhatKySaoLuu(soDong = 20) {
  return db.all(
    `SELECT maNK, tenFile, ghiChu, kichThuoc, thoiDiem
       FROM NHATKYSAOLUU ORDER BY maNK DESC LIMIT :soDong`,
    { soDong: Number(soDong) }
  );
}

/** Thông tin chung về hệ thống (dùng cho trang quản trị). */
async function thongTinHeThong() {
  const bang = await db.danhSachBang();
  const ketNoi = db.thongTinKetNoi();
  const laPostgres = db.getClient() === 'postgres';
  const soBanSaoLuu = (await danhSachSaoLuu()).length;

  return {
    phienBan: '1.0.0',
    tenHeThong: 'Hệ thống CRM doanh nghiệp bán Coffee',
    heCSDL: ketNoi.he,
    chuoiKetNoi: ketNoi.moTa,
    nguoiDungCsdl: ketNoi.nguoiDung,
    soBang: bang.length,
    danhSachBang: bang,
    fileCsdl: laPostgres ? null : path.basename(config.databaseFile),
    kichThuocCsdl: laPostgres
      ? 0
      : fs.existsSync(config.databaseFile)
        ? fs.statSync(config.databaseFile).size
        : 0,
    thuMucSaoLuu: path.relative(config.rootDir, config.backupDir),
    soBanSaoLuu,
    thoiDiemHienTai: toSqlDateTime(),
    soPhienDangMo: Number(
      await db.scalar(`SELECT COUNT(*) FROM PHIENDANGNHAP WHERE hetHan > :now`, { now: nowSql() })
    ),
    vaiTro: VAI_TRO,
  };
}

/** Kiểm tra tính toàn vẹn / khả năng truy cập của CSDL. */
async function kiemTraToanVen() {
  const bang = await db.danhSachBang();
  const ketNoiDuoc = await db.kiemTraKetNoi();
  return {
    heCSDL: db.thongTinKetNoi().he,
    dat: ketNoiDuoc,
    ketQua: ketNoiDuoc ? 'ok' : 'không kết nối được',
    danhSachBang: bang,
    soBang: bang.length,
  };
}

module.exports = {
  listTaiKhoan,
  thongKeTaiKhoan,
  getTaiKhoan,
  createTaiKhoan,
  doiVaiTro,
  doiTrangThaiTaiKhoan,
  datLaiMatKhauTaiKhoan,
  xoaTaiKhoan,
  doiMatKhauCaNhan,
  saoLuuCsdl,
  danhSachSaoLuu,
  nhatKySaoLuu,
  phucHoiCsdl,
  xoaSaoLuu,
  thongTinHeThong,
  kiemTraToanVen,
  thoiDiemTuTenFile,
  VAI_TRO,
};
