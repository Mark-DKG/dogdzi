"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ShareGlyph } from "@/components/app/install-app";
import { IconCheck, IconDevice, IconDownload, IconMonitor } from "@/components/icons";
import { Button, buttonClass } from "@/components/ui/button";
import { Badge, Card } from "@/components/ui/surface";
import { detectMobileOS, isStandalone, promptInstall, currentInstallMethod, onInstallChange } from "@/lib/platform";
import { cn } from "@/lib/utils";

interface ApkInfo {
  version: string;
  bytes: number;
  sha256: string;
  minAndroid: string;
  builtAt: string;
  file: string;
}

type Platform = "android" | "ios" | "desktop";

function Section({ id, icon, title, badge, children, highlight }: { id: string; icon: ReactNode; title: string; badge?: string; children: ReactNode; highlight: boolean }) {
  return (
    <Card id={id} className={cn("scroll-mt-6 p-5 sm:p-6", highlight && "ring-2 ring-primary")}>
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-surface-2 text-fg">{icon}</span>
        <h2 className="text-lg font-bold">{title}</h2>
        {badge && <Badge tone="done">{badge}</Badge>}
      </div>
      <div className="mt-4 space-y-4 text-[15px]">{children}</div>
    </Card>
  );
}

function Steps({ items }: { items: ReactNode[] }) {
  return (
    <ol className="space-y-2.5">
      {items.map((it, i) => (
        <li key={i} className="flex gap-3">
          <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary text-xs font-bold text-primary-fg">{i + 1}</span>
          <span className="pt-0.5">{it}</span>
        </li>
      ))}
    </ol>
  );
}

const mb = (b: number) => `${(b / 1048576).toFixed(1)} MB`;

export function DownloadOptions() {
  const [platform, setPlatform] = useState<Platform>("desktop");
  const [apk, setApk] = useState<ApkInfo | null | "missing">(null);
  const [installed, setInstalled] = useState(false);
  const [canPrompt, setCanPrompt] = useState(false);

  useEffect(() => {
    const os = detectMobileOS(navigator.userAgent, navigator.maxTouchPoints);
    setPlatform(os === "other" ? "desktop" : os);
    setInstalled(isStandalone());
    const sync = () => setCanPrompt(currentInstallMethod() === "prompt");
    sync();
    const off = onInstallChange(sync);
    fetch("/downloads/dogdzi-apk.json", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : "missing"))
      .then(setApk)
      .catch(() => setApk("missing"));
    return off;
  }, []);

  const android = (
    <Section key="android" id="android" icon={<IconDevice />} title="Android" badge={platform === "android" ? "Your device" : undefined} highlight={platform === "android"}>
      {apk && apk !== "missing" ? (
        <>
          <a
            href={apk.file}
            download="Dogdzi.apk"
            className={buttonClass("primary", "lg", "w-full sm:w-auto")}
          >
            <IconDownload size={20} /> Download for Android
          </a>
          <p className="text-sm text-muted">
            Version {apk.version} · {mb(apk.bytes)} · Android {apk.minAndroid} or newer
          </p>
          <Steps
            items={[
              <>Tap <b>Download for Android</b> and open the file when it finishes.</>,
              <>If Android asks, allow your browser to <b>install unknown apps</b>, then go back and tap <b>Install</b>.</>,
              <>Open <b>Dogdzi</b> from your home screen and sign in.</>,
            ]}
          />
          <p className="rounded-xl bg-surface-2 px-4 py-3 text-sm text-muted">
            Dogdzi isn&apos;t on Google Play yet, so Android may warn that the app comes from outside the Play Store. That&apos;s expected for apps installed from a website.
            <span className="mt-1 block break-all font-mono text-xs">SHA-256: {apk.sha256}</span>
          </p>
        </>
      ) : apk === "missing" ? (
        <p className="text-muted">The Android download is being prepared. Meanwhile, open Dogdzi in Chrome and choose <b>Install app</b> from the menu.</p>
      ) : (
        <div className="h-12 w-56 animate-pulse rounded-xl bg-surface-2" aria-label="Loading download" />
      )}
    </Section>
  );

  const ios = (
    <Section key="ios" id="iphone" icon={<IconDevice />} title="iPhone and iPad" badge={platform === "ios" ? "Your device" : undefined} highlight={platform === "ios"}>
      <Steps
        items={[
          <>Open <b>dogdzi.vercel.app</b> in <b>Safari</b>.</>,
          <>Tap <b>Share</b> <ShareGlyph />, then <b>Add to Home Screen</b>.</>,
          <>Tap <b>Add</b>. Dogdzi opens full-screen from your home screen, like any other app.</>,
        ]}
      />
      <p className="text-sm text-muted">Apple only allows apps to be downloaded from the App Store, so on iPhone Dogdzi installs straight from Safari instead.</p>
    </Section>
  );

  const desktop = (
    <Section key="desktop" id="computer" icon={<IconMonitor />} title="Computer" badge={platform === "desktop" ? "Your device" : undefined} highlight={platform === "desktop"}>
      {installed ? (
        <p className="flex items-center gap-2 text-done">
          <IconCheck size={18} /> Dogdzi is installed on this device.
        </p>
      ) : canPrompt ? (
        <Button size="lg" onClick={() => void promptInstall()}>
          <IconDownload size={20} /> Install Dogdzi
        </Button>
      ) : (
        <Steps
          items={[
            <>Open <b>dogdzi.vercel.app</b> in Chrome or Edge.</>,
            <>Click the <b>install icon</b> in the address bar, or open the browser menu and choose <b>Install Dogdzi</b>.</>,
          ]}
        />
      )}
      <p className="text-sm text-muted">On a computer you can also just use Dogdzi in your browser. To get it on your phone, open this page there.</p>
    </Section>
  );

  const order = platform === "android" ? [android, ios, desktop] : platform === "ios" ? [ios, android, desktop] : [desktop, android, ios];
  return <div className="space-y-4">{order}</div>;
}
