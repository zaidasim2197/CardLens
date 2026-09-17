import { NavLink } from "react-router-dom";
import { Scan, ListChecks } from "lucide-react";
import { cn } from "@/lib/utils";


const navItems = [
  { name: "Scan Card", to: "/", icon: Scan },
  { name: "Verified Contacts", to: "/verified", icon: ListChecks },
];

export default function Sidebar() {
  return (
    <aside className="hidden md:flex flex-col w-64 border-r bg-card shadow-sm h-full shrink-0">
      <div className="p-6 pb-2">
        <NavLink to="/" className="flex items-center gap-2">
          <img
            src="/Picture1.png"
            alt="Aventure Aviation"
            className="h-9 w-auto object-contain"
          />
        </NavLink>
      </div>

      <div className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-2">
          Menu
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors text-sm font-medium",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                )
              }
            >
              <Icon className="w-4 h-4" />
              {item.name}
            </NavLink>
          );
        })}
      </div>
    </aside>
  );
}
