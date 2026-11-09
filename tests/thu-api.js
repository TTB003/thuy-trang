'use strict';

/* Kiểm thử HTTP cho các API mới: đăng ký khách hàng, quy tắc mật khẩu,
   hồ sơ cá nhân (không đổi được SĐT), chuông thông báo và ưu đãi.

   Tệp này tự khởi động một máy chủ riêng ở cổng 3100 (không đụng tới máy chủ
   đang chạy ở cổng 3000 của người dùng), chạy kiểm thử rồi tắt máy chủ và
   xoá sạch dữ liệu thử. */

const { spawn } = require('child_process');
const path = require('path');
const db = require('../src/db');

const CONG = 3100;
const GOC = `http://127.0.0.1:${CONG}`;
const SDT_THU = '0999888777';
const MAT_KHAU_THU = 'Thu@12345';

let soDat = 0;
let soLoi = 0;
let tienTrinhMayChu = null;

/** In kết quả một phép kiểm tra. */
function kiemTra(ten, dieuKien, chiTiet = '') {
  if (dieuKien) {
    soDat += 1;
    console.log(`  [ĐẠT] ${ten}${chiTiet ? ` — ${chiTiet}` : ''}`);
  } else {
    soLoi += 1;
    console.log(`  [LỖI] ${ten}${chiTiet ? ` — ${chiTiet}` : ''}`);
  }
}

/** Gọi API và trả về mã trạng thái kèm phần data. */
async function goi(duongDan, { method = 'GET', body = null, cookie = null } = {}) {
  const headers = {};
  if (body) headers['content-type'] = 'application/json';
  if (cookie) headers.cookie = cookie;
  const phanHoi = await fetch(`${GOC}${duongDan}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const than = await phanHoi.json().catch(() => null);
  return {
    ma: phanHoi.status,
    duLieu: than && typeof than === 'object' && 'data' in than ? than.data : than,
    thongDiep: than?.message ?? null,
    cookie: (phanHoi.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]).join('; '),
  };
}

/** Khởi động máy chủ riêng và chờ tới khi phục vụ được yêu cầu. */
function khoiDongMayChu() {
  return new Promise((giaiQuyet, tuChoi) => {
    const con = spawn(process.execPath, ['server.js'], {
      cwd: path.join(__dirname, '..'),
      env: { ...process.env, PORT: String(CONG) },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    tienTrinhMayChu = con;

    let nhatKy = '';
    let daSanSang = false;
    con.stdout.on('data', (du) => {
      nhatKy += du;
    });
    con.stderr.on('data', (du) => {
      nhatKy += du;
    });
    con.on('exit', (ma) => {
      if (!daSanSang) tuChoi(new Error(`Máy chủ thoát sớm (mã ${ma}):\n${nhatKy}`));
    });

    const batDau = Date.now();
    const thuLai = async () => {
      try {
        await fetch(`${GOC}/`);
        daSanSang = true;
        giaiQuyet(con);
      } catch {
        if (Date.now() - batDau > 25000) {
          tuChoi(new Error(`Máy chủ không phản hồi sau 25 giây:\n${nhatKy}`));
          return;
        }
        setTimeout(thuLai, 250);
      }
    };
    thuLai();
  });
}

/** Tắt máy chủ đã khởi động. */
function tatMayChu() {
  if (tienTrinhMayChu && !tienTrinhMayChu.killed) {
    tienTrinhMayChu.kill();
    tienTrinhMayChu = null;
  }
}

/** Xoá khách hàng thử cùng mọi dữ liệu liên quan. */
async function donDep(maKH) {
  if (!maKH) return;
  const xoa = await db.run('DELETE FROM KHACHHANG WHERE maKH = :maKH', { maKH });
  console.log(`  Đã xoá khách thử #${maKH} (${xoa?.changes ?? 0} dòng, cascade tài khoản/thông báo/phiếu).`);
}

async function main() {
  console.log(`=== KHỞI ĐỘNG MÁY CHỦ RIÊNG Ở CỔNG ${CONG} ===`);
  await khoiDongMayChu();
  console.log('  Máy chủ đã sẵn sàng.');

  await db.init();
  let maKH = null;

  try {
    console.log('\n=== 1. ĐĂNG KÝ: QUY TẮC MẬT KHẨU');

    const yeu = await goi('/api/auth/register', {
      method: 'POST',
      body: { hoTen: 'Khách Thử', sdt: SDT_THU, matKhau: 'abc123', xacNhanMatKhau: 'abc123' },
    });
    kiemTra('Mật khẩu yếu bị từ chối', yeu.ma === 400, `${yeu.ma} — ${yeu.thongDiep}`);

    const thieuHoa = await goi('/api/auth/register', {
      method: 'POST',
      body: { hoTen: 'Khách Thử', sdt: SDT_THU, matKhau: 'abc@123', xacNhanMatKhau: 'abc@123' },
    });
    kiemTra('Thiếu chữ in hoa bị từ chối', thieuHoa.ma === 400, thieuHoa.thongDiep ?? '');

    const thieuDacBiet = await goi('/api/auth/register', {
      method: 'POST',
      body: { hoTen: 'Khách Thử', sdt: SDT_THU, matKhau: 'Abc12345', xacNhanMatKhau: 'Abc12345' },
    });
    kiemTra('Thiếu ký tự đặc biệt bị từ chối', thieuDacBiet.ma === 400, thieuDacBiet.thongDiep ?? '');

    const lech = await goi('/api/auth/register', {
      method: 'POST',
      body: { hoTen: 'Khách Thử', sdt: SDT_THU, matKhau: MAT_KHAU_THU, xacNhanMatKhau: 'Khac@12345' },
    });
    kiemTra('Nhập lại không khớp bị từ chối', lech.ma === 400, lech.thongDiep ?? '');

    const thanhCong = await goi('/api/auth/register', {
      method: 'POST',
      body: {
        hoTen: 'Khách Thử Nghiệm',
        sdt: SDT_THU,
        email: 'thu.nghiem@example.com',
        matKhau: MAT_KHAU_THU,
        xacNhanMatKhau: MAT_KHAU_THU,
      },
    });
    maKH = thanhCong.duLieu?.maKH ?? null;
    kiemTra('Đăng ký mật khẩu mạnh thành công', thanhCong.ma === 201, `mã KH #${maKH}`);

    console.log('\n=== 2. ĐĂNG NHẬP BẰNG SỐ ĐIỆN THOẠI');
    const dangNhap = await goi('/api/auth/login', {
      method: 'POST',
      body: { tenDangNhap: SDT_THU, matKhau: MAT_KHAU_THU },
    });
    kiemTra('Đăng nhập được', dangNhap.ma === 200, `vai trò: ${dangNhap.duLieu?.user?.vaiTro ?? dangNhap.duLieu?.vaiTro}`);
    const cookie = dangNhap.cookie;

    console.log('\n=== 3. CHUÔNG THÔNG BÁO');
    const tomTat = await goi('/api/cua-toi/thong-bao/tom-tat', { cookie });
    kiemTra(
      'GET /cua-toi/thong-bao/tom-tat',
      tomTat.ma === 200 && typeof tomTat.duLieu?.chuaDoc === 'number',
      `chưa đọc = ${tomTat.duLieu?.chuaDoc}`
    );

    const danhSachTb = await goi('/api/cua-toi/thong-bao?pageSize=5', { cookie });
    kiemTra(
      'GET /cua-toi/thong-bao',
      danhSachTb.ma === 200 && Array.isArray(danhSachTb.duLieu?.items),
      `tổng = ${danhSachTb.duLieu?.pagination?.total}`
    );

    const docHet = await goi('/api/cua-toi/thong-bao/doc-het', { method: 'POST', body: {}, cookie });
    kiemTra('POST /cua-toi/thong-bao/doc-het', docHet.ma === 200, `còn ${docHet.duLieu?.chuaDoc} chưa đọc`);

    console.log('\n=== 4. ƯU ĐÃI CỦA TÔI');
    const uuDai = await goi('/api/cua-toi/uu-dai?pageSize=5', { cookie });
    kiemTra(
      'GET /cua-toi/uu-dai',
      uuDai.ma === 200 && Array.isArray(uuDai.duLieu?.items),
      `tổng = ${uuDai.duLieu?.pagination?.total}`
    );

    const thongKeUuDai = await goi('/api/cua-toi/uu-dai/thong-ke', { cookie });
    kiemTra(
      'GET /cua-toi/uu-dai/thong-ke',
      thongKeUuDai.ma === 200 && typeof thongKeUuDai.duLieu?.tongSo === 'number',
      JSON.stringify(thongKeUuDai.duLieu)
    );

    console.log('\n=== 5. HỒ SƠ CÁ NHÂN: KHÔNG ĐỔI ĐƯỢC SỐ ĐIỆN THOẠI');
    const capNhat = await goi('/api/cua-toi/ho-so', {
      method: 'PUT',
      cookie,
      body: {
        hoTen: 'Khách Đã Đổi Tên',
        email: 'da.doi@example.com',
        ngaySinh: '1998-03-15',
        sdt: '0900000000',
      },
    });
    kiemTra('PUT /cua-toi/ho-so thành công', capNhat.ma === 200, capNhat.thongDiep ?? '');
    kiemTra('Họ tên đã đổi', capNhat.duLieu?.hoTen === 'Khách Đã Đổi Tên', capNhat.duLieu?.hoTen);
    kiemTra('Email đã đổi', capNhat.duLieu?.email === 'da.doi@example.com', capNhat.duLieu?.email);
    kiemTra(
      'Ngày sinh đã lưu',
      String(capNhat.duLieu?.ngaySinh).slice(0, 10) === '1998-03-15',
      String(capNhat.duLieu?.ngaySinh)
    );
    kiemTra(
      'Số điện thoại GIỮ NGUYÊN',
      capNhat.duLieu?.sdt === SDT_THU,
      `gửi lên 0900000000 → lưu ${capNhat.duLieu?.sdt}`
    );

    console.log('\n=== 6. DỌN DẸP DỮ LIỆU THỬ');
    await donDep(maKH);
    maKH = null;

    const conLai = await db.scalar('SELECT COUNT(*) AS total FROM KHACHHANG WHERE sdt = :sdt', { sdt: SDT_THU });
    const tkConLai = await db.scalar('SELECT COUNT(*) AS total FROM TAIKHOAN WHERE tenDangNhap = :ten', {
      ten: SDT_THU,
    });
    kiemTra(
      'Đã xoá sạch khách thử',
      Number(conLai) === 0 && Number(tkConLai) === 0,
      `khách ${conLai}, tài khoản ${tkConLai}`
    );
  } finally {
    if (maKH) await donDep(maKH).catch(() => undefined);
  }

  console.log(`\n===== KẾT QUẢ: ${soDat} đạt, ${soLoi} lỗi =====`);
}

main()
  .catch((loi) => {
    console.error('LOI:', loi?.message ?? loi);
    soLoi += 1;
  })
  .finally(async () => {
    tatMayChu();
    await db.closeDb().catch(() => undefined);
    if (soLoi > 0) process.exitCode = 1;
  });
