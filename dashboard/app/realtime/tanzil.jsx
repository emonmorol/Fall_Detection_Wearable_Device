"use client";
import { useEffect, useState } from "react";
import {
	Radio,
	Heart,
	Activity,
	Wifi,
	WifiOff,
	Monitor,
	TrendingUp,
	Zap,
	CircleDot,
	ChevronDown,
	History,
} from "lucide-react";

import { useDeviceSocket } from "../../lib/socket";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Table } from "@/components/ui/table";

export default function RealtimePage() {
	const [devices, setDevices] = useState([]);
	const [deviceId, setDeviceId] = useState("");
	const [loading, setLoading] = useState(true);
	const [expanded, setExpanded] = useState(false);
	const [history, setHistory] = useState([]);
	const { connected, last } = useDeviceSocket(deviceId);

	useEffect(() => {
		(async () => {
			try {
				setLoading(true);
				const d = await api("/api/devices");
				setDevices(d.devices || []);
				console.log("devices:", d);
				if (d.devices?.[0]) setDeviceId(d.devices[0].deviceId);
			} finally {
				setLoading(false);
			}
		})();
	}, []);

	useEffect(() => {
		if (!deviceId) {
			setHistory([]);
			return;
		}
		let cancelled = false;
		(async () => {
			try {
				const res = await api(
					`/api/readings/recent?deviceId=${deviceId}&limit=10`
				);
				if (cancelled) return;
				const items = (res.items || [])
					.filter((item) => item?.ts)
					.sort((a, b) => new Date(b.ts) - new Date(a.ts))
					.slice(0, 10)
					.map((item) => normalizeReading(item));
				setHistory(items);
			} catch (error) {
				console.error("Failed to load reading history", error);
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [deviceId]);

	useEffect(() => {
		if (!last || !deviceId || last.deviceId !== deviceId) return;
		setHistory((prev) => {
			const incoming = normalizeReading(last);
			const withoutDup = prev.filter(
				(item) => item.tsIso !== incoming.tsIso
			);
			return [incoming, ...withoutDup].slice(0, 10);
		});
	}, [last, deviceId]);

	const toggleExpanded = () => setExpanded((prev) => !prev);

	const latestUpdateTs = history[0]?.tsIso ?? last?.ts ?? null;

	function normalizeReading(reading) {
		const tsIso = reading?.ts
			? new Date(reading.ts).toISOString()
			: new Date().toISOString();
		return {
			tsIso,
			hr: typeof reading?.hr === "number" ? reading.hr : "--",
			spo2: typeof reading?.spo2 === "number" ? reading.spo2 : "--",
		};
	}

	function formatTimestamp(ts) {
		const date = new Date(ts);
		if (Number.isNaN(date.getTime())) return "--";
		const hour = date.toLocaleTimeString([], {
			hour: "2-digit",
			minute: "2-digit",
			hour12: false,
		});
		const day = date.toLocaleDateString([], { day: "2-digit" });
		const month = date.toLocaleDateString([], { month: "short" });
		return `${hour} ${day} - ${month}`;
	}

	if (loading) {
		return (
			<div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-4">
				<div className="mx-auto space-y-6">
					<div className="flex items-center space-x-3">
						<div className="w-8 h-8 bg-gradient-to-r from-green-500 to-emerald-600 rounded-lg animate-pulse"></div>
						<div className="h-8 bg-gray-200 rounded-lg w-32 animate-pulse"></div>
					</div>
					<div className="bg-white rounded-xl p-4 shadow-sm">
						<div className="h-10 bg-gray-200 rounded-lg w-48 animate-pulse"></div>
					</div>
					<div className="grid md:grid-cols-2 gap-4">
						{[...Array(2)].map((_, i) => (
							<div
								key={i}
								className="bg-white rounded-xl p-8 shadow-sm animate-pulse"
							>
								<div className="h-6 bg-gray-200 rounded w-24 mb-4"></div>
								<div className="h-16 bg-gray-200 rounded w-32"></div>
							</div>
						))}
					</div>
				</div>
			</div>
		);
	}

	const selectedDevice = devices.find((d) => d.deviceId === deviceId);

	return (
		<div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-4">
			<div className="mx-auto space-y-4">
				{/* Header */}
				<div className="flex items-center justify-between">
					<div className="flex items-center space-x-4">
						<div className="w-10 h-10 bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg">
							<Radio className="w-5 h-5 text-white" />
						</div>
						<div>
							<h1 className="text-3xl font-bold bg-gradient-to-r from-slate-900 to-slate-600 bg-clip-text text-transparent">
								Realtime Monitoring
							</h1>
							<p className="text-slate-500 text-sm mt-1">
								Live patient vitals and device status
							</p>
						</div>
					</div>

					{/* Connection Status Indicator */}
					<div className="flex items-center space-x-3">
						<div
							className={`flex items-center space-x-2 px-4 py-2 rounded-full border transition-all duration-300 ${
								connected
									? "bg-green-50 border-green-200 text-green-700"
									: "bg-red-50 border-red-200 text-red-700"
							}`}
						>
							{connected ? (
								<Wifi className="w-4 h-4" />
							) : (
								<WifiOff className="w-4 h-4" />
							)}
							<span className="text-sm font-medium">
								{connected ? "Live Connection" : "Disconnected"}
							</span>
							{connected && (
								<div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
							)}
						</div>
					</div>
				</div>

				{/* Device Selection */}
				<div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
					<div className="flex items-center justify-between mb-4">
						<div className="flex items-center space-x-3">
							<Monitor className="w-5 h-5 text-slate-600" />
							<h2 className="text-lg font-semibold text-slate-900">
								Device Selection
							</h2>
						</div>
						{selectedDevice && (
							<div className="text-sm text-slate-500 flex items-center space-x-2">
								<CircleDot className="w-4 h-4 text-blue-500" />
								<span>Active: {selectedDevice.name}</span>
							</div>
						)}
					</div>

					<div className="relative">
						<select
							className="w-full md:w-96 appearance-none bg-gradient-to-r from-slate-50 to-blue-50 border border-slate-200 rounded-xl px-4 py-3 pr-10 text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 hover:shadow-md"
							value={deviceId}
							onChange={(e) => setDeviceId(e.target.value)}
						>
							<option value="">Select a device...</option>
							{devices.map((d) => (
								<option key={d.deviceId} value={d.deviceId}>
									{d.name} ({d.deviceId})
								</option>
							))}
						</select>
						<ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
					</div>
				</div>

				{/* Vitals Display */}
				{deviceId ? (
					<div className="grid md:grid-cols-2 gap-8">
						<VitalsTile
							title="Heart Rate"
							value={last?.hr ?? "--"}
							unit="bpm"
							icon={<Heart className="w-6 h-6" />}
							color="from-red-500 to-pink-600"
							bgColor="bg-red-50"
							isNormal={
								last?.hr
									? last.hr >= 60 && last.hr <= 100
									: null
							}
							trend={connected ? "Live" : "No Data"}
						/>
						<VitalsTile
							title="Blood Oxygen"
							value={last?.spo2 ?? "--"}
							unit="%"
							icon={<Activity className="w-6 h-6" />}
							color="from-blue-500 to-indigo-600"
							bgColor="bg-blue-50"
							isNormal={last?.spo2 ? last.spo2 >= 95 : null}
							trend={connected ? "Live" : "No Data"}
						/>
					</div>
				) : (
					<div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-12">
						<div className="text-center">
							<Monitor className="w-16 h-16 mx-auto text-slate-300 mb-4" />
							<h3 className="text-xl font-semibold text-slate-600 mb-2">
								No Device Selected
							</h3>
							<p className="text-slate-500">
								Please select a device from the dropdown above
								to start monitoring.
							</p>
						</div>
					</div>
				)}

				{/* Device Info */}
				{deviceId && selectedDevice && (
					<div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
						<div className="flex items-center justify-between">
							<div>
								<h3 className="text-lg font-semibold text-slate-900 mb-1">
									{selectedDevice.name}
								</h3>
								<p className="text-slate-500 text-sm">
									Device ID: {selectedDevice.deviceId}
								</p>
							</div>
							<div className="flex items-center space-x-4 text-sm">
								<div className="flex items-center space-x-2">
									<Zap className="w-4 h-4 text-green-500" />
									<span className="text-slate-600">
										Active
									</span>
								</div>
								<div className="flex items-center space-x-2">
									<Activity className="w-4 h-4 text-blue-500" />
									<span className="text-slate-600">
										{latestUpdateTs
											? `Updated ${new Date(
													latestUpdateTs
											  ).toLocaleTimeString()}`
											: "Waiting for data..."}
									</span>
								</div>
							</div>
						</div>
					</div>
				)}

				{/* History Dropdown */}
				{deviceId && (
					<div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 space-y-5">
						<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
							<div className="flex items-center space-x-3">
								<div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg flex-shrink-0">
									<History className="w-5 h-5" />
								</div>
								<div>
									<h3 className="text-lg font-semibold text-slate-900">
										Recent Readings Timeline
									</h3>
									<p className="text-sm text-slate-500">
										Live backlog of the latest 10 readings
									</p>
								</div>
							</div>
							<Button
								variant="outline"
								onClick={toggleExpanded}
								className="group flex items-center gap-2 rounded-xl border-slate-200 bg-gradient-to-r from-slate-50 to-blue-50 px-4 py-2 font-medium text-slate-700 transition-all duration-300 hover:shadow-md sm:flex-shrink-0"
								aria-expanded={expanded}
								aria-controls="history-table"
							>
								<span>
									{expanded ? "Hide" : "Show"} History
								</span>
								<ChevronDown
									className={`h-4 w-4 transition-transform duration-300 ${
										expanded ? "rotate-180" : ""
									}`}
								/>
							</Button>
						</div>
						<div
							id="history-table"
							className={`transition-all duration-500 ease-in-out ${
								expanded
									? "max-h-[600px] opacity-100 translate-y-0"
									: "pointer-events-none -translate-y-3 max-h-0 opacity-0"
							}`}
						>
							<div className="overflow-hidden rounded-xl border border-slate-200 shadow-sm bg-slate-50/50">
								<div className="relative max-h-[500px] overflow-y-auto overflow-x-hidden">
									<table className="w-full text-sm">
										<thead className="sticky top-0 z-30 bg-gradient-to-b from-slate-100 to-slate-50 backdrop-blur-sm border-b-2 border-slate-200">
											<tr>
												<th className="w-[30%] px-5 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-700">
													Heart Rate
													<span className="block text-[10px] font-normal text-slate-500 normal-case mt-0.5">
														bpm
													</span>
												</th>
												<th className="w-[30%] px-5 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-700">
													SpO₂
													<span className="block text-[10px] font-normal text-slate-500 normal-case mt-0.5">
														%
													</span>
												</th>
												<th className="w-[40%] px-5 py-4 text-right text-xs font-bold uppercase tracking-wider text-slate-700">
													Timestamp
												</th>
											</tr>
										</thead>
										<tbody className="bg-white divide-y divide-slate-100">
											{history.length ? (
												history.map((entry, index) => (
													<tr
														key={`${entry.tsIso}-${index}`}
														className="group transition-all duration-200 hover:bg-indigo-50/60 hover:shadow-sm"
													>
														<td className="w-[30%] px-5 py-4 text-left">
															<span className="text-lg font-bold text-slate-800 group-hover:text-indigo-700">
																{entry.hr}
															</span>
														</td>
														<td className="w-[30%] px-5 py-4 text-left">
															<span className="text-lg font-bold text-slate-800 group-hover:text-indigo-700">
																{entry.spo2}
															</span>
														</td>
														<td className="w-[40%] px-5 py-4 text-right">
															<span className="font-mono text-xs text-slate-600 group-hover:text-slate-800">
																{formatTimestamp(
																	entry.tsIso
																)}
															</span>
														</td>
													</tr>
												))
											) : (
												<tr>
													<td
														colSpan={3}
														className="px-5 py-8 text-center text-sm text-slate-500"
													>
														<div className="flex flex-col items-center gap-2">
															<Activity className="w-8 h-8 text-slate-300" />
															<span>
																No readings
																received yet for
																this device.
															</span>
														</div>
													</td>
												</tr>
											)}
										</tbody>
									</table>
								</div>
							</div>
						</div>
					</div>
				)}
			</div>
		</div>
	);
}

function VitalsTile({
	title,
	value,
	unit,
	icon,
	color,
	bgColor,
	isNormal,
	trend,
}) {
	return (
		<div
			className={`group relative bg-white rounded-2xl p-8 shadow-sm border border-slate-200 hover:shadow-lg transition-all duration-300 overflow-hidden ${bgColor}`}
		>
			{/* Background gradient effect */}
			<div
				className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl ${color} opacity-10 rounded-full blur-3xl group-hover:opacity-20 transition-opacity`}
			></div>

			<div className="relative z-10">
				<div className="flex items-center justify-between mb-6">
					<div
						className={`w-12 h-12 bg-gradient-to-r ${color} rounded-xl flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform`}
					>
						{icon}
					</div>

					{/* Status Indicator */}
					<div className="flex items-center space-x-2">
						{isNormal !== null && (
							<div
								className={`flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium ${
									isNormal
										? "bg-green-100 text-green-700"
										: "bg-orange-100 text-orange-700"
								}`}
							>
								<div
									className={`w-1.5 h-1.5 rounded-full ${
										isNormal
											? "bg-green-500"
											: "bg-orange-500"
									}`}
								></div>
								<span>{isNormal ? "Normal" : "Alert"}</span>
							</div>
						)}
					</div>
				</div>

				<div className="space-y-2">
					<p className="text-sm font-medium text-slate-500 uppercase tracking-wider">
						{title}
					</p>
					<div className="flex items-baseline space-x-2">
						<span className="text-5xl font-bold text-slate-900 group-hover:text-slate-700 transition-colors">
							{value}
						</span>
						<span className="text-xl text-slate-500 font-medium">
							{unit}
						</span>
					</div>

					<div className="flex items-center space-x-2 pt-2">
						<TrendingUp className="w-4 h-4 text-slate-400" />
						<span className="text-sm text-slate-500">{trend}</span>
						{trend === "Live" && (
							<div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}
