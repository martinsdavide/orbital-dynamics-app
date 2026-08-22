import React from 'react';
import { Play, Pause, RotateCcw } from 'lucide-react';

interface TimeControlsProps {
  isPlaying: boolean;
  onTogglePlay: () => void;
  timeWarp: number;
  onSetTimeWarp: (warp: number) => void;
  simTimeDays: number;
  onResetTime: () => void;
}

export const TimeControls: React.FC<TimeControlsProps> = ({
  isPlaying,
  onTogglePlay,
  timeWarp,
  onSetTimeWarp,
  simTimeDays,
  onResetTime,
}) => {
  const warps = [1, 10, 100, 1000, 10000];

  return (
    <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-20 flex items-center space-x-3 px-4 py-2 bg-gray-950/85 backdrop-blur-md border border-gray-800/80 rounded-2xl shadow-2xl text-gray-200">
      <div className="flex flex-col items-start pr-3 border-r border-gray-800 text-left font-mono">
        <span className="text-[10px] text-gray-500 uppercase tracking-wider">Mission Elapsed</span>
        <span className="text-xs font-semibold text-cyan-300">
          T+ {simTimeDays.toFixed(2)} days ({Math.round(simTimeDays * 24)}h)
        </span>
      </div>

      <button
        onClick={onTogglePlay}
        className={`p-2.5 rounded-xl transition-all shadow-lg ${
          isPlaying
            ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-600/20'
            : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20'
        }`}
        title={isPlaying ? 'Pause' : 'Play'}
      >
        {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 translate-x-0.5" />}
      </button>

      <div className="flex items-center space-x-1 bg-gray-900/80 p-1 rounded-xl border border-gray-800/60 font-mono text-xs">
        {warps.map((w) => (
          <button
            key={w}
            onClick={() => onSetTimeWarp(w)}
            className={`px-2 py-1 rounded-lg transition-all ${
              timeWarp === w
                ? 'bg-blue-600 text-white font-bold shadow-sm'
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
            }`}
          >
            {w === 1 ? '1x' : w >= 1000 ? `${w / 1000}kx` : `${w}x`}
          </button>
        ))}
      </div>

      <button
        onClick={onResetTime}
        className="p-2 text-gray-400 hover:text-gray-200 hover:bg-gray-800/60 rounded-xl transition-colors"
        title="Reset Time to T+0"
      >
        <RotateCcw className="w-4 h-4" />
      </button>
    </div>
  );
};
