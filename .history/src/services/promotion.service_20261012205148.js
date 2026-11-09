/**
 * NGHIỆP VỤ NHÓM 9 — Quản lý khuyến mãi (CN9.1 → CN9.6).
 * Bảng: KHUYENMAI, CTKM, SANPHAM.
 */
'use strict';

const db = require('../db');
const { todaySql } = require('../core/time');
const { badRequest, notFound, conflict } = require('../core/errors');
const { requiredText, optionalText, requiredNumber, dateOnly, oneOf, idList } = require('../core/validation');
const { FilterBuilder, parsePagination, paginate, executePaged } = require('../core/query');

const TRANG_THAI_KM = ['Đang diễn ra', 'Đã kết thúc', 'Tạm dừng'];

const SELECT_SQL = `
  SELECT km.maKM, km.tenKM, km.moTa, km.giaTriGiam, km.ngayBatDau, km.ngayKetThuc,
         km.trangThai,
         (SELECT COUNT(*) FROM CTKM c WHERE c.maKM = km.maKM) AS soSanPham,
         CASE WHEN km.trangThai = 'Đang diễn ra'
                   AND date('now','localtime') BETWEEN km.ngayBatDau AND km.ngayKetThuc
              THEN 1 ELSE 0 END AS dangHieuLuc
    FROM KHUYENMAI km`;
const COUNT_SQL = 'SELECT COUNT(*) AS total FROM KHUYENMAI km';

/** CN9.5 — Xem / tra cứu khuyến mãi. */
function listKhuyenMai(query = {}) {
  const pagination = parsePagination(query);
  const filter = new FilterBuilder()
    .search(query.q, ['km.tenKM', 'km.moTa'])
    .equals('km.trangThai', query.trangThai ? optionalText(query.trangThai, 30) : null);

  if (String(query.dangHieuLuc) === 'true') {
    filter.raw(
      `km.trangThai = 'Đang diễn ra' AND date('now','localtime') BETWEEN km.ngayBatDau AND km.ngayKetThuc`
    );
  } else if (String(query.dangHieuLuc) === 'false') {
    filter.raw(
      `NOT (km.trangThai = 'Đang diễn ra' AND date('now','localtime') BETWEEN km.ngayBatDau AND km.ngayKetThuc)`
    );
  }
  if (query.tuNgay) filter.raw('date(km.ngayKetThuc) >= date(:tuNgay)', { tuNgay: query.tuNgay });
  if (query.denNgay) filter.raw('date(km.ngayBatDau) <= date(:denNgay)', { denNgay: query.denNgay });

  const { items, total } = executePaged({
    selectSql: SELECT_SQL,
    countSql: COUNT_SQL,
    filter,
    orderBy: 'ORDER BY km.ngayKetThuc DESC, km.maKM DESC',
    pagination,
    runAll: db.all,
    runGet: db.get,
  });
  return paginate(items, total, pagination);
}

/** Lấy khuyến mãi kèm danh sách sản phẩm áp dụng. */
function getKhuyenMai(maKM) {
  const row = db.get(`${SELECT_SQL} WHERE km.maKM = :maKM`, { maKM });
  if (!row) throw notFound(`Không tìm thấy chương trình khuyến mãi có mã ${maKM}.`);
  const sanPham = db.all(
    `SELECT sp.maSP, sp.tenSP, l.tenLoai, sp.gia,
            MAX(0, sp.gia - :giaTriGiam) AS giaSauGiam
       FROM CTKM c
       JOIN SANPHAM sp ON sp.maSP = c.maSP
       JOIN LOAISANPHAM l ON l.maLoai = sp.maLoai
      WHERE c.maKM = :maKM
      ORDER BY sp.tenSP ASC`,
    { maKM, giaTriGiam: row.giaTriGiam }
  );
  return { ...row, sanPham };
}

/** CN9.1 — Tạo chương trình khuyến mãi. */
function createKhuyenMai(payload) {
  const tenKM = requiredText(payload.tenKM, 'Tên chương trình', 150);
  const moTa = optionalText(payload.moTa, 255);
  const giaTriGiam = requiredNumber(payload.giaTriGiam, 'Giá trị giảm', 1);
  const ngayBatDau = dateOnly(payload.ngayBatDau ?? todaySql(), 'Ngày bắt đầu');
  const ngayKetThuc = dateOnly(payload.ngayKetThuc, 'Ngày kết thúc');
  if (ngayKetThuc < ngayBatDau) {
    throw badRequest('Ngày kết thúc phải sau hoặc bằng ngày bắt đầu.');
  }
  if (ngayKetThuc < todaySql()) {
    throw badRequest('Ngày kết thúc không được nhỏ hơn ngày hiện tại.');
  }
  const trangThai = oneOf(payload.trangThai ?? TRANG_THAI_KM[0], TRANG_THAI_KM, 'Trạng thái');

  const result = db.run(
    `INSERT INTO KHUYENMAI (tenKM, moTa, giaTriGiam, ngayBatDau, ngayKetThuc, trangThai)
     VALUES (:tenKM, :moTa, :giaTriGiam, :ngayBatDau, :ngayKetThuc, :trangThai)`,
    { tenKM, moTa, giaTriGiam, ngayBatDau, ngayKetThuc, trangThai }
  );
  return getKhuyenMai(result.lastInsertRowid);
}

/** CN9.2 — Sửa khuyến mãi. */
function updateKhuyenMai(maKM, payload) {
  const current = getKhuyenMai(maKM);
  const tenKM = requiredText(payload.tenKM ?? current.tenKM, 'Tên chương trình', 150);
  const moTa = optionalText(payload.moTa ?? current.moTa, 255);
  const giaTriGiam = requiredNumber(payload.giaTriGiam ?? current.giaTriGiam, 'Giá trị giảm', 1);
  const ngayBatDau = dateOnly(payload.ngayBatDau ?? current.ngayBatDau, 'Ngày bắt đầu');
  const ngayKetThuc = dateOnly(payload.ngayKetThuc ?? current.ngayKetThuc, 'Ngày kết thúc');
  if (ngayKetThuc < ngayBatDau) throw badRequest('Ngày kết thúc phải sau hoặc bằng ngày bắt đầu.');
  const trangThai = oneOf(payload.trangThai ?? current.trangThai, TRANG_THAI_KM, 'Trạng thái');

  db.run(
    `UPDATE KHUYENMAI
        SET tenKM = :tenKM, moTa = :moTa, giaTriGiam = :giaTriGiam,
            ngayBatDau = :ngayBatDau, ngayKetThuc = :ngayKetThuc, trangThai = :trangThai
      WHERE maKM = :maKM`,
    { tenKM, moTa, giaTriGiam, ngayBatDau, ngayKetThuc, trangThai, maKM: current.maKM }
  );
  return getKhuyenMai(current.maKM);
}

/** CN9.2 — Xóa khuyến mãi (xóa các dòng CTKM liên quan trước). */
function deleteKhuyenMai(maKM) {
  const current = getKhuyenMai(maKM);
  return db.transaction(() => {
    db.run('DELETE FROM CTKM WHERE maKM = :maKM', { maKM: current.maKM });
    db.run('DELETE FROM KHUYENMAI WHERE maKM = :maKM', { maKM: current.maKM });
    return { maKM: current.maKM, tenKM: current.tenKM };
  });
}

/** Kết thúc sớm một khuyến mãi ngay hôm nay. */
function ketThucSom(maKM) {
  const current = getKhuyenMai(maKM);
  db.run(
    `UPDATE KHUYENMAI SET ngayKetThuc = :homNay, trangThai = N'Đã kết thúc' WHERE maKM = :maKM`,
    { homNay: todaySql(), maKM: current.maKM }
  );
  return getKhuyenMai(current.maKM);
}

/**
 * CN9.3 — Áp dụng khuyến mãi cho sản phẩm.
 * Ràng buộc nghiệp vụ: một sản phẩm không được chồng nhiều khuyến mãi
 * cùng hiệu lực tại một thời điểm.
 */
function apDungKhuyenMai(maKM, danhSachMaSP) {
  const khuyenMai = getKhuyenMai(maKM);
  const danhSach = idList(danhSachMaSP, 'Danh sách sản phẩm');

  return db.transaction(() => {
    let soThem = 0;
    const boQua = [];

    danhSach.forEach((maSP) => {
      const sanPham = db.get('SELECT maSP, tenSP FROM SANPHAM WHERE maSP = :maSP', { maSP });
      if (!sanPham) throw badRequest(`Sản phẩm có mã ${maSP} không tồn tại.`);

      const daCo = db.get('SELECT maKM FROM CTKM WHERE maKM = :maKM AND maSP = :maSP', { maKM, maSP });
      if (daCo) {
        boQua.push({ maSP, tenSP: sanPham.tenSP, lyDo: 'Đã nằm trong chương trình này' });
        return;
      }

      const trungKhuyenMaiKhac = db.get(
        `SELECT km.maKM, km.tenKM
           FROM CTKM c
           JOIN KHUYENMAI km ON km.maKM = c.maKM
          WHERE c.maSP = :maSP
            AND km.maKM <> :maKM
            AND km.trangThai = 'Đang diễn ra'
            AND date('now','localtime') BETWEEN km.ngayBatDau AND km.ngayKetThuc`,
        { maSP, maKM }
      );
      if (trungKhuyenMaiKhac) {
        boQua.push({
          maSP,
          tenSP: sanPham.tenSP,
          lyDo: `Đang áp dụng chương trình "${trungKhuyenMaiKhac.tenKM}"`,
        });
        return;
      }

      db.run('INSERT INTO CTKM (maKM, maSP) VALUES (:maKM, :maSP)', { maKM, maSP });
      soThem += 1;
    });

    return { soThem, boQua, khuyenMai: getKhuyenMai(maKM) };
  });
}

/** CN9.4 — Gỡ khuyến mãi khỏi sản phẩm. */
function goKhuyenMai(maKM, maSP) {
  const current = getKhuyenMai(maKM);
  const result = db.run('DELETE FROM CTKM WHERE maKM = :maKM AND maSP = :maSP', {
    maKM: current.maKM,
    maSP: Number(maSP),
  });
  if (result.changes === 0) {
    throw notFound('Sản phẩm này không nằm trong chương trình khuyến mãi đã chọn.');
  }
  return getKhuyenMai(current.maKM);
}

/**
 * CN9.6 — Tự động kết thúc khuyến mãi hết hạn.
 * Tác vụ hệ thống, chạy định kỳ hoặc khi khởi động.
 */
function ketThucKhuyenMaiHetHan() {
  const rows = db.all(
    `SELECT maKM, tenKM FROM KHUYENMAI
      WHERE trangThai = 'Đang diễn ra' AND date(ngayKetThuc) < date('now','localtime')`
  );
  rows.forEach((row) => {
    db.run(`UPDATE KHUYENMAI SET trangThai = N'Đã kết thúc' WHERE maKM = :maKM`, { maKM: row.maKM });
  });
  return { soKetThuc: rows.length, danhSach: rows };
}

/** Danh sách khuyến mãi đang hiệu lực (dùng cho form áp dụng nhanh). */
function listKhuyenMaiDangHieuLuc() {
  return db.all(
    `${SELECT_SQL}
      WHERE km.trangThai = 'Đang diễn ra'
        AND date('now','localtime') BETWEEN km.ngayBatDau AND km.ngayKetThuc
      ORDER BY km.ngayKetThuc ASC`
  );
}

module.exports = {
  listKhuyenMai,
  getKhuyenMai,
  createKhuyenMai,
  updateKhuyenMai,
  deleteKhuyenMai,
  ketThucSom,
  apDungKhuyenMai,
  goKhuyenMai,
  ketThucKhuyenMaiHetHan,
  listKhuyenMaiDangHieuLuc,
  TRANG_THAI_KM,
};
