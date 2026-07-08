import type { Metadata } from 'next';
import { Heebo, Frank_Ruhl_Libre } from 'next/font/google';
import './globals.css';

// Self-hosted via next/font — no render-blocking request to fonts.googleapis.com
// and no flash of fallback text. Exposed as CSS variables; globals.css applies them.
const heebo = Heebo({
  subsets: ['hebrew', 'latin'],
  weight: ['300', '400', '500', '600', '700', '800', '900'],
  variable: '--font-heebo',
  display: 'swap',
});

const frankRuhl = Frank_Ruhl_Libre({
  subsets: ['hebrew', 'latin'],
  weight: ['400', '700', '900'],
  variable: '--font-frank-ruhl',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'מסרים – בחירות 2026',
  description: 'מסרים – נקודות דיון לקראת הבחירות',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="he" dir="rtl" className={`${heebo.variable} ${frankRuhl.variable}`}>
      <body>{children}</body>
    </html>
  );
}
