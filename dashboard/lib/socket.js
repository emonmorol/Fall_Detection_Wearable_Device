"use client";
import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";

export function useDeviceSocket(deviceId) {
	const [connected, setConnected] = useState(false);
	const [last, setLast] = useState(null);
	const sockRef = useRef(null);

	useEffect(() => {
		if (!deviceId) return;
		const s = io(process.env.NEXT_PUBLIC_SOCKET_URL, {
			withCredentials: true,
			transports: ["websocket"],
			reconnectionDelayMax: 5000,
		});
		sockRef.current = s;

		s.on("connect", () => setConnected(true));
		s.on("disconnect", () => setConnected(false));
		s.emit("joinDevice", deviceId);
		s.on("reading", (p) => {
			if (p.deviceId === deviceId) setLast(p);
		});

		return () => {
			s.emit("joinDevice", "");
			s.disconnect();
		};
	}, [deviceId]);

	return { connected, last };
}
