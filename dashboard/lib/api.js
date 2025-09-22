const BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "";

export async function api(path, { method = "GET", body, headers = {} } = {}) {
	const url = new URL(`${BASE}${path}`);
	const res = await fetch(url, {
		method,
		headers: { "Content-Type": "application/json", ...headers },
		body: body ? JSON.stringify(body) : undefined,
		credentials: "include", // send httpOnly cookies
	});
	console.log(res);
	if (!res.ok) {
		const txt = await res.text().catch(() => res.statusText);
		throw new Error(txt || `HTTP ${res.status}`);
	}
	return res.json();
}
