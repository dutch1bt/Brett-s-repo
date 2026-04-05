import BottomNav from '@/components/BottomNav';

export default function MainLayout({ children }) {
  return (
    <div className="min-h-screen flex flex-col max-w-lg mx-auto relative">
      <main className="flex-1 bottom-nav-padding">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
