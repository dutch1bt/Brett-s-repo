import './globals.css';

export const metadata = {
  title: "Pick'em Pool",
  description: 'Golf tournament pick\'em pool tracker',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="bg-gray-950 text-white min-h-screen">
        <nav className="bg-masters-green border-b border-masters-yellow/30 px-4 py-3 flex items-center justify-between">
          <a href="/" className="text-masters-yellow font-bold text-xl tracking-wide">
            ⛳ Pick&apos;em Pool
          </a>
          <a href="/admin" className="text-masters-yellow/70 hover:text-masters-yellow text-sm">
            Admin
          </a>
        </nav>
        <main className="max-w-5xl mx-auto px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
