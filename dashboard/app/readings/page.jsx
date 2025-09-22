"use client";
import { useEffect, useState } from "react";
import { api } from "../../lib/api";

export default function ReadingsPage() {
	const [deviceId, setDeviceId] = useState("");
	const [devices, setDevices] = useState([]);
	const [items, setItems] = useState([]);

	useEffect(() => {
		(async () => {
			const d = await api("/api/devices");
			setDevices(d.devices || []);
			console.log("devices:", d);
			const r = await api("/api/readings/recent?limit=20");
			console.log("readings:", r);
			setItems(r.items || []);
		})();
	}, []);

	async function filterDevice(id) {
		setDeviceId(id);
		const r = await api(
			`/api/readings/recent?limit=20${id ? `&deviceId=${id}` : ""}`
		);
		setItems(r.items || []);
	}

	return (
		<div className="space-y-4">
			<h1 className="text-xl font-semibold">Readings</h1>
			<div className="flex gap-2">
				<select
					className="border rounded px-2 py-1"
					value={deviceId}
					onChange={(e) => filterDevice(e.target.value)}
				>
					<option value="">All devices</option>
					{devices.map((d) => (
						<option key={d.deviceId} value={d.deviceId}>
							{d.name} ({d.deviceId})
						</option>
					))}
				</select>
			</div>
			<div className="grid md:grid-cols-2 gap-3">
				{items.map((x, i) => (
					<div key={i} className="rounded border p-4">
						<div className="text-xs text-muted-foreground font-mono">
							{x.deviceId} · {new Date(x.ts).toLocaleString()}
						</div>
						<div className="text-lg">
							HR {x.hr} · SpO₂ {x.spo2}
						</div>
						<div className="text-xs text-muted-foreground">
							flags:{" "}
							{Object.entries(x.flags || {})
								.filter(([_, v]) => v)
								.map(([k]) => k)
								.join(", ") || "none"}
						</div>
					</div>
				))}
			</div>
		</div>
	);
}
