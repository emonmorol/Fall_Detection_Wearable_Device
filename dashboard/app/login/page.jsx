"use client";
import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";

export default function LoginPage() {
	const { login } = useAuth();
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [err, setErr] = useState(null);
	const [loading, setLoading] = useState(false);

	const submit = async (e) => {
		e.preventDefault();
		setErr(null);
		setLoading(true);
		try {
			await login(email, password);
		} catch (e) {
			setErr(e.message || "Login failed");
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="container min-h-screen grid place-items-center">
			<div className="card w-full max-w-4xl overflow-hidden grid md:grid-cols-2">
				<form onSubmit={submit} className="p-8 space-y-6">
					<div className="text-center">
						<h1 className="text-2xl font-bold">Welcome back</h1>
						<p className="text-neutral-500">
							Login to your account
						</p>
					</div>
					{err && (
						<div className="text-sm text-red-600 bg-red-50 border border-red-200 p-2 rounded">
							{err}
						</div>
					)}
					<div>
						<label className="block text-sm mb-1" htmlFor="email">
							Email
						</label>
						<input
							id="email"
							type="email"
							className="input"
							placeholder="m@example.com"
							required
							value={email}
							onChange={(e) => setEmail(e.target.value)}
						/>
					</div>
					<div>
						<div className="flex items-center justify-between mb-1">
							<label className="block text-sm" htmlFor="password">
								Password
							</label>
							<a className="text-xs underline" href="#">
								Forgot your password?
							</a>
						</div>
						<input
							id="password"
							type="password"
							className="input"
							required
							value={password}
							onChange={(e) => setPassword(e.target.value)}
						/>
					</div>
					<button disabled={loading} className="btn w-full">
						{loading ? "Signing in…" : "Login"}
					</button>
					<div className="text-center text-sm">
						Don&apos;t have an account?{" "}
						<Link className="underline" href="/register">
							Sign up
						</Link>
					</div>
				</form>
				<div className="hidden md:block bg-[url('/login.png')] bg-cover bg-center min-h-[320px]" />
			</div>
		</div>
	);
}
