import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type Theme = "light" | "dark";
const ThemeCtx = createContext<{ theme: Theme; toggle: () => void; set: (t: Theme) => void }>({
  theme: "dark",
  toggle: () => {},
  set: () => {},
});

export const THEME_INIT_SCRIPT = `
(function(){try{
  var s=localStorage.getItem('alta-theme');
  var m=window.matchMedia('(prefers-color-scheme: dark)').matches;
  var t=s||(m?'dark':'light');
  var c=document.documentElement.classList;
  if(t==='dark')c.add('dark');else c.remove('dark');
}catch(e){document.documentElement.classList.add('dark');}})();
`;

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    const has = document.documentElement.classList.contains("dark");
    setTheme(has ? "dark" : "light");
  }, []);

  const set = (t: Theme) => {
    setTheme(t);
    const c = document.documentElement.classList;
    if (t === "dark") c.add("dark");
    else c.remove("dark");
    try {
      localStorage.setItem("alta-theme", t);
    } catch {}
  };

  return (
    <ThemeCtx.Provider value={{ theme, toggle: () => set(theme === "dark" ? "light" : "dark"), set }}>
      {children}
    </ThemeCtx.Provider>
  );
}

export const useTheme = () => useContext(ThemeCtx);