// src/lib/socket.js
import { io } from "socket.io-client";

let _socket = null;

export function getSocket() {
	if (_socket) return _socket;

	// Prefer explicit socket URL, else fall back to API base or same-origin
	const base =
		process.env.NEXT_PUBLIC_SOCKET_URL ||
		process.env.NEXT_PUBLIC_API_BASE ||
		"";

	_socket = io(base, {
		transports: ["websocket"],
		withCredentials: true,
		reconnectionDelayMax: 5000,
	});

	return _socket;
}
