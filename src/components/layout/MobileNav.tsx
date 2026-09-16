import { NavLink } from "react-router-dom";
import { Scan, ListChecks } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { name: "Scan Card", to: "/", icon: Scan },
  { name: "Verified", to: "/verified", icon: ListChecks },
];

export default function MobileNav() {
  return (
    <nav className="md:hidden flex items-center justify-around bg-card border-t shrink-0 h-16 px-2 safe-area-bottom">
      {navItems.map((item) => {
        const Icon = item.icon;
        return (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                "flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors rounded-lg",
                isActive
                  ? "text-primary font-medium"
                  : "text-muted-foreground hover:text-foreground"
              )
            }
          >
            <Icon className="w-5 h-5" />
            <span className="text-[10px] uppercase tracking-wide">{item.name}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}
