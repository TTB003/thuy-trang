'use strict';

const path = require('node:path');
const { spawnSync } = require('node:child_process');

const androidDir = path.join(__dirname, '..', 'android');
const mobileDir = path.join(__dirname, '..');
const projectDir = path.resolve(mobileDir, '..');
const wrapperJar = path.join('gradle', 'wrapper', 'gradle-wrapper.jar');
const userProfile = process.env.USERPROFILE || process.env.HOME;
const gradleUserHome = process.env.GRADLE_USER_HOME || path.join(userProfile, '.gradle');
const sdkPath = process.env.ANDROID_SDK_ROOT || process.env.ANDROID_HOME ||
  (process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'Android', 'Sdk') : null);

if (sdkPath && !process.env.ANDROID_SDK_ROOT && !process.env.ANDROID_HOME) {
  const escapedSdkPath = sdkPath.replace(/\\/g, '\\\\');
  require('node:fs').writeFileSync(
    path.join(androidDir, 'local.properties'),
    `sdk.dir=${escapedSdkPath}\n`,
    'utf8'
  );
}

const result = spawnSync('java', ['-jar', wrapperJar, 'assembleDebug'], {
  cwd: androidDir,
  env: { ...process.env, GRADLE_USER_HOME: gradleUserHome },
  stdio: 'inherit',
  windowsHide: true,
});

if (result.error) {
  console.error(`Không chạy được Gradle: ${result.error.message}`);
  process.exit(1);
}
if (result.status !== 0) process.exit(result.status ?? 1);

const apkPath = path.join(androidDir, 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');
const publicDownloads = path.join(projectDir, 'public', 'downloads');
require('node:fs').mkdirSync(publicDownloads, { recursive: true });
require('node:fs').copyFileSync(apkPath, path.join(mobileDir, 'coffee-crm-mobile.apk'));
require('node:fs').copyFileSync(apkPath, path.join(publicDownloads, 'Coffee-uohp.apk'));
console.log('Đã cập nhật APK tải về tại public/downloads/Coffee-uohp.apk');
