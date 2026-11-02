import type { Metadata } from "next";
import Link from "next/link";
import { Monogram } from "@/components/brand/logo";

export const metadata: Metadata = { title: "Privacy notice" };

const STORAGE = [
  ["Supabase auth cookies (sb-…)", "Keep you signed in securely", "Essential", "Until you sign out or the session expires"],
  ["dogdzi:guest:v1 (browser storage)", "Holds a guest's actions, goals and history on this device", "Essential", "Until you sign up, erase it, or clear site data"],
  ["dogdzi:consent:v1 (browser storage)", "Remembers your analytics choice", "Essential", "Until you change it"],
  ["dogdzi:reminders-sent (browser storage)", "Prevents duplicate reminders", "Essential", "Resets daily"],
  ["dogdzi:guest-id (browser storage)", "Random id to count guest sessions", "Analytics, only with consent", "Deleted if you turn analytics off"],
  ["Vercel Web Analytics", "Anonymous page views (no cookies)", "Analytics, only with consent", "Aggregated by Vercel"],
];

export default function PrivacyPage() {
  return (
    <div className="min-h-dvh">
      <header className="bg-forest-900 px-5 py-5">
        <div className="mx-auto max-w-3xl">
          <Link href="/" aria-label="DOGDZI home">
            <Monogram height={22} tile={false} />
          </Link>
        </div>
      </header>
      <main id="main" className="mx-auto max-w-3xl px-5 py-10 text-[15px] leading-relaxed">
        <h1 className="text-3xl font-bold tracking-tight">Privacy notice</h1>
        <p className="mt-2 text-sm text-muted">DOGDZI by 9DEVs. Please have this reviewed by your legal adviser before launch.</p>

        <h2 className="mt-10 text-xl font-bold">What we collect and why</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5">
          <li>
            <b>Account details</b>: your email and password (stored hashed by our authentication provider) so you can sign in.
          </li>
          <li>
            <b>Your content</b>: actions, schedules, goals, milestones, history, reasons you record and recovery plans. Used only to run the app for you. Guests&apos; content never leaves their browser.
          </li>
          <li>
            <b>Settings</b>: life areas, time zone, reminder style, quiet hours and notification limits.
          </li>
          <li>
            <b>Push subscriptions</b>: if you turn on push reminders, your browser&apos;s push endpoint, so we can deliver them.
          </li>
          <li>
            <b>Usage analytics (optional)</b>: only if you allow it. Session start/end and estimated time in the app, your device type, and events such as &ldquo;action completed&rdquo;. We never send action titles, notes or reasons to analytics.
          </li>
        </ul>

        <h2 className="mt-10 text-xl font-bold">Cookies and browser storage</h2>
        <div className="mt-3 overflow-x-auto rounded-2xl border border-line">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="bg-surface-2 text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Purpose</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Duration</th>
              </tr>
            </thead>
            <tbody>
              {STORAGE.map((r) => (
                <tr key={r[0]} className="border-t border-line bg-surface">
                  {r.map((c, i) => (
                    <td key={i} className="px-4 py-3 align-top">
                      {c}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-sm text-muted">We use no advertising or cross-site tracking. You can change your analytics choice in Settings at any time.</p>

        <h2 className="mt-10 text-xl font-bold">Who can see your data</h2>
        <p className="mt-3">
          Database rules ensure only you can read your content. A small number of DOGDZI staff can access account details to provide support. Access to your content needs a specific permission and a recorded reason, and every access is logged. Staff cannot edit or erase your accountability history.
        </p>

        <h2 className="mt-10 text-xl font-bold">Your choices</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5">
          <li>Download a copy of your data from Settings.</li>
          <li>Turn analytics on or off in Settings.</li>
          <li>Delete your account from Settings. This permanently removes your content. Anonymous usage counts are kept with no link to you.</li>
        </ul>

        <h2 className="mt-10 text-xl font-bold">Processors</h2>
        <p className="mt-3">Supabase (database and authentication), Vercel (hosting and anonymous web analytics), and your browser vendor&apos;s push service for notifications.</p>

        <p className="mt-10 text-sm text-muted">
          Questions? Contact the DOGDZI team. See also our{" "}
          <Link href="/terms" className="underline">
            Terms of Service
          </Link>
          . <Link href="/" className="underline">Back to home</Link>
        </p>
      </main>
    </div>
  );
}
