import dotenv from 'dotenv';
import http from 'node:http';
import { Server as IOServer } from 'socket.io';
import initMongo from './loaders/db.js';
import buildExpress from './loaders/express.js';
import config from './config.js';

// Connect Mongo first
dotenv.config();
await initMongo(config.mongoUri);

// HTTP + Socket.IO
const server = http.createServer();
const io = new IOServer(server, {
  cors: { origin: config.dashboardOrigin, credentials: true },
});

// Express app (mounted onto same server)
const app = buildExpress(io);
server.on('request', app);
// Socket handlers
io.on('connection', (socket) => {
  socket.on('joinDevice', (deviceId) => socket.join(deviceId));
});

const port = config.port || 8080;
server.listen(port, () => console.log(`Server started on port :${port}`));
