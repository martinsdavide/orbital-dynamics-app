import { useEffect, useState } from 'react';
import { halleyLabTime } from '../../physics/halley';

type Stop = 0 | 1 | 2;

export function useHalleyLab() {
  const [open, setOpen] = useState(false);
  const [stop, setStop] = useState<Stop>(0);
  const [progress, setProgress] = useState(1);
  const [paused, setPaused] = useState(false);
  const [growthGuess, setGrowthGuess] = useState('');
  const [directionGuess, setDirectionGuess] = useState('');
  const travelling = open && progress < 1;

  useEffect(() => {
    if (!travelling || paused) return;
    let frame: number;
    let last = performance.now();
    const duration = stop === 1 ? 8000 : 4000;
    function fly(now: number) {
      const step = Math.min(now - last, 100) / duration;
      last = now;
      setProgress(value => Math.min(1, value + step));
      frame = requestAnimationFrame(fly);
    }
    frame = requestAnimationFrame(fly);
    return () => cancelAnimationFrame(frame);
  }, [travelling, paused, stop]);

  function restart() {
    setStop(0);
    setProgress(1);
    setPaused(false);
    setGrowthGuess('');
    setDirectionGuess('');
  }

  return {
    open, stop, travelling, paused, growthGuess, directionGuess,
    showArrows: stop === 2 && !travelling && !!directionGuess,
    time: halleyLabTime(stop, progress),
    start() { restart(); setOpen(true); },
    restart,
    close() { setOpen(false); },
    next() {
      setStop(stop === 0 ? 1 : 2);
      setProgress(0);
      setPaused(false);
    },
    togglePause() { setPaused(value => !value); },
    setGrowthGuess,
    setDirectionGuess,
  };
}
