module.exports = (io) => {
  io.on('connection', (socket) => {
    console.log('[Socket] client connected', socket.id);
    socket.on('joinDevice', (deviceId) => {
      socket.join(deviceId);
      console.log(`[Socket] joined room: ${deviceId}`);
    });
    socket.on('leaveDevice', (deviceId) => {
      socket.leave(deviceId);
      console.log(`[Socket] left room: ${deviceId}`);
    });
  });
};
