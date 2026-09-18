import { NavLink } from "react-router-dom";
import { Scan, ListChecks } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { name: "Scan Card", to: "/", icon: Scan },
  { name: "Reviewed Contacts", to: "/verified", icon: ListChecks },
];

export default function Header() {
  return (
    <header className="fixed inset-x-0 top-0 z-40 flex h-20 sm:h-22 shrink-0 items-center justify-between border-b border-border/80 bg-background/95 px-4 sm:px-8 backdrop-blur-md md:sticky">
      {/* Official CardSnap by V71 Logo Area (Large & Clear Sizing for All Screens) */}
      <NavLink to="/" className="flex items-center gap-3 shrink-0 py-2 hover:opacity-95 transition-opacity min-w-0">
        <img
          src="/CardSnapLogo_Black.png"
          alt="CardSnap by V71"
          className="h-22 sm:h-14 md:h-16 lg:h-26 w-auto object-contain dark:invert max-w-[260px] sm:max-w-[320px] md:max-w-[380px] transition-all ml-[-30px]"
        />
      </NavLink>

      {/* Navigation Links - Hidden on Mobile (Mobile uses fixed bottom nav bar) */}
      <nav className="hidden md:flex items-center gap-1.5 bg-slate-100/80 dark:bg-slate-900/80 p-1.5 rounded-full border border-slate-200/80 dark:border-slate-800">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-2 px-4 py-2 rounded-full text-xs sm:text-sm font-semibold transition-all duration-200 whitespace-nowrap",
                  isActive
                    ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs"
                    : "text-slate-600 hover:text-slate-950 dark:text-slate-400 dark:hover:text-white"
                )
              }
            >
              <Icon className="w-4 h-4" />
              <span>{item.name}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* Right side live status indicator */}
      <div className="hidden lg:flex items-center gap-3 shrink-0">
        <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 font-medium bg-slate-100/60 dark:bg-slate-900/60 px-3.5 py-1.5 rounded-full border border-slate-200/60 dark:border-slate-800">
          <span className="w-2 h-2 rounded-full bg-slate-900 dark:bg-white animate-pulse" />
          <span>Vision71 Engine</span>
        </div>
      </div>
    </header>
  );
}


