import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'TestPilot — AI QA Tester Dashboard',
  description:
    'Professional AI QA tester dashboard connecting to external Runner API for autonomous web testing, live timeline streaming, screenshots, and structured bug reports.',
  openGraph: {
    title: 'TestPilot — AI QA Tester Dashboard',
    description:
      'Professional AI QA tester dashboard connecting to external Runner API for autonomous web testing, live timeline streaming, screenshots, and structured bug reports.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'TestPilot — AI QA Tester Dashboard',
    description:
      'Professional AI QA tester dashboard connecting to external Runner API for autonomous web testing, live timeline streaming, screenshots, and structured bug reports.',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`} suppressHydrationWarning>
      <body className="bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100 antialiased min-h-screen selection:bg-[#3B5BDB]/20 selection:text-[#3B5BDB]" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
