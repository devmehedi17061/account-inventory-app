/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        sidebar: '#0f2b46',
        sidebarMuted: '#1b3b5b',
        accent: '#0d8b8b',      // teal active state
        accentSoft: '#14a3a3',
        ink: '#021640',         // navy heading / KPI text
        ink2: '#0066CC',
        ink3: '#0099CC',
        ink4: '#4572C4',
        ink5: '#558ED5',
        ink6: '#1F4E79',
        canvas: '#f5f7fb',
      },
      fontFamily: {
        sans: ['Inter', 'Roboto', 'system-ui', 'sans-serif'],
        heading: ['Poppins', 'Montserrat', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
