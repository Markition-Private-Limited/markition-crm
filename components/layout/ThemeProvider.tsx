"use client";
import * as React from "react";
import { THEME_COOKIE_KEY, THEME_STORAGE_KEY, resolveThemeMode, type ThemeMode } from "@/lib/theme";

type ThemeContextValue = {
  mode: ThemeMode;
  toggleMode: () => void;
};

const ThemeContext = React.createContext<ThemeContextValue | null>(null);

type ThemeProviderProps = {
  children: React.ReactNode;
  initialMode?: ThemeMode;
};

export function ThemeProvider({ children, initialMode = "light" }: ThemeProviderProps) {
  const [mode, setMode] = React.useState<ThemeMode>(initialMode);

  React.useEffect(() => {
    const stored = resolveThemeMode(window.localStorage.getItem(THEME_STORAGE_KEY));
    const cookie = resolveThemeMode(
      document.cookie
        .split("; ")
        .find((item) => item.startsWith(`${THEME_COOKIE_KEY}=`))
        ?.split("=")[1] ?? null,
    );
    const preferred = stored ?? cookie ?? initialMode;

    if (preferred !== mode) {
      setMode(preferred);
    }
  }, []);

  React.useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", mode === "dark");
    root.dataset.theme = mode;
    window.localStorage.setItem(THEME_STORAGE_KEY, mode);
    document.cookie = `${THEME_COOKIE_KEY}=${mode}; path=/; max-age=31536000; samesite=lax`;
  }, [mode]);

  const toggleMode = React.useCallback(() => {
    setMode((current) => (current === "dark" ? "light" : "dark"));
  }, []);

  return <ThemeContext.Provider value={{ mode, toggleMode }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = React.useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
