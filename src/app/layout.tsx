import type { Metadata } from 'next';
import Script from 'next/script';
import './globals.css';

export const metadata: Metadata = {
  title: 'Design Your Custom Enclosure | Basshead Supply',
  description:
    'Build a custom subwoofer enclosure tuned to your sub. Available in Baltic birch and MDF, built and finished in California.',
};

const googleTagId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim();

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        {googleTagId ? <GoogleAnalytics tagId={googleTagId} /> : null}
        {children}
      </body>
    </html>
  );
}

function GoogleAnalytics({ tagId }: { tagId: string }) {
  const tagIdJson = JSON.stringify(tagId);

  return (
    <>
      <script
        id="bhs-google-analytics-init"
        dangerouslySetInnerHTML={{
          __html: `
            window.dataLayer = window.dataLayer || [];
            window.gtag = window.gtag || function(){window.dataLayer.push(arguments);};
            window.gtag('js', new Date());
            window.gtag('config', ${tagIdJson});
          `,
        }}
      />
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(tagId)}`}
        strategy="afterInteractive"
      />
    </>
  );
}
