import { Outlet } from "react-router-dom";
import MobileNav from "./MobileNav";
import Header from "./Header";

export default function AppLayout() {
  return (
    <div className="flex flex-col h-screen w-full bg-background overflow-hidden text-foreground">
      <Header />
      <main className="flex-1 overflow-y-auto p-4 md:p-8 bg-slate-50/50">
        <div className="max-w-6xl mx-auto w-full">
          <Outlet />
        </div>
      </main>
      <MobileNav />
    </div>
  );
}
