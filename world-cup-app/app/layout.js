import './globals.css';
import Nav from './nav';

export const metadata = {
  title: 'World Cup 2026 Pool',
  description: 'Pick your teams and track the action',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#060d06] text-white">
        <Nav />
        <main className="max-w-6xl mx-auto px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
