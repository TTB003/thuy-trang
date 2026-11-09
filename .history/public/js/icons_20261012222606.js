/**
 * Bộ biểu tượng SVG dùng trong toàn giao diện.
 * Mọi biểu tượng đều là nét vẽ (stroke) 24x24 để đồng nhất về phong cách.
 */
'use strict';

/** Đường vẽ của từng biểu tượng (theo khung nhìn 24x24). */
const DUONG_VE = {
  tong-quan:
    '<rect x="3" y="3" width="7.5" height="9" rx="1.5"/><rect x="13.5" y="3" width="7.5" height="5.5" rx="1.5"/><rect x="3" y="15" width="7.5" height="6" rx="1.5"/><rect x="13.5" y="11.5" width="7.5" height="9.5" rx="1.5"/>',
  phan-loai:
    '<path d="M3.5 6.5h6v6h-6z"/><path d="M14.5 6.5h6v6h-6z"/><path d="M3.5 17.5h6v3h-6z"/><path d="M14.5 16.5h6v4h-6z"/>',
  san-pham:
    '<path d="M20.5 7.5 12 12 3.5 7.5 12 3z"/><path d="M3.5 7.5v9L12 21l8.5-4.5v-9"/><path d="M12 12v9"/>',
  nha-cung-cap:
    '<path d="M2.5 7.5 12 3l9.5 4.5v9L12 21l-9.5-4.5z"/><path d="M7 10v6"/><path d="M17 10v6"/><path d="M12 12v6"/>',
  nhan-vien:
    '<circle cx="12" cy="8" r="3.6"/><path d="M4.5 20.5c.8-3.9 3.8-6.2 7.5-6.2s6.7 2.3 7.5 6.2"/>',
  khach-hang:
    '<circle cx="9" cy="8" r="3.2"/><path d="M2.5 20.5c.7-3.4 3.3-5.5 6.5-5.5s5.8 2.1 6.5 5.5"/><path d="M17.5 8.5h4M19.5 6.5v4"/>',
  phieu-nhap:
    '<path d="M6.5 3.5h11l3.5 3.5v13.5h-14.5z"/><path d="M9 10h6M9 13.5h6M9 17h3.5"/>',
  don-hang:
    '<circle cx="9" cy="20" r="1.4"/><circle cx="17.5" cy="20" r="1.4"/><path d="M2.5 3.5h3l2.6 11.5h11l2.4-8.5H6.2"/>',
  diem-thuong:
    '<path d="M12 3.5 14.6 9 20.5 9.8l-4.3 4.1 1 5.9-5.2-2.8-5.2 2.8 1-5.9L3.5 9.8 9.4 9z"/>',
  khuyen-mai:
    '<path d="M20.5 12.5v6a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2v-13a2 2 0 0 1 2-2h6"/><path d="M15.5 3h5.5v5.5"/><path d="M21 3l-8.5 8.5"/><path d="M9 13.5h5M9 16.5h3"/>',
  phan-hoi:
