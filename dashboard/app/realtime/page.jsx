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
} from "lucide-react";

import { api } from "@/lib/api";
import { VitalsTile } from "@/components/vitals-tile";
import { useDeviceSocket } from "@/hooks/useDeviceSocket";

export default function RealtimePage() {
	const [devices, setDevices] = useState([]);
	const [deviceId, setDeviceId] = useState("");
	const [loading, setLoading] = useState(true);
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

	if (loading) {
		return (
			<div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-6">
				<div className="mx-auto space-y-6">
					<div className="flex items-center space-x-3">
						<div className="w-8 h-8 bg-gradient-to-r from-green-500 to-emerald-600 rounded-lg animate-pulse"></div>
						<div className="h-8 bg-gray-200 rounded-lg w-32 animate-pulse"></div>
					</div>
					<div className="bg-white rounded-xl p-6 shadow-sm">
						<div className="h-10 bg-gray-200 rounded-lg w-48 animate-pulse"></div>
					</div>
					<div className="grid md:grid-cols-2 gap-6">
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
		<div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-6">
			<div className="mx-auto space-y-8">
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
				<div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
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
					<div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
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
										{last
											? `Updated ${new Date(
													last.timestamp
											  ).toLocaleTimeString()}`
											: "Waiting for data..."}
									</span>
								</div>
							</div>
						</div>
					</div>
				)}
			</div>
		</div>
	);
}
