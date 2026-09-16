import { NavLink } from "react-router-dom";
import { Scan, ListChecks, Camera } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { name: "Scan Card", to: "/", icon: Scan },
  { name: "Verified Contacts", to: "/verified", icon: ListChecks },
];

export default function Header() {
  return (
    <header className="h-14 md:h-18 flex items-center px-3 md:px-8 border-b bg-card/80 backdrop-blur-md shrink-0 sticky top-0 z-30 relative">
      <div className="flex items-center gap-2 text-primary font-bold tracking-tight shrink-0 w-1/3">
        <div className="bg-primary/10 p-1.5 rounded-xl">
          <Camera className="w-4 h-4 md:w-5 md:h-5 text-primary" />
        </div>
        <span className="text-sm sm:text-base md:text-lg whitespace-nowrap">CardLens</span>
      </div>

      <nav className="hidden md:flex items-center justify-center gap-1 w-1/3 absolute left-1/2 -translate-x-1/2">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200",
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
      </nav>

      <div className="flex-1 md:w-1/3" />
    </header>
  );
}
