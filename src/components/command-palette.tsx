import { useEffect, useState, createContext, useContext, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import {
  LayoutDashboard,
  LineChart,
  Landmark,
  Network,
  Sun,
  Moon,
  Search,
} from "lucide-react";
import { useTheme } from "./theme";
import { stocks } from "@/lib/mock-data";

const CmdCtx = createContext<{ open: () => void }>({ open: () => {} });
export const useCommand = () => useContext(CmdCtx);

export function CommandProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { theme, toggle } = useTheme();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const go = (to: string) => {
    setOpen(false);
    navigate({ to });
  };

  return (
    <CmdCtx.Provider value={{ open: () => setOpen(true) }}>
      {children}
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Search Alta — pages, tickers, accounts…" />
        <CommandList>
          <CommandEmpty>No results.</CommandEmpty>
          <CommandGroup heading="Navigate">
            <CommandItem onSelect={() => go("/terminal")}>
              <LayoutDashboard /> Alta Terminal <CommandShortcut>G T</CommandShortcut>
            </CommandItem>
            <CommandItem onSelect={() => go("/exchange")}>
              <LineChart /> Alta Exchange
            </CommandItem>
            <CommandItem onSelect={() => go("/bank")}>
              <Landmark /> Alta Bank
            </CommandItem>
            <CommandItem onSelect={() => go("/governance")}>
              <Network /> Governance & Structure
            </CommandItem>
            <CommandItem onSelect={() => go("/governance/leadership")}>
              <Network /> Leadership
            </CommandItem>
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Listed Companies">
            {stocks.slice(0, 6).map((s) => (
              <CommandItem key={s.symbol} onSelect={() => go(`/exchange/company/${s.symbol.toLowerCase()}`)}>
                <Search />
                <span className="font-mono text-xs">{s.symbol}</span>
                <span className="text-muted-foreground">{s.name}</span>
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Accounts">
            <CommandItem onSelect={() => go("/bank")}>
              <Search /> ALT-PRV-00184 · Private Wealth
            </CommandItem>
            <CommandItem onSelect={() => go("/bank")}>
              <Search /> ALT-OPS-22019 · Treasury Operations
            </CommandItem>
            <CommandItem onSelect={() => go("/terminal")}>
              <Search /> ALT-TRM-77512 · Terminal Portfolio
            </CommandItem>
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Preferences">
            <CommandItem
              onSelect={() => {
                toggle();
                setOpen(false);
              }}
            >
              {theme === "dark" ? <Sun /> : <Moon />}
              Toggle theme — switch to {theme === "dark" ? "light" : "dark"}
              <CommandShortcut>⌘ ⇧ L</CommandShortcut>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </CmdCtx.Provider>
  );
}