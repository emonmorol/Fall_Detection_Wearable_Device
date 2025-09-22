"use client";
import { useEffect, useState } from "react";
import { api } from "../../lib/api";

export default function AlertsPage() {
	const [items, setItems] = useState([]);
	const [sel, setSel] = useState(null);

	useEffect(() => {
		(async () => {
			const a = await api("/api/alerts/recent?limit=20");
			setItems(a.items || []);
			console.log("items:", a);
		})();
	}, []);

	return (
		<div className="grid md:grid-cols-2 gap-6">
			<section>
				<h1 className="text-xl font-semibold mb-2">Recent Alerts</h1>
				<ul className="space-y-2">
					{items.map((a) => (
						<li
							key={a._id}
							className="rounded border p-3 text-sm cursor-pointer hover:bg-muted"
							onClick={() => setSel(a)}
						>
							<div className="font-mono text-xs text-muted-foreground">
								{a.deviceId} · {new Date(a.ts).toLocaleString()}
							</div>
							<div>
								Rule: {a.rule} · Value: {a.value}
							</div>
						</li>
					))}
				</ul>
			</section>
			<section>
				<h2 className="font-medium mb-2">Details</h2>
				{sel ? (
					<div className="rounded border p-4 text-sm">
						<div className="font-mono text-xs text-muted-foreground">
							{sel.deviceId} · {new Date(sel.ts).toLocaleString()}
						</div>
						<div className="my-2">
							Rule: {sel.rule} · Value: {sel.value}
						</div>
						<div>
							Channels:{" "}
							{Object.entries(sel.channels || {})
								.filter(([_, v]) => v)
								.map(([k]) => k)
								.join(", ") || "None"}
						</div>
						<div className="text-xs text-muted-foreground mt-2">
							Delivered:{" "}
							{sel.deliveredTo
								?.map((d) => `${d.channel}:${d.status}`)
								.join(", ") || "n/a"}
						</div>
					</div>
				) : (
					<div className="text-sm text-muted-foreground">
						Select an alert.
					</div>
				)}
			</section>
		</div>
	);
}
