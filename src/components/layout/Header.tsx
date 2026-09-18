import { NavLink } from "react-router-dom";
import { Scan, ListChecks } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { name: "Scan Card", to: "/", icon: Scan },
  { name: "Reviewed contacts", to: "/verified", icon: ListChecks },
];

export default function Header() {
  return (
    <header className="app-header fixed inset-x-0 top-0 z-40 flex h-17 sm:h-18 shrink-0 items-center justify-between border-b border-border/80 bg-background/95 px-4 backdrop-blur-md md:sticky md:px-8">
      {/* Unified CardSnap by Vision71 Brand Logo */}
      <NavLink to="/" className="flex items-center shrink-0 py-1 hover:opacity-90 transition-opacity">
        <img
          src="/cardsnap-brand-logo.png"
          alt="CardSnap by Vision71"
          className="h-12 sm:h-13.5 md:h-14 w-auto object-contain dark:brightness-0 dark:invert transition-transform hover:scale-[1.02]"
        />
      </NavLink>

      {/* Desktop Navigation */}
      <nav aria-label="Main navigation" className="hidden md:flex items-center gap-1.5 bg-slate-100/80 dark:bg-slate-900/80 p-1 rounded-full border border-slate-200/80 dark:border-slate-800">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-2 px-4 min-h-11 py-2 rounded-full text-xs font-semibold transition-all duration-200",
                  isActive
                    ? "bg-brand text-white shadow-sm"
                    : "text-slate-600 hover:text-slate-950 dark:text-slate-400 dark:hover:text-white"
                )
              }
            >
              <Icon className="w-3.5 h-3.5" />
              {item.name}
            </NavLink>
          );
        })}
      </nav>

      {/* Right side status */}
      <div className="flex items-center gap-3 shrink-0">
        <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground font-medium bg-muted/40 px-3 py-1.5 rounded-full border border-border/50">
          <span className="w-2 h-2 rounded-full bg-emerald-600" />
          Review before saving
        </div>
      </div>
    </header>
  );
}
