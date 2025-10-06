export function toKpi(state) {
	const s = state?.stats;
	console.log(s);
	return {
		activeDevices: s?.devices?.total ?? null,
		readings24h: s?.readings?.total ?? null,
		alerts24h: s?.alerts?.total ?? null,
		minSpO2: s?.spo2?.min ?? null,
		maxHr: s?.heartRate?.max ?? null,

		// keep these in case you later add more KPI cards or sparklines
		avgSpO2: s?.spo2?.avg ?? null,
		avgHeartRate: s?.heartRate?.avg ?? null,
	};
}
