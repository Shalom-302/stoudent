import type { Metadata, Viewport } from 'next';
import { Inter, Outfit } from 'next/font/google';

import { Providers } from '@/app/providers';

import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const outfit = Outfit({ subsets: ['latin'], variable: '--font-outfit', display: 'swap' });

export const metadata: Metadata = {
  title: {
    default: 'STOUDENT — Le réseau d’entraide étudiante',
    template: '%s · STOUDENT',
  },
  description:
    'Posez vos questions, partagez vos connaissances et entraidez-vous gratuitement, entre étudiants et professeurs de toutes les filières.',
};

export const viewport: Viewport = {
  themeColor: '#ffffff',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${inter.variable} ${outfit.variable}`}>
      <body className="min-h-screen bg-white antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
