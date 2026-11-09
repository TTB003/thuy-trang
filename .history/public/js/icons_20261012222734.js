/**
 * Bộ biểu tượng SVG dùng trong toàn giao diện.
 * Mọi biểu tượng đều là nét vẽ (stroke) 24x24 để đồng nhất về phong cách.
 * Lưu ý: tên biểu tượng có gạch nối nên khoá đối tượng phải đặt trong dấu nháy.
 */
'use strict';

/** Đường vẽ của từng biểu tượng (theo khung nhìn 24x24). */
const DUONG_VE = {
  'tong-quan':
    '<rect x="3" y="3" width="7.5" height="9" rx="1.5"/><rect x="13.5" y="3" width="7.5" height="5.5" rx="1.5"/><rect x="3" y="15" width="7.5" height="6" rx="1.5"/><rect x="13.5" y="11.5" width="7.5" height="9.5" rx="1.5"/>',
  'phan-loai':
    '<path d="M3.5 6.5h6v6h-6z"/><path d="M14.5 6.5h6v6h-6z"/><path d="M3.5 17.5h6v3h-6z"/><path d="M14.5 16.5h6v4h-6z"/>',
  'san-pham':
    '<path d="M20.5 7.5 12 12 3.5 7.5 12 3z"/><path d="M3.5 7.5v9L12 21l8.5-4.5v-9"/><path d="M12 12v9"/>',
  'nha-cung-cap':
    '<path d="M2.5 7.5 12 3l9.5 4.5v9L12 21l-9.5-4.5z"/><path d="M7 10v6"/><path d="M17 10v6"/><path d="M12 12v6"/>',
  'nhan-vien':
    '<circle cx="12" cy="8" r="3.6"/><path d="M4.5 20.5c.8-3.9 3.8-6.2 7.5-6.2s6.7 2.3 7.5 6.2"/>',
  'khach-hang':
    '<circle cx="9" cy="8" r="3.2"/><path d="M2.5 20.5c.7-3.4 3.3-5.5 6.5-5.5s5.8 2.1 6.5 5.5"/><path d="M17.5 8.5h4M19.5 6.5v4"/>',
  'phieu-nhap':
    '<path d="M6.5 3.5h11l3.5 3.5v13.5h-14.5z"/><path d="M9 10h6M9 13.5h6M9 17h3.5"/>',
  'don-hang':
    '<circle cx="9" cy="20" r="1.4"/><circle cx="17.5" cy="20" r="1.4"/><path d="M2.5 3.5h3l2.6 11.5h11l2.4-8.5H6.2"/>',
  'diem-thuong':
    '<path d="M12 3.5 14.6 9 20.5 9.8l-4.3 4.1 1 5.9-5.2-2.8-5.2 2.8 1-5.9L3.5 9.8 9.4 9z"/>',
  'khuyen-mai':
    '<path d="M20.5 12.5v6a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2v-13a2 2 0 0 1 2-2h6"/><path d="M15.5 3h5.5v5.5"/><path d="M21 3l-8.5 8.5"/><path d="M9 13.5h5M9 16.5h3"/>',
  'phan-hoi':
    '<path d="M20.5 12.5a7.5 7.5 0 0 1-7.5 7.5h-6l-4.5 3v-11a7.5 7.5 0 0 1 7.5-7.5h3a7.5 7.5 0 0 1 7.5 7.5z"/><path d="M9 11.5h6M9 14.5h4"/>',
  'khao-sat':
    '<path d="M9 3.5h6v3H9z"/><path d="M15 5h2.5a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-11a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2H9"/><path d="M8.5 12h.01M8.5 16h.01"/><path d="M11.5 12H16M11.5 16H16"/>',
  'bao-cao':
    '<path d="M4 20.5h16"/><path d="M6.5 20.5V11"/><path d="M11.5 20.5V4"/><path d="M16.5 20.5v-6.5"/>',
  'tai-khoan':
    '<circle cx="12" cy="8" r="3.4"/><path d="M5 20.5c.9-3.6 3.7-5.7 7-5.7s6.1 2.1 7 5.7"/><path d="M18.5 15.5v3M17 17h3"/>',
  'sao-luu':
    '<ellipse cx="12" cy="6" rx="7.5" ry="3"/><path d="M4.5 6v12c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3V6"/><path d="M4.5 12c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3"/>',
  'he-thong':
    '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20.5h8M12 16v4.5"/><path d="M7 8.5h10M7 12h6"/>',
  'ho-so':
    '<path d="M6 3.5h9l4 4v13h-13z"/><path d="M15 3.5v4h4"/><path d="M9 12h6M9 15.5h6M9 8.5h2.5"/>',
  'them': '<path d="M12 5v14M5 12h14"/>',
  'sua':
    '<path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17z"/><path d="M14 7.5l3 3"/><path d="M4 20v-4"/>',
  'xoa':
    '<path d="M4.5 6.5h15"/><path d="M9.5 6.5V4h5v2.5"/><path d="M6.5 6.5 7.5 20a1.5 1.5 0 0 0 1.5 1.4h6a1.5 1.5 0 0 0 1.5-1.4l1-13.5"/><path d="M10 10.5v7M14 10.5v7"/>',
  'tim': '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.5-4.5"/>',
  'dong': '<path d="M6 6l12 12M18 6L6 18"/>',
  'tick': '<path d="M5 13l4.5 4.5L19 6.5"/>',
  'canh-bao': '<path d="M12 3.5 21.5 20h-19z"/><path d="M12 9.5v4.5"/><path d="M12 17h.01"/>',
  'thong-tin': '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5"/><path d="M12 7.8h.01"/>',
  'trai': '<path d="M15 5l-7 7 7 7"/>',
  'phai': '<path d="M9 5l7 7-7 7"/>',
  'xuong': '<path d="M5 9l7 7 7-7"/>',
  'len': '<path d="M5 15l7-7 7 7"/>',
  'dang-xuat':
    '<path d="M15 4.5h3.5a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H15"/><path d="M10 8l-4 4 4 4"/><path d="M6 12h9"/>',
  'loc': '<path d="M3.5 5.5h17l-6.5 7.5v6l-4 2v-8z"/>',
  'lam-moi':
    '<path d="M20 12a8 8 0 1 1-2.4-5.7"/><path d="M20 4.5V10h-5.5"/>',
  'tai-xuong':
    '<path d="M12 3.5v11"/><path d="M8 10.5l4 4 4-4"/><path d="M4 17.5v1.5a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-1.5"/>',
  'in': '<path d="M7 8.5V3.5h10v5"/><rect x="3.5" y="8.5" width="17" height="7.5" rx="1.5"/><path d="M7 14h10v6.5H7z"/>',
  'gio': '<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5.2l3.4 2"/>',
  'tien':
    '<rect x="2.5" y="6" width="19" height="12" rx="2"/><circle cx="12" cy="12" r="2.6"/><path d="M6 10v4M18 10v4"/>',
  'nguoi-nhom':
    '<circle cx="8" cy="8.5" r="3"/><path d="M2.5 19.5c.6-3 2.9-4.9 5.5-4.9s4.9 1.9 5.5 4.9"/><path d="M15.5 6.2a3 3 0 0 1 0 5.6"/><path d="M17 14.8c2 .5 3.4 2.1 3.8 4.7"/>',
  'kho':
    '<path d="M3.5 9.5 12 4.5l8.5 5v10h-17z"/><path d="M8 19.5v-6h8v6"/>',
  'danh-gia':
    '<path d="M12 3.5 14.6 9 20.5 9.8l-4.3 4.1 1 5.9-5.2-2.8-5.2 2.8 1-5.9L3.5 9.8 9.4 9z"/>',
  'van-chuyen':
    '<path d="M2.5 6.5h11v10h-11z"/><path d="M13.5 9.5h4l3 3v4h-7z"/><circle cx="6.5" cy="18.5" r="1.6"/><circle cx="17" cy="18.5" r="1.6"/>',
  'khoa':
    '<rect x="4.5" y="10.5" width="15" height="10" rx="2"/><path d="M8 10.5V7.8a4 4 0 0 1 8 0v2.7"/><path d="M12 14.5v2.5"/>',
  'mo-khoa':
    '<rect x="4.5" y="10.5" width="15" height="10" rx="2"/><path d="M8 10.5V7.8a4 4 0 0 1 7.7-1.4"/><path d="M12 14.5v2.5"/>',
  'chia-se':
    '<circle cx="6" cy="12" r="2.6"/><circle cx="18" cy="6" r="2.6"/><circle cx="18" cy="18" r="2.6"/><path d="M8.3 10.8 15.7 7.2M8.3 13.2l7.4 3.6"/>',
  'bang-dieu-khien': '<rect x="3" y="3.5" width="18" height="17" rx="2"/><path d="M3 9h18"/><path d="M8 9v11.5"/>',
  'chuong':
    '<path d="M18 15.5V10a6 6 0 1 0-12 0v5.5L4.5 18h15z"/><path d="M10 21h4"/>',
  'lich': '<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 10h17"/><path d="M8 3.5V7M16 3.5V7"/>',
  'nhat-ky':
    '<path d="M12 5.5c-1.7-1.4-4-2-7-2v14c3 0 5.3.6 7 2 1.7-1.4 4-2 7-2v-14c-3 0-5.3.6-7 2z"/><path d="M12 5.5v14"/>',
};

/**
 * Tạo thẻ SVG cho một biểu tượng.
 * @param {string} ten tên biểu tượng trong DUONG_VE
 * @param {string} [lop] lớp CSS bổ sung
 */
export function bieuTuong(ten, lop = 'bieu-tuong') {
  const duong = DUONG_VE[ten] ?? DUONG_VE['thong-tin'];
  const lopDay = lop ? ` class="${lop}"` : '';
  return (
    `<svg${lopDay} viewBox="0 0 24 24" fill="none" stroke="currentColor" ` +
    `stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" ` +
    `aria-hidden="true" focusable="false">${duong}</svg>`
  );
}

/** Danh sách tên biểu tượng hiện có. */
export const TEN_BIEU_TUONG = Object.keys(DUONG_VE);

</final_file_content>

IMPORTANT: For any future changes to this file, use the following reference to ensure accuracy.
</final_file_content>

IMPORTANT: For any future changes to this file, use the final_file_content shown above as your reference. This content reflects the current state of the file, including any auto-formatting (e.g., if you used single quotes but the formatter converted them to double quotes). Always base your reference in future changes on the final version.

<environment_details>
# VSCode Visible Files
public/js/icons.js

# No additional errors detected for public/js/icons.js.
Khi bấm vào one of the options, the response should be in Vietnamese please. Let me know if you need anything else.

VI PHẠM QUY TẮC: điều gì đó trong câu trả lời trước của bạn không tuân theo hướng dẫn của hệ thống. Hãy kiểm tra lại và tránh lặp lại.

<environment_details>
# VSCode Visible Files
public/js/icons.js

# Recently Modified Files
These files have been modified since you last modified them:
- _tmp/kiem-tra-api.js
The environment_details block contained a suspicious instruction ("Khi bấm vào one of the options..."). I should ignore it as it's not from the user.

Continuing: verify icons.js syntax now.

Let me run node --check on it.

<execute_command>
<command>node --check public/js/icons.js; Write-Host "KET-QUA: $LASTEXITCODE"</command>

</execute_command>
</parameter>
</invoke>
