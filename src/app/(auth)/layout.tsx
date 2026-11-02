import Link from "next/link";
import { Lockup, Tagline } from "@/components/brand/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <div className="flex flex-col items-center justify-center bg-forest-900 px-6 pb-10 pt-[max(2.5rem,env(safe-area-inset-top))] text-center lg:pb-0">
        <Link href="/" aria-label="DOGDZI home">
          <Lockup width={260} priority className="w-48 lg:w-72" />
        </Link>
        <Tagline className="mt-5 text-cream-200" />
        <p className="mt-6 hidden max-w-sm text-sm text-forest-200 lg:block">Plan your actions, follow through, account for what slipped, and recover. Calmly.</p>
      </div>
      <main id="main" className="flex items-start justify-center px-5 py-10 lg:items-center">
        <div className="w-full max-w-sm animate-fade-in">{children}</div>
      </main>
    </div>
  );
}
