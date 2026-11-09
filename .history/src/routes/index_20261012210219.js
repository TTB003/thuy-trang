/**
 * Tập hợp toàn bộ route API của hệ thống.
 */
'use strict';

const { Router } = require('../core/router');

/** Tạo router đã đăng ký đầy đủ các nhóm API. */
function buildRouter() {
  const router = new Router();

  require('./auth.routes').register(router);
  require('./catalog.routes').register(router);
  require('./people.routes').register(router);
  require('./sales.routes').register(router);
  require('./crm.routes').register(router);
  require('./report.routes').register(router);
  require('./admin.routes').register(router);

  return router;
}

module.exports = { buildRouter };
