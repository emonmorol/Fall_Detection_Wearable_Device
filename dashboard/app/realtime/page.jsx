"use client";
import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { useDeviceSocket } from "../../lib/socket";

export default function RealtimePage() {
	const [devices, setDevices] = useState([]);
	const [deviceId, setDeviceId] = useState("");
	const { connected, last } = useDeviceSocket(deviceId);

	useEffect(() => {
		(async () => {
			const d = await api("/api/devices");
			setDevices(d.devices || []);
			console.log("devices:", d);
			if (d.devices?.[0]) setDeviceId(d.devices[0].deviceId);
		})();
	}, []);

	return (
		<div className="space-y-4">
			<h1 className="text-xl font-semibold">Realtime</h1>
			<div className="flex gap-2 items-center">
				<select
					className="border rounded px-2 py-1"
					value={deviceId}
					onChange={(e) => setDeviceId(e.target.value)}
				>
					{devices.map((d) => (
						<option key={d.deviceId} value={d.deviceId}>
							{d.name} ({d.deviceId})
						</option>
					))}
				</select>
				<span
					className={`text-sm ${
						connected ? "text-emerald-500" : "text-red-500"
					}`}
				>
					{connected ? "Connected" : "Disconnected"}
				</span>
			</div>
			<div className="grid md:grid-cols-2 gap-3">
				<Tile title="Heart Rate" value={last?.hr ?? "--"} unit="bpm" />
				<Tile title="SpO₂" value={last?.spo2 ?? "--"} unit="%" />
			</div>
		</div>
	);
}

function Tile({ title, value, unit }) {
	return (
		<div className="rounded border p-4">
			<div className="text-xs text-muted-foreground">{title}</div>
			<div className="text-3xl font-semibold">
				{value}{" "}
				<span className="text-base text-muted-foreground">{unit}</span>
			</div>
		</div>
	);
}
