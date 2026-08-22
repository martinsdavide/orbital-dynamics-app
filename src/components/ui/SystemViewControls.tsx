import React from 'react';
import type { ReferenceFrame, ScaleMode, EphemerisState } from '../../types/celestial';
import { Layers, Globe2, Compass } from 'lucide-react';

interface SystemViewControlsProps {
  referenceFrame: ReferenceFrame;
  onChangeFrame: (frame: ReferenceFrame) => void;
  scaleMode: ScaleMode;
  onChangeScale: (scale: ScaleMode) => void;
  showLagrangePoints: boolean;
  onToggleLagrange: () => void;
  showOrbitLines: boolean;
  onToggleOrbitLines: () => void;
  showLunarSOI: boolean;
  onToggleLunarSOI: () => void;
  showAtmosphereGlow: boolean;
  onToggleAtmosphere: () => void;
  ephemeris: EphemerisState;
}

export const SystemViewControls: React.FC<SystemViewControlsProps> = ({
  referenceFrame,
  onChangeFrame,
  scaleMode,
  onChangeScale,
  showLagrangePoints,
  onToggleLagrange,
  showOrbitLines,
  onToggleOrbitLines,
  showLunarSOI,
  onToggleLunarSOI,
  showAtmosphereGlow,
  onToggleAtmosphere,
  ephemeris,
}) => {
  return (
    <div className="absolute top-16 left-4 z-20 w-72 bg-gray-950/85 backdrop-blur-md border border-gray-800/80 rounded-2xl p-4 text-gray-200 shadow-2xl space-y-4">
      <div className="flex items-center justify-between pb-2 border-b border-gray-800">
        <div className="flex items-center space-x-2">
          <Layers className="w-4 h-4 text-blue-400" />
          <span className="font-semibold text-xs uppercase tracking-wider text-gray-300">
            Orbital System Settings
          </span>
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-[11px] font-mono uppercase text-gray-400 flex items-center space-x-1.5">
          <Compass className="w-3.5 h-3.5 text-cyan-400" />
          <span>Coordinate Reference Frame</span>
        </label>
        <div className="grid grid-cols-3 gap-1 bg-gray-900/90 p-1 rounded-xl border border-gray-800 text-xs">
          <button
            onClick={() => onChangeFrame('heliocentric')}
            className={`py-1.5 rounded-lg text-center font-medium transition-all ${
              referenceFrame === 'heliocentric'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            Heliocentric
          </button>
          <button
            onClick={() => onChangeFrame('geocentric')}
            className={`py-1.5 rounded-lg text-center font-medium transition-all ${
              referenceFrame === 'geocentric'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            Geocentric
          </button>
          <button
            onClick={() => onChangeFrame('barycentric')}
            className={`py-1.5 rounded-lg text-center font-medium transition-all ${
              referenceFrame === 'barycentric'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            Barycentric
          </button>
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-[11px] font-mono uppercase text-gray-400 flex items-center space-x-1.5">
          <Globe2 className="w-3.5 h-3.5 text-blue-400" />
          <span>Scale Proportions</span>
        </label>
        <div className="grid grid-cols-2 gap-1 bg-gray-900/90 p-1 rounded-xl border border-gray-800 text-xs">
          <button
            onClick={() => onChangeScale('visual')}
            className={`py-1.5 rounded-lg text-center font-medium transition-all ${
              scaleMode === 'visual'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            Enhanced Visual
          </button>
          <button
            onClick={() => onChangeScale('true')}
            className={`py-1.5 rounded-lg text-center font-medium transition-all ${
              scaleMode === 'true'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            True 1:1 Scale
          </button>
        </div>
      </div>

      <div className="space-y-2 pt-2 border-t border-gray-800/80 text-xs">
        <label className="text-[11px] font-mono uppercase text-gray-400">Visual Overlays</label>

        <label className="flex items-center justify-between cursor-pointer group">
          <span className="text-gray-300 group-hover:text-white">Earth-Moon Lagrange (L1-L5)</span>
          <input
            type="checkbox"
            checked={showLagrangePoints}
            onChange={onToggleLagrange}
            className="w-4 h-4 rounded text-blue-600 focus:ring-0 focus:outline-none bg-gray-800 border-gray-700 cursor-pointer"
          />
        </label>

        <label className="flex items-center justify-between cursor-pointer group">
          <span className="text-gray-300 group-hover:text-white">Keplerian Orbit Trails</span>
          <input
            type="checkbox"
            checked={showOrbitLines}
            onChange={onToggleOrbitLines}
            className="w-4 h-4 rounded text-blue-600 focus:ring-0 focus:outline-none bg-gray-800 border-gray-700 cursor-pointer"
          />
        </label>

        <label className="flex items-center justify-between cursor-pointer group">
          <span className="text-gray-300 group-hover:text-white">Lunar Sphere of Influence</span>
          <input
            type="checkbox"
            checked={showLunarSOI}
            onChange={onToggleLunarSOI}
            className="w-4 h-4 rounded text-blue-600 focus:ring-0 focus:outline-none bg-gray-800 border-gray-700 cursor-pointer"
          />
        </label>

        <label className="flex items-center justify-between cursor-pointer group">
          <span className="text-gray-300 group-hover:text-white">Atmospheric Rayleigh Glow</span>
          <input
            type="checkbox"
            checked={showAtmosphereGlow}
            onChange={onToggleAtmosphere}
            className="w-4 h-4 rounded text-blue-600 focus:ring-0 focus:outline-none bg-gray-800 border-gray-700 cursor-pointer"
          />
        </label>
      </div>

      <div className="pt-2 border-t border-gray-800/80 space-y-1.5 text-[11px] font-mono text-gray-400">
        <div className="flex justify-between">
          <span>Earth-Sun Distance:</span>
          <span className="text-gray-200">1.00 AU (149.6M km)</span>
        </div>
        <div className="flex justify-between">
          <span>Earth-Moon Distance:</span>
          <span className="text-gray-200">384,400 km</span>
        </div>
        <div className="flex justify-between">
          <span>Moon Orbital Inclination:</span>
          <span className="text-purple-300">5.145° (to Ecliptic)</span>
        </div>
        <div className="flex justify-between">
          <span>Moon Phase Angle:</span>
          <span className="text-cyan-300">{Math.round(ephemeris.moonPhaseAngle)}°</span>
        </div>
        {ephemeris.eclipseStatus !== 'none' && (
          <div className="p-1.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 text-center font-bold animate-pulse">
            ⚠️ {ephemeris.eclipseStatus === 'solar_eclipse' ? 'Solar Eclipse Alignment' : 'Lunar Eclipse Alignment'}
          </div>
        )}
      </div>
    </div>
  );
};
