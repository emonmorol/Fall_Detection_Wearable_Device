"use client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import loginimage from "@/public/login.png";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import React from "react";
import { useAuth } from "../context/AuthContext";
import Swal from "sweetalert2";

export function LoginForm({ className, ...props }) {
	const { login } = useAuth();
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const navigate = useNavigate();

	const handleSubmit = async (e) => {
		e.preventDefault();
		try {
			await login(email, password);
			navigate("/");
		} catch (err) {
			Swal.fire({
				title: "Error!Login Failed",
				text: "Please Enter Valid Email And Password!",
				icon: "error",
				confirmButtonText: "Try Again",
			});
			console.error("Login failed", err);
		}
	};

	return (
		<div className={cn("flex flex-col gap-6", className)} {...props}>
			<Card className="overflow-hidden p-0">
				<CardContent className="grid p-0 md:grid-cols-2">
					<form onSubmit={handleSubmit} className="p-6 md:p-8">
						<div className="flex flex-col gap-6">
							<div className="flex flex-col items-center text-center">
								<h1 className="text-2xl font-bold">
									Welcome back
								</h1>
								<p className="text-muted-foreground text-balance">
									Login to your Acme Inc account
								</p>
							</div>
							<div className="grid gap-3">
								<Label htmlFor="email">Email</Label>
								<Input
									id="email"
									type="email"
									placeholder="m@example.com"
									required
									value={email}
									onChange={(e) => setEmail(e.target.value)}
								/>
							</div>
							<div className="grid gap-3">
								<div className="flex items-center">
									<Label htmlFor="password">Password</Label>
									<a
										href="#"
										className="ml-auto text-sm underline-offset-2 hover:underline"
									>
										Forgot your password?
									</a>
								</div>
								<Input
									id="password"
									type="password"
									required
									value={password}
									onChange={(e) =>
										setPassword(e.target.value)
									}
								/>
							</div>
							<Button type="submit" className="w-full">
								Login
							</Button>
							<div className="after:border-border relative text-center text-sm after:absolute after:inset-0 after:top-1/2 after:z-0 after:flex after:items-center after:border-t">
								<span className="bg-card text-muted-foreground relative z-10 px-2">
									Or
								</span>
							</div>
							<div className="text-center text-sm">
								Don&apos;t have an account?{" "}
								<Link
									to="/register"
									className="underline underline-offset-4"
								>
									Sign up
								</Link>
							</div>
						</div>
					</form>
					<div className="bg-muted relative hidden md:block">
						<img
							src={loginimage}
							alt="Image"
							className="absolute inset-0 h-full w-full object-cover dark:brightness-[0.2] dark:grayscale"
						/>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
