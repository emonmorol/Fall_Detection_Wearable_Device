"use client";

import * as React from "react";
import {
	IconChartBar,
	IconDashboard,
	IconFolder,
	IconInnerShadowTop,
	IconListDetails,
	IconUsers,
} from "@tabler/icons-react";

import { NavMain } from "@/components/nav-main";
import { NavUser } from "@/components/nav-user";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
} from "@/components/ui/sidebar";

const data = {
	user: {
		name: "Team Paradox",
		email: "team_paradox@gmail.com",
		avatar: "/avatar.png",
	},
	navMain: [
		{
			title: "Dashboard",
			url: "/",
			icon: IconDashboard,
		},
		{
			title: "Realtime",
			url: "/realtime",
			icon: IconListDetails,
		},
		{
			title: "Readings",
			url: "/readings",
			icon: IconChartBar,
		},
		{
			title: "Alerts",
			url: "/alerts",
			icon: IconFolder,
		},
		{
			title: "Fall History",
			url: "/fall-history",
			icon: IconUsers,
		},
		{
			title: "Settings",
			url: "/settings",
			icon: IconUsers,
		},
	],
};

export function AppSidebar({ ...props }) {
	return (
		<Sidebar collapsible="offcanvas" {...props}>
			<SidebarHeader>
				<SidebarMenu>
					<SidebarMenuItem>
						<SidebarMenuButton
							asChild
							className="data-[slot=sidebar-menu-button]:!p-1.5"
						>
							<a href="#">
								<IconInnerShadowTop className="!size-5" />
								<span className="text-base font-semibold">
									AuraLink
								</span>
							</a>
						</SidebarMenuButton>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarHeader>
			<SidebarContent>
				<NavMain items={data.navMain} />
			</SidebarContent>
			<SidebarFooter>
				<NavUser user={data.user} />
			</SidebarFooter>
		</Sidebar>
	);
}
