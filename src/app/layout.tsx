import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Design Your Custom Enclosure | Basshead Supply',
  description:
    'Build a custom subwoofer enclosure tuned to your sub. Available in Baltic birch and MDF, built and finished in California.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
