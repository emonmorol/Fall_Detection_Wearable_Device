"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
	AlertTriangle,
	Bell,
	Info,
	Activity,
	Calendar,
	Monitor,
	Mail,
	MessageSquare,
	Phone,
	RefreshCcw,
	ArrowUpDown,
	XCircle,
	Loader2,
	Pause,
	Play,
	Search,
	Database,
} from "lucide-react";
import { api } from "@/lib/api";

// shadcn/ui
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";

function cn(...xs) {
	return xs.filter(Boolean).join(" ");
}

const RULE_LABEL = {
	hrHigh: "Heart Rate High",
	hrLow: "Heart Rate Low",
	spo2Low: "Low Oxygen Level",
	spo2High: "High Oxygen Level",
	fallDetected: "Fall Detected",
	deviceOffline: "Device Offline",
	batteryLow: "Low Battery",
};

const SEVERITY = {
	critical: {
		label: "Critical",
		dot: "bg-red-500",
		pill: "bg-red-600 text-white",
		row: "bg-red-50",
		icon: <AlertTriangle className="h-4 w-4" />,
	},
	warning: {
		label: "Warning",
		dot: "bg-amber-500",
		pill: "bg-amber-600 text-white",
		row: "bg-amber-50/40",
		icon: <AlertTriangle className="h-4 w-4" />,
	},
	info: {
		label: "Info",
		dot: "bg-sky-500",
		pill: "bg-sky-600 text-white",
		row: "bg-sky-50/40",
		icon: <Info className="h-4 w-4" />,
	},
};

function ChannelIcon({ ch, className = "h-3.5 w-3.5" }) {
	if (ch === "email") return <Mail className={className} />;
	if (ch === "sms") return <Phone className={className} />;
	if (ch === "slack") return <MessageSquare className={className} />;
	return <Bell className={className} />;
}

function fmtRule(r) {
	return RULE_LABEL[r] ?? r.replace(/([A-Z])/g, " $1").trim();
}

function timeAgo(d) {
	const diff = (Date.now() - d.getTime()) / 1000;
	const steps = [
		[60, "second"],
		[60, "minute"],
		[24, "hour"],
		[7, "day"],
		[4.34524, "week"],
		[12, "month"],
		[Infinity, "year"],
	];
	let unit = "second";
	let value = -Math.floor(diff);
	let cur = diff;
	let denom = 1;
	for (let i = 0; i < steps.length; i++) {
		const [n, u] = steps[i];
		if (cur < n) {
			unit = u;
			value = -Math.round(cur / denom);
			break;
		}
		denom *= n;
		cur /= n;
	}
	return new Intl.RelativeTimeFormat(undefined, { numeric: "auto" }).format(
		value,
		unit
	);
}

function sevRank(s) {
	if (s === "critical") return 0;
	if (s === "warning") return 1;
	return 2;
}

export default function AlertsPage() {
	const [items, setItems] = useState([]);
	const [sel, setSel] = useState(null);
	const [loading, setLoading] = useState(true);
	const [err, setErr] = useState(null);

	// controls
	const [query, setQuery] = useState("");
	const [severity, setSeverity] = useState("all"); // all | critical | warning | info
	const [sort, setSort] = useState("recent"); // recent | severity | valueDesc
	const [dense, setDense] = useState(false);
	const [auto, setAuto] = useState(true);

	const abortRef = useRef(null);

	const fetchAlerts = useCallback(async () => {
		abortRef.current?.abort?.();
		const ac = new AbortController();
		abortRef.current = ac;
		try {
			setErr(null);
			setLoading(true);
			const res = await api("/api/alerts/recent?limit=50", {
				signal: ac.signal,
			});
			const list = res?.items ?? [];
			setItems(list);
			if (!sel && list.length) setSel(list[0]);
		} catch (e) {
			if (e?.name !== "AbortError")
				setErr(e?.message ?? "Failed to load alerts");
		} finally {
			setLoading(false);
		}
	}, [sel]);

	useEffect(() => {
		fetchAlerts();
	}, [fetchAlerts]);

	useEffect(() => {
		if (!auto) return;
		const id = setInterval(fetchAlerts, 15000);
		return () => clearInterval(id);
	}, [auto, fetchAlerts]);

	// list keyboard nav
	const onKeyNav = (e) => {
		if (!items.length) return;
		const idx = sel ? items.findIndex((x) => x._id === sel._id) : -1;
		if (e.key === "ArrowDown") {
			e.preventDefault();
			const next = items[Math.min(idx + 1, items.length - 1)];
			if (next) setSel(next);
		} else if (e.key === "ArrowUp") {
			e.preventDefault();
			const prev = items[Math.max(idx - 1, 0)];
			if (prev) setSel(prev);
		}
	};

	const filtered = useMemo(() => {
		let out = [...items];
		if (severity !== "all")
			out = out.filter((i) => i.severity === severity);
		if (query.trim()) {
			const q = query.trim().toLowerCase();
			out = out.filter((i) => {
				const txt = `${fmtRule(i.rule)} ${i.deviceId ?? ""} ${
					i.value ?? ""
				}`.toLowerCase();
				return txt.includes(q);
			});
		}
		if (sort === "severity")
			out.sort((a, b) => sevRank(a.severity) - sevRank(b.severity));
		else if (sort === "valueDesc")
			out.sort((a, b) => (Number(b.value) || 0) - (Number(a.value) || 0));
		else out.sort((a, b) => new Date(b.ts) - new Date(a.ts));
		return out;
	}, [items, query, severity, sort]);

	useEffect(() => {
		if (sel && !filtered.find((x) => x._id === sel._id)) {
			setSel(filtered[0] ?? null);
		}
	}, [query, severity, sort]); // keep selection stable

	return (
		<div className="min-h-screen bg-slate-50">
			{/* Main */}
			<div className="mx-auto px-4 py-4">
				{/* Header */}
				<div className="flex items-center justify-between py-4 pb-8">
					<div className="flex items-center space-x-4">
						<div className="w-12 h-12 bg-gradient-to-r from-red-500 to-orange-600 rounded-xl flex items-center justify-center shadow-lg">
							<AlertTriangle className="w-6 h-6 text-white" />
						</div>
						<div>
							<h1 className="text-2xl font-bold bg-gradient-to-r from-slate-900 to-slate-600 bg-clip-text text-transparent">
								Alert Management
							</h1>
							<p className="text-slate-500 text-sm mt-1">
								Monitor and manage system alerts
							</p>
						</div>
					</div>

					<div className="flex items-center justify-between gap-3">
						<div className="flex items-center gap-2">
							<Button
								variant="outline"
								size="sm"
								onClick={fetchAlerts}
							>
								<RefreshCcw className="mr-1.5 h-4 w-4" />
								Refresh
							</Button>
						</div>
					</div>
				</div>
				{/* Top Bar */}
				<div className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur rounded-lg mb-4">
					<div className="mx-auto p-4">
						{/* Controls */}
						<div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
							<div className="relative">
								<Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
								<Input
									value={query}
									onChange={(e) => setQuery(e.target.value)}
									placeholder="Search by rule, device, value…"
									className="pl-8"
									aria-label="Search alerts"
								/>
							</div>

							<div className="flex items-center gap-2">
								<div className="inline-flex overflow-hidden rounded-md border border-slate-200">
									{["all", "critical", "warning", "info"].map(
										(k) => (
											<Button
												key={k}
												size="sm"
												variant={
													severity === k
														? "default"
														: "ghost"
												}
												onClick={() => setSeverity(k)}
												className={cn(
													severity === k
														? "bg-slate-900 hover:bg-slate-900 text-white"
														: "text-slate-700"
												)}
											>
												{k[0].toUpperCase() +
													k.slice(1)}
											</Button>
										)
									)}
								</div>
							</div>

							<div className="flex items-center justify-between gap-2">
								<div className="flex items-center gap-1">
									<ArrowUpDown className="h-4 w-4 text-slate-400" />
									<Select
										value={sort}
										onValueChange={setSort}
									>
										<SelectTrigger className="h-9 w-[180px]">
											<SelectValue placeholder="Sort by" />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="recent">
												Most Recent
											</SelectItem>
											<SelectItem value="severity">
												Severity
											</SelectItem>
											<SelectItem value="valueDesc">
												Value (High→Low)
											</SelectItem>
										</SelectContent>
									</Select>
								</div>
							</div>
						</div>
					</div>
				</div>
				<div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(26rem,32rem)]">
					{/* List */}
					<Card className="overflow-hidden">
						<CardHeader>
							<CardTitle className="text-sm">
								Alert list
							</CardTitle>
						</CardHeader>
						<Separator />
						<ScrollArea
							className="max-h-[70vh]"
							role="listbox"
							onKeyDown={onKeyNav}
							tabIndex={0}
						>
							{loading && <ListSkeleton dense={dense} />}

							{!loading && err && (
								<div className="flex items-center gap-2 border-b border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
									<XCircle className="h-4 w-4" />
									<span>{err}</span>
								</div>
							)}

							{!loading && !err && filtered.length === 0 && (
								<div className="px-6 py-10 text-center text-slate-600">
									<div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100">
										<Bell className="h-6 w-6 text-slate-400" />
									</div>
									<p className="font-medium">
										No alerts match your filters
									</p>
									<p className="text-sm text-slate-500">
										Clear search or change severity.
									</p>
								</div>
							)}

							{!loading &&
								!err &&
								filtered.map((a) => {
									const sev =
										SEVERITY[a.severity] ?? SEVERITY.info;
									const selected = sel?._id === a._id;
									return (
										<button
											key={a._id}
											role="option"
											aria-selected={selected}
											onClick={() => setSel(a)}
											className={cn(
												"w-full border-b border-slate-100 text-left transition-colors cursor-pointer",
												selected
													? sev.row
													: "hover:bg-slate-50"
											)}
										>
											<div
												className={cn(
													"flex items-start gap-3 px-4",
													dense ? "py-2.5" : "py-3.5"
												)}
											>
												{/* <span
													className={cn(
														"mt-1 h-2.5 w-2.5 rounded-full",
														sev.dot
													)}
												/> */}
												<div className="flex justify-between min-w-0 flex-1">
													<div className="flex items-center justify-between gap-2">
														<Badge
															className={cn(
																"gap-1 px-2 py-0.5 text-[11px] font-semibold",
																sev.pill
															)}
														>
															{sev.icon}
															{SEVERITY[
																a.severity
															]?.label ?? "Info"}
														</Badge>
														<span className="truncate text-sm font-medium text-slate-900">
															{fmtRule(a.rule)}
														</span>
														{a.deviceId && (
															<span className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-1.5 py-0.5 font-mono">
																<Monitor className="h-3 w-3" />
																{a.deviceId}
															</span>
														)}
													</div>

													<div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-600">
														{typeof a.value !==
															"undefined" && (
															<div className="w-11 h-11 bg-gradient-to-r from-red-500 to-orange-600 rounded-xl flex items-center justify-center shadow-lg">
																<span className="text-sm font-semibold text-white text-center">
																	{a.value}
																</span>
															</div>
														)}
														{/* <span className="inline-flex items-center gap-1">
															<Calendar className="h-3 w-3" />
															{timeAgo(
																new Date(a.ts)
															)}
														</span> */}
														{!!a.channels &&
															Object.entries(
																a.channels
															)
																.filter(
																	([, v]) => v
																)
																.map(([ch]) => (
																	<span
																		key={ch}
																		className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-1.5 py-0.5"
																	>
																		<ChannelIcon
																			ch={
																				ch
																			}
																		/>
																		<span className="capitalize">
																			{ch}
																		</span>
																	</span>
																))}
													</div>
												</div>
											</div>
										</button>
									);
								})}
						</ScrollArea>

						<div className="flex items-center justify-between px-4 py-2 text-xs text-slate-500">
							<div className="inline-flex items-center gap-1">
								<Bell className="h-3.5 w-3.5" />
								<span>
									{filtered.length} of {items.length} alerts
								</span>
							</div>
							{loading && (
								<span className="inline-flex items-center gap-1">
									<Loader2 className="h-3.5 w-3.5 animate-spin" />
									updating…
								</span>
							)}
						</div>
					</Card>

					{/* Details */}
					<Card className="sticky top-[68px] h-fit">
						<CardHeader>
							<CardTitle className="text-sm">
								Alert details
							</CardTitle>
						</CardHeader>
						<Separator />
						{!sel ? (
							<CardContent className="px-6 py-10 text-center text-slate-600">
								<div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-xl bg-slate-100">
									<Activity className="h-7 w-7 text-slate-400" />
								</div>
								<p className="font-medium">Select an alert</p>
								<p className="text-sm text-slate-500">
									Choose an alert from the list to see more.
								</p>
							</CardContent>
						) : (
							<CardContent className="space-y-6 p-4">
								<div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
									<div className="flex flex-wrap items-center gap-2">
										<Badge
											className={cn(
												"gap-1 px-2 py-0.5 text-[11px] font-semibold",
												(
													SEVERITY[sel.severity] ??
													SEVERITY.info
												).pill
											)}
										>
											{
												(
													SEVERITY[sel.severity] ??
													SEVERITY.info
												).icon
											}
											{
												(
													SEVERITY[sel.severity] ??
													SEVERITY.info
												).label
											}
										</Badge>
										<h3 className="text-base font-semibold text-slate-900">
											{fmtRule(sel.rule)}
										</h3>
									</div>
									<div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-slate-600">
										<span className="inline-flex items-center gap-1">
											<Calendar className="h-4 w-4" />
											{new Date(sel.ts).toLocaleString()}
										</span>
										{typeof sel.value !== "undefined" && (
											<span className="inline-flex items-center gap-1">
												<Activity className="h-4 w-4" />
												<span className="font-semibold text-slate-900">
													{sel.value}
												</span>
											</span>
										)}
									</div>
								</div>

								<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
									<div className="rounded-lg border border-slate-200 bg-white p-4">
										<p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
											Device
										</p>
										<p className="mt-1 font-mono text-sm text-slate-900">
											{sel.deviceId ?? "—"}
										</p>
									</div>

									<div className="rounded-lg border border-slate-200 bg-white p-4">
										<p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
											Channels
										</p>
										<div className="mt-1 flex flex-wrap gap-1.5">
											{sel.channels &&
											Object.entries(sel.channels).filter(
												([, v]) => v
											).length ? (
												Object.entries(sel.channels)
													.filter(([, v]) => v)
													.map(([ch]) => (
														<span
															key={ch}
															className="inline-flex items-center gap-1 rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-xs"
														>
															<ChannelIcon
																ch={ch}
															/>
															<span className="capitalize">
																{ch}
															</span>
														</span>
													))
											) : (
												<span className="text-sm text-slate-500">
													No channels
												</span>
											)}
										</div>
									</div>
								</div>

								<div>
									<p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
										Delivery status
									</p>
									{!sel.deliveredTo ||
									sel.deliveredTo.length === 0 ? (
										<div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
											No delivery information available.
										</div>
									) : (
										<ul className="space-y-2">
											{sel.deliveredTo.map((d, idx) => (
												<li
													key={idx}
													className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2"
												>
													<div className="flex items-center gap-2">
														<span className="rounded-lg bg-slate-100 p-1.5">
															<ChannelIcon
																ch={d.channel}
																className="h-4 w-4"
															/>
														</span>
														<span className="text-sm font-medium capitalize text-slate-800">
															{d.channel}
														</span>
													</div>
													<div className="flex items-center gap-1.5">
														{d.status ===
														"delivered" ? (
															<>
																<Badge className="bg-emerald-600 text-white">
																	Delivered
																</Badge>
															</>
														) : d.status ===
														  "pending" ? (
															<>
																<Loader2 className="h-4 w-4 animate-spin text-slate-500" />
																<Badge variant="secondary">
																	Pending
																</Badge>
															</>
														) : (
															<>
																<XCircle className="h-4 w-4 text-rose-600" />
																<Badge className="bg-rose-600 text-white">
																	Failed
																</Badge>
															</>
														)}
													</div>
												</li>
											))}
										</ul>
									)}
								</div>
							</CardContent>
						)}
					</Card>
				</div>
			</div>
		</div>
	);
}

/* ------- skeleton ------- */
function ListSkeleton({ dense }) {
	return (
		<div className="divide-y divide-slate-100">
			{Array.from({ length: 7 }).map((_, i) => (
				<div
					key={i}
					className={cn("px-4", dense ? "py-2.5" : "py-3.5")}
				>
					<div className="flex items-start gap-3">
						<Skeleton className="mt-1 h-2.5 w-2.5 rounded-full" />
						<div className="w-full">
							<Skeleton className="h-3 w-40" />
							<div className="mt-2 flex gap-2">
								<Skeleton className="h-4 w-16" />
								<Skeleton className="h-4 w-24" />
								<Skeleton className="h-4 w-20" />
							</div>
						</div>
					</div>
				</div>
			))}
		</div>
	);
}
