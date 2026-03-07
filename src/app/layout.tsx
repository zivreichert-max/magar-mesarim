import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'מאגר מסרים – בחירות 2026',
  description: 'מאגר מסרים ונקודות דיון לקראת הבחירות',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="he" dir="rtl">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;500;600;700;800;900&family=Frank+Ruhl+Libre:wght@400;700;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
