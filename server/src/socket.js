module.exports = (io) => {
	io.on("connection", (socket) => {
		socket.on("joinDevice", (deviceId) => {
			socket.join(deviceId);
		});
	});
};
