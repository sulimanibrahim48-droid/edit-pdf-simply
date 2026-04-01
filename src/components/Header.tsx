import { FileText, Scissors, Minimize2, ChevronDown, PenTool } from "lucide-react";
import { Button } from "@/components/ui/button";

const navItems = [
  { label: "MERGE PDF", icon: FileText },
  { label: "SPLIT PDF", icon: Scissors },
  { label: "COMPRESS PDF", icon: Minimize2 },
  { label: "CONVERT PDF", icon: ChevronDown },
  { label: "ALL PDF TOOLS", icon: ChevronDown },
];

const Header = () => {
  return (
    <header className="border-b border-border bg-card sticky top-0 z-50">
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center gap-8">
          <a href="/" className="flex items-center gap-2 group">
            <div className="h-9 w-9 rounded-lg bg-primary flex items-center justify-center">
              <PenTool className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold text-foreground tracking-tight">
              PDF<span className="text-primary">Edit</span>
            </span>
          </a>
          <nav className="hidden lg:flex items-center gap-1">
            {navItems.map((item) => (
              <Button
                key={item.label}
                variant="ghost"
                size="sm"
                className="text-xs font-semibold tracking-wide text-muted-foreground hover:text-foreground"
              >
                {item.label}
                {item.icon === ChevronDown && (
                  <ChevronDown className="h-3 w-3 ml-0.5" />
                )}
              </Button>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm">
            Login
          </Button>
          <Button size="sm">Sign up</Button>
        </div>
      </div>
    </header>
  );
};

export default Header;
