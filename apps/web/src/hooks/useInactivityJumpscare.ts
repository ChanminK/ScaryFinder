import { useEffect, useRef } from 'react';

type Opts = {
  minMs?: number;     
  maxMs?: number;    
  onTrigger: () => void;
};

export function useInactivityJumpscare({ minMs = 5000, maxMs = 10000, onTrigger }: Opts) {
  const tRef = useRef<number | null>(null);

  const schedule = () => {
    clear();
    const wait = Math.floor(minMs + Math.random() * (maxMs - minMs));
    tRef.current = window.setTimeout(onTrigger, wait);
  };

  const clear = () => {
    if (tRef.current != null) {
      window.clearTimeout(tRef.current);
      tRef.current = null;
    }
  };

  useEffect(() => {
    schedule();
    return clear;
  }, []);

  return { reset: schedule, cancel: clear };
}