/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html"
  ],
  theme: {
    extend: {
      colors: {
        background: '#F5F5F5',
        surface: '#FFFFFF',
        primary: '#111111',
        secondary: '#E5E5E5',
        accent: '#FF331F',
        'text-main': '#111111',
        'text-muted': '#737373',
        'sentiment-positive': '#111111',
        'sentiment-neutral': '#A3A3A3',
        'sentiment-negative': '#FF331F',
      },
      fontFamily: {
        heading: ['Cabinet Grotesk', 'sans-serif'],
        body: ['Satoshi', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
