"use client";
import React, { useEffect, useState } from "react";
import { api } from "../lib/api"; // adjust import path if needed

export default function OverviewPage() {
	const [kpi, setKpi] = useState({});
	const [recentR, setRecentR] = useState([]);
	const [recentA, setRecentA] = useState([]);
	const [err, setErr] = useState("");

	useEffect(() => {
		(async () => {
			try {
				const s = await api("/api/stats/overview?range=24h");
				setKpi(s.kpi || {});
				console.log("stats:", s);
				const r = await api("/api/readings/recent?limit=5");
				setRecentR(r.items || []);
				console.log("readings:", r);
				const a = await api("/api/alerts/recent?limit=5");
				setRecentA(a.items || []);
				console.log("alerts:", a);
			} catch (e) {
				setErr(String(e.message || e));
			}
		})();
	}, []);

	return (
		<div className="space-y-6">
			<h1 className="text-xl font-semibold">Overview</h1>
			{err && <p className="text-red-500 text-sm">{err}</p>}

			{/* KPI row */}
			<div className="grid grid-cols-2 md:grid-cols-4 gap-3">
				<Kpi title="Active Devices" value={kpi.activeDevices ?? "--"} />
				<Kpi title="Readings (24h)" value={kpi.readings24h ?? "--"} />
				<Kpi title="Alerts (24h)" value={kpi.alerts24h ?? "--"} />
				<Kpi title="Min SpO₂ (24h)" value={kpi.minSpO2 ?? "--"} />
			</div>

			{/* Recent */}
			<div className="grid md:grid-cols-2 gap-6">
				<section>
					<h2 className="font-medium mb-2">Recent Readings</h2>
					<ul className="space-y-2">
						{recentR.map((x, i) => (
							<li key={i} className="rounded border p-3 text-sm">
								<div className="font-mono text-xs text-muted-foreground">
									{x.deviceId} ·{" "}
									{new Date(x.ts).toLocaleString()}
								</div>
								<div>
									HR: {x.hr} · SpO₂: {x.spo2}
								</div>
								<div className="text-xs text-muted-foreground">
									flags:{" "}
									{Object.entries(x.flags || {})
										.filter(([_, v]) => v)
										.map(([k]) => k)
										.join(", ") || "none"}
								</div>
							</li>
						))}
					</ul>
				</section>
				<section>
					<h2 className="font-medium mb-2">Recent Alerts</h2>
					<ul className="space-y-2">
						{recentA.map((a) => (
							<li
								key={a._id}
								className="rounded border p-3 text-sm"
							>
								<div className="font-mono text-xs text-muted-foreground">
									{a.deviceId} ·{" "}
									{new Date(a.ts).toLocaleString()}
								</div>
								<div>
									Rule: {a.rule} · Value: {a.value}
								</div>
							</li>
						))}
					</ul>
				</section>
			</div>
		</div>
	);
}

function Kpi({ title, value }) {
	return (
		<div className="rounded border p-4">
			<div className="text-xs text-muted-foreground">{title}</div>
			<div className="text-2xl font-semibold">{value}</div>
		</div>
	);
}
