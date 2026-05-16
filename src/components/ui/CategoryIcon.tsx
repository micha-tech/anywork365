'use client'

interface CategoryIconProps {
  category: string
  size?: number
}

const EMOJI_ICONS: Record<string, string> = {
  'Repair services': '🔧',
  'Environmental services': '🌿',
  'Cleaning services': '🧹',
  'Events and rentals': '🎉',
  'Fashion services': '👔',
  'Spa and beauty parlour': '💆',
  'General services': '🛠️',
  'Computer operation': '💻',
  'Restaurant and lounges': '🍽️',
  'Lifestyle and entertainment': '🎵',
  'Tradesmen and retailers': '🏪',
  'Professional services': '💼',
  'Healthcare services': '🏥',
  'Software development': '👨‍💻',
}

const SVG_ICONS: Record<string, string> = {
  'Repair services': `<svg width="100" height="100" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100" fill="#003E3E"/><path d="M48 20L46 25L43 24L40 28L29 27L27 30L29 35C28 36 27 37 26 38L22 36L20 40L29 35C29 36 28 37 27 38L22 38L21 41L25 44C25 45 25 46 25 47L20 50L21 53L26 54C26 55 26 56 27 57L23 61L25 64L30 62C31 63 32 63 33 64L33 71L35 72L39 69C40 70 41 70 43 71L44 75L47 75L49 71C50 70 52 70 53 70L56 74L59 72L59 70L52 65C50 66 48 65 46 65C42 65 38 63 35 60C28 53 28 42 35 35C38 32 43 30 48 30C52 30 57 32 60 35C66 41 67 50 63 57L67 60C67 59 68 59 68 58L73 58L74 54L70 51C71 50 71 49 71 48L75 46L74 42L70 41C69 40 69 40 68 38L71 33L69 31L64 32C64 32 64 32 64 32C63 31 63 30 62 30L63 25L60 24L56 27C55 26 54 26 53 25L51 20L48 20Z" fill="white"/></svg>`,
  'Environmental services': `<svg width="100" height="100" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100" fill="#003E3E"/><path d="M23 77V71C23 71 37 66 50 66C63 66 77 71 77 71V77H23ZM48 42C45 32 29 34 29 34C29 34 29 55 44 52C43 44 39 42 39 42C47 42 47 51 47 51V63H53V52C53 52 53 42 61 39C61 39 55 47 55 52C74 54 74 29 74 29C74 29 50 26 48 42Z" fill="white"/></svg>`,
  'Cleaning services': `<svg width="100" height="100" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100" fill="#003E3E"/><path d="M47 52L33 25C33 25 33 25 33 25C33 25 33 25 33 25C33 25 33 25 33 25L50 51L52 50C52 49 53 49 54 49C54 49 55 49 56 49C56 49 56 49 57 49C57 49 58 49 58 49C58 49 58 49 59 49C59 49 60 50 60 50L60 54L69 67L50 77L44 62L43 60C43 60 43 60 42 60C42 60 42 60 42 59C42 59 42 59 42 58C42 58 42 58 42 57C42 57 42 56 43 56C43 56 44 55 44 55C44 55 44 54 45 54C45 54 45 53 46 53C46 53 46 52 47 52ZM47 56L53 52C54 52 54 52 55 52C55 52 55 52 56 52C56 52 56 52 57 52C57 52 58 53 58 53L59 55L46 61L46 59C46 59 46 58 46 58C46 58 46 58 46 57C46 57 46 56 47 56Z" fill="white"/></svg>`,
  'Events and rentals': `<svg width="100" height="100" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100" fill="#003E3E"/><path d="M50 20C30 20 15 35 15 55C15 74 30 90 50 90C69 90 85 74 85 55C85 35 69 20 50 20ZM50 80C37 80 26 69 26 55C26 41 37 30 50 30C63 30 74 41 74 55C74 69 63 80 50 80Z" fill="white"/><path d="M52 40L48 50H60C60 50 60 40 52 40ZM48 60C48 60 44 70 50 75C56 70 52 60 52 60Z" stroke="white" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  'Fashion services': `<svg width="100" height="100" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100" fill="#003E3E"/><path d="M50 15L35 30V45L25 55V75H75V55L65 45V30L50 15ZM50 25L60 35V45H40V35L50 25Z" stroke="white" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>`,
  'Spa and beauty parlour': `<svg width="100" height="100" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100" fill="#003E3E"/><circle cx="50" cy="40" r="20" stroke="white" stroke-width="4" fill="none"/><path d="M50 60V80M35 70H65M50 80V75" stroke="white" stroke-width="4" stroke-linecap="round"/></svg>`,
  'General services': `<svg width="100" height="100" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100" fill="#003E3E"/><path d="M30 70V30L50 20L70 30V70L50 80L30 70Z" stroke="white" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" fill="none"/><path d="M50 20V80" stroke="white" stroke-width="4" stroke-linecap="round"/></svg>`,
  'Computer operation': `<svg width="100" height="100" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100" fill="#003E3E"/><rect x="20" y="30" width="60" height="40" rx="4" stroke="white" stroke-width="4" fill="none"/><path d="M40 80H60" stroke="white" stroke-width="4" stroke-linecap="round"/><path d="M50 70V80" stroke="white" stroke-width="4" stroke-linecap="round"/><circle cx="50" cy="50" r="10" stroke="white" stroke-width="4" fill="none"/></svg>`,
  'Restaurant and lounges': `<svg width="100" height="100" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100" fill="#003E3E"/><path d="M30 25C30 25 35 35 50 35C65 35 70 25 70 25" stroke="white" stroke-width="4" stroke-linecap="round" fill="none"/><path d="M25 25V70C25 75 30 80 35 80H65C70 80 75 75 75 70V25" stroke="white" stroke-width="4" fill="none"/><path d="M35 80V85C35 88 37 90 40 90H60C63 90 65 88 65 85V80" stroke="white" stroke-width="4" stroke-linecap="round"/></svg>`,
  'Lifestyle and entertainment': `<svg width="100" height="100" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100" fill="#003E3E"/><path d="M30 70V30C30 25 35 20 40 20H60C65 20 70 25 70 30V70C70 75 65 80 60 80H40C35 80 30 75 30 70Z" stroke="white" stroke-width="4" fill="none"/><circle cx="40" cy="45" r="6" stroke="white" stroke-width="3" fill="none"/><circle cx="60" cy="45" r="6" stroke="white" stroke-width="3" fill="none"/><path d="M35 60C35 60 40 65 50 65C60 65 65 60 65 60" stroke="white" stroke-width="4" stroke-linecap="round" fill="none"/></svg>`,
  'Tradesmen and retailers': `<svg width="100" height="100" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100" fill="#003E3E"/><path d="M30 80H70L65 50H35L30 80Z" stroke="white" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" fill="none"/><path d="M35 50L40 30L50 35L60 30L65 50" stroke="white" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>`,
  'Professional services': `<svg width="100" height="100" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100" fill="#003E3E"/><rect x="25" y="35" width="50" height="40" stroke="white" stroke-width="4" fill="none"/><path d="M35 35V25H65V35" stroke="white" stroke-width="4" fill="none"/><path d="M50 45V55M50 60V65" stroke="white" stroke-width="4" stroke-linecap="round"/></svg>`,
  'Healthcare services': `<svg width="100" height="100" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100" fill="#003E3E"/><path d="M50 20V80" stroke="white" stroke-width="8" stroke-linecap="round"/><path d="M20 50H80" stroke="white" stroke-width="8" stroke-linecap="round"/></svg>`,
  'Software development': `<svg width="100" height="100" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100" fill="#003E3E"/><path d="M30 50L40 60L70 30" stroke="white" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" fill="none"/><path d="M60 50H70" stroke="white" stroke-width="4" stroke-linecap="round"/></svg>`,
}

const ALLOWED_CATEGORIES = new Set(Object.keys(SVG_ICONS))

export function CategoryIcon({ category, size = 48 }: CategoryIconProps) {
  const emoji = EMOJI_ICONS[category]

  if (!ALLOWED_CATEGORIES.has(category)) {
    return (
      <div
        className="rounded-xl bg-brand-50 flex items-center justify-center"
        style={{ width: size, height: size }}
      >
        <span style={{ fontSize: size * 0.5 }}>{emoji || '✨'}</span>
      </div>
    )
  }

  return (
    <div
      className="rounded-xl overflow-hidden flex items-center justify-center bg-[#003E3E]"
      style={{ width: size, height: size }}
      dangerouslySetInnerHTML={{ __html: SVG_ICONS[category] }}
    />
  )
}

export const CATEGORY_ICONS = Object.keys(SVG_ICONS)