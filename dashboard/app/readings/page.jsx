"use client";
import { useEffect, useState } from "react";
import {
	FileText,
	Filter,
	Monitor,
	ChevronDown,
	Database,
	AlertCircle,
	CheckCircle,
	Activity,
} from "lucide-react";
import { api } from "@/lib/api";

export default function ReadingsPage() {
	const [deviceId, setDeviceId] = useState("");
	const [devices, setDevices] = useState([]);
	const [items, setItems] = useState([]);
	const [loading, setLoading] = useState(true);
	const [rowsPerPage, setRowsPerPage] = useState(10);

	useEffect(() => {
		(async () => {
			try {
				setLoading(true);
				const d = await api("/api/devices");
				setDevices(d.devices || []);
				const r = await api(
					`/api/readings/recent?limit=${rowsPerPage}`
				);
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
				`/api/readings/recent?limit=${rowsPerPage}${
					id ? `&deviceId=${id}` : ""
				}`
			);
			setItems(r.items || []);
		} finally {
			setLoading(false);
		}
	}

	async function handleRowsChange(rows) {
		setRowsPerPage(rows);
		setLoading(true);
		try {
			const r = await api(
				`/api/readings/recent?limit=${rows}${
					deviceId ? `&deviceId=${deviceId}` : ""
				}`
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
				status: "Critical",
				color: "text-red-600",
				bgColor: "bg-red-50",
				borderColor: "border-red-200",
				icon: <AlertCircle className="w-3.5 h-3.5" />,
			};
		} else if (flags?.high_hr || flags?.low_hr || spo2 < 95) {
			return {
				status: "Warning",
				color: "text-amber-600",
				bgColor: "bg-amber-50",
				borderColor: "border-amber-200",
				icon: <AlertCircle className="w-3.5 h-3.5" />,
			};
		} else {
			return {
				status: "Normal",
				color: "text-emerald-600",
				bgColor: "bg-emerald-50",
				borderColor: "border-emerald-200",
				icon: <CheckCircle className="w-3.5 h-3.5" />,
			};
		}
	};

	if (loading) {
		return (
			<div className="min-h-screen bg-slate-50 p-6 flex items-center justify-center">
				<div className="text-center space-y-4">
					<div className="animate-spin mx-auto w-12 h-12 border-3 border-slate-200 border-t-slate-600 rounded-full"></div>
					<p className="text-slate-600 font-medium">
						Loading readings...
					</p>
				</div>
			</div>
		);
	}

	const selectedDevice = devices.find((d) => d.deviceId === deviceId);

	return (
		<div className="min-h-screen bg-slate-50 p-6">
			<div className="mx-auto space-y-6">
				{/* Header */}
				<div className="flex items-center justify-between">
					<div className="flex items-center space-x-4">
						<div className="w-12 h-12 bg-slate-900 rounded-xl flex items-center justify-center">
							<Activity className="w-6 h-6 text-white" />
						</div>
						<div>
							<h1 className="text-2xl font-bold text-slate-900">
								Patient Readings
							</h1>
							<p className="text-slate-500 text-sm">
								Monitor vital signs and health metrics
							</p>
						</div>
					</div>

					<div className="flex items-center space-x-2 px-4 py-2 bg-white rounded-lg border border-slate-200">
						<Database className="w-4 h-4 text-slate-400" />
						<span className="text-sm font-medium text-slate-700">
							{items.length}
						</span>
						<span className="text-sm text-slate-500">records</span>
					</div>
				</div>

				{/* Controls Bar */}
				<div className="bg-white rounded-xl border border-slate-200 p-4">
					<div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
						{/* Device Filter */}
						<div className="flex-1 max-w-md">
							<label className="text-xs font-medium text-slate-700 mb-2 block uppercase tracking-wide">
								Device Filter
							</label>
							<div className="relative">
								<select
									className="w-full appearance-none bg-white border border-slate-200 rounded-lg px-4 py-2.5 pr-10 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition-all"
									value={deviceId}
									onChange={(e) =>
										filterDevice(e.target.value)
									}
								>
									<option value="">All devices</option>
									{devices.map((d) => (
										<option
											key={d.deviceId}
											value={d.deviceId}
										>
											{d.name} ({d.deviceId})
										</option>
									))}
								</select>
								<ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
							</div>
						</div>

						{/* Rows Per Page */}
						<div className="w-full md:w-auto">
							<label className="text-xs font-medium text-slate-700 mb-2 block uppercase tracking-wide">
								Rows Per Page
							</label>
							<div className="relative">
								<select
									className="w-full md:w-32 appearance-none bg-white border border-slate-200 rounded-lg px-4 py-2.5 pr-10 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition-all"
									value={rowsPerPage}
									onChange={(e) =>
										handleRowsChange(Number(e.target.value))
									}
								>
									<option value={5}>5</option>
									<option value={10}>10</option>
									<option value={20}>20</option>
									<option value={50}>50</option>
									<option value={100}>100</option>
								</select>
								<ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
							</div>
						</div>
					</div>

					{selectedDevice && (
						<div className="mt-4 pt-4 border-t border-slate-100 flex items-center space-x-2 text-sm">
							<Monitor className="w-4 h-4 text-slate-400" />
							<span className="text-slate-600">
								Active filter:
							</span>
							<span className="font-medium text-slate-900">
								{selectedDevice.name}
							</span>
						</div>
					)}
				</div>

				{/* Modern Table */}
				<div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
					<div className="overflow-x-auto">
						<table className="w-full">
							<thead>
								<tr className="border-b border-slate-200">
									<th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
										Timestamp
									</th>
									<th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
										Heart Rate
									</th>
									<th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
										SpO₂
									</th>
									<th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
										Status
									</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-slate-100">
								{items.length > 0 ? (
									items.map((reading, i) => {
										const status = getStatusInfo(reading);
										const date = new Date(reading.ts);
										const dateStr = date.toLocaleDateString(
											"en-US",
											{
												month: "short",
												day: "numeric",
												year: "numeric",
											}
										);
										const timeStr = date.toLocaleTimeString(
											"en-US",
											{
												hour: "2-digit",
												minute: "2-digit",
											}
										);

										return (
											<tr
												key={i}
												className="hover:bg-slate-50 transition-colors"
											>
												<td className="px-6 py-4">
													<div className="flex flex-col">
														<span className="text-sm font-medium text-slate-900">
															{dateStr}
														</span>
														<span className="text-xs text-slate-500">
															{timeStr}
														</span>
													</div>
												</td>
												<td className="px-6 py-4">
													<span className="text-sm font-semibold text-slate-900">
														{reading.hr}
													</span>
													<span className="text-xs text-slate-500 ml-1">
														bpm
													</span>
												</td>
												<td className="px-6 py-4">
													<span className="text-sm font-semibold text-slate-900">
														{reading.spo2}
													</span>
													<span className="text-xs text-slate-500 ml-1">
														%
													</span>
												</td>
												<td className="px-6 py-4">
													<div
														className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${status.bgColor} ${status.color} ${status.borderColor}`}
													>
														{status.icon}
														{status.status}
													</div>
												</td>
											</tr>
										);
									})
								) : (
									<tr>
										<td
											colSpan="4"
											className="px-6 py-16 text-center"
										>
											<div className="flex flex-col items-center space-y-3">
												<div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center">
													<FileText className="w-6 h-6 text-slate-400" />
												</div>
												<p className="text-sm font-medium text-slate-900">
													No readings found
												</p>
												<p className="text-xs text-slate-500">
													Try adjusting your filters
												</p>
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
	);
}
