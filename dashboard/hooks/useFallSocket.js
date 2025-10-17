// /src/hooks/useFallSocket.js
"use client";

import { useEffect, useRef, useState } from "react";
import { getSocket } from "@/lib/socket";

export function useFallSocket(deviceId) {
	const [connected, setConnected] = useState(false);
	const [inference, setInference] = useState(null);
	const prevRoomRef = useRef(null);

	useEffect(() => {
		if (!deviceId) return;

		const s = getSocket();

		const join = (room) => {
			if (prevRoomRef.current && prevRoomRef.current !== room) {
				s.emit("leaveDevice", prevRoomRef.current);
			}
			// Try both event names for compatibility with your server
			s.emit("joinDevice", room);
			s.emit("join", room);
			prevRoomRef.current = room;
		};

		const onConnect = () => {
			setConnected(true);
			join(deviceId);
		};

		const onDisconnect = () => setConnected(false);
		const onReconnect = () => join(deviceId);

		const onInference = (payload) => {
			if (payload && payload.deviceId === deviceId) {
				setInference(payload); // { deviceId, fallProb, isFall, ts }
			}
		};

		s.on("connect", onConnect);
		s.on("disconnect", onDisconnect);
		s.io.on("reconnect", onReconnect);
		s.on("inference", onInference);

		// initial join
		join(deviceId);

		return () => {
			s.emit("leaveDevice", deviceId);
			s.off("connect", onConnect);
			s.off("disconnect", onDisconnect);
			s.io.off("reconnect", onReconnect);
			s.off("inference", onInference);
		};
	}, [deviceId]);

	return { connected, inference };
}
