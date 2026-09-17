import { NavLink } from "react-router-dom";
import { Scan, ListChecks } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { name: "Scan Card", to: "/", icon: Scan },
  { name: "Verified Contacts", to: "/verified", icon: ListChecks },
];

export default function MobileNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex h-[calc(4rem+env(safe-area-inset-bottom,0px))] shrink-0 items-center justify-around border-t border-border/80 bg-background/95 px-4 pb-[env(safe-area-inset-bottom,0px)] backdrop-blur-md md:hidden">
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

