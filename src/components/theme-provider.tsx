'use client';

import { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'dark' | 'light';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'dark',
  toggleTheme: () => {},
  setTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('dark');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const saved = localStorage.getItem('theme') as Theme | null;
      if (saved === 'light' || saved === 'dark') {
        setThemeState(saved);
        const root = document.documentElement;
        root.classList.remove('light', 'dark');
        root.classList.add(saved);
        root.style.colorScheme = saved;
      } else {
        const root = document.documentElement;
        root.classList.remove('light');
        root.classList.add('dark');
        root.style.colorScheme = 'dark';
      }
    } catch (e) {}
  }, []);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    const root = document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(newTheme);
    root.style.colorScheme = newTheme;
    try {
      localStorage.setItem('theme', newTheme);
    } catch (e) {}
  };

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
