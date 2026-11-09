/**
 * Xuất toàn bộ cơ sở dữ liệu ra file database/code.sql (bản PostgreSQL).
 *
 * File sinh ra gồm 3 phần, có thể dán toàn bộ vào pgAdmin Query Tool:
 *   1. Kịch bản tạo bảng (nội dung database/schema-pg.sql).
 *   2. Lệnh INSERT toàn bộ dữ liệu hiện có.
 *   3. Lệnh đặt lại giá trị SERIAL để có thể thêm bản ghi mới sau khi dán.
 *
 * Cách chạy: node scripts/xuat-sql.js
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const db = require('../src/db');
const { config, database } = require('../src/config');

/** Chuyển một giá trị JS thành literal SQL của PostgreSQL. */
function thanhLiteral(giaTri) {
  if (giaTri === null || giaTri === undefined) return 'NULL';
  if (typeof giaTri === 'number') return Number.isFinite(giaTri) ? String(giaTri) : 'NULL';
  if (typeof giaTri === 'boolean') return giaTri ? 'TRUE' : 'FALSE';
  if (giaTri instanceof Date) return `'${giaTri.toISOString().slice(0, 19)}'`;
  return `'${String(giaTri).replace(/'/g, "''")}'`;
}

/** Các cột SERIAL/IDENTITY để đặt lại giá trị sau khi chèn dữ liệu. */
async function layCotTuTang() {
  return db.all(
    `SELECT table_name, column_name
       FROM information_schema.columns
      WHERE table_schema = 'public' AND column_default LIKE 'nextval%'
      ORDER BY table_name`
  );
}

/** Sinh phần INSERT cho toàn bộ bảng. */
async function sinhPhanDuLieu(bang) {
  const phan = [];
  let tongDong = 0;

  for (const tenBang of bang) {
    const rows = await db.all(`SELECT * FROM ${tenBang}`);
    phan.push(`-- Bảng ${tenBang} (${rows.length} dòng)`);
    if (rows.length === 0) {
      phan.push('');
      continue;
    }
    for (const dong of rows) {
      const cot = Object.keys(dong);
      const giaTri = cot.map((ten) => thanhLiteral(dong[ten]));
      phan.push(`INSERT INTO ${tenBang} (${cot.join(', ')}) VALUES (${giaTri.join(', ')});`);
      tongDong += 1;
    }
    phan.push('');
  }
  return { phan, tongDong };
}

/** Sinh phần đặt lại giá trị SERIAL. */
function sinhPhanDatLaiSequence(cotTuTang) {
  const phan = ['-- Đặt lại giá trị tăng tự động (SERIAL) sau khi chèn dữ liệu', ''];
  if (cotTuTang.length === 0) {
    phan.push('-- (Không có cột SERIAL nào.)', '');
    return phan;
  }
  for (const muc of cotTuTang) {
    const bang = muc.table_name ?? muc.tableName;
    const cot = muc.column_name ?? muc.columnName;
    phan.push(
      `SELECT setval(pg_get_serial_sequence('${bang}', '${cot}'), ` +
        `COALESCE((SELECT MAX(${cot}) FROM ${bang}), 1));`
    );
  }
  phan.push('');
  return phan;
}

async function main() {
  const bang = await db.danhSachBang();
  const { phan, tongDong } = await sinhPhanDuLieu(bang);
  const cotTuTang = await layCotTuTang();
  const phanSequence = sinhPhanDatLaiSequence(cotTuTang);

  const schemaSql = fs.readFileSync(config.schemaPostgresFile, 'utf8');

  const noiDung = [
    '-- =============================================================================',
    '-- HỆ THỐNG CRM DOANH NGHIỆP BÁN COFFEE — FILE code.sql',
    '-- -----------------------------------------------------------------------------',
    `-- Cơ sở dữ liệu : ${database.postgres.database} (PostgreSQL)`,
    `-- Thời điểm xuất: ${new Date().toLocaleString('vi-VN')}`,
    `-- Số bảng       : ${bang.length}   |   Số dòng dữ liệu: ${tongDong}`,
    '-- Cách dùng    : pgAdmin -> chuột phải database DAS -> Query Tool ->',
    '--                 dán toàn bộ file này -> Execute (F5).',
    '-- =============================================================================',
    '',
    '-- ============ PHẦN 1: TẠO BẢNG ============',
    schemaSql,
    '',
    '-- ============ PHẦN 2: DỮ LIỆU MẪU ============',
    ...phan,
    '-- ============ PHẦN 3: ĐẶT LẠI KHÓA TỰ TĂNG ============',
    ...phanSequence,
    '-- ============ KẾT THÚC ============',
    '',
  ].join('\n');

  fs.mkdirSync(path.dirname(config.codeSqlFile), { recursive: true });
  fs.writeFileSync(config.codeSqlFile, noiDung, 'utf8');

  const kichThuoc = fs.statSync(config.codeSqlFile).size;
  console.log(`Đã xuất file: database/code.sql (${(kichThuoc / 1024).toFixed(0)} KB)`);
  console.log(`  - Số bảng       : ${bang.length}`);
  console.log(`  - Số dòng dữ liệu: ${tongDong}`);
  console.log(`  - Số cột SERIAL : ${cotTuTang.length}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('LỖI XUẤT SQL:', error.message);
    console.error(error.stack);
    process.exit(1);
  });
