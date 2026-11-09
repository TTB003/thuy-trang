'use strict';

const os = require('node:os');

// Some managed Windows shells cannot resolve the current user through libuv.
try {
  os.userInfo();
} catch {
  os.userInfo = () => ({
    username: process.env.USERNAME || 'windows-user',
    uid: -1,
    gid: -1,
    shell: '',
  });
}

require('@capacitor/cli/bin/capacitor');
