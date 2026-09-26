import type { SVGProps } from 'react';

/**
 * 手绘风格的线性图标，24 格，1.6 描边。全部内联，无外部资源。
 */
export type IconName =
  | 'attack'
  | 'guard'
  | 'move'
  | 'burst'
  | 'intent-strike'
  | 'intent-sweep'
  | 'intent-break'
  | 'intent-charge'
  | 'intent-fortify'
  | 'intent-heal'
  | 'shell'
  | 'pearl'
  | 'retreat'
  | 'sound'
  | 'mute'
  | 'dice'
  | 'spring'
  | 'scout'
  | 'forge'
  | 'close'
  | 'arrow'
  | 'book'
  | 'card'
  | 'download'
  | 'share';

const PATHS: Record<IconName, React.ReactNode> = {
  attack: (
    <>
      <path d="M5 19 16.5 7.5" />
      <path d="M14 5h5v5" />
      <path d="m7.5 14.5 2 2" />
      <path d="M4 20l2-.5.5-2" />
    </>
  ),
  guard: (
    <>
      <path d="M12 3.5 5 6v5.2c0 4.3 2.9 7.6 7 9.3 4.1-1.7 7-5 7-9.3V6l-7-2.5Z" />
      <path d="M12 8v8" />
      <path d="M8.8 11.5c1 .8 2 1.2 3.2 1.2s2.2-.4 3.2-1.2" />
    </>
  ),
  move: (
    <>
      <path d="M4 16c3.5 0 4.5-8 8-8s4.5 8 8 8" />
      <path d="M17 12.5 20 16l-3.8 1.5" />
      <circle cx="6.5" cy="7" r="1.2" />
    </>
  ),
  burst: (
    <>
      <path d="M12 3v3.5M12 17.5V21M3 12h3.5M17.5 12H21M5.6 5.6l2.5 2.5M15.9 15.9l2.5 2.5M18.4 5.6l-2.5 2.5M8.1 15.9l-2.5 2.5" />
      <circle cx="12" cy="12" r="2.6" />
    </>
  ),
  'intent-strike': (
    <>
      <path d="M6 18 18 6" />
      <path d="M13 6h5v5" />
    </>
  ),
  'intent-sweep': (
    <>
      <path d="M3.5 14c2.5-5 6-7.5 8.5-7.5s6 2.5 8.5 7.5" />
      <path d="M5 17.5c2-2.3 4.3-3.5 7-3.5s5 1.2 7 3.5" />
      <path d="M18 11l2.5 3-3.6.7" />
    </>
  ),
  'intent-break': (
    <>
      <path d="M12 3.5 5 6v5.2c0 4.3 2.9 7.6 7 9.3 4.1-1.7 7-5 7-9.3V6l-7-2.5Z" />
      <path d="m12.5 6-2 5 3 1.5-2.5 5.5" />
    </>
  ),
  'intent-charge': (
    <>
      <circle cx="12" cy="12" r="7.5" strokeDasharray="2.4 2.6" />
      <path d="M13 6.5 9.5 12.5h3.2L11 17.5l4-6.2h-3.2l1.2-4.8Z" />
    </>
  ),
  'intent-fortify': (
    <>
      <path d="M5 9h14v10H5z" />
      <path d="M5 9V6h2.5v2M10.75 9V5.5h2.5V9M16.5 9V6H19v3" />
      <path d="M9.5 19v-4a2.5 2.5 0 0 1 5 0v4" />
    </>
  ),
  'intent-heal': (
    <>
      <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z" />
      <path d="M12 9.5v5M9.5 12h5" />
    </>
  ),
  shell: (
    <>
      <path d="M4 16.5C4 10.5 7.6 5 12 5s8 5.5 8 11.5c-2.4 1.8-5.1 2.5-8 2.5s-5.6-.7-8-2.5Z" />
      <path d="M12 5v14M8.2 6.8 9.5 18.6M15.8 6.8l-1.3 11.8" />
    </>
  ),
  pearl: (
    <>
      <circle cx="12" cy="12" r="7" />
      <path d="M9 9.2a3.6 3.6 0 0 1 3-1.6" />
    </>
  ),
  retreat: (
    <>
      <path d="M10 6 4 12l6 6" />
      <path d="M4.5 12H14a6 6 0 0 1 6 6" />
    </>
  ),
  sound: (
    <>
      <path d="M4 10v4h3.5L12 18V6L7.5 10H4Z" />
      <path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" />
    </>
  ),
  mute: (
    <>
      <path d="M4 10v4h3.5L12 18V6L7.5 10H4Z" />
      <path d="m16 9.5 5 5M21 9.5l-5 5" />
    </>
  ),
  dice: (
    <>
      <rect x="4.5" y="4.5" width="15" height="15" rx="3.5" />
      <circle cx="9" cy="9" r=".9" fill="currentColor" />
      <circle cx="15" cy="15" r=".9" fill="currentColor" />
      <circle cx="12" cy="12" r=".9" fill="currentColor" />
    </>
  ),
  spring: (
    <>
      <path d="M12 3.5c3 3.5 5 6.4 5 9a5 5 0 0 1-10 0c0-2.6 2-5.5 5-9Z" />
      <path d="M9.5 13.5a2.5 2.5 0 0 0 2.5 2.5" />
    </>
  ),
  scout: (
    <>
      <circle cx="10.5" cy="10.5" r="5.5" />
      <path d="m15 15 4.5 4.5" />
      <path d="M8 10.5a2.5 2.5 0 0 1 2.5-2.5" />
    </>
  ),
  forge: (
    <>
      <path d="M6 20h12" />
      <path d="M8 20c0-3 1-4.5 4-4.5s4 1.5 4 4.5" />
      <path d="M12 12.5c-2-1.3-2.5-3-1.5-5 .5 1 1.2 1.4 2 1.3-.3-1.8.4-3.3 2-4.3-.3 2 .8 3 1.2 4.5.5 2-1 3.6-3.7 3.5Z" />
    </>
  ),
  close: <path d="m6.5 6.5 11 11M17.5 6.5l-11 11" />,
  arrow: (
    <>
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </>
  ),
  book: (
    <>
      <path d="M4 5.5c2.8-1 5.5-.8 8 1 2.5-1.8 5.2-2 8-1v13c-2.8-1-5.5-.8-8 1-2.5-1.8-5.2-2-8-1Z" />
      <path d="M12 6.5v13" />
    </>
  ),
  card: (
    <>
      <rect x="6" y="3" width="12" height="18" rx="2" />
      <circle cx="12" cy="9.5" r="2.8" />
      <path d="M9 15h6M10 17.5h4" />
    </>
  ),
  download: (
    <>
      <path d="M12 4v11" />
      <path d="m7.5 11 4.5 4.5 4.5-4.5" />
      <path d="M5 19.5h14" />
    </>
  ),
  share: (
    <>
      <path d="M12 14V4" />
      <path d="m8 7.5 4-4 4 4" />
      <path d="M7 11H5.5v9h13v-9H17" />
    </>
  ),
};

export interface IconProps extends SVGProps<SVGSVGElement> {
  name: IconName;
  size?: number;
  title?: string;
}

export function Icon({ name, size = 20, title, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      {...rest}
    >
      {title && <title>{title}</title>}
      {PATHS[name]}
    </svg>
  );
}
