/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './App.tsx',
    './screens/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
    './navigation/**/*.{ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {},
  },
  plugins: [],
};
