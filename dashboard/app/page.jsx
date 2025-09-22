import { SectionCards } from "@/components/section-cards";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function Home() {
	return (
		<div className="font-sans grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20">
			<main className="flex flex-col flex-wrap gap-[32px] row-start-2 justify-center items-center">
				<h1 className="text-4xl font-bold">
					Well Come To Fall Detection Device Dashboard
				</h1>
				<Link href="/dashboard" className="text-blue-500">
					<Button className="cursor-pointer">Go to Dashboard</Button>
				</Link>
			</main>
			<footer className="row-start-3 flex gap-[24px] flex-wrap items-center justify-center"></footer>
		</div>
	);
}
