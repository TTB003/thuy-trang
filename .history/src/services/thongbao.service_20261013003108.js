/**
 * THÔNG BÁO CHO KHÁCH HÀNG — bảng THONGBAO (chuông thông báo ở cổng khách hàng).
 *
 * Thông báo được sinh khi khách nhận phiếu giảm giá sinh nhật, khi phản hồi
 * được xử lý, khi trả lời khảo sát... Đây là hộp thư một chiều: khách chỉ đọc
 * và đánh dấu đã đọc.
 */
'use strict';

const db = require('../db');
const { notFound } = require('../core/errors');
const { requiredText, optionalText, oneOf, toText } = require('../core/validation');
const { FilterBuilder, parsePagination, paginate, executePaged, buildOrderBy } = require('../core/query');
const { nowSql } = require('../core/time');

/** Loại thông báo hiển thị kèm biểu tượng khác nhau trên giao diện. */
const LOAI_THONG_BAO = ['Ưu đãi', 'Đơn hàng', 'Phản hồi', 'Khảo sát', 'Hệ thống'];
const LOAI_MAC_DINH = 'Hệ thống';

const SELECT_SQL = `
  SELECT tb.maTB, tb.maKH, tb.tieuDe, tb.noiDung, tb.loai,
         tb.maPG, tb.daDoc, tb.ngayTao
    FROM THONGBAO tb`;
const COUNT_SQL = 'SELECT COUNT(*) AS total FROM THONGBAO tb';

const SORT_MAP = { ngayTao: 'tb.ngayTao', maTB: 'tb.maTB' };

/** Tạo một thông báo mới cho khách hàng. */
async function taoThongBao({ maKH, tieuDe, noiDung = null, loai = LOAI_MAC_DINH, maPG = null }) {
  const ketQua = await db.run(
    `INSERT INTO THONGBAO (maKH, tieuDe, noiDung, loai, maPG, daDoc, ngayTao)
     VALUES (:maKH, :tieuDe, :noiDung, :loai, :maPG, 0, :ngayTao)`,
    {
      maKH,
      tieuDe: requiredText(tieuDe, 'Tiêu đề thông báo', 150),
      noiDung: optionalText(noiDung, 500),
      loai: oneOf(loai, LOAI_THONG_BAO, 'Loại thông báo'),
      maPG: maPG ?? null,
      ngayTao: nowSql(),
    }
  );
  return getThongBao(maKH, Number(ketQua.lastInsertRowid));
}

/** Lấy một thông báo (kiểm tra thuộc về đúng khách hàng). */
async function getThongBao(maKH, maTB) {
  const row = await db.get(`${SELECT_SQL} WHERE tb.maKH = :maKH AND tb.maTB = :maTB`, {
    maKH,
    maTB,
  });
  if (!row) throw notFound(`Không tìm thấy thông báo có mã ${maTB}.`);
  return row;
}

/** Danh sách thông báo của khách hàng, mới nhất trước. */
async function listThongBao(maKH, query = {}) {
  const pagination = parsePagination(query);
  const filter = new FilterBuilder().equals('tb.maKH', maKH);
  const chiChuaDoc = toText(query.chiChuaDoc);
  if (chiChuaDoc === '1' || chiChuaDoc === 'true') filter.raw('tb.daDoc = 0');
  const orderBy = buildOrderBy(query, SORT_MAP, 'ngayTao');
  const sapXepDesc = String(query.sortDir ?? '').toLowerCase() === 'desc' || !query.sortBy;
  const { items, total } = await executePaged({
    selectSql: SELECT_SQL,
    countSql: COUNT_SQL,
    filter,
    orderBy: sapXepDesc
      ? `ORDER BY ${SORT_MAP.ngayTao} DESC, ${SORT_MAP.maTB} DESC`
      : orderBy,
    pagination,
    runAll: db.all,
    runGet: db.get,
  });
  return paginate(items, total, pagination);
}

/** Số thông báo chưa đọc — dùng cho chấm đỏ trên chuông. */
async function demChuaDoc(maKH) {
  const tong = await db.scalar('SELECT COUNT(*) FROM THONGBAO WHERE maKH = :maKH AND daDoc = 0', {
    maKH,
  });
  return Number(tong ?? 0);
}

/** Đánh dấu một thông báo đã đọc. */
async function danhDauDaDoc(maKH, maTB) {
  await getThongBao(maKH, maTB);
  await db.run('UPDATE THONGBAO SET daDoc = 1 WHERE maKH = :maKH AND maTB = :maTB', {
    maKH,
    maTB,
  });
  return { maTB, daDoc: 1, chuaDoc: await demChuaDoc(maKH) };
}

/** Đánh dấu tất cả thông báo của khách là đã đọc. */
async function danhDauTatCaDaDoc(maKH) {
  const ketQua = await db.run('UPDATE THONGBAO SET daDoc = 1 WHERE maKH = :maKH AND daDoc = 0', {
    maKH,
  });
  return { soLuong: Number(ketQua?.changes ?? 0), chuaDoc: await demChuaDoc(maKH) };
}

/** Tóm tắt nhanh cho chuông thông báo: số chưa đọc và vài thông báo mới nhất. */
async function tomTatThongBao(maKH, soLuong = 5) {
  await dongBoThongBaoSinhNhat(maKH);
  const [chuaDoc, moiNhat] = await Promise.all([
    demChuaDoc(maKH),
    db.all(
      `${SELECT_SQL} WHERE tb.maKH = :maKH ORDER BY tb.ngayTao DESC, tb.maTB DESC LIMIT :soLuong`,
      { maKH, soLuong: Number(soLuong) }
    ),
  ]);
  return { chuaDoc, moiNhat };
}

/**
 * Móc nối sang dịch vụ ưu đãi sinh nhật để bảo đảm khi khách mở chuông vào
 * đúng ngày sinh nhật thì phiếu và thông báo đã có sẵn.
 */
function dongBoThongBaoSinhNhat(maKH) {
  // Nạp muộn để tránh phụ thuộc vòng giữa hai mô-đun.
  const uuDai = require('./uu-dai-sinh-nhat.service');
