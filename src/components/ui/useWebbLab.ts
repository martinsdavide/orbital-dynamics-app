import { useEffect, useMemo, useState } from 'react';
import { simulateWebbExperiment, WEBB_LAB_DAYS, type WebbExperiment, type WebbOffset, type WebbPoint } from '../../physics/webbLab';

export function useWebbLab() {
  const [open, setOpen] = useState(false);
  const [experiment, setExperiment] = useState<WebbExperiment>('compare');
  const [focus, setFocus] = useState<WebbPoint>('L2');
  const [offset, setOffset] = useState<WebbOffset>('radial');
  const [nudge, setNudge] = useState(100);
  const [day, setDay] = useState(0);
  const [play, setPlay] = useState(false);
  const [prediction, setPrediction] = useState('');
  const playing = open && play && day < WEBB_LAB_DAYS;
  const runs = useMemo(() => {
    if (!open) return [];
    const points: WebbPoint[] = experiment === 'compare' ? ['L2', 'L4'] : [experiment];
    return points.map(point => simulateWebbExperiment(point, nudge, offset));
  }, [open, experiment, nudge, offset]);

  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => setDay(day => Math.min(day + 1, WEBB_LAB_DAYS)), 70);
    return () => window.clearInterval(timer);
  }, [playing]);

  function reset() {
    setDay(0);
    setPlay(false);
  }

  return {
    open,
    scene: { runs, day, focus: experiment === 'compare' ? focus : experiment },
    controls: {
      experiment, offset, nudge, playing, prediction,
      onExperiment(next: WebbExperiment) { setExperiment(next); reset(); },
      onOffset(next: WebbOffset) { setOffset(next); reset(); },
      onNudge(next: number) { setNudge(next); reset(); },
      onFocus: setFocus,
      onDay(next: number) { setPlay(false); setDay(next); },
      onPlay() {
        if (day >= WEBB_LAB_DAYS) setDay(0);
        setPlay(!playing);
      },
      onReset: reset,
      onPrediction: setPrediction,
      onClose() { setOpen(false); setPlay(false); },
    },
    show() { setOpen(true); reset(); },
  };
}
