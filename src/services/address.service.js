'use strict';

const db = require('../db');
const { requiredText, optionalText, phone } = require('../core/validation');
const { notFound } = require('../core/errors');

async function listDiaChi(maKH) {
  return db.all(
    `SELECT maDC, maKH, tenGoiNho, diaChi, sdtNhanHang, laMacDinh, ngayTao
       FROM DIACHIGIAOHANG
      WHERE maKH = :maKH
      ORDER BY laMacDinh DESC, ngayTao DESC, maDC DESC`,
    { maKH }
  );
}

async function getDiaChi(maKH, maDC) {
  const row = await db.get(
    `SELECT maDC, maKH, tenGoiNho, diaChi, sdtNhanHang, laMacDinh, ngayTao
       FROM DIACHIGIAOHANG WHERE maKH = :maKH AND maDC = :maDC`,
    { maKH, maDC }
  );
  if (!row) throw notFound('Không tìm thấy địa chỉ giao hàng này.');
  return row;
}

async function chonDiaChi(maKH, maDC) {
  return db.transaction(async () => {
    const diaChi = await getDiaChi(maKH, maDC);
    await db.run('UPDATE DIACHIGIAOHANG SET laMacDinh = FALSE WHERE maKH = :maKH', { maKH });
    await db.run(
      'UPDATE DIACHIGIAOHANG SET laMacDinh = TRUE WHERE maKH = :maKH AND maDC = :maDC',
      { maKH, maDC }
    );
    await db.run('UPDATE KHACHHANG SET diaChi = :diaChi WHERE maKH = :maKH', {
      diaChi: diaChi.diaChi,
      maKH,
    });
    return getDiaChi(maKH, maDC);
  });
}

async function themDiaChi(maKH, payload = {}) {
  const tenGoiNho = optionalText(payload.tenGoiNho, 60) || 'Địa chỉ';
  const diaChi = requiredText(payload.diaChi, 'Địa chỉ giao hàng', 255);
  const sdtNhanHang = payload.sdtNhanHang ? phone(payload.sdtNhanHang) : null;

  return db.transaction(async () => {
    const diaChiTrung = await db.get(
      'SELECT maDC FROM DIACHIGIAOHANG WHERE maKH = :maKH AND diaChi = :diaChi',
      { maKH, diaChi }
    );
    await db.run('UPDATE DIACHIGIAOHANG SET laMacDinh = FALSE WHERE maKH = :maKH', { maKH });

    let maDC;
    if (diaChiTrung) {
      maDC = diaChiTrung.maDC;
      await db.run(
        `UPDATE DIACHIGIAOHANG
            SET tenGoiNho = :tenGoiNho, sdtNhanHang = :sdtNhanHang, laMacDinh = TRUE
          WHERE maKH = :maKH AND maDC = :maDC`,
        { tenGoiNho, sdtNhanHang, maKH, maDC }
      );
    } else {
      const result = await db.run(
        `INSERT INTO DIACHIGIAOHANG (maKH, tenGoiNho, diaChi, sdtNhanHang, laMacDinh)
         VALUES (:maKH, :tenGoiNho, :diaChi, :sdtNhanHang, TRUE)`,
        { maKH, tenGoiNho, diaChi, sdtNhanHang }
      );
      maDC = result.lastInsertRowid;
    }

    await db.run('UPDATE KHACHHANG SET diaChi = :diaChi WHERE maKH = :maKH', { diaChi, maKH });
    return getDiaChi(maKH, maDC);
  });
}

module.exports = { listDiaChi, getDiaChi, chonDiaChi, themDiaChi };
