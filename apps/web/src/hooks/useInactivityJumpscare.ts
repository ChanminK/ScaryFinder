import { useEffect, useRef } from 'react';

export function useInactivityJumpscare(opts: { onTrigger: () => void; minDelayMs?: number; maxDelayMs?: number }) {
  const { onTrigger, minDelayMs = 5000, maxDelayMs = 10000 } = opts;
  const t = useRef<number | null>(null);

  const schedule = () => {
    const wait = Math.floor(minDelayMs + Math.random() * (maxDelayMs - minDelayMs));
    if (t.current) window.clearTimeout(t.current);
    t.current = window.setTimeout(onTrigger, wait) as unknown as number;
  };

  const reset = () => schedule();

  useEffect(() => {
    schedule();
    const bump = () => reset();
    window.addEventListener('mousemove', bump);
    window.addEventListener('keydown', bump);
    window.addEventListener('click', bump);
    return () => {
      if (t.current) window.clearTimeout(t.current);
      window.removeEventListener('mousemove', bump);
      window.removeEventListener('keydown', bump);
      window.removeEventListener('click', bump);
    };
  }, []);

  return { reset };
}
