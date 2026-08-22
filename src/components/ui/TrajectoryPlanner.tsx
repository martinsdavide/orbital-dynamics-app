import React, { useState } from 'react';
import type { Spaceport } from '../../types/spaceport';
import type { EarthMoonTrajectory, MissionTrajectoryType } from '../../types/trajectory';
import { SPACEPORTS } from '../../data/spaceports';
import { solveEarthMoonTrajectory } from '../../physics/trajectorySolver';
import { Compass, Play } from 'lucide-react';

interface TrajectoryPlannerProps {
  selectedSpaceport: Spaceport;
  onSelectSpaceport: (p: Spaceport) => void;
  activeTrajectory: EarthMoonTrajectory;
  onUpdateTrajectory: (traj: EarthMoonTrajectory) => void;
  trajectoryProgress: number;
  onChangeProgress: (p: number) => void;
}

export const TrajectoryPlanner: React.FC<TrajectoryPlannerProps> = ({
  selectedSpaceport,
  onSelectSpaceport,
  activeTrajectory,
  onUpdateTrajectory,
  trajectoryProgress,
  onChangeProgress,
}) => {
  const [trajType, setTrajType] = useState<MissionTrajectoryType>(activeTrajectory.type);
  const [flightTimeHours, setFlightTimeHours] = useState<number>(activeTrajectory.timeOfFlightHours);

  const handleRecalculate = (newType: MissionTrajectoryType, newTof: number, newPort: Spaceport) => {
    setTrajType(newType);
    setFlightTimeHours(newTof);
    const solved = solveEarthMoonTrajectory(newType, newPort, 200000, newTof);
    onUpdateTrajectory(solved);
  };

  return (
    <div className="absolute top-16 left-4 z-20 w-88 bg-gray-950/85 backdrop-blur-md border border-gray-800/80 rounded-2xl p-4 text-gray-200 shadow-2xl space-y-4 max-h-[calc(100vh-130px)] overflow-y-auto">
      <div className="flex items-center justify-between pb-2 border-b border-gray-800">
        <div className="flex items-center space-x-2">
          <Compass className="w-4 h-4 text-purple-400" />
          <span className="font-semibold text-xs uppercase tracking-wider text-gray-300">
            Earth-Moon Trajectory Optimizer
          </span>
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-[11px] font-mono uppercase text-gray-400">Departure Earth Spaceport</label>
        <select
          value={selectedSpaceport.id}
          onChange={(e) => {
            const p = SPACEPORTS.find((sp) => sp.id === e.target.value);
            if (p) {
              onSelectSpaceport(p);
              handleRecalculate(trajType, flightTimeHours, p);
            }
          }}
          className="w-full bg-gray-900/90 border border-gray-800 rounded-xl px-3 py-2 text-xs text-gray-200 focus:outline-none focus:border-purple-500 cursor-pointer"
        >
          {SPACEPORTS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.flag} {p.name}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <label className="text-[11px] font-mono uppercase text-gray-400">Mission Profile Archetype</label>
        <div className="grid grid-cols-3 gap-1 bg-gray-900/90 p-1 rounded-xl border border-gray-800 text-xs font-medium">
          <button
            onClick={() => handleRecalculate('direct_loi', flightTimeHours, selectedSpaceport)}
            className={`py-1.5 px-1 rounded-lg text-center transition-all ${
              trajType === 'direct_loi'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            Direct Orbit (LOI)
          </button>
          <button
            onClick={() => handleRecalculate('free_return', flightTimeHours, selectedSpaceport)}
            className={`py-1.5 px-1 rounded-lg text-center transition-all ${
              trajType === 'free_return'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            Free Return
          </button>
          <button
            onClick={() => handleRecalculate('lunar_flyby', flightTimeHours, selectedSpaceport)}
            className={`py-1.5 px-1 rounded-lg text-center transition-all ${
              trajType === 'lunar_flyby'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            Lunar Flyby
          </button>
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex justify-between text-[11px] font-mono text-gray-400">
          <span>Transfer Time of Flight:</span>
          <span className="text-cyan-400 font-bold">
            {flightTimeHours} hours ({(flightTimeHours / 24).toFixed(1)} days)
          </span>
        </div>
        <input
          type="range"
          min="48"
          max="120"
          step="6"
          value={flightTimeHours}
          onChange={(e) => handleRecalculate(trajType, Number(e.target.value), selectedSpaceport)}
          className="w-full h-1.5 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
        />
        <div className="flex justify-between text-[10px] font-mono text-gray-500">
          <span>48h (Fast / High Δv)</span>
          <span>72h (Apollo Standard)</span>
          <span>120h (Low Energy)</span>
        </div>
      </div>

      <div className="p-3 rounded-xl bg-gray-900/80 border border-gray-800 space-y-2 text-xs font-mono">
        <div className="flex items-center justify-between pb-1.5 border-b border-gray-800 text-gray-300">
          <span className="font-bold">Total Astrodynamic Δv Budget</span>
          <span className="text-emerald-400 font-bold text-sm">
            {activeTrajectory.totalMissionDeltaV.toLocaleString()} m/s
          </span>
        </div>

        <div className="space-y-1 text-[11px]">
          <div className="flex justify-between">
            <span className="text-gray-400">Trans-Lunar Injection (TLI):</span>
            <span className="text-cyan-300">+{activeTrajectory.tliDeltaV} m/s</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Lunar Orbit Insertion (LOI):</span>
            <span className="text-purple-300">+{activeTrajectory.loiDeltaV} m/s</span>
          </div>
          {activeTrajectory.planeChangeDeltaV > 0 && (
            <div className="flex justify-between">
              <span className="text-gray-400">Latitude Plane Change:</span>
              <span className="text-amber-400">+{activeTrajectory.planeChangeDeltaV} m/s</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-gray-400">Spaceport Rotation Bonus:</span>
            <span className="text-emerald-400">-{activeTrajectory.spaceportRotationBenefit} m/s</span>
          </div>
          <div className="flex justify-between pt-1 border-t border-gray-800/60">
            <span className="text-gray-400">Launch Azimuth:</span>
            <span className="text-gray-200">{activeTrajectory.launchAzimuthRequired}° East of North</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Lunar Flyby Periapsis:</span>
            <span className="text-gray-200">{activeTrajectory.periapsisMoonAltitude} km alt</span>
          </div>
        </div>
      </div>

      <div className="space-y-1.5 pt-2 border-t border-gray-800">
        <div className="flex justify-between text-[11px] font-mono text-gray-400">
          <span className="flex items-center space-x-1">
            <Play className="w-3 h-3 text-cyan-400" />
            <span>Mission Trajectory Scrubber</span>
          </span>
          <span className="text-cyan-300 font-bold">{Math.round(trajectoryProgress * 100)}%</span>
        </div>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={trajectoryProgress}
          onChange={(e) => onChangeProgress(Number(e.target.value))}
          className="w-full h-2 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
        />
        <div className="p-2 rounded-xl bg-purple-950/30 border border-purple-800/40 text-[11px] text-purple-200 font-mono">
          {activeTrajectory.points[Math.min(activeTrajectory.points.length - 1, Math.floor(trajectoryProgress * (activeTrajectory.points.length - 1)))]?.phase || 'Cislunar Coast'}
        </div>
      </div>
    </div>
  );
};
