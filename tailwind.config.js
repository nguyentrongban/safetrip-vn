/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        base: '#07080A',
        panel: '#121417',
        primary: '#3B82F6',
        danger: '#EF4444',
        warning: '#F59E0B',
        success: '#10B981',
      },
      animation: {
        'sos-pulse': 'sosPulse 1.6s ease-in-out infinite',
        'blink-red': 'blinkRed 0.7s step-start infinite',
      },
      keyframes: {
        sosPulse: {
          '0%,100%': { boxShadow: '0 0 0 0 rgba(239,68,68,0.55)' },
          '50%': { boxShadow: '0 0 0 22px rgba(239,68,68,0)' },
        },
        blinkRed: { '50%': { opacity: '0.25' } },
      },
    },
  },
  plugins: [],
};
