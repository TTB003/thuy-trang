const net = require('node:net');

const host = process.argv[2] || '127.0.0.1';
const port = Number(process.argv[3] || 5432);

const socket = net.createConnection({ host, port });
const ketThuc = (message) => {
  console.log(message);
  socket.destroy();
  process.exit(0);
};

socket.setTimeout(3000);
socket.on('connect', () => ketThuc('TCP_OPEN: có tiến trình đang lắng nghe cổng ' + port));
socket.on('timeout', () => ketThuc('TCP_TIMEOUT: không kết nối được cổng ' + port));
socket.on('error', (error) => ketThuc('TCP_ERROR: ' + error.message));
