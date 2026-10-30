const PATHS = {
  catalog: 'M4 5h16M4 12h16M4 19h10',
  calendar: 'M7 3v3M17 3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z',
  bell: 'M6 16V11a6 6 0 1 1 12 0v5l2 2H4l2-2ZM10 21h4',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14ZM20 20l-4-4',
  plus: 'M12 5v14M5 12h14',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  close: 'M6 6l12 12M18 6L6 18',
  alert: 'M12 4l9 16H3l9-16ZM12 10v4M12 17.5v.01',
  download: 'M12 4v11M7 10l5 5 5-5M5 20h14',
  upload: 'M12 20V9M7 14l5-5 5 5M5 4h14',
  external: 'M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5',
  filter: 'M4 6h16M7 12h10M10 18h4',
  arrow: 'M5 12h14M13 6l6 6-6 6',
  sun: 'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  moon: 'M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z',
  glossary: 'M4 19.5V5a2 2 0 0 1 2-2h14v15H6a2 2 0 0 0-2 2v-.5ZM9 13l2.5-6 2.5 6M9.8 11h3.4',
  compass: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM15.5 8.5l-2 5-5 2 2-5 5-2Z',
  map: 'M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2ZM9 4v14M15 6v14',
  cloud: 'M7 18h10.5a4 4 0 0 0 .4-7.98A6 6 0 0 0 6.2 9.6 4.2 4.2 0 0 0 7 18Z',
  guide: 'M5 4h10a4 4 0 0 1 4 4v12H9a4 4 0 0 1-4-4V4ZM5 16a4 4 0 0 1 4-4h10M9 8h6',
  overview: 'M4 13a8 8 0 0 1 16 0M12 13l3.5-3.5M4 17h16',
  plan: 'M4 5h4v14H4zM10 5h4v9h-4zM16 5h4v6h-4z',
  book: 'M4 5.5C6.5 4 9.5 4 12 6c2.5-2 5.5-2 8-.5V19c-2.5-1.5-5.5-1.5-8 .5-2.5-2-5.5-2-8-.5V5.5ZM12 6v13.5',
  briefcase: 'M4 8h16v11H4zM9 8V5h6v3M4 13h16',
  help: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6M12 17v.01',
  settings: 'M4 7h10M18 7h2M4 17h4M12 17h8M16 5v4M10 15v4',
  more: 'M5 12a1 1 0 1 0 2 0 1 1 0 1 0-2 0ZM11 12a1 1 0 1 0 2 0 1 1 0 1 0-2 0ZM17 12a1 1 0 1 0 2 0 1 1 0 1 0-2 0Z',
  chevron: 'M9 6l6 6-6 6',
  chevronLeft: 'M15 6l-6 6 6 6',
  chevronDown: 'M6 9l6 6 6-6',
  star: 'M12 3.6l2.55 5.17 5.7.83-4.12 4.02.97 5.68L12 16.62 6.9 19.3l.97-5.68L3.75 9.6l5.7-.83L12 3.6Z',
  grip: 'M8.5 6a1.25 1.25 0 1 0 2.5 0 1.25 1.25 0 1 0-2.5 0ZM13 6a1.25 1.25 0 1 0 2.5 0 1.25 1.25 0 1 0-2.5 0ZM8.5 12a1.25 1.25 0 1 0 2.5 0 1.25 1.25 0 1 0-2.5 0ZM13 12a1.25 1.25 0 1 0 2.5 0 1.25 1.25 0 1 0-2.5 0ZM8.5 18a1.25 1.25 0 1 0 2.5 0 1.25 1.25 0 1 0-2.5 0ZM13 18a1.25 1.25 0 1 0 2.5 0 1.25 1.25 0 1 0-2.5 0Z',
  undo: 'M9 14 4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11',
  print: 'M7 9V3h10v6M7 17H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2M7 14h10v7H7z',
  share: 'M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M16 6l-4-4-4 4M12 2v13',
  link: 'M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1',
  keyboard: 'M3 6h18v12H3zM6.5 9.5h1M10.5 9.5h1M14.5 9.5h1M7 14h10',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 7v5l3 2',
  pin: 'M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21ZM12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 21a8 8 0 0 1 16 0',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  globe: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3Z',
  cap: 'M2 9l10-5 10 5-10 5L2 9ZM6 11v5c3 2.5 9 2.5 12 0v-5M22 9v6',
  list: 'M9 6h11M9 12h11M9 18h11M4.5 6h1M4.5 12h1M4.5 18h1',
  columns: 'M4 4h4.5v16H4zM9.75 4h4.5v16h-4.5zM15.5 4H20v16h-4.5z',
  monitor: 'M3 5h18v11H3zM8 20h8M12 16v4',
  sparkle: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3ZM19 16l.7 1.8 1.8.7-1.8.7L19 21l-.7-1.8-1.8-.7 1.8-.7L19 16Z',
  trend: 'M3 17l6-6 4 4 8-8M15 7h6v6',
  target: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10ZM12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z',
  command: 'M9 6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6Z',
  swap: 'M7 7h13M16 3l4 4-4 4M17 17H4M8 13l-4 4 4 4',
  copy: 'M9 9h11v11H9zM5 15H4V4h11v1',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 11v6M12 7.5v.01',
  users: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM2.5 20a6.5 6.5 0 0 1 13 0M16 4.3a3.5 3.5 0 0 1 0 6.4M18.5 14.5A6.5 6.5 0 0 1 21.5 20',
} as const

export type IconName = keyof typeof PATHS

export function Icon({ name, size = 18, filled = false }: { name: IconName; size?: number; filled?: boolean }) {
  return (
    <svg class="icon" width={size} height={size} viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor"
      stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d={PATHS[name]} />
    </svg>
  )
}
