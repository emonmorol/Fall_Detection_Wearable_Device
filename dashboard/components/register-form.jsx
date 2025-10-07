"use client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import loginimage from "@/public/login.png";
import { useState } from "react";
import React from "react";
import { Link, useNavigate } from "react-router-dom";
import axiosInstance from "../utils/axiosInstance";
import Swal from "sweetalert2";

export function RegisterForm({ className, ...props }) {
	const [name, setName] = useState("");
	const [username, setUsername] = useState("");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const navigate = useNavigate();

	const handleSubmit = async (e) => {
		e.preventDefault();
		try {
			// Send registration request
			await axiosInstance.post("/users/register", {
				email: email,
				name: name,
				username: username,
				password_hash: password,
			});

			Swal.fire({
				icon: "success",
				title: "Registration Successful!",
				text: "Please login to continue.",
			});

			navigate("/login");
		} catch (err) {
			console.error(err);
			Swal.fire({
				icon: "error",
				title: "Registration Failed!",
				text: err.response?.data?.message || "Something went wrong.",
			});
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
									Create an account
								</h1>
								<p className="text-muted-foreground text-balance">
									Enter your details below to register
								</p>
							</div>
							<div className="grid gap-3">
								<Label htmlFor="name">Name</Label>
								<Input
									id="name"
									type="text"
									placeholder="John Doe"
									required
									value={name}
									onChange={(e) => setName(e.target.value)}
								/>
							</div>
							<div className="grid gap-3">
								<Label htmlFor="username">Username</Label>
								<Input
									id="username"
									type="text"
									placeholder="johndoe"
									required
									value={username}
									onChange={(e) =>
										setUsername(e.target.value)
									}
								/>
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
								<Label htmlFor="password">Password</Label>
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
								Sign Up
							</Button>

							{/* Social media sign-up buttons */}
							<div className="after:border-border relative text-center text-sm after:absolute after:inset-0 after:top-1/2 after:z-0 after:flex after:items-center after:border-t">
								<span className="bg-card text-muted-foreground relative z-10 px-2">
									Or
								</span>
							</div>

							<div className="text-center text-sm">
								Already have an account?{" "}
								<Link
									to="/login"
									className="underline underline-offset-4"
								>
									Login
								</Link>
							</div>
						</div>
					</form>
					<div className="hidden h-full flex-1 items-center justify-center md:flex">
						<img
							src={loginimage}
							alt="Login image"
							className="h-full w-full object-cover"
						/>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
