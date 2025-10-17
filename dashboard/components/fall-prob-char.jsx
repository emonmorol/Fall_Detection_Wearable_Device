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
	AlertTriangle,
	Play,
	Pause,
	Settings2,
	Download,
	Clock,
} from "lucide-react";
import { useFallSocket } from "@/hooks/useFallSocket";
import { api } from "@/lib/api";

export default function FallProbChartEnhanced({ deviceId }) {
	const [data, setData] = useState([]);
	const [isLive, setIsLive] = useState(true);
	const [showControls, setShowControls] = useState(false);
	const [bucket, setBucket] = useState("1m");
	const [range, setRange] = useState("24h");
	const [loading, setLoading] = useState(true);
	const { connected, inference } = useFallSocket(deviceId);

	// Fetch data from backend with filters
	useEffect(() => {
		const fetchData = async () => {
			try {
				const qs = new URLSearchParams({ range, bucket });
				const res = await api(`/api/stats/${deviceId}?${qs}`);
				setData(res);
			} catch (err) {
				console.error("Failed to fetch fall probability data", err);
			} finally {
				setLoading(false);
			}
		};
		fetchData();
	}, [deviceId, range, bucket]);

	// Realtime update handler
	useEffect(() => {
		if (!inference || !isLive) return;
		setData((prev) => [...prev.slice(-200), inference]);
	}, [inference, isLive]);

	const handleExport = () => {
		const csv = [
			["Timestamp", "Fall Probability", "Is Fall"],
			...data.map((d) => [
				new Date(d.ts).toISOString(),
				d.fallProb?.toFixed(3) || "N/A",
				d.isFall ? "Yes" : "No",
			]),
		]
			.map((row) => row.join(","))
			.join("\n");

		const blob = new Blob([csv], { type: "text/csv" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `fall-prob-${deviceId}-${new Date().toISOString()}.csv`;
		a.click();
		URL.revokeObjectURL(url);
	};

	const formatted = useMemo(
		() =>
			data.map((d) => ({
				time: new Date(d.ts).toLocaleTimeString([], {
					hour: "2-digit",
					minute: "2-digit",
				}),
				fallProb: d.fallProb ?? 0,
				isFall: d.isFall,
			})),
		[data]
	);

	return (
		<Card className="overflow-hidden border-slate-200 shadow-sm pt-0">
			<div className="bg-gradient-to-r from-rose-50 to-pink-100 border-b border-slate-200 p-4 md:p-4">
				<div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
					<div className="flex items-center gap-3">
						<div className="bg-rose-500 p-2 rounded-lg">
							<AlertTriangle className="w-5 h-5 text-white" />
						</div>
						<div>
							<h3 className="text-lg font-semibold text-slate-900">
								Fall Probability Monitor
							</h3>
							<p className="text-xs text-slate-600 mt-0.5">
								Live probability tracking and event detection
							</p>
						</div>
					</div>

					<div className="flex items-center gap-2">
						<Button
							variant="outline"
							size="sm"
							onClick={() => setIsLive(!isLive)}
							className={`gap-2 ${
								isLive
									? "bg-green-50 border-green-200 text-green-700"
									: "bg-slate-50"
							}`}
						>
							{isLive ? (
								<>
									<Pause className="w-4 h-4" /> Pause
								</>
							) : (
								<>
									<Play className="w-4 h-4" /> Resume
								</>
							)}
						</Button>
						<Button
							variant="outline"
							size="sm"
							onClick={() => setShowControls(!showControls)}
							className="gap-2"
						>
							<Settings2 className="w-4 h-4" /> Controls
						</Button>
						<Button
							variant="outline"
							size="sm"
							onClick={handleExport}
							className="gap-2"
						>
							<Download className="w-4 h-4" /> Export
						</Button>
					</div>
				</div>

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
							{data.length} points
						</span>
					</div>
				)}
			</div>

			{showControls && (
				<div className="bg-slate-50 border-b border-slate-200 p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
					<div className="space-y-2">
						<Label className="text-xs font-medium text-slate-700 flex items-center gap-1.5">
							<Clock className="w-3.5 h-3.5" /> Time Range
						</Label>
						<Select value={range} onValueChange={setRange}>
							<SelectTrigger className="bg-white">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="1h">Last 1 Hour</SelectItem>
								<SelectItem value="6h">Last 6 Hours</SelectItem>
								<SelectItem value="12h">
									Last 12 Hours
								</SelectItem>
								<SelectItem value="24h">
									Last 24 Hours
								</SelectItem>
								<SelectItem value="2d">Last 2 Days</SelectItem>
							</SelectContent>
						</Select>
					</div>

					<div className="space-y-2">
						<Label className="text-xs font-medium text-slate-700">
							Interval
						</Label>
						<Select value={bucket} onValueChange={setBucket}>
							<SelectTrigger className="bg-white">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="1m">Every Minute</SelectItem>
								<SelectItem value="5m">
									Every 5 Minutes
								</SelectItem>
								<SelectItem value="15m">
									Every 15 Minutes
								</SelectItem>
								<SelectItem value="1h">Every Hour</SelectItem>
							</SelectContent>
						</Select>
					</div>

					<div className="space-y-2">
						<Label className="text-xs font-medium text-slate-700">
							Custom Range
						</Label>
						<div className="flex gap-2">
							<Input
								type="number"
								placeholder="24"
								className="bg-white w-20"
							/>
							<Select>
								<SelectTrigger className="bg-white">
									<SelectValue placeholder="hours" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="minutes">
										Minutes
									</SelectItem>
									<SelectItem value="hours">Hours</SelectItem>
									<SelectItem value="days">Days</SelectItem>
								</SelectContent>
							</Select>
						</div>
					</div>
				</div>
			)}

			<div className="p-4 md:p-4">
				<div className="h-80 md:h-96">
					{loading ? (
						<div className="flex items-center justify-center h-full text-slate-500">
							Loading...
						</div>
					) : data.length > 0 ? (
						<ResponsiveContainer width="100%" height="100%">
							<LineChart data={formatted}>
								<CartesianGrid
									strokeDasharray="3 3"
									stroke="#e2e8f0"
								/>
								<XAxis
									dataKey="time"
									tick={{ fontSize: 11, fill: "#64748b" }}
									stroke="#cbd5e1"
								/>
								<YAxis
									domain={[0, 1]}
									tick={{ fontSize: 12, fill: "#64748b" }}
								/>
								<Tooltip
									formatter={(v) => v.toFixed(3)}
									labelFormatter={(l) => l}
								/>
								<Legend
									wrapperStyle={{
										fontSize: 14,
										paddingTop: 10,
									}}
								/>
								<Line
									type="monotone"
									dataKey="fallProb"
									stroke="#ef4444"
									strokeWidth={2.5}
									dot={false}
									activeDot={{ r: 6, strokeWidth: 2 }}
									name="Fall Probability"
								/>
								<Brush
									height={15}
									stroke="#ef4444"
									fill="#f8fafc"
								/>
							</LineChart>
						</ResponsiveContainer>
					) : (
						<div className="h-full flex items-center justify-center text-slate-500">
							No data available
						</div>
					)}
				</div>
			</div>
		</Card>
	);
}
