/** Inline stroke icons (no icon font, no network). */

import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function base({ size = 20, ...props }: IconProps, children: React.ReactNode) {
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
      {...props}
    >
      {children}
    </svg>
  );
}

export const WandIcon = (p: IconProps) =>
  base(p, (
    <>
      <path d="M15 4V2M15 22v-2M8.5 8.5 7 7M22 15h-2M4 15H2M19.1 5 17.7 6.4M12.3 12.3 6 18.6" />
      <path d="m14.6 4.8 4.6 4.6-9.2 9.2-4.6-4.6z" />
      <circle cx="15" cy="15" r="1" />
    </>
  ));

export const FilmIcon = (p: IconProps) =>
  base(p, (
    <>
      <rect x="2.5" y="4" width="19" height="16" rx="2.5" />
      <path d="M7 4v16M17 4v16M2.5 9h4.5M2.5 15h4.5M17 9h4.5M17 15h4.5" />
    </>
  ));

export const SlidersIcon = (p: IconProps) =>
  base(p, (
    <>
      <path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h10M18 18h2" />
      <circle cx="16" cy="6" r="2" />
      <circle cx="10" cy="12" r="2" />
      <circle cx="16" cy="18" r="2" />
    </>
  ));

export const CopyIcon = (p: IconProps) =>
  base(p, (
    <>
      <rect x="9" y="9" width="12" height="12" rx="2.5" />
      <path d="M15 5.5A2.5 2.5 0 0 0 12.5 3H6a2.5 2.5 0 0 0-2.5 2.5V13A2.5 2.5 0 0 0 6 15.5" />
    </>
  ));

export const ShareIcon = (p: IconProps) =>
  base(p, (
    <>
      <path d="M12 15V3M8 7l4-4 4 4" />
      <path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" />
    </>
  ));

export const CloseIcon = (p: IconProps) =>
  base(p, (
    <>
      <path d="M6 6l12 12M18 6 6 18" />
    </>
  ));

export const ChevronLeftIcon = (p: IconProps) =>
  base(p, <path d="M14.5 5 8 12l6.5 7" />);

export const ChevronRightIcon = (p: IconProps) =>
  base(p, <path d="M9.5 5 16 12l-6.5 7" />);

export const CheckIcon = (p: IconProps) =>
  base(p, <path d="m4.5 12.5 5 5 10-11" />);

export const SparkIcon = (p: IconProps) =>
  base(p, (
    <>
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18" />
      <circle cx="12" cy="12" r="3.2" />
    </>
  ));

export const TrashIcon = (p: IconProps) =>
  base(p, (
    <>
      <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" />
      <path d="M10 11v6M14 11v6" />
    </>
  ));

export const BoltIcon = (p: IconProps) =>
  base(p, <path d="M13 2 4.5 13.5H11l-1 8.5L19.5 10H13z" />);

export const ClockIcon = (p: IconProps) =>
  base(p, (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ));

export const LayersIcon = (p: IconProps) =>
  base(p, (
    <>
      <path d="m12 3 8.5 4.8L12 12.6 3.5 7.8z" />
      <path d="m3.5 12.4 8.5 4.8 8.5-4.8M3.5 16.8 12 21.6l8.5-4.8" />
    </>
  ));

export const DownloadIcon = (p: IconProps) =>
  base(p, (
    <>
      <path d="M12 3v12M8 11l4 4 4-4" />
      <path d="M4 17v2.5A1.5 1.5 0 0 0 5.5 21h13a1.5 1.5 0 0 0 1.5-1.5V17" />
    </>
  ));

export const TargetIcon = (p: IconProps) =>
  base(p, (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4.5" />
      <circle cx="12" cy="12" r="1" />
    </>
  ));

export const InfoIcon = (p: IconProps) =>
  base(p, (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5M12 8h.01" />
    </>
  ));
