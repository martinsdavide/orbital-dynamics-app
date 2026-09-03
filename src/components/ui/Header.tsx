import React from 'react';
import { Orbit, Rocket, Compass, Eye, Info, BarChart3, RotateCcw } from 'lucide-react';
import type { ActiveAppMode, CameraPreset } from '../canvas/ThreeViewport';

interface HeaderProps {
  appMode: ActiveAppMode;
  onSelectMode: (mode: ActiveAppMode) => void;
  cameraPreset: CameraPreset;
  onSelectCamera: (preset: CameraPreset) => void;
  onOpenInfo: () => void;
  onOpenCharts: () => void;
  onResetSimulation: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  appMode,
  onSelectMode,
  cameraPreset,
  onSelectCamera,
  onOpenInfo,
  onOpenCharts,
  onResetSimulation,
}) => {
  return (
    <header className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between px-4 py-2.5 bg-gray-950/80 backdrop-blur-md border-b border-gray-800/80 text-gray-100 shadow-xl">
      <div className="flex items-center space-x-3">
        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-gradient-to-tr from-blue-600 via-indigo-500 to-cyan-400 text-white shadow-lg shadow-blue-500/20">
          <Orbit className="w-5 h-5 animate-spin-slow" />
        </div>
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="font-bold text-base tracking-wide bg-gradient-to-r from-blue-400 via-cyan-300 to-indigo-300 bg-clip-text text-transparent">
              ASTROSIM
            </h1>
            <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/30">
              v2.0
            </span>
          </div>
          <p className="text-[11px] text-gray-400 font-mono hidden sm:block">
            Sun-Earth-Moon Dynamics & Rocket Trajectory Engine
          </p>
        </div>
      </div>

      <div className="flex items-center p-1 rounded-xl bg-gray-900/90 border border-gray-800">
        <button
          onClick={() => onSelectMode('system')}
          className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            appMode === 'system'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
              : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
          }`}
        >
          <Orbit className="w-4 h-4" />
          <span className="hidden md:inline">Celestial System</span>
          <span className="md:hidden">System</span>
        </button>

        <button
          onClick={() => onSelectMode('launch')}
          className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            appMode === 'launch'
              ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/30'
              : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
          }`}
        >
          <Rocket className="w-4 h-4" />
          <span className="hidden md:inline">Rocket Launch Ascent</span>
          <span className="md:hidden">Launch</span>
        </button>

        <button
          onClick={() => onSelectMode('transfer')}
          className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            appMode === 'transfer'
              ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
              : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
          }`}
        >
          <Compass className="w-4 h-4" />
          <span className="hidden md:inline">Earth-Moon Trajectory</span>
          <span className="md:hidden">Transfer</span>
        </button>
      </div>

      <div className="flex items-center space-x-2">
        <div className="flex items-center space-x-1 bg-gray-900/80 border border-gray-800 rounded-lg px-2 py-1 text-xs">
          <Eye className="w-3.5 h-3.5 text-blue-400" />
          <select
            value={cameraPreset}
            onChange={(e) => onSelectCamera(e.target.value as CameraPreset)}
            className="bg-transparent text-gray-200 text-xs focus:outline-none cursor-pointer"
          >
            <option value="free" className="bg-gray-900">Orbit View</option>
            <option value="earth" className="bg-gray-900">Focus Earth</option>
            <option value="moon" className="bg-gray-900">Focus Moon</option>
            <option value="sun" className="bg-gray-900">Focus Sun</option>
            <option value="spaceport" className="bg-gray-900">Launchpad Cam</option>
            <option value="rocket" className="bg-gray-900">Chase Rocket</option>
            <option value="earthrise" className="bg-gray-900">Moon Earthrise</option>
            <option value="infographic" className="bg-gray-900">Artemis / Infographic View</option>
          </select>
        </div>

        {appMode === 'launch' && (
          <button
            onClick={onOpenCharts}
            className="p-1.5 text-gray-300 hover:text-white bg-gray-900/80 hover:bg-gray-800 border border-gray-800 rounded-lg transition-colors"
            title="Telemetry Graphs"
          >
            <BarChart3 className="w-4 h-4 text-cyan-400" />
          </button>
        )}

        <button
          onClick={onResetSimulation}
          className="p-1.5 text-gray-300 hover:text-white bg-gray-900/80 hover:bg-gray-800 border border-gray-800 rounded-lg transition-colors"
          title="Reset Simulation"
        >
          <RotateCcw className="w-4 h-4" />
        </button>

        <button
          onClick={onOpenInfo}
          className="p-1.5 text-gray-300 hover:text-white bg-gray-900/80 hover:bg-gray-800 border border-gray-800 rounded-lg transition-colors"
          title="Astrodynamics & Physics Manual"
        >
          <Info className="w-4 h-4 text-blue-400" />
        </button>
      </div>
    </header>
  );
};
