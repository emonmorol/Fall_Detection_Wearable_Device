"use client";
import React, { useEffect, useState } from "react";
import {
	Activity,
	Heart,
	AlertTriangle,
	Zap,
	Clock,
	TrendingUp,
	Shield,
} from "lucide-react";
import { api } from "../lib/api";
import { toKpi } from "@/utils/constants";
import dynamic from "next/dynamic";

const RealtimeReadingsChart = dynamic(
	() => import("@/components/realtime-reading-chart"),
	{ ssr: false }
);

export default function OverviewPage() {
	const [kpi, setKpi] = useState({});
	const [recentR, setRecentR] = useState([]);
	const [recentA, setRecentA] = useState([]);
	const [err, setErr] = useState("");
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		(async () => {
			try {
				setLoading(true);
				const s = await api("/api/stats/overview?range=24h");

				setKpi(toKpi(s));
				console.log("stats:", s);
				const r = await api("/api/readings/recent?limit=5");
				setRecentR(r.items || []);
				console.log("readings:", r);
				const a = await api("/api/alerts/recent?limit=5");
				setRecentA(a.items || []);
				console.log("alerts:", a);
			} catch (e) {
				setErr(String(e.message || e));
			} finally {
				setLoading(false);
			}
		})();
	}, []);
	console.log("kpi:", kpi);

	const kpiData = [
		{
			title: "Active Devices",
			value: kpi.activeDevices ?? "--",
			icon: <Zap className="w-5 h-5" />,
			trend: "+2 from yesterday", // keep or compute later
			color: "from-emerald-500 to-teal-600",
			bgColor: "bg-emerald-50",
		},
		{
			title: "Readings",
			value: kpi.readings24h ?? "--",
			icon: <TrendingUp className="w-5 h-5" />,
			trend: "+12% from yesterday",
			color: "from-blue-500 to-indigo-600",
			bgColor: "bg-blue-50",
		},
		{
			title: "Alerts",
			value: kpi.alerts24h ?? "--",
			icon: <AlertTriangle className="w-5 h-5" />,
			trend: "-2 from yesterday",
			color: "from-orange-500 to-red-500",
			bgColor: "bg-orange-50",
			isAlert: true,
		},
		{
			title: "Min Oxygen (SpO₂)",
			value: kpi.minSpO2 != null ? `${kpi.minSpO2}` : "--",
			icon: <Heart className="w-5 h-5" />,
			trend: "Within normal range",
			color: "from-pink-500 to-rose-600",
			bgColor: "bg-pink-50",
		},
		{
			title: "Max Heart Rate",
			value: kpi.maxHr != null ? `${kpi.maxHr}%` : "--",
			icon: <Heart className="w-5 h-5" />,
			trend: "Within normal range",
			color: "from-pink-500 to-rose-600",
			bgColor: "bg-pink-50",
		},
	];

	console.log(kpiData);

	if (loading) {
		return (
			<div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-6">
				<div className="mx-auto space-y-6">
					<div className="flex items-center space-x-3">
						<div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-lg animate-pulse"></div>
						<div className="h-8 bg-gray-200 rounded-lg w-32 animate-pulse"></div>
					</div>
					<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
						{[...Array(4)].map((_, i) => (
							<div
								key={i}
								className="bg-white rounded-xl p-6 shadow-sm animate-pulse"
							>
								<div className="h-4 bg-gray-200 rounded w-24 mb-3"></div>
								<div className="h-8 bg-gray-200 rounded w-16"></div>
							</div>
						))}
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-6">
			<div className="mx-auto space-y-8">
				{/* Header */}
				<div className="flex items-center justify-between">
					<div className="flex items-center space-x-4">
						<div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
							<Activity className="w-5 h-5 text-white" />
						</div>
						<div>
							<h1 className="text-3xl font-bold bg-gradient-to-r from-slate-900 to-slate-600 bg-clip-text text-transparent">
								Health Monitor Dashboard
							</h1>
							<p className="text-slate-500 text-sm mt-1">
								Real-time patient monitoring overview
							</p>
						</div>
					</div>
					<div className="flex items-center space-x-2 text-sm text-slate-500">
						<Clock className="w-4 h-4" />
						<span>
							Last updated: {new Date().toLocaleTimeString()}
						</span>
					</div>
				</div>

				{err && (
					<div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center space-x-3">
						<AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
						<p className="text-red-700 text-sm">{err}</p>
					</div>
				)}

				{/* KPI Cards */}
				<div className="grid grid-cols-2 md:grid-cols-5 gap-4">
					{kpiData &&
						kpiData.map((card) => (
							<KpiCard
								key={card.title}
								title={card.title}
								value={card.value}
								icon={card.icon}
								// trend={card.trend}
								color={card.color}
								bgColor={card.bgColor}
								isAlert={card.isAlert}
							/>
						))}
				</div>

				<div className="grid gap-8">
					<RealtimeReadingsChart
						deviceId="all"
						range="1d"
						bucket="15m"
						live={false}
					/>
				</div>

				{/* Recent Data */}
				<div className="grid lg:grid-cols-2 gap-8">
					{/* Recent Readings */}
					<section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
						<div className="bg-gradient-to-r from-blue-500 to-indigo-600 p-6">
							<div className="flex items-center space-x-3">
								<div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
									<Activity className="w-4 h-4 text-white" />
								</div>
								<h2 className="text-lg font-semibold text-white">
									Recent Readings
								</h2>
							</div>
						</div>
						<div className="p-6">
							<div className="space-y-4">
								{recentR.length > 0 ? (
									recentR.map((x, i) => (
										<div
											key={i}
											className="group bg-slate-50 hover:bg-slate-100 rounded-xl p-4 transition-all duration-200 hover:shadow-md border border-slate-100"
										>
											<div className="flex justify-between items-start mb-3">
												<div className="flex items-center space-x-2">
													<div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
													<span className="font-mono text-sm font-medium text-slate-700">
														{x.deviceId}
													</span>
												</div>
												<span className="text-xs text-slate-500">
													{new Date(
														x.ts
													).toLocaleString()}
												</span>
											</div>
											<div className="flex items-center space-x-6">
												<div className="flex items-center space-x-2">
													<Heart className="w-4 h-4 text-red-500" />
													<span className="text-sm font-medium">
														HR: {x.hr}
													</span>
												</div>
												<div className="flex items-center space-x-2">
													<div className="w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
														<div className="w-2 h-2 bg-white rounded-full"></div>
													</div>
													<span className="text-sm font-medium">
														SpO₂: {x.spo2}%
													</span>
												</div>
											</div>
											<div className="mt-3 flex items-center space-x-2">
												<Shield className="w-3 h-3 text-slate-400" />
												<span className="text-xs text-slate-500">
													Flags:{" "}
													{Object.entries(
														x.flags || {}
													)
														.filter(([_, v]) => v)
														.map(([k]) =>
															k.replace("_", " ")
														)
														.join(", ") || "none"}
												</span>
											</div>
										</div>
									))
								) : (
									<div className="text-center py-8 text-slate-500">
										<Activity className="w-12 h-12 mx-auto mb-3 text-slate-300" />
										<p className="text-sm">
											No recent readings available
										</p>
									</div>
								)}
							</div>
						</div>
					</section>

					{/* Recent Alerts */}
					<section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
						<div className="bg-gradient-to-r from-orange-500 to-red-500 p-6">
							<div className="flex items-center space-x-3">
								<div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
									<AlertTriangle className="w-4 h-4 text-white" />
								</div>
								<h2 className="text-lg font-semibold text-white">
									Recent Alerts
								</h2>
							</div>
						</div>
						<div className="p-6">
							<div className="space-y-4">
								{recentA.length > 0 ? (
									recentA.map((a) => (
										<div
											key={a._id}
											className="group bg-red-50 hover:bg-red-100 rounded-xl p-4 transition-all duration-200 hover:shadow-md border border-red-100"
										>
											<div className="flex justify-between items-start mb-3">
												<div className="flex items-center space-x-2">
													<div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
													<span className="font-mono text-sm font-medium text-slate-700">
														{a.deviceId}
													</span>
												</div>
												<span className="text-xs text-slate-500">
													{new Date(
														a.ts
													).toLocaleString()}
												</span>
											</div>
											<div className="space-y-2">
												<div className="flex items-center space-x-2">
													<AlertTriangle className="w-4 h-4 text-red-500" />
													<span className="text-sm font-medium text-red-700">
														{a.rule}
													</span>
												</div>
												<div className="text-sm text-slate-600 ml-6">
													Threshold value:{" "}
													<span className="font-semibold">
														{a.value}
													</span>
												</div>
											</div>
										</div>
									))
								) : (
									<div className="text-center py-8 text-slate-500">
										<Shield className="w-12 h-12 mx-auto mb-3 text-slate-300" />
										<p className="text-sm">
											No recent alerts
										</p>
										<p className="text-xs text-slate-400 mt-1">
											All systems operating normally
										</p>
									</div>
								)}
							</div>
						</div>
					</section>
				</div>
			</div>
		</div>
	);
}

function KpiCard({
	title,
	value,
	icon,
	trend,
	color,
	bgColor,
	isAlert = false,
}) {
	return (
		<div
			className={`group relative bg-white rounded-2xl p-4 shadow-sm border border-slate-200 hover:shadow-lg transition-all duration-300 overflow-hidden ${bgColor}`}
		>
			{/* Background gradient effect */}
			<div
				className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl ${color} opacity-10 rounded-full blur-2xl group-hover:opacity-20 transition-opacity`}
			></div>

			<div className="flex justify-between relative z-10">
				<div className="flex items-center justify-between">
					<div
						className={`w-13 h-13 bg-gradient-to-r ${color} rounded-xl flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform`}
					>
						{icon}
					</div>
					{isAlert && (
						<div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
					)}
				</div>

				<div className="space-y-1">
					<p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
						{title}
					</p>
					<p className="text-3xl font-bold text-slate-900 text-right group-hover:text-slate-700 transition-colors">
						{value}
					</p>
					{/* {trend && (
						<p className="text-xs text-slate-500 flex items-center space-x-1">
							<TrendingUp className="w-3 h-3" />
							<span>{trend}</span>
						</p>
					)} */}
				</div>
			</div>
		</div>
	);
}
