import { NavLink } from "react-router-dom";
import { Scan, ListChecks, Focus } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { name: "Scan Card", to: "/", icon: Scan },
  { name: "Verified Contacts", to: "/verified", icon: ListChecks },
];

export default function Header() {
  return (
    <header className="h-16 flex items-center justify-between px-4 md:px-8 border-b border-border/80 bg-background/95 backdrop-blur-md shrink-0 sticky top-0 z-30">
      {/* Brand Logo & Name */}
      <div className="flex items-center gap-3 shrink-0">
        <div className="relative flex items-center justify-center w-9 h-9 rounded-xl bg-slate-950 text-white shadow-sm ring-1 ring-slate-800">
          <Focus className="w-5 h-5 text-blue-400" />
          <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-background" />
        </div>
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="text-base font-bold tracking-tight text-foreground font-sans">
              CardLens
            </span>
            {/* <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
              Enterprise OCR
            </span> */}
          </div>
        </div>
      </div>

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
                    ? "bg-slate-950 text-white shadow-sm dark:bg-white dark:text-slate-950"
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

      {/* Right side spacer / live status */}
      <div className="flex items-center gap-3 shrink-0">
        <div className="hidden lg:flex items-center gap-2 text-xs text-muted-foreground font-medium bg-muted/40 px-3 py-1.5 rounded-full border border-border/50">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          OCR Engine Active
        </div>
      </div>
    </header>
  );
}

