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
import { useDeviceSocket } from "@/hooks/useDeviceSocket";

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
	const [deviceId, setDeviceId] = useState("");
	const { connected, last } = useDeviceSocket(deviceId);

	useEffect(() => {
		(async () => {
			try {
				setLoading(true);
				const d = await api("/api/devices");
				if (d.devices?.[0]) setDeviceId(d.devices[0].deviceId);
			} finally {
				setLoading(false);
			}
		})();
	}, []);

	useEffect(() => {
		(async () => {
			try {
				setLoading(true);
				const s = await api("/api/stats/overview?range=24h");

				setKpi(toKpi(s));
				console.log("stats:", s);
				const r = await api("/api/readings/recent?limit=10");
				setRecentR(r.items || []);
				console.log("readings:", r);
				const a = await api("/api/alerts/recent?limit=10");
				setRecentA(a.items || []);
				console.log("alerts:", a);
			} catch (e) {
				setErr(String(e.message || e));
			} finally {
				setLoading(false);
			}
		})();
	}, [last]);
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
			<div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-4">
				<div className="mx-auto space-y-6">
					<div className="flex items-center space-x-3">
						<div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-lg animate-pulse"></div>
						<div className="h-8 bg-gray-200 rounded-lg w-32 animate-pulse"></div>
					</div>
					<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
						{[...Array(4)].map((_, i) => (
							<div
								key={i}
								className="bg-white rounded-xl p-4 shadow-sm animate-pulse"
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
		<div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-4">
			<div className="mx-auto space-y-4">
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
					<RealtimeReadingsChart deviceId={deviceId} />
				</div>

				{/* Recent Data */}
				<div className="grid lg:grid-cols-2 gap-6">
					{/* Recent Readings Table */}
					<section className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
						<div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4">
							<div className="flex items-center space-x-2">
								<Activity className="w-5 h-5 text-white" />
								<h2 className="text-base font-semibold text-white">
									Recent Readings
								</h2>
							</div>
						</div>
						<div className="overflow-x-auto">
							{recentR.length > 0 ? (
								<table className="w-full">
									<thead>
										<tr className="bg-slate-50 border-b border-slate-200">
											<th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
												Device
											</th>
											<th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
												HR
											</th>
											<th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
												SpO₂
											</th>
											<th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
												Time
											</th>
										</tr>
									</thead>
									<tbody className="divide-y divide-slate-100">
										{recentR.map((x, i) => (
											<tr
												key={i}
												className="hover:bg-slate-50 transition-colors"
											>
												<td className="px-6 py-4 whitespace-nowrap">
													<div className="flex items-center space-x-2">
														<div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
														<span className="text-sm font-medium text-slate-900">
															{x.deviceId}
														</span>
													</div>
												</td>
												<td className="px-6 py-4 whitespace-nowrap">
													<div className="flex items-center space-x-2">
														<Heart className="w-4 h-4 text-rose-500" />
														<span className="text-sm font-semibold text-slate-900">
															{x.hr}
														</span>
													</div>
												</td>
												<td className="px-6 py-4 whitespace-nowrap">
													<div className="flex items-center space-x-2">
														<div className="w-4 h-4 bg-blue-500 rounded flex items-center justify-center">
															<div className="w-1.5 h-1.5 bg-white rounded-full"></div>
														</div>
														<span className="text-sm font-semibold text-slate-900">
															{x.spo2}%
														</span>
													</div>
												</td>
												<td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
													{new Date(
														x.createdAt
													).toLocaleDateString(
														"en-GB",
														{
															day: "numeric",
															month: "long",
														}
													)}
													<span className="text-slate-400 mx-1">
														•
													</span>
													{new Date(
														x.ts
													).toLocaleTimeString(
														"en-US",
														{
															hour: "numeric",
															minute: "2-digit",
															hour12: true,
														}
													)}
												</td>
											</tr>
										))}
									</tbody>
								</table>
							) : (
								<div className="text-center py-12">
									<Activity className="w-10 h-10 mx-auto mb-2 text-slate-300" />
									<p className="text-sm text-slate-500">
										No readings available
									</p>
								</div>
							)}
						</div>
					</section>

					{/* Recent Alerts Table */}
					<section className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
						<div className="bg-gradient-to-r from-amber-500 to-red-500 px-6 py-4">
							<div className="flex items-center space-x-2">
								<AlertTriangle className="w-5 h-5 text-white" />
								<h2 className="text-base font-semibold text-white">
									Recent Alerts
								</h2>
							</div>
						</div>
						<div className="overflow-x-auto">
							{recentA.length > 0 ? (
								<table className="w-full">
									<thead>
										<tr className="bg-slate-50 border-b border-slate-200">
											<th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
												Device
											</th>
											<th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
												Alert
											</th>
											<th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
												Value
											</th>
											<th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
												Time
											</th>
										</tr>
									</thead>
									<tbody className="divide-y divide-slate-100">
										{recentA.map((a) => (
											<tr
												key={a._id}
												className="hover:bg-red-50 transition-colors"
											>
												<td className="px-6 py-4 whitespace-nowrap">
													<div className="flex items-center space-x-2">
														<div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
														<span className="text-sm font-medium text-slate-900">
															{a.deviceId}
														</span>
													</div>
												</td>
												<td className="px-6 py-4">
													<span className="text-sm font-medium text-red-700">
														{a.rule &&
														a.rule === "spo2Low"
															? "Low Oxygen Level"
															: a.rule ===
															  "hrHigh"
															? "High Heart Rate"
															: a.rule === "hrLow"
															? "Low Heart Rate"
															: a.rule}
													</span>
												</td>
												<td className="px-6 py-4 whitespace-nowrap">
													<span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800">
														{a.value}
													</span>
												</td>
												<td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
													{new Date(
														a.createdAt
													).toLocaleDateString(
														"en-GB",
														{
															day: "numeric",
															month: "long",
														}
													)}
													<span className="text-slate-400 mx-1">
														•
													</span>
													{new Date(
														a.createdAt
													).toLocaleTimeString(
														"en-US",
														{
															hour: "numeric",
															minute: "2-digit",
															hour12: true,
														}
													)}
												</td>
											</tr>
										))}
									</tbody>
								</table>
							) : (
								<div className="text-center py-12">
									<Shield className="w-10 h-10 mx-auto mb-2 text-slate-300" />
									<p className="text-sm text-slate-500">
										No alerts
									</p>
									<p className="text-xs text-slate-400 mt-1">
										All systems normal
									</p>
								</div>
							)}
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
