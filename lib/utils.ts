import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { useState, useEffect } from "react"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const tableStateCache: Record<string, any> = {};

export function useTableState<T>(key: string, defaultState: T): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [state, setState] = useState<T>(() => {
     if (tableStateCache[key] !== undefined) {
        return tableStateCache[key];
     }
     return typeof defaultState === 'function' ? (defaultState as any)() : defaultState;
  });
  
  useEffect(() => {
    tableStateCache[key] = state;
  }, [key, state]);
  
  return [state, setState];
}
