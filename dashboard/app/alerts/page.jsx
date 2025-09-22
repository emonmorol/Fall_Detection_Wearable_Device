"use client";

import { useEffect, useState } from "react";
import {
	AlertTriangle,
	Bell,
	Clock,
	Monitor,
	Shield,
	CheckCircle,
	XCircle,
	Mail,
	MessageSquare,
	Phone,
	Info,
	Calendar,
	Activity,
	AlertCircle,
} from "lucide-react";
import { api } from "@/lib/api";

export default function AlertsPage() {
	const [items, setItems] = useState([]);
	const [sel, setSel] = useState(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		(async () => {
			try {
				setLoading(true);
				const a = await api("/api/alerts/recent?limit=20");
				setItems(a.items || []);
				// Optional: auto-select the first alert
				if ((a.items || []).length && !sel) setSel(a.items[0]);
			} finally {
				setLoading(false);
			}
		})();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	const getSeverityInfo = (severity) => {
		switch (severity) {
			case "critical":
				return {
					color: "text-red-600",
					bgColor: "bg-red-50",
					borderColor: "border-red-200",
					icon: <AlertCircle className="w-4 h-4" />,
					label: "Critical",
				};
			case "warning":
				return {
					color: "text-orange-600",
					bgColor: "bg-orange-50",
					borderColor: "border-orange-200",
					icon: <AlertTriangle className="w-4 h-4" />,
					label: "Warning",
				};
			default:
				return {
					color: "text-blue-600",
					bgColor: "bg-blue-50",
					borderColor: "border-blue-200",
					icon: <Info className="w-4 h-4" />,
					label: "Info",
				};
		}
	};

	const getChannelIcon = (channel) => {
		switch (channel) {
			case "email":
				return <Mail className="w-3 h-3" />;
			case "sms":
				return <Phone className="w-3 h-3" />;
			case "push":
				return <Bell className="w-3 h-3" />;
			case "slack":
				return <MessageSquare className="w-3 h-3" />;
			default:
				return <Bell className="w-3 h-3" />;
		}
	};

	if (loading) {
		return (
			<div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-6">
				<div className="mx-auto">
					<div className="grid lg:grid-cols-2 gap-8 items-start">
						<div className="space-y-4">
							<div className="h-8 bg-gray-200 rounded-lg w-32 animate-pulse"></div>
							{[...Array(5)].map((_, i) => (
								<div
									key={i}
									className="bg-white rounded-xl p-4 shadow-sm animate-pulse"
								>
									<div className="h-4 bg-gray-200 rounded w-24 mb-2"></div>
									<div className="h-5 bg-gray-200 rounded w-48"></div>
								</div>
							))}
						</div>
						<div className="bg-white rounded-xl p-6 shadow-sm animate-pulse">
							<div className="h-6 bg-gray-200 rounded w-20 mb-4"></div>
							<div className="space-y-3">
								<div className="h-4 bg-gray-200 rounded w-32"></div>
								<div className="h-4 bg-gray-200 rounded w-48"></div>
								<div className="h-4 bg-gray-200 rounded w-24"></div>
							</div>
						</div>
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
						<div className="w-10 h-10 bg-gradient-to-r from-red-500 to-orange-600 rounded-xl flex items-center justify-center shadow-lg">
							<AlertTriangle className="w-5 h-5 text-white" />
						</div>
						<div>
							<h1 className="text-3xl font-bold bg-gradient-to-r from-slate-900 to-slate-600 bg-clip-text text-transparent">
								Alert Management
							</h1>
							<p className="text-slate-500 text-sm mt-1">
								Monitor and manage system alerts
							</p>
						</div>
					</div>
					<div className="flex items-center space-x-3 text-sm text-slate-500">
						<Bell className="w-4 h-4" />
						<span>{items.length} alerts found</span>
					</div>
				</div>

				<div className="relative grid lg:grid-cols-2 gap-8 items-start">
					{/* Alerts List (scrollable) */}
					<section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
						<div className="bg-gradient-to-r from-red-500 to-orange-600 p-6">
							<div className="flex items-center space-x-3">
								<div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
									<AlertTriangle className="w-4 h-4 text-white" />
								</div>
								<h2 className="text-lg font-semibold text-white">
									Recent Alerts
								</h2>
							</div>
						</div>

						{/* The key: cap the height and enable vertical scroll */}
						<div className="p-6 max-h-[calc(100vh-280px)] overflow-y-auto pr-1">
							{items.length > 0 ? (
								<div className="space-y-3">
									{items.map((a) => {
										const severityInfo = getSeverityInfo(
											a.severity
										);
										const isSelected = sel?._id === a._id;

										return (
											<div
												key={a._id}
												className={`group relative rounded-xl p-4 cursor-pointer transition-all duration-200 border-2 ${
													isSelected
														? `${severityInfo.borderColor} ${severityInfo.bgColor} shadow-md`
														: "border-slate-100 hover:border-slate-200 hover:shadow-sm hover:bg-slate-50"
												}`}
												onClick={() => setSel(a)}
											>
												{/* Severity indicator */}
												<div className="absolute top-3 right-3">
													<div
														className={`flex items-center space-x-1 ${severityInfo.color}`}
													>
														{severityInfo.icon}
													</div>
												</div>

												{/* Alert info */}
												<div className="pr-8">
													<div className="flex items-center space-x-2 mb-2">
														<Monitor className="w-4 h-4 text-slate-500" />
														<span className="font-mono text-sm font-medium text-slate-700">
															{a.deviceId}
														</span>
														<span
															className={`px-2 py-0.5 rounded-full text-xs font-medium ${severityInfo.bgColor} ${severityInfo.color}`}
														>
															{severityInfo.label}
														</span>
													</div>

													<div className="flex items-center space-x-2 text-xs text-slate-500 mb-3">
														<Clock className="w-3 h-3" />
														<span>
															{new Date(
																a.ts
															).toLocaleString()}
														</span>
													</div>

													<div className="space-y-1">
														<div className="text-sm font-medium text-slate-900">
															{a.rule}
														</div>
														<div className="text-sm text-slate-600">
															Value:{" "}
															<span className="font-semibold">
																{a.value}
															</span>
														</div>
													</div>
												</div>

												{/* Selection indicator bar */}
												{isSelected && (
													<div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-red-500 to-orange-600 rounded-l-xl"></div>
												)}
											</div>
										);
									})}
								</div>
							) : (
								<div className="text-center py-8 text-slate-500">
									<Shield className="w-12 h-12 mx-auto mb-3 text-slate-300" />
									<p className="text-sm">
										No alerts available
									</p>
									<p className="text-xs text-slate-400 mt-1">
										All systems operating normally
									</p>
								</div>
							)}
						</div>
					</section>

					{/* Alert Details (sticky) */}
					<section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden lg:sticky lg:top-4 self-start">
						<div className="bg-gradient-to-r from-blue-500 to-indigo-600 p-6">
							<div className="flex items-center space-x-3">
								<div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
									<Info className="w-4 h-4 text-white" />
								</div>
								<h2 className="text-lg font-semibold text-white">
									Alert Details
								</h2>
							</div>
						</div>

						<div className="p-6">
							{sel ? (
								<div className="space-y-6">
									{/* Basic Info */}
									<div className="space-y-4">
										<div className="flex items-center justify-between">
											<div className="flex items-center space-x-2">
												<Monitor className="w-5 h-5 text-slate-500" />
												<span className="font-mono text-lg font-semibold text-slate-900">
													{sel.deviceId}
												</span>
											</div>

											<div
												className={`flex items-center space-x-2 px-3 py-1 rounded-full ${
													getSeverityInfo(
														sel.severity
													).bgColor
												} ${
													getSeverityInfo(
														sel.severity
													).color
												}`}
											>
												{
													getSeverityInfo(
														sel.severity
													).icon
												}
												<span className="text-sm font-medium">
													{
														getSeverityInfo(
															sel.severity
														).label
													}
												</span>
											</div>
										</div>

										<div className="flex items-center space-x-2 text-slate-600">
											<Calendar className="w-4 h-4" />
											<span className="text-sm">
												{new Date(
													sel.ts
												).toLocaleString()}
											</span>
										</div>
									</div>

									{/* Alert Details */}
									<div className="bg-slate-50 rounded-xl p-4 space-y-3">
										<div>
											<label className="text-xs font-medium text-slate-500 uppercase tracking-wider">
												Alert Rule
											</label>
											<p className="text-lg font-semibold text-slate-900 mt-1">
												{sel.rule}
											</p>
										</div>
										<div>
											<label className="text-xs font-medium text-slate-500 uppercase tracking-wider">
												Triggered Value
											</label>
											<p className="text-lg font-semibold text-slate-900 mt-1">
												{sel.value}
											</p>
										</div>
									</div>

									{/* Notification Channels */}
									<div>
										<label className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3 block">
											Notification Channels
										</label>
										<div className="space-y-2">
											{Object.entries(sel.channels || {})
												.filter(([_, v]) => v)
												.map(([channel], idx) => (
													<div
														key={idx}
														className="flex items-center space-x-3 p-3 bg-blue-50 rounded-lg"
													>
														<div className="text-blue-600">
															{getChannelIcon(
																channel
															)}
														</div>
														<span className="text-sm font-medium text-slate-700 capitalize">
															{channel}
														</span>
													</div>
												))}
											{(!sel.channels ||
												Object.keys(sel.channels)
													.length === 0) && (
												<p className="text-sm text-slate-500 italic">
													No channels configured
												</p>
											)}
										</div>
									</div>

									{/* Delivery Status */}
									<div>
										<label className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3 block">
											Delivery Status
										</label>
										<div className="space-y-2">
											{sel.deliveredTo &&
											sel.deliveredTo.length > 0 ? (
												sel.deliveredTo.map(
													(d, idx) => (
														<div
															key={idx}
															className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
														>
															<div className="flex items-center space-x-3">
																<div className="text-slate-600">
																	{getChannelIcon(
																		d.channel
																	)}
																</div>
																<span className="text-sm font-medium text-slate-700 capitalize">
																	{d.channel}
																</span>
															</div>
															<div className="flex items-center space-x-2">
																{d.status ===
																"delivered" ? (
																	<CheckCircle className="w-4 h-4 text-green-500" />
																) : (
																	<XCircle className="w-4 h-4 text-red-500" />
																)}
																<span
																	className={`text-sm font-medium capitalize ${
																		d.status ===
																		"delivered"
																			? "text-green-600"
																			: "text-red-600"
																	}`}
																>
																	{d.status}
																</span>
															</div>
														</div>
													)
												)
											) : (
												<p className="text-sm text-slate-500 italic">
													No delivery information
													available
												</p>
											)}
										</div>
									</div>
								</div>
							) : (
								<div className="text-center py-12 text-slate-500">
									<Activity className="w-16 h-16 mx-auto mb-4 text-slate-300" />
									<h3 className="text-lg font-semibold text-slate-600 mb-2">
										Select an Alert
									</h3>
									<p className="text-sm">
										Choose an alert from the list to view
										detailed information
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
