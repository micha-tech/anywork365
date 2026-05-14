import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#f0f9f9',
          100: '#dff0f0',
          200: '#b8e0e0',
          300: '#72c7c3',
          400: '#3ba69f',
          500: '#0F4F4A',
          600: '#1F6F68',
          700: '#0a3835',
          800: '#062d2b',
          900: '#041f1e',
        },
        surface: {
          50:  '#FAFBFC',
          100: '#F4F6F8',
          200: '#EEF1F5',
          300: '#E2E7EC',
          base: '#FAFBFC',
        },
        slate: {
          750: '#334155',
        },
      },
      fontFamily: {
        display: ['var(--font-jakarta)', 'sans-serif'],
        body:    ['var(--font-dm)', 'sans-serif'],
      },
      borderRadius: {
        xl:  '12px',
        '2xl': '16px',
        '3xl': '24px',
      },
      boxShadow: {
        card:     '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
        'card-md': '0 4px 12px rgba(0,0,0,0.08)',
        'card-lg': '0 12px 32px rgba(0,0,0,0.10)',
        'glow':    '0 0 24px rgba(15,79,74,0.15)',
      },
      minHeight: { dvh: '100dvh' },
      height:    { dvh: '100dvh' },
      spacing: {
        '18': '4.5rem',
        '22': '5.5rem',
      },
    },
  },
  plugins: [
    function ({ addUtilities }: { addUtilities: (u: Record<string, Record<string, string>>) => void }) {
      addUtilities({
        '.scrollbar-none': {
          '-ms-overflow-style': 'none',
          'scrollbar-width': 'none',
        },
        '.scrollbar-none::-webkit-scrollbar': { display: 'none' },
      })
    },
  ],
}

export default config