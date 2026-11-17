import { useEffect, useState } from 'react';

const KEY = 'copperos_floor_mode';
const EVENT = 'copperos:floor-mode';

/** U7 — Modo Chão de Fábrica: interface ampliada e simplificada para tablet/celular. */
export function useFloorMode() {
  const [enabled, setEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem(KEY) === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const sync = () => setEnabled(localStorage.getItem(KEY) === 'true');
    window.addEventListener(EVENT, sync);
    return () => window.removeEventListener(EVENT, sync);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('floor-mode', enabled);
  }, [enabled]);

  const toggle = () => {
    try {
      localStorage.setItem(KEY, String(!enabled));
    } catch {
      // noop
    }
    window.dispatchEvent(new Event(EVENT));
  };

  return { floorMode: enabled, toggleFloorMode: toggle };
}
