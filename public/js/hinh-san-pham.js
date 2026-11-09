import { el } from './ui.js';

const ANH_THEO_NHOM = {
  'ca-phe-viet': '/images/san-pham/ca-phe-viet.svg',
  espresso: '/images/san-pham/espresso.svg',
  tra: '/images/san-pham/tra.svg',
  'da-xay': '/images/san-pham/da-xay.svg',
  banh: '/images/san-pham/banh.svg',
  hat: '/images/san-pham/hat.svg',
};

function layAnhMacDinh(sanPham) {
  const khoaAnh = String(sanPham?.hinhAnh ?? '').trim().toLowerCase();
  if (ANH_THEO_NHOM[khoaAnh]) return ANH_THEO_NHOM[khoaAnh];
  const tenLoai = String(sanPham?.tenLoai ?? '').toLowerCase();
  if (tenLoai.includes('trà')) return ANH_THEO_NHOM.tra;
  if (tenLoai.includes('bánh')) return ANH_THEO_NHOM.banh;
  if (tenLoai.includes('hạt') || tenLoai.includes('đóng gói')) return ANH_THEO_NHOM.hat;
  if (tenLoai.includes('đá xay')) return ANH_THEO_NHOM['da-xay'];
  if (tenLoai.includes('espresso')) return ANH_THEO_NHOM.espresso;
  return ANH_THEO_NHOM['ca-phe-viet'];
}

function duongDanAnh(url) {
  const apiGoc = String(window.COFFEE_CRM_API_URL ?? '').replace(/\/$/, '');
  return apiGoc && url.startsWith('/') ? `${apiGoc}${url}` : url;
}

/** Hiển thị ảnh được lưu trong sản phẩm, hoặc ảnh minh họa theo nhóm hàng. */
export function anhSanPham(sanPham, lop = '') {
  const anhMacDinh = layAnhMacDinh(sanPham);
  const anhDaLuu = String(sanPham?.hinhAnh ?? '').trim();
  const src = /^(https?:\/\/|\/|data:image\/(?:jpeg|png|webp);base64,)/i.test(anhDaLuu)
    ? duongDanAnh(anhDaLuu)
    : anhMacDinh;
  const anh = el('img', {
    lop,
    thuocTinh: {
      src,
      alt: sanPham?.tenSP ? `Ảnh ${sanPham.tenSP}` : 'Ảnh sản phẩm',
      loading: 'lazy',
      decoding: 'async',
    },
  });
  anh.addEventListener('error', () => {
    if (anh.dataset.daDungAnhMacDinh) return;
    anh.dataset.daDungAnhMacDinh = 'true';
    anh.src = anhMacDinh;
  });
  return anh;
}
