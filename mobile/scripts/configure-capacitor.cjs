'use strict';

const fs = require('node:fs');
const path = require('node:path');

const configPath = path.join(__dirname, '..', 'capacitor.config.json');
const webDir = path.join(__dirname, '..', 'www');
const publicDir = path.join(__dirname, '..', '..', 'public');
fs.mkdirSync(webDir, { recursive: true });
fs.cpSync(publicDir, webDir, {
  recursive: true,
  force: true,
  filter: (source) => !source.split(path.sep).includes('downloads'),
});
const config = {
  appId: 'vn.edu.sgu.coffeecrm',
  appName: 'Coffee👓uoHP',
  webDir: 'www',
};

const rawServerUrl = process.env.COFFEE_CRM_SERVER_URL?.trim();
if (rawServerUrl) {
  let serverUrl;
  try {
    serverUrl = new URL(rawServerUrl);
  } catch {
    console.error('COFFEE_CRM_SERVER_URL phải là địa chỉ http:// hoặc https:// hợp lệ.');
    process.exit(1);
  }
  if (!['http:', 'https:'].includes(serverUrl.protocol) || serverUrl.username || serverUrl.password) {
    console.error('Địa chỉ server chỉ hỗ trợ http:// hoặc https:// và không được chứa thông tin đăng nhập.');
    process.exit(1);
  }
  config.server = {
    cleartext: serverUrl.protocol === 'http:',
  };
  fs.writeFileSync(
    path.join(webDir, 'server-config.js'),
    `window.COFFEE_CRM_SERVER_URL = ${JSON.stringify(serverUrl.origin)};\n`,
    'utf8'
  );
  fs.writeFileSync(
    path.join(webDir, 'mobile-config.js'),
    `window.COFFEE_CRM_API_URL = ${JSON.stringify(serverUrl.origin)};\n`,
    'utf8'
  );
} else {
  fs.writeFileSync(
    path.join(webDir, 'server-config.js'),
    "window.COFFEE_CRM_SERVER_URL = '';\n",
    'utf8'
  );
  fs.writeFileSync(path.join(webDir, 'mobile-config.js'), "window.COFFEE_CRM_API_URL = '';\n", 'utf8');
}

fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
console.log(`Capacitor config: ${rawServerUrl ? new URL(rawServerUrl).origin : 'chưa cấu hình server URL'}`);
if (rawServerUrl && new URL(rawServerUrl).protocol === 'http:') {
  console.warn('Đang dùng HTTP; chỉ nên thử trong mạng tin cậy. Bản dùng bên ngoài nên cấu hình HTTPS.');
}
