import type { SVGProps } from 'react'

const paths = {
  home: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  train: 'M13 2 4.5 13.5H12L11 22l8.5-11.5H12z',
  chart: 'M4 20V10m6 10V4m6 16v-7m4 7H3',
  book: 'M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5zM4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5',
  user: 'M12 12a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9Zm-8 9a8 8 0 0 1 16 0',
  play: 'M7 4.5v15l12-7.5z',
  pause: 'M8 4.5v15M16 4.5v15',
  check: 'm4.5 12.5 5 5 10-11',
  x: 'M6 6l12 12M18 6 6 18',
  chevronRight: 'm9 5 7 7-7 7',
  chevronLeft: 'm15 5-7 7 7 7',
  chevronDown: 'm5 9 7 7 7-7',
  chevronUp: 'm5 15 7-7 7 7',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-13v4.5l3 2',
  swap: 'M7 4 3 8l4 4M3 8h14M17 20l4-4-4-4m4 4H7',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-10v6m0-9.5v.01',
  alert: 'M12 3 2 20h20zm0 6.5v5m0 3v.01',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7.4-3a7.4 7.4 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7.5 7.5 0 0 0-2-1.2L14.5 3h-4l-.4 2.6a7.5 7.5 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6a7.4 7.4 0 0 0 0 2.4l-2 1.6 2 3.4 2.4-1a7.5 7.5 0 0 0 2 1.2l.4 2.6h4l.4-2.6a7.5 7.5 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2Z',
  calendar: 'M4 6.5A1.5 1.5 0 0 1 5.5 5h13A1.5 1.5 0 0 1 20 6.5v13a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19.5zM4 10h16M8 3v4m8-4v4',
  run: 'M13.5 5.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM7 22l3-6 3 2.5V23m-6-11 3-4 4 1.5 2 3.5 3 1M10 8l-1.5 5.5 4.5 3',
  flame: 'M12 22c4 0 7-2.8 7-7 0-4.5-4-7.5-5-12-2.5 2-4 4.5-4 7-1-.5-2-1.8-2-3.5C6 8.5 5 11 5 14.5 5 19 8 22 12 22Z',
  moon: 'M20 14.5A8.5 8.5 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5Z',
  sun: 'M12 16.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9ZM12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  trash: 'M4 7h16M9 7V4h6v3m-8 0 1 13h8l1-13',
  download: 'M12 4v11m0 0-4.5-4.5M12 15l4.5-4.5M4 20h16',
  upload: 'M12 16V5m0 0L7.5 9.5M12 5l4.5 4.5M4 20h16',
  edit: 'M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  skip: 'M5 5l9 7-9 7zM18 5v14',
  reset: 'M4 4v6h6M4.5 15a8 8 0 1 0 1.9-8.3L4 10',
  pin: 'M12 22s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12Zm0-9.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z',
  heart: 'M12 20s-8-4.8-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 9c0 6.2-8 11-8 11Z',
  camera: 'M4 8h3l2-3h6l2 3h3v11H4zm8 9a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z',
  search: 'M10.5 18a7.5 7.5 0 1 0 0-15 7.5 7.5 0 0 0 0 15Zm5.5-2 5 5',
  trophy: 'M7 4h10v5a5 5 0 0 1-10 0zm0 2H3.5a3.5 3.5 0 0 0 3.8 4M17 6h3.5a3.5 3.5 0 0 1-3.8 4M12 14v4m-4 3h8l-1-3H9z',
  leaf: 'M5 19c0-8 5-14 15-15-.5 10-6.5 15-15 15Zm0 0 7-7',
  target: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-4a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm0-4a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z',
  lock: 'M6 11h12v10H6zm2.5 0V7.5a3.5 3.5 0 0 1 7 0V11',
  shield: 'M12 3 4.5 6v6c0 4.5 3.2 7.8 7.5 9 4.3-1.2 7.5-4.5 7.5-9V6z',
  wave: 'M2 12c2.5 0 2.5-4 5-4s2.5 8 5 8 2.5-8 5-8 2.5 4 5 4',
  sparkle: 'M12 3v4m0 10v4M3 12h4m10 0h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18',
  stairs: 'M3 20h5v-5h5v-5h5V5h3',
  volume: 'M4 9v6h4l5 4V5L8 9zm12.5-.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12',
  mute: 'M4 9v6h4l5 4V5L8 9zm12 0 5 6m0-6-5 6',
  filter: 'M4 5h16l-6 7.5V19l-4 2v-8.5z',
  note: 'M5 4h14v16H5zM9 8h6M9 12h6M9 16h3',
  layers: 'm12 3 9 5-9 5-9-5zm-9 9 9 5 9-5M3 16l9 5 9-5',
  stop: 'M6 6h12v12H6z',
  hand: 'M8 13V6a1.5 1.5 0 0 1 3 0v5m0-6.5a1.5 1.5 0 0 1 3 0V11m0-5a1.5 1.5 0 0 1 3 0v6m0-3a1.5 1.5 0 0 1 3 0v4.5a7.5 7.5 0 0 1-7.5 7.5h-.6a6 6 0 0 1-4.6-2.2L5 15.5a1.5 1.5 0 0 1 2.3-2l.7.7',
  bolt: 'M13 2 4.5 13.5H12L11 22l8.5-11.5H12z',
  phone: 'M8 2h8a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Zm3 17h2',
  share: 'M12 15V3m0 0L8 7m4-4 4 4M5 11v9h14v-9',
} as const

export type IconName = keyof typeof paths

export function Icon({ name, size = 22, strokeWidth = 1.8, className, ...rest }: { name: IconName; size?: number; strokeWidth?: number } & SVGProps<SVGSVGElement>) {
  const filled = name === 'play'
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
      {...rest}
    >
      <path d={paths[name]} />
    </svg>
  )
}
