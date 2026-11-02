import Link from "next/link";
import { Monogram } from "@/components/brand/logo";

export default function NotFound() {
  return (
    <main id="main" className="flex min-h-dvh flex-col items-center justify-center bg-forest-900 px-6 text-center text-cream-100">
      <Monogram height={40} tile={false} />
      <h1 className="mt-8 text-2xl font-bold text-cream-200">Page not found</h1>
      <p className="mt-2 text-forest-200">That link doesn&apos;t lead anywhere. Let&apos;s get you back on track.</p>
      <Link href="/app" className="mt-6 rounded-xl bg-cream-200 px-5 py-3 text-sm font-bold text-forest-900">
        Go to today
      </Link>
    </main>
  );
}
