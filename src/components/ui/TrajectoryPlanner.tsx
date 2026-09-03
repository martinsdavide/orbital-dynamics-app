import React, { useState } from 'react';
import type { Spaceport } from '../../types/spaceport';
import type { EarthMoonTrajectory, MissionTrajectoryType, LaunchWindow } from '../../types/trajectory';
import { SPACEPORTS } from '../../data/spaceports';
import { solveEarthMoonTrajectory } from '../../physics/trajectorySolver';
import { Compass, Play, Calendar, CheckCircle2, Clock } from 'lucide-react';

interface TrajectoryPlannerProps {
  selectedSpaceport: Spaceport;
  onSelectSpaceport: (p: Spaceport) => void;
  activeTrajectory: EarthMoonTrajectory;
  onUpdateTrajectory: (traj: EarthMoonTrajectory) => void;
  trajectoryProgress: number;
  onChangeProgress: (p: number) => void;
  onSelectLaunchWindow?: (win: LaunchWindow) => void;
}

export const TrajectoryPlanner: React.FC<TrajectoryPlannerProps> = ({
  selectedSpaceport,
  onSelectSpaceport,
  activeTrajectory,
  onUpdateTrajectory,
  trajectoryProgress,
  onChangeProgress,
  onSelectLaunchWindow,
}) => {
  const [trajType, setTrajType] = useState<MissionTrajectoryType>(activeTrajectory.type);
  const [flightTimeHours, setFlightTimeHours] = useState<number>(activeTrajectory.timeOfFlightHours);
  const [selectedWindowIdx, setSelectedWindowIdx] = useState<number>(activeTrajectory.selectedWindowIndex || 0);

  const handleRecalculate = (
    newType: MissionTrajectoryType,
    newTof: number,
    newPort: Spaceport,
    winIdx: number = selectedWindowIdx
  ) => {
    setTrajType(newType);
    setFlightTimeHours(newTof);
    setSelectedWindowIdx(winIdx);
    const solved = solveEarthMoonTrajectory(newType, newPort, 200000, newTof, 0, winIdx);
    onUpdateTrajectory(solved);
  };

  const handleWindowSelect = (win: LaunchWindow, idx: number) => {
    setSelectedWindowIdx(idx);
    handleRecalculate(trajType, flightTimeHours, selectedSpaceport, idx);
    if (onSelectLaunchWindow) {
      onSelectLaunchWindow(win);
    }
  };

  const currentPoint = activeTrajectory.points[
    Math.min(activeTrajectory.points.length - 1, Math.floor(trajectoryProgress * (activeTrajectory.points.length - 1)))
  ];

  return (
    <div className="absolute top-16 left-4 z-20 w-96 bg-gray-950/85 backdrop-blur-md border border-gray-800/80 rounded-2xl p-4 text-gray-200 shadow-2xl space-y-4 max-h-[calc(100vh-130px)] overflow-y-auto font-sans">
      <div className="flex items-center justify-between pb-2 border-b border-gray-800">
        <div className="flex items-center space-x-2">
          <Compass className="w-4 h-4 text-purple-400" />
          <span className="font-semibold text-xs uppercase tracking-wider text-gray-300">
            Earth-Moon Trajectory & Launch Windows
          </span>
        </div>
      </div>

      {/* Spaceport Selector */}
      <div className="space-y-1.5">
        <label className="text-[11px] font-mono uppercase text-gray-400">Departure Launch Base</label>
        <select
          value={selectedSpaceport.id}
          onChange={(e) => {
            const p = SPACEPORTS.find((sp) => sp.id === e.target.value);
            if (p) {
              onSelectSpaceport(p);
              handleRecalculate(trajType, flightTimeHours, p, selectedWindowIdx);
            }
          }}
          className="w-full bg-gray-900/90 border border-gray-800 rounded-xl px-3 py-2 text-xs text-gray-200 focus:outline-none focus:border-purple-500 cursor-pointer"
        >
          {SPACEPORTS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.flag} {p.name} ({p.latitude > 0 ? `+${p.latitude}°N` : `${p.latitude}°S`})
            </option>
          ))}
        </select>
      </div>

      {/* Launch Windows Section */}
      <div className="space-y-2 pt-2 border-t border-gray-800/80">
        <div className="flex items-center justify-between">
          <label className="text-[11px] font-mono uppercase text-purple-300 flex items-center space-x-1.5 font-bold">
            <Calendar className="w-3.5 h-3.5 text-purple-400" />
            <span>Optimal Lunar Launch Windows</span>
          </label>
          <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30">
            {activeTrajectory.launchWindows.length} Opportunities
          </span>
        </div>

        <div className="space-y-1.5">
          {activeTrajectory.launchWindows.map((win, idx) => (
            <div
              key={win.id}
              onClick={() => handleWindowSelect(win, idx)}
              className={`p-2.5 rounded-xl border text-xs cursor-pointer transition-all ${
                selectedWindowIdx === idx
                  ? 'bg-purple-900/40 border-purple-500/80 text-white shadow-md shadow-purple-950/50'
                  : 'bg-gray-900/60 border-gray-800 text-gray-400 hover:border-gray-700 hover:text-gray-200'
              }`}
            >
              <div className="flex items-center justify-between font-mono font-medium">
                <span className="flex items-center space-x-1.5">
                  {selectedWindowIdx === idx ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-purple-400" />
                  ) : (
                    <Clock className="w-3.5 h-3.5 text-gray-500" />
                  )}
                  <span className="text-gray-200 font-bold">T+{win.openTimeHours}h Window</span>
                </span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                  win.isOptimal ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-blue-500/20 text-blue-300'
                }`}>
                  {win.planeAlignmentEfficiency}% Coplanar
                </span>
              </div>

              <div className="mt-1 flex items-center justify-between text-[10px] font-mono text-gray-400">
                <span>Azimuth: <strong className="text-cyan-300">{win.launchAzimuth}° E of N</strong></span>
                <span>Duration: <strong className="text-gray-300">{win.durationMinutes} min</strong></span>
                <span>TLI Δv: <strong className="text-purple-300">{win.tliDeltaV} m/s</strong></span>
              </div>
              <div className="mt-0.5 text-[10px] text-gray-400 italic">
                {win.label}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Mission Type Archetypes */}
      <div className="space-y-1.5 pt-2 border-t border-gray-800/80">
        <label className="text-[11px] font-mono uppercase text-gray-400">Trajectory Archetype</label>
        <div className="grid grid-cols-3 gap-1 bg-gray-900/90 p-1 rounded-xl border border-gray-800 text-xs font-medium">
          <button
            onClick={() => handleRecalculate('direct_loi', flightTimeHours, selectedSpaceport)}
            className={`py-1.5 px-1 rounded-lg text-center transition-all ${
              trajType === 'direct_loi'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            Direct (LOI)
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

      {/* Transfer Time of Flight Slider */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-[11px] font-mono text-gray-400">
          <span>Transfer Flight Duration:</span>
          <span className="text-cyan-400 font-bold">
            {flightTimeHours}h ({(flightTimeHours / 24).toFixed(1)} days)
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
          <span>48h (High Δv)</span>
          <span>72h (Apollo Standard)</span>
          <span>120h (Low Energy)</span>
        </div>
      </div>

      {/* Δv Budget Table */}
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
            <span className="text-gray-400">Lunar Periapsis Altitude:</span>
            <span className="text-gray-200">{activeTrajectory.periapsisMoonAltitude} km</span>
          </div>
        </div>
      </div>

      {/* Trajectory Mission Scrubber & Synchronized Cislunar Dynamics */}
      <div className="space-y-2 pt-2 border-t border-gray-800">
        <div className="flex justify-between text-[11px] font-mono text-gray-400">
          <span className="flex items-center space-x-1">
            <Play className="w-3 h-3 text-cyan-400" />
            <span className="font-bold text-gray-300">Synchronized Mission Timeline</span>
          </span>
          <span className="text-cyan-300 font-bold">{Math.round(trajectoryProgress * 100)}%</span>
        </div>

        {/* Milestone Quick Jumps */}
        <div className="grid grid-cols-4 gap-1 text-[9px] font-mono">
          <button
            onClick={() => onChangeProgress(0)}
            className="py-1 rounded bg-gray-900 hover:bg-gray-800 border border-gray-800 text-gray-300 text-center"
          >
            🚀 Liftoff
          </button>
          <button
            onClick={() => onChangeProgress(0.04)}
            className="py-1 rounded bg-gray-900 hover:bg-gray-800 border border-gray-800 text-cyan-300 text-center"
          >
            🛰️ TLI
          </button>
          <button
            onClick={() => onChangeProgress(activeTrajectory.type === 'free_return' ? 0.52 : 0.95)}
            className="py-1 rounded bg-gray-900 hover:bg-purple-900/60 border border-purple-800/60 text-purple-300 text-center font-bold"
          >
            🌕 Encounter
          </button>
          <button
            onClick={() => onChangeProgress(1.0)}
            className="py-1 rounded bg-gray-900 hover:bg-gray-800 border border-gray-800 text-emerald-300 text-center"
          >
            {activeTrajectory.type === 'free_return' ? '🌍 Splashdown' : '🌕 LLO Orbit'}
          </button>
        </div>

        <input
          type="range"
          min="0"
          max="1"
          step="0.002"
          value={trajectoryProgress}
          onChange={(e) => onChangeProgress(Number(e.target.value))}
          className="w-full h-2 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
        />

        <div className="p-2.5 rounded-xl bg-purple-950/40 border border-purple-800/50 text-[11px] font-mono space-y-1.5 shadow-inner">
          <div className="flex justify-between text-purple-200 font-bold border-b border-purple-800/40 pb-1">
            <span>Mission Phase:</span>
            <span className="text-cyan-300">{currentPoint?.phase || 'Cislunar Transit'}</span>
          </div>
          <div className="grid grid-cols-2 gap-1 text-gray-300 text-[10px]">
            <div>Mission Clock: <strong className="text-white">T+{(currentPoint ? (currentPoint.t - activeTrajectory.points[0].t) / 3600 : 0).toFixed(1)}h</strong></div>
            <div>Inertial Speed: <strong className="text-white">{currentPoint?.speed?.toLocaleString()} m/s</strong></div>
            <div>Dist to Earth: <strong className="text-cyan-300">{Math.round((currentPoint?.distanceToEarth || 0) / 1000).toLocaleString()} km</strong></div>
            <div>Dist to Moon: <strong className="text-purple-300">{Math.round((currentPoint?.distanceToMoon || 0) / 1000).toLocaleString()} km</strong></div>
          </div>

          {currentPoint && currentPoint.distanceToMoon < 66100000 && (
            <div className="mt-1 p-1 rounded bg-purple-500/20 border border-purple-500/40 text-[10px] text-purple-200 text-center font-bold animate-pulse">
              🌕 Lunar Gravity Encounter Active (Inside Laplace SOI)
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
