module.exports = (io) => {
  io.on('connection', (socket) => {
    socket.on('joinDevice', (deviceId) => {
      socket.join(deviceId);
    });
    socket.on('leaveDevice', (deviceId) => socket.leave(deviceId));
  });
};
