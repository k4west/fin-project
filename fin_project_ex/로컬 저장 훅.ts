// src/hooks/useLocalStorageState.ts
import { useEffect, useState } from "react";

export function useLocalStorageState<T>(key: string, initial: T) {
  const [state, setState] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : initial;
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch {
      // 저장 실패(용량/차단) 시 조용히 무시: MVP는 깨지지 않게
    }
  }, [key, state]);

  const reset = () => {
    try {
      localStorage.removeItem(key);
    } catch {}
    setState(initial);
  };

  return { state, setState, reset };
}
