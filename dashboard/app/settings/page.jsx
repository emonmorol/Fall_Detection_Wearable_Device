"use client";
import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function SettingsPage() {
	const [devices, setDevices] = useState([]);
	const [name, setName] = useState("");

	async function load() {
		const d = await api("/api/devices");
		setDevices(d.devices || []);
		console.log("devices:", d);
	}
	useEffect(() => {
		load();
	}, []);

	async function registerDevice(e) {
		e.preventDefault();
		await api("/api/devices/register", { method: "POST", body: { name } });
		setName("");
		await load();
	}

	return (
		<div className="space-y-6">
			<h1 className="text-xl font-semibold">Settings</h1>
			<form onSubmit={registerDevice} className="flex gap-2">
				<Input
					placeholder="Device name"
					value={name}
					onChange={(e) => setName(e.target.value)}
				/>
				<Button type="submit">Register</Button>
			</form>

			<div className="grid md:grid-cols-2 gap-3">
				{devices.map((d) => (
					<div key={d.deviceId} className="rounded border p-4">
						<div className="font-medium">{d.name}</div>
						<div className="text-xs text-muted-foreground">
							{d.deviceId}
						</div>
						<div className="text-xs mt-1">
							{d.lastSeen && Date.now() - d.lastSeen < 30_000 ? (
								<span className="text-emerald-500">online</span>
							) : (
								<span className="text-muted-foreground">
									offline
								</span>
							)}
						</div>
					</div>
				))}
			</div>
		</div>
	);
}
