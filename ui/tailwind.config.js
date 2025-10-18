/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        'ibm-plex-mono': ['var(--font-ibm-plex-mono)', 'monospace'],
        'roboto-mono': ['var(--font-roboto-mono)', 'monospace'],
        'rinter': ['var(--font-rinter)', 'monospace'],
      },
      colors: {
        orange: {
          500: '#EF6400',
          600: '#D65A00',
          400: '#FF7519',
        },
        green: {
          500: 'hsla(145, 100%, 39%, 1)',
          600: 'hsla(145, 100%, 34%, 1)',
          400: 'hsla(145, 100%, 44%, 1)',
        },
        red: {
          500: 'hsla(0, 100%, 60%, 1)',
          600: 'hsla(0, 100%, 55%, 1)',
          400: 'hsla(0, 100%, 65%, 1)',
        },
      },
    },
  },
  plugins: [],
}