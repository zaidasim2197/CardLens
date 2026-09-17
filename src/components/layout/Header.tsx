import { NavLink } from "react-router-dom";
import { Scan, ListChecks } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { name: "Scan Card", to: "/", icon: Scan },
  { name: "Verified Contacts", to: "/verified", icon: ListChecks },
];

export default function Header() {
  return (
    <header className="h-16 flex items-center justify-between px-4 md:px-8 border-b border-border/80 bg-background/95 backdrop-blur-md shrink-0 sticky top-0 z-30">
      {/* Official Aventure Aviation Logo */}
      <NavLink to="/" className="flex items-center gap-3 shrink-0 py-1 hover:opacity-90 transition-opacity">
        <img
          src="/Picture1.png"
          alt="Aventure Aviation"
          className="h-7 sm:h-9 md:h-10 w-auto object-contain shrink-0"
        />
      </NavLink>

      {/* Desktop Navigation */}
      <nav className="hidden md:flex items-center gap-1.5 bg-slate-100/80 dark:bg-slate-900/80 p-1 rounded-full border border-slate-200/80 dark:border-slate-800">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold transition-all duration-200",
                  isActive
                    ? "bg-[#007BC2] text-white shadow-sm"
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

      {/* Right side live status */}
      <div className="flex items-center gap-3 shrink-0">
        <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground font-medium bg-muted/40 px-3 py-1.5 rounded-full border border-border/50">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          Enterprise OCR
        </div>
      </div>
    </header>
  );
}


