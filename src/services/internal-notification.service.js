'use strict';

const db = require('../db');
const { nowSql } = require('../core/time');
const { notFound } = require('../core/errors');

async function thongBaoDonMoi(donHang) {
  const nhan = await db.all(
    `SELECT tk.maTK
       FROM TAIKHOAN tk
       LEFT JOIN NHANVIEN nv ON nv.maNV = tk.maNV
      WHERE tk.trangThai = N'Hoạt động'
        AND (
          tk.vaiTro IN (N'Admin', N'Quản lý')
          OR (tk.vaiTro = N'Nhân viên' AND nv.trangThai = N'Đang làm việc'
              AND nv.chucVu IN (N'Nhân viên bán hàng', N'Nhân viên quản lý đơn'))
        )`
  );
  const tieuDe = `${donHang.tenKhachHang} vừa đặt đơn #${donHang.maDH}`.slice(0, 150);
  const noiDung = `${donHang.sdtKhachHang || 'Không có số điện thoại'} · ${Number(donHang.tongTien || 0).toLocaleString('vi-VN')} đ · ${donHang.soMatHang || 0} món`;
  for (const { maTK } of nhan) {
    await db.run(
      `INSERT INTO THONGBAONOIBO (maTK, maDH, tieuDe, noiDung, daDoc, ngayTao)
       VALUES (:maTK, :maDH, :tieuDe, :noiDung, FALSE, :ngayTao)
       ON CONFLICT (maTK, maDH) DO NOTHING`,
      { maTK, maDH: donHang.maDH, tieuDe, noiDung, ngayTao: nowSql() }
    );
  }
}

async function tomTat(maTK, soLuong = 8) {
  const [chuaDoc, moiNhat] = await Promise.all([
    db.scalar('SELECT COUNT(*) FROM THONGBAONOIBO WHERE maTK = :maTK AND daDoc = FALSE', { maTK }),
    db.all(
      `SELECT maTBNB, maTK, maDH, tieuDe, noiDung, daDoc, ngayTao
         FROM THONGBAONOIBO WHERE maTK = :maTK
        ORDER BY ngayTao DESC, maTBNB DESC LIMIT :soLuong`,
      { maTK, soLuong: Math.max(1, Math.min(20, Number(soLuong) || 8)) }
    ),
  ]);
  return { chuaDoc: Number(chuaDoc || 0), moiNhat: moiNhat.map((tin) => ({ ...tin, loai: 'Đơn hàng' })) };
}

async function danhDauDaDoc(maTK, maTBNB) {
  const row = await db.get(
    'SELECT maTBNB FROM THONGBAONOIBO WHERE maTK = :maTK AND maTBNB = :maTBNB',
    { maTK, maTBNB }
  );
  if (!row) throw notFound('Không tìm thấy thông báo nội bộ.');
  await db.run('UPDATE THONGBAONOIBO SET daDoc = TRUE WHERE maTK = :maTK AND maTBNB = :maTBNB', { maTK, maTBNB });
  return { maTBNB };
}

async function danhDauTatCaDaDoc(maTK) {
  const result = await db.run('UPDATE THONGBAONOIBO SET daDoc = TRUE WHERE maTK = :maTK AND daDoc = FALSE', { maTK });
  return { soLuong: Number(result?.changes ?? 0) };
}

module.exports = { thongBaoDonMoi, tomTat, danhDauDaDoc, danhDauTatCaDaDoc };
