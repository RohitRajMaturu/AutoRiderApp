import React, { createContext, useContext, useMemo } from "react";
import { theme, type AppTheme } from "./tokens";

const ThemeContext = createContext<AppTheme>(theme);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const value = useMemo(() => theme, []);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}

export { theme };
