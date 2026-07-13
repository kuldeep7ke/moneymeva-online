'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark';
export type Brand = 'orange' | 'blue' | 'green';

interface ThemeContextValue {
  theme: Theme;
  brand: Brand;
  toggle: () => void;
  setBrand: (b: Brand) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'light', brand: 'orange', toggle: () => {}, setBrand: () => {},
});

export function useTheme() { return useContext(ThemeContext); }

const BRANDS: { key: Brand; label: string; color: string; colors: string[] }[] = [
  { key: 'orange', label: 'Orange', color: '#FF8A3D', colors: ['#FF8A3D', '#FFCF9A', '#FFF6EC', '#1B1B1D', '#3D332F'] },
  { key: 'blue', label: 'Royal', color: '#1E40AF', colors: ['#1E40AF', '#FCD34D', '#FFF7ED', '#0F172A', '#1E3A5F'] },
  { key: 'green', label: 'Emerald', color: '#047857', colors: ['#047857', '#FCD34D', '#FFF7ED', '#0F2918', '#064E3B'] },
];

export function getBrands() { return BRANDS; }

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('light');
  const [brand, setBrandState] = useState<Brand>('orange');

  const applyBrand = (b: Brand) => {
    const root = document.documentElement;
    root.classList.remove('brand-orange', 'brand-blue', 'brand-green');
    if (b !== 'orange') root.classList.add(`brand-${b}`);
  };

  useEffect(() => {
    const storedTheme = (localStorage.getItem('mm_theme') as Theme) || 'light';
    setTheme(storedTheme);
    const storedBrand = (localStorage.getItem('mm_brand') as Brand) || 'orange';
    setBrandState(storedBrand);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  useEffect(() => {
    applyBrand(brand);
  }, [brand]);

  const toggle = () => {
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    localStorage.setItem('mm_theme', next);
  };

  const setBrand = (b: Brand) => {
    setBrandState(b);
    localStorage.setItem('mm_brand', b);
    applyBrand(b);
  };

  return (
    <ThemeContext.Provider value={{ theme, brand, toggle, setBrand }}>
      {children}
    </ThemeContext.Provider>
  );
}
