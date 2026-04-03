import './globals.css';

export const metadata = {
  title: "The Back Nine | Golf Group",
  description: "Private social network for our golf group",
  viewport: "width=device-width, initial-scale=1, viewport-fit=cover",
  themeColor: "#052e16",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "The Back Nine",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="h-full">
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="h-full antialiased">{children}</body>
    </html>
  );
}
