import type { Config } from "tailwindcss";

const config: Config = {
	darkMode: ["class"],
	content: [
		"./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
		"./src/components/**/*.{js,ts,jsx,tsx,mdx}",
		"./src/app/**/*.{js,ts,jsx,tsx,mdx}",
	],
	theme: {
		extend: {
			borderWidth: {
				// Project convention: every button uses `border-1` (1px) explicitly,
				// even when the colour is transparent, so hover/active states never
				// shift the box. Standard Tailwind's `border` is also 1px.
				'1': '1px',
			},
			colors: {
				brand: {
					'25': '#fafeff', '50': '#e9fbff', '100': '#dbf8ff', '200': '#ccf6ff', 
					'300': '#bdf3ff', '400': '#92d1de', '500': '#6baebc', '600': '#4b8c9a', 
					'700': '#306b78', '800': '#1b4c56', '900': '#0c2d34', '950': '#040e11'
				},
				secondary: {
					'25': '#fbfffd', '50': '#e9fff3', '100': '#d7ffe9', '200': '#c4edd6',
					'300': '#aad4bd', '400': '#92baa4', '500': '#7ba08c', '600': '#658774',
					'700': '#4f6e5d', '800': '#3b5446', '900': '#28392f', '950': '#151e19',
					DEFAULT: 'hsl(var(--secondary))',
					foreground: 'hsl(var(--secondary-foreground))'
				},
				tertiary: {
					'50': '#f1f2ed', '100': '#dcded5', '200': '#c7c9bf', '300': '#b2b5a8',
					'400': '#9ea093', '500': '#898c7e', '600': '#75786a', '700': '#616356',
					'800': '#4c4f43', '900': '#35372f', '950': '#1d1e1a'
				},
				surface: {
					DEFAULT: '#ffffff',
					secondary: '#f9fafb',
					tertiary: '#f2f4f7',
					dark: '#161b26'
				},
				border: 'hsl(var(--border))',
				background: 'hsl(var(--background))',
				foreground: 'hsl(var(--foreground))',
				card: {
					DEFAULT: 'hsl(var(--card))',
					foreground: 'hsl(var(--card-foreground))'
				},
				popover: {
					DEFAULT: 'hsl(var(--popover))',
					foreground: 'hsl(var(--popover-foreground))'
				},
				primary: {
					DEFAULT: 'hsl(var(--primary))',
					foreground: 'hsl(var(--primary-foreground))'
				},
				muted: {
					DEFAULT: 'hsl(var(--muted))',
					foreground: 'hsl(var(--muted-foreground))'
				},
				accent: {
					DEFAULT: 'hsl(var(--accent))',
					foreground: 'hsl(var(--accent-foreground))'
				},
				destructive: {
					DEFAULT: 'hsl(var(--destructive))',
					foreground: 'hsl(var(--destructive-foreground))'
				},
				success: {
					'25': '#f6fef9', '50': '#ecfdf3', '100': '#dcfae6', '300': '#75e0a7',
					'400': '#47cd89', '500': '#17b26a', '600': '#079455', '700': '#067647',
					'800': '#085d3a', '900': '#074d31', '950': '#053321'
				},
				warning: {
					'25': '#fffcf5', '50': '#fffaeb', '100': '#fef0c7', '200': '#fedf89',
					'300': '#fec84b', '400': '#fdb022', '500': '#f79009', '600': '#dc6803',
					'700': '#b54708', '800': '#93370d', '900': '#7a2e0e', '950': '#4e1d09'
				},
				error: {
					'25': '#fffbfa', '50': '#fef3f2', '100': '#fee4e2', '200': '#fecdca',
					'300': '#fda29b', '400': '#f97066', '500': '#f04438', '600': '#d92d20',
					'700': '#b42318', '800': '#912018', '900': '#7a271a', '950': '#55160c'
				},
				input: 'hsl(var(--input))',
				ring: 'hsl(var(--ring))',
				chart: {
					'1': 'hsl(var(--chart-1))',
					'2': 'hsl(var(--chart-2))',
					'3': 'hsl(var(--chart-3))',
					'4': 'hsl(var(--chart-4))',
					'5': 'hsl(var(--chart-5))'
				}
			},
			fontFamily: {
				sans: [
					'"DM Sans"',
					'system-ui',
					'sans-serif'
				]
			},
			fontSize: {
				'display-2xl': ['4.5rem', { lineHeight: '5.625rem', letterSpacing: '-0.02em' }],
				'display-xl': ['3.75rem', { lineHeight: '4.5rem', letterSpacing: '-0.02em' }],
				'display-lg': ['3rem', { lineHeight: '3.75rem', letterSpacing: '-0.02em' }],
				'display-md': ['2.25rem', { lineHeight: '2.75rem', letterSpacing: '-0.02em' }],
				'display-sm': ['1.875rem', { lineHeight: '2.375rem' }],
				'display-xs': ['1.5rem', { lineHeight: '2rem' }],
				'text-xl': ['1.25rem', { lineHeight: '1.875rem' }],
				'text-lg': ['1.125rem', { lineHeight: '1.75rem' }],
				'text-md': ['1rem', { lineHeight: '1.5rem' }],
				'text-sm': ['0.875rem', { lineHeight: '1.25rem' }],
				'text-xs': ['0.75rem', { lineHeight: '1.125rem' }],
			},
			borderRadius: {
				xl: '1rem',
				'2xl': '1.25rem',
				lg: 'var(--radius)',
				md: 'calc(var(--radius) - 2px)',
				sm: 'calc(var(--radius) - 4px)'
			},
			boxShadow: {
				soft: '0 1px 3px 0 rgba(0,0,0,0.04), 0 1px 2px -1px rgba(0,0,0,0.04)',
				card: '0 2px 8px -2px rgba(0,0,0,0.06), 0 4px 16px -4px rgba(0,0,0,0.08)',
				glow: '0 0 20px rgba(108,71,255,0.15)'
			},
			animation: {
				'fade-in': 'fadeIn 0.5s ease-out',
				'slide-up': 'slideUp 0.4s ease-out',
				'slide-in-right': 'slideInRight 0.3s ease-out',
				'scale-in': 'scaleIn 0.2s ease-out',
				shimmer: 'shimmer 2s linear infinite'
			},
			keyframes: {
				fadeIn: {
					'0%': {
						opacity: '0'
					},
					'100%': {
						opacity: '1'
					}
				},
				slideUp: {
					'0%': {
						opacity: '0',
						transform: 'translateY(10px)'
					},
					'100%': {
						opacity: '1',
						transform: 'translateY(0)'
					}
				},
				slideInRight: {
					'0%': {
						opacity: '0',
						transform: 'translateX(20px)'
					},
					'100%': {
						opacity: '1',
						transform: 'translateX(0)'
					}
				},
				scaleIn: {
					'0%': {
						opacity: '0',
						transform: 'scale(0.95)'
					},
					'100%': {
						opacity: '1',
						transform: 'scale(1)'
					}
				},
				shimmer: {
					'0%': {
						backgroundPosition: '-200% 0'
					},
					'100%': {
						backgroundPosition: '200% 0'
					}
				}
			}
		}
	},
	plugins: [require("tailwindcss-animate")],
};

export default config;
