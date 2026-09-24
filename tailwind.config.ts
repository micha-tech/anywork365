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
          50:  '#fbfcfa',
          100: '#f3f5f0',
          200: '#ecefe8',
          300: '#dce2dc',
          base: '#f7f8f5',
        },
        slate: {
          50: '#f7f8f5',
          100: '#eef1ec',
          200: '#dce2dc',
          300: '#c2ccc4',
          400: '#78867d',
          500: '#657168',
          600: '#546159',
          700: '#3e4d44',
          800: '#2e3a33',
          900: '#202724',
          950: '#151d18',
          750: '#334155',
        },
      },
      fontFamily: {
        display: ['var(--font-jakarta)', 'sans-serif'],
        body:    ['var(--font-jakarta)', 'sans-serif'],
      },
      borderRadius: {
        xl:  '12px',
        '2xl': '16px',
        '3xl': '24px',
      },
      boxShadow: {
        card:     'var(--elevation-1)',
        'card-md': 'var(--elevation-2)',
        'card-lg': 'var(--elevation-3)',
        dialog: 'var(--elevation-4)',
        tactile: 'var(--shadow-button)',
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
