// src/hooks/useDeviceSocket.js
"use client";

import { useEffect, useRef, useState } from "react";
import { getSocket } from "@/lib/socket";

export function useDeviceSocket(deviceId) {
	const [connected, setConnected] = useState(false);
	const [last, setLast] = useState(null);
	const prevRoomRef = useRef(null);

	useEffect(() => {
		if (!deviceId) return;

		const s = getSocket();

		const join = (room) => {
			if (prevRoomRef.current && prevRoomRef.current !== room) {
				s.emit("leaveDevice", prevRoomRef.current);
			}
			s.emit("joinDevice", room);
			prevRoomRef.current = room;
		};

		const onConnect = () => setConnected(true);
		const onDisconnect = () => setConnected(false);
		const onReconnect = () => join(deviceId);
		const onReading = (p) => {
			if (p && p.deviceId === deviceId) setLast(p);
		};

		s.on("connect", onConnect);
		s.on("disconnect", onDisconnect);
		s.io.on("reconnect", onReconnect); // re-join after reconnect
		s.on("reading", onReading);

		join(deviceId);

		return () => {
			s.emit("leaveDevice", deviceId);
			s.off("connect", onConnect);
			s.off("disconnect", onDisconnect);
			s.io.off("reconnect", onReconnect);
			s.off("reading", onReading);
		};
	}, [deviceId]);

	return { connected, last };
}
