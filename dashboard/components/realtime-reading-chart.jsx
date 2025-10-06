// src/components/RealtimeReadingsChart.jsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
	ResponsiveContainer,
	LineChart,
	Line,
	XAxis,
	YAxis,
	Tooltip,
	Legend,
	CartesianGrid,
	Brush,
} from "recharts";
import {
	Activity,
	Droplet,
	Play,
	Pause,
	Settings2,
	Download,
	Calendar,
	Clock,
} from "lucide-react";
import { useDeviceSocket } from "@/hooks/useDeviceSocket";

function floorToBucket(date, bucket) {
	const ms = date.getTime();
	const size =
		bucket === "1h"
			? 3600e3
			: bucket === "15m"
			? 900e3
			: bucket === "5m"
			? 300e3
			: 60e3;
	const t = Math.floor(ms / size) * size;
	return new Date(t);
}

const CustomTooltip = ({ active, payload, label }) => {
	if (!active || !payload || !payload.length) return null;

	return (
		<div className="bg-slate-900/95 backdrop-blur-sm border border-slate-700 rounded-lg p-3 shadow-xl">
			<p className="text-slate-300 text-xs font-medium mb-2">{label}</p>
			{payload.map((entry, index) => (
				<div key={index} className="flex items-center gap-2 text-sm">
					<div
						className="w-2 h-2 rounded-full"
						style={{ backgroundColor: entry.color }}
					/>
					<span className="text-slate-200 font-medium">
						{entry.name}:
					</span>
					<span className="text-white font-semibold">
						{entry.value !== null ? entry.value.toFixed(1) : "N/A"}
					</span>
					<span className="text-slate-400 text-xs">
						{entry.dataKey === "hr" ? "bpm" : "%"}
					</span>
				</div>
			))}
		</div>
	);
};

export default function RealtimeReadingsChart({
	deviceId: propDeviceId = "all",
	range: propRange = "24h",
	bucket: propBucket = "1m",
	apiBase = "",
	live: propLive = false,
}) {
	const [data, setData] = useState([]);
	const [isLive, setIsLive] = useState(propLive);
	const [showHR, setShowHR] = useState(true);
	const [showSpO2, setShowSpO2] = useState(true);
	const [showControls, setShowControls] = useState(false);
	const [deviceId, setDeviceId] = useState(propDeviceId);
	const [bucket, setBucket] = useState(propBucket);

	// Custom time range
	const [timeMode, setTimeMode] = useState("preset"); // "preset" or "custom"
	const [presetRange, setPresetRange] = useState(propRange);
	const [customValue, setCustomValue] = useState("24");
	const [customUnit, setCustomUnit] = useState("hours");

	const { last } = useDeviceSocket(deviceId);

	// Calculate actual range based on mode
	const actualRange = useMemo(() => {
		if (timeMode === "preset") return presetRange;

		const value = parseInt(customValue) || 1;
		if (customUnit === "minutes") return `${value}m`;
		if (customUnit === "hours") return `${value}h`;
		if (customUnit === "days") return `${value}d`;
		return "24h";
	}, [timeMode, presetRange, customValue, customUnit]);

	// Calculate stats
	const stats = useMemo(() => {
		if (!data.length)
			return {
				hrAvg: 0,
				hrMin: 0,
				hrMax: 0,
				spo2Avg: 0,
				spo2Min: 0,
				spo2Max: 0,
			};

		const hrValues = data
			.filter((d) => d.hrAvg != null)
			.map((d) => d.hrAvg);
		const spo2Values = data
			.filter((d) => d.spo2Avg != null)
			.map((d) => d.spo2Avg);

		return {
			hrAvg: hrValues.length
				? hrValues.reduce((a, b) => a + b, 0) / hrValues.length
				: 0,
			hrMin: hrValues.length ? Math.min(...hrValues) : 0,
			hrMax: hrValues.length ? Math.max(...hrValues) : 0,
			spo2Avg: spo2Values.length
				? spo2Values.reduce((a, b) => a + b, 0) / spo2Values.length
				: 0,
			spo2Min: spo2Values.length ? Math.min(...spo2Values) : 0,
			spo2Max: spo2Values.length ? Math.max(...spo2Values) : 0,
		};
	}, [data]);

	// Calculate realistic max points based on bucket and range
	const getMaxPoints = (bucket, range) => {
		const bucketMinutes =
			bucket === "1h"
				? 60
				: bucket === "15m"
				? 15
				: bucket === "5m"
				? 5
				: 1;

		let rangeMinutes;
		if (range.endsWith("m")) {
			rangeMinutes = parseInt(range);
		} else if (range.endsWith("h")) {
			rangeMinutes = parseInt(range) * 60;
		} else if (range.endsWith("d")) {
			rangeMinutes = parseInt(range) * 24 * 60;
		} else {
			rangeMinutes = 24 * 60; // default 24h
		}

		return Math.ceil(rangeMinutes / bucketMinutes);
	};

	// Initial history fetch
	useEffect(() => {
		let alive = true;
		(async () => {
			try {
				const qs = new URLSearchParams({
					range: actualRange,
					bucket,
					deviceId,
				});
				const base =
					apiBase || process.env.NEXT_PUBLIC_API_BASE_URL || "";
				const res = await fetch(
					`${base}/api/readings/series?${qs.toString()}`,
					{ credentials: "include" }
				);
				const json = await res.json();
				if (!alive) return;
				const items = (json.items || []).map((x) => ({
					t: x.t,
					hrAvg: x.hrAvg ?? null,
					spo2Avg: x.spo2Avg ?? null,
					count: x.count ?? 0,
				}));
				setData(items);
			} catch (error) {
				console.error("Error fetching chart data:", error);
			}
		})();
		return () => {
			alive = false;
		};
	}, [deviceId, actualRange, bucket, apiBase]);

	// Live updates from hook
	useEffect(() => {
		if (!last || !isLive) return;
		const ts = new Date(last.ts);
		const bTime = floorToBucket(ts, bucket).toISOString();
		const hrValid = last.hr > 0;
		const spValid = last.spo2 > 0;

		setData((prev) => {
			let found = false;
			const next = prev.map((p) => {
				if (p.t === bTime) {
					found = true;
					const c = (p.count || 0) + 1;
					const hrAvg =
						hrValid && p.hrAvg != null
							? (p.hrAvg * (c - 1) + last.hr) / c
							: hrValid
							? last.hr
							: p.hrAvg;
					const spo2Avg =
						spValid && p.spo2Avg != null
							? (p.spo2Avg * (c - 1) + last.spo2) / c
							: spValid
							? last.spo2
							: p.spo2Avg;
					return { ...p, hrAvg, spo2Avg, count: c };
				}
				return p;
			});

			if (!found) {
				next.push({
					t: bTime,
					hrAvg: hrValid ? last.hr : null,
					spo2Avg: spValid ? last.spo2 : null,
					count: 1,
				});
				next.sort(
					(a, b) => new Date(a.t).getTime() - new Date(b.t).getTime()
				);
			}

			const maxPoints = getMaxPoints(bucket, actualRange);
			if (next.length > maxPoints)
				next.splice(0, next.length - maxPoints);
			return next;
		});
	}, [last, bucket, isLive, actualRange]);

	const formatted = useMemo(() => {
		return data.map((d) => {
			const date = new Date(d.t);
			const isToday = new Date().toDateString() === date.toDateString();

			return {
				time: date.toLocaleTimeString([], {
					hour: "2-digit",
					minute: "2-digit",
				}),
				fullTime: isToday
					? date.toLocaleTimeString([], {
							hour: "2-digit",
							minute: "2-digit",
					  })
					: `${date.toLocaleDateString([], {
							month: "short",
							day: "numeric",
					  })} ${date.toLocaleTimeString([], {
							hour: "2-digit",
							minute: "2-digit",
					  })}`,
				hr: showHR ? d.hrAvg ?? null : null,
				spo2: showSpO2 ? d.spo2Avg ?? null : null,
			};
		});
	}, [data, showHR, showSpO2]);

	const handleExport = () => {
		const csv = [
			["Timestamp", "Date", "Time", "Heart Rate (bpm)", "SpO₂ (%)"],
			...data.map((d) => {
				const date = new Date(d.t);
				return [
					date.toISOString(),
					date.toLocaleDateString(),
					date.toLocaleTimeString(),
					d.hrAvg?.toFixed(1) || "N/A",
					d.spo2Avg?.toFixed(1) || "N/A",
				];
			}),
		]
			.map((row) => row.join(","))
			.join("\n");

		const blob = new Blob([csv], { type: "text/csv" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `vitals-${new Date().toISOString().split("T")[0]}.csv`;
		a.click();
		URL.revokeObjectURL(url);
	};

	return (
		<Card className="overflow-hidden border-slate-200 shadow-sm pt-0 gap-0">
			{/* Header */}
			<div className="bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-200 p-4 md:p-6">
				<div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
					<div className="flex items-center gap-3">
						<div className="bg-blue-500 p-2 rounded-lg">
							<Activity className="w-5 h-5 text-white" />
						</div>
						<div>
							<h3 className="text-lg font-semibold text-slate-900">
								Realtime Vital Signs
							</h3>
							<p className="text-xs text-slate-600 mt-0.5">
								Live monitoring of heart rate and oxygen
								saturation
							</p>
						</div>
					</div>

					<div className="flex items-center gap-2">
						<Button
							variant="outline"
							size="sm"
							onClick={() => setIsLive(!isLive)}
							className={`gap-2 transition-all ${
								isLive
									? "bg-green-50 border-green-200 text-green-700 hover:bg-green-100"
									: "bg-slate-50"
							}`}
						>
							{isLive ? (
								<>
									<Pause className="w-4 h-4" />
									Pause
								</>
							) : (
								<>
									<Play className="w-4 h-4" />
									Resume
								</>
							)}
						</Button>
						<Button
							variant="outline"
							size="sm"
							onClick={() => setShowControls(!showControls)}
							className="gap-2"
						>
							<Settings2 className="w-4 h-4" />
							Controls
						</Button>
						<Button
							variant="outline"
							size="sm"
							onClick={handleExport}
							className="gap-2"
						>
							<Download className="w-4 h-4" />
							Export
						</Button>
					</div>
				</div>

				{/* Status Indicator */}
				{isLive && (
					<div className="flex items-center gap-2 mt-3 text-sm">
						<div className="flex items-center gap-1.5">
							<span className="relative flex h-2 w-2">
								<span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
								<span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
							</span>
							<span className="text-green-700 font-medium">
								Live
							</span>
						</div>
						<span className="text-slate-400">•</span>
						<span className="text-slate-600">
							{data.length} data points
						</span>
						<span className="text-slate-400">•</span>
						<span className="text-slate-600">
							Max: {getMaxPoints(bucket, actualRange)} points
						</span>
					</div>
				)}
			</div>

			{/* Controls Panel */}
			{showControls && (
				<div className="flex justify-center bg-slate-50 border-b border-slate-200 p-4">
					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
						{/* Time Range Control */}
						<div className="space-y-2 lg:col-span-2">
							<Label className="text-xs font-medium text-slate-700 flex items-center gap-1.5">
								<Clock className="w-3.5 h-3.5" />
								Time Range
							</Label>
							<div className="flex gap-2">
								<Select
									value={timeMode}
									onValueChange={setTimeMode}
								>
									<SelectTrigger className="bg-white w-32">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="preset">
											Preset
										</SelectItem>
										<SelectItem value="custom">
											Custom
										</SelectItem>
									</SelectContent>
								</Select>

								{timeMode === "preset" ? (
									<Select
										value={presetRange}
										onValueChange={setPresetRange}
									>
										<SelectTrigger className="bg-white flex-1">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="30m">
												Last 30 Minutes
											</SelectItem>
											<SelectItem value="1h">
												Last Hour
											</SelectItem>
											<SelectItem value="3h">
												Last 3 Hours
											</SelectItem>
											<SelectItem value="6h">
												Last 6 Hours
											</SelectItem>
											<SelectItem value="12h">
												Last 12 Hours
											</SelectItem>
											<SelectItem value="24h">
												Last 24 Hours
											</SelectItem>
											<SelectItem value="2d">
												Last 2 Days
											</SelectItem>
											<SelectItem value="7d">
												Last 7 Days
											</SelectItem>
										</SelectContent>
									</Select>
								) : (
									<div className="flex gap-2 flex-1">
										<Input
											type="number"
											min="1"
											max="365"
											value={customValue}
											onChange={(e) =>
												setCustomValue(e.target.value)
											}
											className="bg-white w-20"
											placeholder="24"
										/>
										<Select
											value={customUnit}
											onValueChange={setCustomUnit}
										>
											<SelectTrigger className="bg-white flex-1">
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="minutes">
													Minutes
												</SelectItem>
												<SelectItem value="hours">
													Hours
												</SelectItem>
												<SelectItem value="days">
													Days
												</SelectItem>
											</SelectContent>
										</Select>
									</div>
								)}
							</div>
						</div>

						{/* Bucket Size */}
						<div className="space-y-2">
							<Label className="text-xs font-medium text-slate-700 flex items-center gap-1.5">
								<Calendar className="w-3.5 h-3.5" />
								Data Interval
							</Label>
							<Select value={bucket} onValueChange={setBucket}>
								<SelectTrigger className="bg-white">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="1m">
										Every Minute
									</SelectItem>
									<SelectItem value="5m">
										Every 5 Minutes
									</SelectItem>
									<SelectItem value="15m">
										Every 15 Minutes
									</SelectItem>
									<SelectItem value="1h">
										Every Hour
									</SelectItem>
								</SelectContent>
							</Select>
						</div>

						{/* Display Options */}
						<div className="space-y-3">
							<Label className="text-xs font-medium text-slate-700">
								Display Metrics
							</Label>
							<div className="flex gap-3">
								<div className="flex items-center gap-2">
									<Switch
										id="show-hr"
										checked={showHR}
										onCheckedChange={setShowHR}
									/>
									<Label
										htmlFor="show-hr"
										className="text-sm cursor-pointer font-normal"
									>
										Heart Rate
									</Label>
								</div>
								<div className="flex items-center gap-2">
									<Switch
										id="show-spo2"
										checked={showSpO2}
										onCheckedChange={setShowSpO2}
									/>
									<Label
										htmlFor="show-spo2"
										className="text-sm cursor-pointer font-normal"
									>
										SpO₂
									</Label>
								</div>
							</div>
						</div>
					</div>
				</div>
			)}

			{/* Stats Cards */}
			<div className="w-full flex justify-center">
				<div className="w-full grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-white border-b border-slate-100">
					{showHR && (
						<>
							<div className="flex justify-center border rounded-lg p-2 shadow-md">
								<div className="space-y-1">
									<div className="flex items-center gap-1.5">
										<Activity className="w-3.5 h-3.5 text-red-500" />
										<p className="text-xs font-medium text-slate-600">
											Avg HR
										</p>
									</div>
									<p className="text-2xl font-bold text-slate-900">
										{stats.hrAvg.toFixed(0)}
										<span className="text-sm font-normal text-slate-500 ml-1">
											bpm
										</span>
									</p>
								</div>
							</div>
							<div className="flex justify-center border rounded-lg p-2 shadow-md">
								<div className="space-y-1">
									<p className="text-xs font-medium text-slate-600">
										HR Range
									</p>
									<p className="text-lg font-semibold text-slate-700">
										{stats.hrMin.toFixed(0)} -{" "}
										{stats.hrMax.toFixed(0)}
										<span className="text-xs font-normal text-slate-500 ml-1">
											bpm
										</span>
									</p>
								</div>
							</div>
						</>
					)}
					{showSpO2 && (
						<>
							<div className="flex justify-center border rounded-lg p-2 shadow-md">
								<div className="space-y-1">
									<div className="flex items-center gap-1.5">
										<Droplet className="w-3.5 h-3.5 text-blue-500" />
										<p className="text-xs font-medium text-slate-600">
											Avg SpO₂
										</p>
									</div>
									<p className="text-2xl font-bold text-slate-900">
										{stats.spo2Avg.toFixed(1)}
										<span className="text-sm font-normal text-slate-500 ml-1">
											%
										</span>
									</p>
								</div>
							</div>
							<div className="flex justify-center border rounded-lg p-2 shadow-md">
								<div className="space-y-1">
									<p className="text-xs font-medium text-slate-600">
										SpO₂ Range
									</p>
									<p className="text-lg font-semibold text-slate-700">
										{stats.spo2Min.toFixed(1)} -{" "}
										{stats.spo2Max.toFixed(1)}
										<span className="text-xs font-normal text-slate-500 ml-1">
											%
										</span>
									</p>
								</div>
							</div>
						</>
					)}
				</div>
			</div>

			{/* Chart */}
			<div className="p-4 md:p-6">
				<div className="h-80 md:h-96">
					{data.length > 0 ? (
						<ResponsiveContainer width="100%" height="100%">
							<LineChart
								data={formatted}
								margin={{
									top: 10,
									right: 30,
									left: 0,
									bottom: 0,
								}}
							>
								<defs>
									<linearGradient
										id="colorHr"
										x1="0"
										y1="0"
										x2="0"
										y2="1"
									>
										<stop
											offset="5%"
											stopColor="#ef4444"
											stopOpacity={0.1}
										/>
										<stop
											offset="95%"
											stopColor="#ef4444"
											stopOpacity={0}
										/>
									</linearGradient>
									<linearGradient
										id="colorSpo2"
										x1="0"
										y1="0"
										x2="0"
										y2="1"
									>
										<stop
											offset="5%"
											stopColor="#3b82f6"
											stopOpacity={0.1}
										/>
										<stop
											offset="95%"
											stopColor="#3b82f6"
											stopOpacity={0}
										/>
									</linearGradient>
								</defs>
								<CartesianGrid
									strokeDasharray="3 3"
									stroke="#e2e8f0"
								/>
								<XAxis
									dataKey="fullTime"
									minTickGap={40}
									tick={{ fontSize: 11, fill: "#64748b" }}
									stroke="#cbd5e1"
									angle={-15}
									textAnchor="end"
									height={60}
								/>
								{showHR && (
									<YAxis
										yAxisId="left"
										domain={[40, 180]}
										allowDataOverflow
										tick={{ fontSize: 12, fill: "#64748b" }}
										stroke="#cbd5e1"
										label={{
											value: "Heart Rate (bpm)",
											angle: -90,
											position: "insideLeft",
											style: {
												fontSize: 12,
												fill: "#475569",
											},
										}}
									/>
								)}
								{showSpO2 && (
									<YAxis
										yAxisId="right"
										orientation="right"
										domain={[85, 100]}
										allowDataOverflow
										tick={{ fontSize: 12, fill: "#64748b" }}
										stroke="#cbd5e1"
										label={{
											value: "SpO₂ (%)",
											angle: 90,
											position: "insideRight",
											style: {
												fontSize: 12,
												fill: "#475569",
											},
										}}
									/>
								)}
								<Tooltip content={<CustomTooltip />} />
								<Legend
									wrapperStyle={{
										fontSize: 14,
										paddingTop: 10,
									}}
									iconType="line"
								/>
								{showHR && (
									<Line
										yAxisId="left"
										type="monotone"
										dataKey="hr"
										stroke="#ef4444"
										strokeWidth={2.5}
										dot={false}
										activeDot={{ r: 6, strokeWidth: 2 }}
										isAnimationActive={false}
										name="Heart Rate"
										connectNulls
									/>
								)}
								{showSpO2 && (
									<Line
										yAxisId="right"
										type="monotone"
										dataKey="spo2"
										stroke="#3b82f6"
										strokeWidth={2.5}
										dot={false}
										activeDot={{ r: 6, strokeWidth: 2 }}
										isAnimationActive={false}
										name="SpO₂"
										connectNulls
									/>
								)}
								<Brush
									height={30}
									travellerWidth={10}
									stroke="#94a3b8"
									fill="#f8fafc"
								/>
							</LineChart>
						</ResponsiveContainer>
					) : (
						<div className="h-full flex items-center justify-center">
							<div className="text-center space-y-2">
								<Activity className="w-12 h-12 text-slate-300 mx-auto" />
								<p className="text-slate-500 font-medium">
									No data available
								</p>
								<p className="text-sm text-slate-400">
									Waiting for readings...
								</p>
							</div>
						</div>
					)}
				</div>
			</div>
		</Card>
	);
}
