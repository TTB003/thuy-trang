/**
 * Lớp "phương ngữ" SQL: dịch câu lệnh viết theo chuẩn SQLite sang PostgreSQL
 * và cung cấp các đoạn SQL khác nhau giữa hai hệ quản trị.
 *
 * Nhờ lớp này, toàn bộ service chỉ cần viết SQL một lần theo cú pháp chung
 * (tham số `:ten`, `date('now','localtime')`, `UNACCENT(...)`, ...).
 */
'use strict';

const { unaccent } = require('../core/text');

/** Các ký tự tiếng Việt có dấu (đã ở dạng chữ thường). */
const KY_TU_CO_DAU =
  'áàảãạăắằẳẵặâấầẩẫậéèẻẽẹêếềểễệíìỉĩịóòỏõọôốồổỗộơớờởỡợúùủũụưứừửữựýỳỷỹỵđ';

/** Ánh xạ tương ứng sang ký tự không dấu — sinh tự động để luôn khớp độ dài. */
const KY_TU_KHONG_DAU = [...KY_TU_CO_DAU].map((ky) => unaccent(ky)).join('');

if (KY_TU_CO_DAU.length !== KY_TU_KHONG_DAU.length) {
  throw new Error('Bảng ánh xạ bỏ dấu tiếng Việt không khớp độ dài.');
}

/** Câu lệnh tạo hàm bỏ dấu tiếng Việt cho PostgreSQL. */
const TAO_HAM_UNACCENT =
  `CREATE OR REPLACE FUNCTION unaccent_vn(txt text) RETURNS text AS $$\n` +
  `  SELECT translate(lower(coalesce(txt, '')),\n` +
  `         '${KY_TU_CO_DAU}',\n` +
  `         '${KY_TU_KHONG_DAU}')\n` +
  `$$ LANGUAGE SQL IMMUTABLE;`;

/**
 * Thu thập tên tham số theo thứ tự xuất hiện để đánh số $1, $2, ...
 * Chỉ nhận tên bắt đầu bằng chữ cái/gạch dưới nên không nhầm với giờ phút
 * trong chuỗi như '08:30:00', và bỏ qua phép ép kiểu `::text` của PostgreSQL
 * (nhờ lookbehind `(?<!:)`).
 */
function danhSoThamSo(sql) {
  const thuTu = [];
  const viTri = new Map();
  const regex = /(?<!:):([a-zA-Z_][a-zA-Z0-9_]*)/g;
  const sqlMoi = sql.replace(regex, (_match, ten) => {
    if (!viTri.has(ten)) {
      viTri.set(ten, thuTu.length + 1);
      thuTu.push(ten);
    }
    return `$${viTri.get(ten)}`;
  });
  return { sql: sqlMoi, tenThamSo: thuTu };
}

/** Chuyển object tham số theo tên thành mảng tham số theo thứ tự. */
function sapXepThamSo(tenThamSo, params) {
  return tenThamSo.map((ten) => {
    const giaTri = params?.[ten];
    return giaTri === undefined ? null : giaTri;
  });
}

/** Dịch câu lệnh SQL sang PostgreSQL. */
function sangPostgres(sql) {
  let ketQua = sql;
  // Ngày hiện tại: SQLite date('now','localtime') -> PostgreSQL CURRENT_DATE
  ketQua = ketQua.replace(/date\(\s*'now'\s*,\s*'localtime'\s*\)/gi, 'CURRENT_DATE');
  // Nhóm theo tháng/năm: strftime -> to_char
  ketQua = ketQua.replace(
    /strftime\(\s*'%Y-%m'\s*,\s*'now'\s*,\s*'localtime'\s*\)/gi,
    `to_char(CURRENT_DATE, 'YYYY-MM')`
  );
  ketQua = ketQua.replace(
    /strftime\(\s*'%Y'\s*,\s*'now'\s*,\s*'localtime'\s*\)/gi,
    `to_char(CURRENT_DATE, 'YYYY')`
  );
  ketQua = ketQua.replace(
    /strftime\(\s*'%Y-%m'\s*,\s*([A-Za-z0-9_.]+)\s*\)/gi,
    `to_char($1, 'YYYY-MM')`
  );
  ketQua = ketQua.replace(
    /strftime\(\s*'%Y'\s*,\s*([A-Za-z0-9_.]+)\s*\)/gi,
    `to_char($1, 'YYYY')`
  );
  // Hàm bỏ dấu
  ketQua = ketQua.replace(/\bUNACCENT\s*\(/gi, 'unaccent_vn(');
  // COALESCE trên cột số/ngày cần ép kiểu text trước khi nối với '' (PostgreSQL
  // không tự đổi kiểu như SQLite).
  ketQua = ketQua.replace(
    /COALESCE\(\s*([A-Za-z_][A-Za-z0-9_.]*)\s*,\s*''\s*\)/gi,
    `COALESCE($1::text, '')`
  );
  // MAX(a, b) của SQLite là hàm vô hướng; PostgreSQL dùng GREATEST.
  ketQua = ketQua.replace(/\bMAX\(\s*0\s*,/gi, 'GREATEST(0,');
  ketQua = ketQua.replace(/\bMIN\(\s*0\s*,/gi, 'LEAST(0,');
  // GROUP_CONCAT của SQLite -> string_agg của PostgreSQL.
  ketQua = ketQua.replace(
    /GROUP_CONCAT\(\s*DISTINCT\s+([^)]+)\)/gi,
    `string_agg(DISTINCT $1, ', ')`
  );
  ketQua = ketQua.replace(/GROUP_CONCAT\(\s*([^)]+)\)/gi, `string_agg($1, ', ')`);
  return ketQua;
}

/** Dịch câu lệnh SQL sang SQLite (giữ nguyên, dùng cho chế độ dự phòng). */
function sangSqlite(sql) {
  return sql;
}

/** Dịch theo hệ CSDL đang dùng. */
function dich(sql, client) {
  return client === 'postgres' ? sangPostgres(sql) : sangSqlite(sql);
}

/** Đoạn SQL tính nhóm tuổi từ cột ngày sinh. */
function bieuThucNhomTuoi(columnSql, client) {
  const tuoi =
    client === 'postgres'
      ? `CAST(EXTRACT(YEAR FROM age(CURRENT_DATE, ${columnSql})) AS INT)`
      : `CAST((julianday('now','localtime') - julianday(${columnSql})) / 365.25 AS INT)`;
  return `(CASE
      WHEN ${columnSql} IS NULL THEN N'Chưa rõ'
      WHEN ${tuoi} < 18 THEN N'Dưới 18'
      WHEN ${tuoi} <= 24 THEN N'18-24'
      WHEN ${tuoi} <= 34 THEN N'25-34'
      WHEN ${tuoi} <= 44 THEN N'35-44'
      WHEN ${tuoi} <= 54 THEN N'45-54'
      ELSE N'Trên 55' END)`;
}

/** Đoạn SQL nhóm doanh thu theo mốc thời gian. */
function bieuThucMocThoiGian(columnSql, kieu, client) {
  if (client === 'postgres') {
    if (kieu === 'nam') return `to_char(${columnSql}, 'YYYY')`;
    if (kieu === 'thang') return `to_char(${columnSql}, 'YYYY-MM')`;
    if (kieu === 'quy') return `to_char(${columnSql}, 'YYYY') || '-Q' || EXTRACT(QUARTER FROM ${columnSql})::text`;
    return `to_char(${columnSql}, 'YYYY-MM-DD')`;
  }
  if (kieu === 'nam') return `strftime('%Y', ${columnSql})`;
  if (kieu === 'thang') return `strftime('%Y-%m', ${columnSql})`;
  if (kieu === 'quy') return `strftime('%Y', ${columnSql}) || '-Q' || CAST(((CAST(strftime('%m', ${columnSql}) AS INTEGER) - 1) / 3 + 1) AS TEXT)`;
  return `date(${columnSql})`;
}

/** Đoạn SQL nhóm theo tháng của một cột. */
function bieuThucThang(columnSql, client) {
  return client === 'postgres'
    ? `to_char(${columnSql}, 'YYYY-MM')`
    : `strftime('%Y-%m', ${columnSql})`;
}

/**
 * Đoạn SQL trích ngày–tháng (dạng 'MM-DD') của một cột ngày.
 * Dùng để so sánh ngày sinh nhật mà bỏ qua năm sinh.
 */
function bieuThucNgayThang(columnSql, client) {
  return client === 'postgres'
    ? `to_char(${columnSql}, 'MM-DD')`
    : `strftime('%m-%d', ${columnSql})`;
}

module.exports = {
  KY_TU_CO_DAU,
  KY_TU_KHONG_DAU,
  TAO_HAM_UNACCENT,
  danhSoThamSo,
  sapXepThamSo,
  sangPostgres,
  sangSqlite,
  dich,
  bieuThucNhomTuoi,
  bieuThucMocThoiGian,
  bieuThucThang,
  bieuThucNgayThang,
};
