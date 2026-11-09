'use strict';

/* Kiểm tra tính khớp nối của giao diện mới:
   1. Mọi id mà JavaScript truy cập đều có trong public/index.html.
   2. Khối đăng nhập/đăng ký có đủ phần tử và thuộc tính cần thiết.
   3. Tệp tĩnh mới được phục vụ qua HTTP (tự dựng máy chủ riêng ở cổng 3101).
   4. Lớp CSS mới tồn tại và dấu ngoặc cân bằng.
   5. Quy tắc mật khẩu ở giao diện khớp với quy tắc ở máy chủ. */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const GOC_DU_AN = path.join(__dirname, '..');
const TEP_HTML = path.join(GOC_DU_AN, 'public', 'index.html');
const THU_MUC_JS = path.join(GOC_DU_AN, 'public', 'js');
const CONG_THU = 3101;
const DIA_CHI_WEB = `http://127.0.0.1:${CONG_THU}`;

let tienTrinhMayChu = null;

/** Liệt kê đệ quy tất cả tệp .js trong một thư mục. */
function lietKeJs(thuMuc) {
  const ketQua = [];
  for (const muc of fs.readdirSync(thuMuc, { withFileTypes: true })) {
    const duongDan = path.join(thuMuc, muc.name);
    if (muc.isDirectory()) ketQua.push(...lietKeJs(duongDan));
    else if (muc.name.endsWith('.js')) ketQua.push(duongDan);
  }
  return ketQua;
}

/** Khởi động máy chủ riêng và chờ tới khi phục vụ được yêu cầu. */
function khoiDongMayChu() {
  return new Promise((giaiQuyet, tuChoi) => {
    const con = spawn(process.execPath, ['server.js'], {
      cwd: GOC_DU_AN,
      env: { ...process.env, PORT: String(CONG_THU) },
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
        await fetch(`${DIA_CHI_WEB}/`);
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

async function main() {
  const html = fs.readFileSync(TEP_HTML, 'utf8');
  const tapIdHtml = new Set();
  for (const khop of html.matchAll(/\bid="([^"]+)"/g)) tapIdHtml.add(khop[1]);
  let soLoiTong = 0;

  console.log('=== 1. ID TRONG index.html ĐƯỢC JavaScript TRUY CẬP ===');
  let soThieu = 0;
  const tatCaTep = lietKeJs(THU_MUC_JS);
  for (const tep of tatCaTep) {
    const noiDung = fs.readFileSync(tep, 'utf8');
    for (const khop of noiDung.matchAll(/getElementById\(\s*['"]([^'"]+)['"]\s*\)/g)) {
      if (!tapIdHtml.has(khop[1])) {
        soThieu += 1;
        console.log(`  [THIẾU] ${path.relative(GOC_DU_AN, tep)} → #${khop[1]}`);
      }
    }
  }
  soLoiTong += soThieu;
  console.log(
    soThieu === 0
      ? `  [ĐẠT] Tất cả id đều tồn tại (${tatCaTep.length} tệp JS, ${tapIdHtml.size} id trong HTML).`
      : `  [LỖI] Có ${soThieu} id không tồn tại trong HTML.`
  );

  console.log('\n=== 2. KHỐI ĐĂNG NHẬP / ĐĂNG KÝ TRONG HTML ===');
  const idCanCo = [
    'man-hinh-dang-nhap',
    'bieu-mau-dang-nhap',
    'bieu-mau-dang-ky',
    'dk-ho-ten',
    'dk-sdt',
    'dk-mat-khau',
    'dk-nhap-lai',
    'quy-tac-mat-khau',
    'loi-dang-ky',
    'nut-dang-ky',
  ];
  const idThieu = idCanCo.filter((id) => !tapIdHtml.has(id));
  soLoiTong += idThieu.length;
  console.log(
    idThieu.length === 0
      ? `  [ĐẠT] Đủ ${idCanCo.length} id của khối đăng nhập/đăng ký.`
      : `  [LỖI] Thiếu id: ${idThieu.join(', ')}`
  );

  const kiemTra2 = [
    ['Có thẻ chuyển chế độ (role=tablist)', html.includes('role="tablist"')],
    ['Có thẻ Đăng nhập', html.includes('data-che-do="dang-nhap"')],
    ['Có thẻ Đăng ký', html.includes('data-che-do="dang-ky"')],
    ['Biểu mẫu đăng ký ẩn lúc đầu', /id="bieu-mau-dang-ky"[^>]*\bhidden\b/.test(html)],
  ];
  for (const [ten, dat] of kiemTra2) {
    if (!dat) soLoiTong += 1;
    console.log(`  [${dat ? 'ĐẠT' : 'LỖI'}] ${ten}.`);
  }

  const soQuyTac = (html.match(/data-quy-tac=/g) ?? []).length;
  if (soQuyTac < 3) soLoiTong += 1;
  console.log(`  [${soQuyTac >= 3 ? 'ĐẠT' : 'LỖI'}] Có ${soQuyTac} dòng quy tắc mật khẩu (cần ≥ 3).`);

  console.log('\n=== 3. TỆP TĨNH MỚI ĐƯỢC PHỤC VỤ QUA HTTP ===');
  try {
    await khoiDongMayChu();
    const canPhucVu = [
      ['/css/style.css', 'cham-quy-tac'],
      ['/js/mat-khau.js', 'QUY_TAC_MAT_KHAU'],
      ['/js/thong-bao.js', 'taoChuongThongBao'],
      ['/js/app.js', 'bieu-mau-dang-ky'],
      ['/js/pages/cua-toi.js', 'uu-dai'],
    ];
    for (const [duongDan, dauHieu] of canPhucVu) {
      const phanHoi = await fetch(`${DIA_CHI_WEB}${duongDan}`);
      const than = await phanHoi.text();
      const dat = phanHoi.ok && than.includes(dauHieu);
      if (!dat) soLoiTong += 1;
      console.log(`  [${dat ? 'ĐẠT' : 'LỖI'}] ${duongDan} — ${phanHoi.status}, ${than.length} byte, có "${dauHieu}".`);
    }
  } finally {
    tatMayChu();
  }

  console.log('\n=== 4. LỚP CSS MỚI VÀ TÍNH CÂN BẰNG ===');
  const css = fs.readFileSync(path.join(GOC_DU_AN, 'public', 'css', 'style.css'), 'utf8');
  const lopCss = [
    'muc-che-do',
    'chon-che-do',
    'danh-sach-quy-tac',
    'cham-quy-tac',
    'chuong-thong-bao',
    'nut-chuong',
    'cham-chua-doc',
    'chuong-than',
    'muc-thong-bao',
    'ghi-chu-sinh-nhat',
    'luoi-uu-dai',
    'the-uu-dai',
    'uu-dai-giam',
  ];
  const thieuCss = lopCss.filter((lop) => !new RegExp(`\\.${lop}[\\s,{:.]`).test(css));
  soLoiTong += thieuCss.length;
  console.log(
    thieuCss.length === 0
      ? `  [ĐẠT] Đủ ${lopCss.length} lớp CSS mới.`
      : `  [LỖI] Thiếu lớp CSS: ${thieuCss.join(', ')}`
  );
  const dauNgoac = (css.match(/\{/g) ?? []).length;
  const dongNgoac = (css.match(/\}/g) ?? []).length;
  if (dauNgoac !== dongNgoac) soLoiTong += 1;
  console.log(`  [${dauNgoac === dongNgoac ? 'ĐẠT' : 'LỖI'}] Dấu ngoặc CSS cân bằng: ${dauNgoac} mở / ${dongNgoac} đóng.`);

  console.log('\n=== 5. QUY TẮC MẬT KHẨU: GIAO DIỆN KHỚP MÁY CHỦ ===');
  const htmlQuyTac = (html.match(/data-quy-tac="([^"]+)"/g) ?? []).length;
  const jsMatKhau = fs.readFileSync(path.join(GOC_DU_AN, 'public', 'js', 'mat-khau.js'), 'utf8');
  const soQuyTacJs = (jsMatKhau.match(/ma:\s*'/g) ?? []).length;
  const khaiBaoToiThieu = jsMatKhau.match(/MAT_KHAU_TOI_THIEU\s*=\s*(\d+)/);
  const giaoDienDat = soQuyTacJs === htmlQuyTac && Number(khaiBaoToiThieu?.[1]) === 6;
  if (!giaoDienDat) soLoiTong += 1;
  console.log(
    `  [${giaoDienDat ? 'ĐẠT' : 'LỖI'}] ${soQuyTacJs} quy tắc trong mat-khau.js khớp ${htmlQuyTac} dòng trong HTML; tối thiểu ${khaiBaoToiThieu?.[1]} ký tự.`
  );

  console.log('\n=== 6. QUY TẮC Ở MÁY CHỦ ===');
  const validation = require('../src/core/validation');
  const quyTacMayChu = validation.QUY_TAC_MAT_KHAU ?? [];
  const mayChuDat = quyTacMayChu.length === soQuyTacJs && validation.MAT_KHAU_TOI_THIEU === 6;
  if (!mayChuDat) soLoiTong += 1;
  console.log(
    `  [${mayChuDat ? 'ĐẠT' : 'LỖI'}] Máy chủ có ${quyTacMayChu.length} quy tắc, tối thiểu ${validation.MAT_KHAU_TOI_THIEU} ký tự — khớp giao diện.`
  );

  console.log(`\n===== TỔNG KẾT: ${soLoiTong === 0 ? 'TẤT CẢ ĐỀU ĐẠT' : `${soLoiTong} LỖI`} =====`);
  if (soLoiTong > 0) process.exitCode = 1;
}

main().catch((loi) => {
  console.error('LOI:', loi?.message ?? loi);
  tatMayChu();
  process.exitCode = 1;
});
