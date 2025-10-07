import { NextRequest, NextResponse } from "next/server";

const PUBLIC_PATHS = ["/login", "/register", "/_next", "/favicon.ico", "/api"];

export function middleware(req: NextRequest) {
	const { pathname } = req.nextUrl;
	const isPublic = PUBLIC_PATHS.some(
		(p) => pathname === p || pathname.startsWith(p + "/")
	);

	// Presence cookie set by AuthContext on login
	const hasPresence = req.cookies.get("authPresence")?.value === "1";

	if (!isPublic && !hasPresence) {
		const url = req.nextUrl.clone();
		url.pathname = "/login";
		url.searchParams.set("next", pathname);
		return NextResponse.redirect(url);
	}

	return NextResponse.next();
}

export const config = {
	matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
