import { NavLink } from "react-router-dom";
import { Scan, ListChecks } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { name: "Scan Card", to: "/", icon: Scan },
  { name: "Verified Contacts", to: "/verified", icon: ListChecks },
];

export default function MobileNav() {
  return (
    <nav className="md:hidden flex items-center justify-around bg-background/95 backdrop-blur-md border-t border-border/80 shrink-0 h-16 px-4 pb-[env(safe-area-inset-bottom,0px)] sticky bottom-0 z-30">
      {navItems.map((item) => {
        const Icon = item.icon;
        return (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                "flex items-center justify-center gap-2 w-full py-2 text-xs font-semibold rounded-full transition-all duration-200 mx-1",
                isActive
                  ? "bg-[#007BC2] text-white shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )
            }

          >
            <Icon className="w-4 h-4" />
            <span className="tracking-tight">{item.name}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}

