import { TrendingUp } from "lucide-react";

export function VitalsTile({
	title,
	value,
	unit,
	icon,
	color,
	bgColor,
	isNormal,
	trend,
}) {
	return (
		<div
			className={`group relative bg-white rounded-2xl p-8 shadow-sm border border-slate-200 hover:shadow-lg transition-all duration-300 overflow-hidden ${bgColor}`}
		>
			{/* Background gradient effect */}
			<div
				className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl ${color} opacity-10 rounded-full blur-3xl group-hover:opacity-20 transition-opacity`}
			></div>

			<div className="relative z-10">
				<div className="flex items-center justify-between mb-6">
					<div
						className={`w-12 h-12 bg-gradient-to-r ${color} rounded-xl flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform`}
					>
						{icon}
					</div>

					{/* Status Indicator */}
					<div className="flex items-center space-x-2">
						{isNormal !== null && (
							<div
								className={`flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium ${
									isNormal
										? "bg-green-100 text-green-700"
										: "bg-orange-100 text-orange-700"
								}`}
							>
								<div
									className={`w-1.5 h-1.5 rounded-full ${
										isNormal
											? "bg-green-500"
											: "bg-orange-500"
									}`}
								></div>
								<span>{isNormal ? "Normal" : "Alert"}</span>
							</div>
						)}
					</div>
				</div>

				<div className="space-y-2">
					<p className="text-sm font-medium text-slate-500 uppercase tracking-wider">
						{title}
					</p>
					<div className="flex items-baseline space-x-2">
						<span className="text-5xl font-bold text-slate-900 group-hover:text-slate-700 transition-colors">
							{value}
						</span>
						<span className="text-xl text-slate-500 font-medium">
							{unit}
						</span>
					</div>

					<div className="flex items-center space-x-2 pt-2">
						<TrendingUp className="w-4 h-4 text-slate-400" />
						<span className="text-sm text-slate-500">{trend}</span>
						{trend === "Live" && (
							<div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}
