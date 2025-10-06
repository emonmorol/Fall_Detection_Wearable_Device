"use client";
import { useEffect, useState } from "react";
import {
	FileText,
	Heart,
	Activity,
	Filter,
	Clock,
	Monitor,
	Shield,
	ChevronDown,
	AlertCircle,
	CheckCircle,
	Database,
} from "lucide-react";
import { api } from "@/lib/api";

export default function ReadingsPage() {
	const [deviceId, setDeviceId] = useState("");
	const [devices, setDevices] = useState([]);
	const [items, setItems] = useState([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		(async () => {
			try {
				setLoading(true);
				const d = await api("/api/devices");
				setDevices(d.devices || []);
				console.log("devices:", d);
				const r = await api("/api/readings/recent?limit=20");
				console.log("readings:", r);
				setItems(r.items || []);
			} finally {
				setLoading(false);
			}
		})();
	}, []);

	async function filterDevice(id) {
		setDeviceId(id);
		setLoading(true);
		try {
			const r = await api(
				`/api/readings/recent?limit=20${id ? `&deviceId=${id}` : ""}`
			);
			setItems(r.items || []);
		} finally {
			setLoading(false);
		}
	}

	const getStatusInfo = (reading) => {
		const { hr, spo2, flags } = reading;

		if (flags?.low_spo2 || hr > 120 || hr < 50) {
			return {
				status: "critical",
				color: "text-red-600",
				bgColor: "bg-red-50",
				borderColor: "border-red-200",
				icon: <AlertCircle className="w-4 h-4" />,
			};
		} else if (flags?.high_hr || flags?.low_hr || spo2 < 95) {
			return {
				status: "warning",
				color: "text-orange-600",
				bgColor: "bg-orange-50",
				borderColor: "border-orange-200",
				icon: <AlertCircle className="w-4 h-4" />,
			};
		} else {
			return {
				status: "normal",
				color: "text-green-600",
				bgColor: "bg-green-50",
				borderColor: "border-green-200",
				icon: <CheckCircle className="w-4 h-4" />,
			};
		}
	};

	if (loading) {
		return (
			<div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-6">
				<div className="mx-auto space-y-6">
					<div className="flex items-center space-x-3">
						<div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-lg animate-pulse"></div>
						<div className="h-8 bg-gray-200 rounded-lg w-32 animate-pulse"></div>
					</div>
					<div className="bg-white rounded-xl p-6 shadow-sm">
						<div className="h-10 bg-gray-200 rounded-lg w-48 animate-pulse"></div>
					</div>
					<div className="grid md:grid-cols-2 gap-4">
						{[...Array(6)].map((_, i) => (
							<div
								key={i}
								className="bg-white rounded-xl p-6 shadow-sm animate-pulse"
							>
								<div className="h-4 bg-gray-200 rounded w-32 mb-3"></div>
								<div className="h-6 bg-gray-200 rounded w-24 mb-2"></div>
								<div className="h-3 bg-gray-200 rounded w-20"></div>
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
						<div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
							<FileText className="w-5 h-5 text-white" />
						</div>
						<div>
							<h1 className="text-3xl font-bold bg-gradient-to-r from-slate-900 to-slate-600 bg-clip-text text-transparent">
								Patient Readings
							</h1>
							<p className="text-slate-500 text-sm mt-1">
								Historical vital signs and measurements
							</p>
						</div>
					</div>

					<div className="flex items-center space-x-3 text-sm text-slate-500">
						<Database className="w-4 h-4" />
						<span>{items.length} readings found</span>
					</div>
				</div>

				{/* Filter Section */}
				<div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
					<div className="flex items-center justify-between mb-4">
						<div className="flex items-center space-x-3">
							<Filter className="w-5 h-5 text-slate-600" />
							<h2 className="text-lg font-semibold text-slate-900">
								Filter Readings
							</h2>
						</div>
						{selectedDevice && (
							<div className="text-sm text-slate-500 flex items-center space-x-2">
								<Monitor className="w-4 h-4 text-blue-500" />
								<span>Filtered by: {selectedDevice.name}</span>
							</div>
						)}
					</div>

					<div className="relative">
						<select
							className="w-full md:w-96 appearance-none bg-gradient-to-r from-slate-50 to-blue-50 border border-slate-200 rounded-xl px-4 py-3 pr-10 text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 hover:shadow-md"
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
						<ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
					</div>
				</div>

				{/* Readings Grid */}
				{items.length > 0 ? (
					<div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
						{items.map((x, i) => {
							const statusInfo = getStatusInfo(x);
							return (
								<div
									key={i}
									className={`group relative bg-white rounded-2xl p-6 shadow-sm border transition-all duration-300 hover:shadow-lg ${statusInfo.borderColor} ${statusInfo.bgColor}`}
								>
									{/* Status indicator */}
									<div className="absolute top-4 right-4">
										<div
											className={`flex items-center space-x-1 ${statusInfo.color}`}
										>
											{statusInfo.icon}
										</div>
									</div>

									{/* Device info */}
									<div className="mb-4">
										<div className="flex items-center space-x-2 mb-2">
											<Monitor className="w-4 h-4 text-slate-500" />
											<span className="font-mono text-sm font-medium text-slate-700">
												{x.deviceId}
											</span>
										</div>
										<div className="flex items-center space-x-2 text-xs text-slate-500">
											<Clock className="w-3 h-3" />
											<span>
												{new Date(
													x.ts
												).toLocaleString()}
											</span>
										</div>
									</div>

									{/* Vitals */}
									<div className="space-y-3 mb-4">
										<div className="flex items-center justify-between">
											<div className="flex items-center space-x-2">
												<Heart className="w-5 h-5 text-red-500" />
												<span className="text-sm font-medium text-slate-600">
													Heart Rate
												</span>
											</div>
											<span className="text-lg font-bold text-slate-900">
												{x.hr}{" "}
												<span className="text-sm font-normal text-slate-500">
													bpm
												</span>
											</span>
										</div>

										<div className="flex items-center justify-between">
											<div className="flex items-center space-x-2">
												<Activity className="w-5 h-5 text-blue-500" />
												<span className="text-sm font-medium text-slate-600">
													SpO₂
												</span>
											</div>
											<span className="text-lg font-bold text-slate-900">
												{x.spo2}{" "}
												<span className="text-sm font-normal text-slate-500">
													%
												</span>
											</span>
										</div>
									</div>

									{/* Flags */}
									<div className="border-t border-slate-100 pt-3">
										<div className="flex items-center space-x-2 mb-2">
											<Shield className="w-3 h-3 text-slate-400" />
											<span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
												Status Flags
											</span>
										</div>
										<div className="flex flex-wrap gap-1">
											{Object.entries(x.flags || {})
												.filter(([_, v]) => v)
												.map(([k], idx) => (
													<span
														key={idx}
														className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
															k.includes("low") ||
															k.includes("high")
																? "bg-orange-100 text-orange-700"
																: k === "normal"
																? "bg-green-100 text-green-700"
																: "bg-slate-100 text-slate-700"
														}`}
													>
														{k
															.replace("_", " ")
															.replace(
																/\b\w/g,
																(l) =>
																	l.toUpperCase()
															)}
													</span>
												))}
											{(!x.flags ||
												Object.keys(x.flags).length ===
													0) && (
												<span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
													No flags
												</span>
											)}
										</div>
									</div>
								</div>
							);
						})}
					</div>
				) : (
					<div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-12">
						<div className="text-center">
							<FileText className="w-16 h-16 mx-auto text-slate-300 mb-4" />
							<h3 className="text-xl font-semibold text-slate-600 mb-2">
								No Readings Found
							</h3>
							<p className="text-slate-500">
								{deviceId
									? `No readings available for the selected device.`
									: `No readings available. Check back later for patient data.`}
							</p>
						</div>
					</div>
				)}
			</div>
		</div>
	);
}
