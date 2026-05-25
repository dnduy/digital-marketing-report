import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AI Report Hub',
  description: 'Digital Marketing Auto-Reporting Dashboard',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
