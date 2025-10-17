"use client";

import {
	SidebarGroup,
	SidebarGroupContent,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
} from "@/components/ui/sidebar";
import Link from "next/link";
import { Separator } from "@radix-ui/react-select";
import { usePathname } from "next/navigation";

export function NavMain({ items }) {
	const pathname = usePathname();
	console.log(pathname);
	return (
		<SidebarGroup>
			<Separator className="my-2 h-px" />
			<SidebarGroupContent className="flex flex-col gap-2">
				<SidebarMenu>
					{items.map((item) => (
						<Link href={item.url} key={item.title}>
							<SidebarMenuItem
								key={item.title}
								className={
									pathname === item.url
										? "bg-gray-200 rounded"
										: ""
								}
							>
								<SidebarMenuButton tooltip={item.title}>
									{item.icon && <item.icon />}
									<span>{item.title}</span>
								</SidebarMenuButton>
							</SidebarMenuItem>
						</Link>
					))}
				</SidebarMenu>
			</SidebarGroupContent>
		</SidebarGroup>
	);
}
