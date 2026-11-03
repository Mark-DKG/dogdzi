import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement> & { size?: number };

function base({ size = 20, ...rest }: P, children: React.ReactNode) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const IconToday = (p: P) => base(p, <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>);
export const IconCalendar = (p: P) => base(p, <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></>);
export const IconFlag = (p: P) => base(p, <><path d="M5 21V4" /><path d="M5 4h11l-2 4 2 4H5" /></>);
export const IconReview = (p: P) => base(p, <><path d="M4 12a8 8 0 1 0 3-6.2" /><path d="M4 4v4h4" /><path d="M12 8v4l2 2" /></>);
export const IconHistory = (p: P) => base(p, <><path d="M8 6h13M8 12h13M8 18h13" /><circle cx="4" cy="6" r="1" /><circle cx="4" cy="12" r="1" /><circle cx="4" cy="18" r="1" /></>);
export const IconChart = (p: P) => base(p, <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></>);
export const IconSettings = (p: P) => base(p, <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" /></>);
export const IconPlus = (p: P) => base(p, <path d="M12 5v14M5 12h14" />);
export const IconCheck = (p: P) => base(p, <path d="m5 12 5 5 9-10" />);
export const IconX = (p: P) => base(p, <path d="M6 6l12 12M18 6 6 18" />);
export const IconMore = (p: P) => base(p, <><circle cx="5" cy="12" r="1.2" /><circle cx="12" cy="12" r="1.2" /><circle cx="19" cy="12" r="1.2" /></>);
export const IconRepeat = (p: P) => base(p, <><path d="M17 2l3 3-3 3" /><path d="M4 11V9a4 4 0 0 1 4-4h12" /><path d="M7 22l-3-3 3-3" /><path d="M20 13v2a4 4 0 0 1-4 4H4" /></>);
export const IconBell = (p: P) => base(p, <><path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0" /></>);
export const IconClock = (p: P) => base(p, <><circle cx="12" cy="12" r="9" /><path d="M12 7v5h4" /></>);
export const IconArrowRight = (p: P) => base(p, <path d="M5 12h14M13 6l6 6-6 6" />);
export const IconChevronLeft = (p: P) => base(p, <path d="m15 18-6-6 6-6" />);
export const IconChevronUp = (p: P) => base(p, <path d="m18 15-6-6-6 6" />);
export const IconChevronDown = (p: P) => base(p, <path d="m6 9 6 6 6-6" />);
export const IconUser = (p: P) => base(p, <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>);
export const IconShield = (p: P) => base(p, <path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6l-8-3Z" />);
export const IconCloudOff = (p: P) => base(p, <><path d="m2 2 20 20" /><path d="M5.8 8.6A5 5 0 0 0 7 18h10c.6 0 1.2-.1 1.7-.3M21.5 15A4.5 4.5 0 0 0 17 9h-.3A7 7 0 0 0 9.1 5.2" /></>);
export const IconLifebuoy = (p: P) => base(p, <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4" /><path d="m4.9 4.9 4.3 4.3M14.8 14.8l4.3 4.3M14.8 9.2l4.3-4.3M4.9 19.1l4.3-4.3" /></>);
export const IconSkip = (p: P) => base(p, <><path d="m5 4 10 8-10 8V4Z" /><path d="M19 5v14" /></>);
export const IconMove = (p: P) => base(p, <><path d="M3 12h13" /><path d="m12 7 5 5-5 5" /><path d="M21 5v14" /></>);
export const IconTrash = (p: P) => base(p, <><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" /></>);
export const IconEdit = (p: P) => base(p, <><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></>);
export const IconAlert = (p: P) => base(p, <><path d="M12 3 2 21h20L12 3Z" /><path d="M12 10v4M12 18h.01" /></>);
export const IconRefresh = (p: P) => base(p, <><path d="M21 12a9 9 0 1 1-2.6-6.4" /><path d="M21 3v6h-6" /></>);
export const IconLogout = (p: P) => base(p, <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5M21 12H9" /></>);
export const IconSpark = (p: P) => base(p, <path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8" />);
export const IconTarget = (p: P) => base(p, <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></>);
export const IconDevice = (p: P) => base(p, <><rect x="7" y="2" width="10" height="20" rx="2" /><path d="M11 18h2" /></>);
export const IconLock = (p: P) => base(p, <><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></>);
export const IconSun = (p: P) => base(p, <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>);
export const IconMoon = (p: P) => base(p, <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />);
export const IconEye = (p: P) => base(p, <><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>);
export const IconEyeOff = (p: P) => base(p, <><path d="M10.6 5.1A10.9 10.9 0 0 1 12 5c6.4 0 10 7 10 7a17.6 17.6 0 0 1-2.6 3.6M6.6 6.6C3.9 8.4 2 12 2 12s3.6 7 10 7a9.8 9.8 0 0 0 5.4-1.6" /><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" /><path d="M3 3l18 18" /></>);
export const IconDownload = (p: P) => base(p, <><path d="M12 3v12M7 10l5 5 5-5" /><path d="M4 21h16" /></>);
export const IconMonitor = (p: P) => base(p, <><rect x="2" y="4" width="20" height="13" rx="2" /><path d="M8 21h8M12 17v4" /></>);
export const IconUpcoming = (p: P) => base(p, <><path d="M4 6h11M4 12h8M4 18h6" /><path d="m16 15 3 3-3 3" /><path d="M12 18h7" /></>);
export const IconChevronRight = (p: P) => base(p, <path d="m9 6 6 6-6 6" />);
