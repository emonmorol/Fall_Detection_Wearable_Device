"use client";

import { useEffect, useState } from "react";
import {
	Radio,
	Wifi,
	WifiOff,
	Zap,
	Activity,
	TrendingUp,
	AlertTriangle,
} from "lucide-react";
import { useFallSocket } from "@/hooks/useFallSocket"; // ✅ new hook
import FallProbChart from "@/components/fall-prob-char";

export default function DashboardPage() {
	const deviceId = "30EDA02709A8";
	const { connected, inference } = useFallSocket(deviceId);

	const [latest, setLatest] = useState({ ts: "--", probFall: 0 });
	const [data, setData] = useState([]);

	// update UI when new inference arrives
	useEffect(() => {
		if (inference) {
			setLatest(inference);
			setData((prev) => [...prev.slice(-100), inference]);
		}
	}, [inference]);

	const isHighRisk = latest?.fallProb >= 0.7;

	return (
		<div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-4">
			<div className="mx-auto space-y-6">
				{/* Header */}
				<div className="flex items-center justify-between">
					<div className="flex items-center space-x-4">
						<div className="w-10 h-10 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
							<Radio className="w-5 h-5 text-white" />
						</div>
						<div>
							<h1 className="text-3xl font-bold bg-gradient-to-r from-slate-900 to-slate-600 bg-clip-text text-transparent">
								Fall History
							</h1>
							<p className="text-slate-500 text-sm mt-1">
								Real-time fall probability monitoring
							</p>
						</div>
					</div>

					{/* Connection Indicator */}
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
							{connected ? "Connected" : "Disconnected"}
						</span>
						{connected && (
							<div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
						)}
					</div>
				</div>

				{/* Latest Prediction */}
				<div className="grid md:grid-cols-3 gap-6">
					<PredictionTile
						title="Fall Probability"
						value={((latest?.fallProb ?? 0) * 100).toFixed(1)}
						unit="%"
						icon={<Activity className="w-6 h-6" />}
						color="from-purple-500 to-indigo-600"
						bgColor="bg-purple-50"
						status={isHighRisk ? "High Risk" : "Normal"}
					/>
					<PredictionTile
						title="Last Update"
						value={
							latest?.ts
								? new Date(latest.ts).toLocaleTimeString([], {
										hour: "2-digit",
										minute: "2-digit",
										second: "2-digit",
								  })
								: "--"
						}
						unit=""
						icon={<TrendingUp className="w-6 h-6" />}
						color="from-blue-500 to-indigo-500"
						bgColor="bg-blue-50"
						status={connected ? "Live" : "Idle"}
					/>
					<PredictionTile
						title="Alert Status"
						value={isHighRisk ? "ALERT" : "Safe"}
						unit=""
						icon={<AlertTriangle className="w-6 h-6" />}
						color={
							isHighRisk
								? "from-red-500 to-pink-600"
								: "from-green-500 to-emerald-600"
						}
						bgColor={isHighRisk ? "bg-red-50" : "bg-green-50"}
						status={
							isHighRisk ? "Immediate attention needed" : "Stable"
						}
					/>
				</div>

				{/* Real-time Chart */}
				<div className="flex items-center space-x-3 mb-4 mt-10">
					<div className="w-10 h-10 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center text-white shadow-lg">
						<TrendingUp className="w-5 h-5" />
					</div>
					<div>
						<h2 className="text-xl font-semibold text-slate-900">
							Real-Time Fall Probability Trend
						</h2>
						<p className="text-sm text-slate-500">
							Live predictions stream from your device
						</p>
					</div>
				</div>
				<div className="h-[300px]">
					<FallProbChart deviceId={deviceId} />
				</div>
			</div>
		</div>
	);
}

/* --- Prediction Tile Component --- */
function PredictionTile({ title, value, unit, icon, color, bgColor, status }) {
	return (
		<div
			className={`group relative bg-white rounded-2xl p-6 shadow-sm border border-slate-200 hover:shadow-lg transition-all duration-300 overflow-hidden ${bgColor}`}
		>
			<div
				className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl ${color} opacity-10 rounded-full blur-3xl group-hover:opacity-20 transition-opacity`}
			></div>

			<div className="flex justify-between items-center relative z-10">
				<div
					className={`w-14 h-14 bg-gradient-to-r ${color} rounded-xl flex items-center justify-center text-white shadow-lg`}
				>
					{icon}
				</div>

				<div className="text-right">
					<p className="text-sm font-medium text-slate-500 uppercase tracking-wider">
						{title}
					</p>
					<div className="flex items-baseline justify-end space-x-1">
						<span className="text-4xl font-bold text-slate-900 group-hover:text-slate-700 transition-colors">
							{value}
						</span>
						<span className="text-lg text-slate-500 font-medium">
							{unit}
						</span>
					</div>
					<p
						className={`mt-1 text-sm font-medium ${
							status.includes("High") || status.includes("ALERT")
								? "text-red-600"
								: "text-green-600"
						}`}
					>
						{status}
					</p>
				</div>
			</div>
		</div>
	);
}
