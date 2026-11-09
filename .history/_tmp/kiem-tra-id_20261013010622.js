'use strict';

/* Đối chiếu các phần tử giao diện: mọi id mà mã JavaScript truy cập bằng
   getElementById đều phải tồn tại trong public/index.html.
   Đồng thời kiểm tra các tệp tĩnh mới được phục vụ qua HTTP. */

const fs = require('fs');
const path = require('path');

const GOC_DU_AN = path.join(__dirname, '..');
const TEP_HTML = path.join(GOC_DU_AN, 'public', 'index.html');
const THU_MUC_JS = path.join(GOC_DU_AN, 'public', 'js');
const DIA_CHI_WEB = process.env.DIA_CHI_WEB || 'http://127.0.0.1:3000';

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

/** Lấy danh sách id khai báo trong tệp HTML. */
function layIdHtml(html) {
  const tap = new Set();
  for (const khop of html.matchAll(/\bid="([^"]+)"/g)) tap.add(khop[1]);
  return tap;
}

/** Lấy danh sách id mà JavaScript truy cập. */
function layIdJs(duongDanTep) {
  const noiDung = fs.readFileSync(duongDanTep, 'utf8');
  const tap = new Set();
  for (const khop of noiDung.matchAll(/getElementById\(\s*['"]([^'"]+)['"]\s*\)/g)) tap.add(khop[1]);
  return tap;
}

async function main() {
  const html = fs.readFileSync(TEP_HTML, 'utf8');
  const idHtml = layIdHtml(html);

  console.log('=== 1. ID TRONG index.html ĐƯỢC JavaScript TRUY CẬP ===');
  let soThieu = 0;
  const tatCaTep = lietKeJs(THU_MUC_JS);
  for (const tep of tatCaTep) {
    for (const id of layIdJs(tep)) {
      if (!idHtml.has(id)) {
        soThieu += 1;
        console.log(`  [THIẾU] ${path.relative(GOC_DU_AN, tep)} → #${id}`);
      }
    }
  }
  console.log(
    soThieu === 0
      ? `  [ĐẠT] Tất cả id đều tồn tại (${tatCaTep.length} tệp JS, ${idHtml.size} id trong HTML).`
      : `  [LỖI] Có ${soThieu} id không tồn tại trong HTML.`
  );

  console.log('\n=== 2. THÀNH PHẦN MỚI CÓ TRONG HTML ===');
  const canCo = [
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
  let soThieuHtml = 0;
  for (const id of canCo) {
    if (!idHtml.has(id)) {
      soThieuHtml += 1;
      console.log(`  [THIẾU] #${id}`);
    }
  }
  const coChuyenCheDo = html.includes('muc-che-do') && html.includes('chon-che-do');
  const coQuyTac = (html.match(/data-quy-tac=/g) ?? []).length;
  console.log(`  [${soThieuHtml === 0 ? 'ĐẠT' : 'LỖI'}] Đủ ${canCo.length} id của khối đăng nhập/đăng ký.`);
  console.log(`  [${coChuyenCheDo ? 'ĐẠT' : 'LỖI'}] Có hai thẻ chuyển chế độ Đăng nhập / Đăng ký.`);
  console.log(`  [${coQuyTac >= 3 ? 'ĐẠT' : 'LỖI'}] Có ${coQuyTac} dòng quy tắc mật khẩu (cần ≥ 3).`);

  console.log('\n=== 3. TỆP TĨNH MỚI ĐƯỢC PHỤC VỤ QUA HTTP ===');
  const canPhucVu = ['/css/style.css', '/js/mat-khau.js', '/js/thong-bao.js', '/js/app.js', '/js/pages/cua-toi.js'];
  for (const duongDan of canPhucVu) {
    try {
      const phanHoi = await fetch(`${DIA_CHI_WEB}${duongDan}`);
      const than = await phanHoi.text();
      console.log(
        `  [${phanHoi.ok && than.length > 0 ? 'ĐẠT' : 'LỖI'}] ${duongDan} — ${phanHoi.status}, ${than.length} byte`
      );
    } catch (loi) {
      console.log(`  [LỖI] ${duongDan} — ${loi.message}`);
    }
  }

  console.log('\n=== 4. NỘI DUNG THEN CHỐT CÓ TRONG TỆP TĨNH ===');
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
  console.log(
    thieuCss.length === 0
      ? `  [ĐẠT] Đủ ${lopCss.length} lớp CSS mới.`
      : `  [LỖI] Thiếu lớp CSS: ${thieuCss.join(', ')}`
  );

  const dauNgoac = (css.match(/\{/g) ?? []).length;
  const dongNgoac = (css.match(/\}/g) ?? []).length;
  console.log(`  [${dauNgoac === dongNgoac ? 'ĐẠT' : 'LỖI'}] Dấu ngoặc CSS cân bằng: ${dauNgoac} mở / ${dongNgoac} đóng.`);

  if (soThieu > 0 || soThieuHtml > 0 || thieuCss.length > 0 || dauNgoac !== dongNgoac) process.exitCode = 1;
}

main().catch((loi) => {
  console.error('LOI:', loi);
  process.exitCode = 1;
});
