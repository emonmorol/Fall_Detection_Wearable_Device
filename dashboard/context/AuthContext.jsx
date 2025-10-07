"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";

const LS_KEY = "auth_payload_v1";

// create the context (no default value needed beyond null)
const Ctx = createContext(null);

export function AuthProvider({ children }) {
	const [user, setUser] = useState(null);
	const [token, setToken] = useState(null);

	const router = useRouter();
	const params = useSearchParams();

	useEffect(() => {
		const raw =
			typeof window !== "undefined" ? localStorage.getItem(LS_KEY) : null;
		if (raw) {
			try {
				const parsed = JSON.parse(raw);
				setUser(parsed.user);
				setToken(parsed.token);
				// refresh presence cookie (30d)
				document.cookie = `authPresence=1; path=/; max-age=${
					60 * 60 * 24 * 30
				}`;
			} catch {
				// ignore parse errors
			}
		}
	}, []);

	const doLogin = async (email, password) => {
		const res = await api("/auth/login", {
			method: "POST",
			body: JSON.stringify({ email, password }),
		});

		localStorage.setItem(LS_KEY, JSON.stringify(res));
		setUser(res.user);
		setToken(res.token);
		document.cookie = `authPresence=1; path=/; max-age=${
			60 * 60 * 24 * 30
		}`;

		const next = params.get("next") || "/";
		router.replace(next);
	};

	const doRegister = async (email, password, phone = null) => {
		const res = await api("/auth/register", {
			method: "POST",
			body: JSON.stringify({ email, password, phone }),
		});

		localStorage.setItem(LS_KEY, JSON.stringify(res));
		setUser(res.user);
		setToken(res.token);
		document.cookie = `authPresence=1; path=/; max-age=${
			60 * 60 * 24 * 30
		}`;

		router.replace("/");
	};

	const logout = () => {
		localStorage.removeItem(LS_KEY);
		setUser(null);
		setToken(null);
		// expire presence cookie
		document.cookie = "authPresence=; path=/; max-age=0";
		router.replace("/login");
	};

	const value = useMemo(
		() => ({
			user,
			token,
			login: doLogin,
			register: doRegister,
			logout,
		}),
		[user, token]
	);

	return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
	const ctx = useContext(Ctx);
	if (!ctx) throw new Error("useAuth must be used within AuthProvider");
	return ctx;
}
