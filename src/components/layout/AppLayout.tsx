import { Outlet } from "react-router-dom";
import MobileNav from "./MobileNav";
import Header from "./Header";

export default function AppLayout() {
  return (
    <div className="flex h-[100dvh] w-full flex-col overflow-hidden bg-background text-foreground">
      <Header />
      <main className="app-main flex-1 min-h-0 overflow-y-auto px-4 pb-[calc(5rem+env(safe-area-inset-bottom,0px))] pt-20 md:p-8">
        <div className="max-w-6xl mx-auto w-full">
          <Outlet />
        </div>
      </main>
      <MobileNav />
    </div>
  );
}
