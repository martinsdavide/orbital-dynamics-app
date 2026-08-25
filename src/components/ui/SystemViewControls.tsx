import React from 'react';
import type { ReferenceFrame, ScaleMode, EphemerisState } from '../../types/celestial';
import { Layers, Globe2, Compass, Sun, ShieldAlert, Disc, Eye } from 'lucide-react';

interface SystemViewControlsProps {
  referenceFrame: ReferenceFrame;
  onChangeFrame: (frame: ReferenceFrame) => void;
  scaleMode: ScaleMode;
  onChangeScale: (scale: ScaleMode) => void;
  showLagrangePoints: boolean;
  onToggleLagrange: () => void;
  showEarthOrbit: boolean;
  onToggleEarthOrbit: () => void;
  showMoonOrbit: boolean;
  onToggleMoonOrbit: () => void;
  showComposedMoonSunOrbit: boolean;
  onToggleComposedMoonSunOrbit: () => void;
  showDynamicTrails: boolean;
  onToggleDynamicTrails: () => void;
  showLunarSOI: boolean;
  onToggleLunarSOI: () => void;
  showAtmosphereGlow: boolean;
  onToggleAtmosphere: () => void;
  showGeocentricSolarOrbit: boolean;
  onToggleGeocentricSolarOrbit: () => void;
  showEarthUmbraShadow: boolean;
  onToggleEarthUmbraShadow: () => void;
  showGeoLeoBelts: boolean;
  onToggleGeoLeoBelts: () => void;
  showLineOfNodes: boolean;
  onToggleLineOfNodes: () => void;
  ephemeris: EphemerisState;
}

export const SystemViewControls: React.FC<SystemViewControlsProps> = ({
  referenceFrame,
  onChangeFrame,
  scaleMode,
  onChangeScale,
  showLagrangePoints,
  onToggleLagrange,
  showEarthOrbit,
  onToggleEarthOrbit,
  showMoonOrbit,
  onToggleMoonOrbit,
  showComposedMoonSunOrbit,
  onToggleComposedMoonSunOrbit,
  showDynamicTrails,
  onToggleDynamicTrails,
  showLunarSOI,
  onToggleLunarSOI,
  showAtmosphereGlow,
  onToggleAtmosphere,
  showGeocentricSolarOrbit,
  onToggleGeocentricSolarOrbit,
  showEarthUmbraShadow,
  onToggleEarthUmbraShadow,
  showGeoLeoBelts,
  onToggleGeoLeoBelts,
  showLineOfNodes,
  onToggleLineOfNodes,
  ephemeris,
}) => {
  return (
    <div className="absolute top-16 left-4 z-20 w-84 bg-gray-950/85 backdrop-blur-md border border-gray-800/80 rounded-2xl p-4 text-gray-200 shadow-2xl space-y-4 max-h-[calc(100vh-130px)] overflow-y-auto font-sans">
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
        <div className="grid grid-cols-2 gap-1 bg-gray-900/90 p-1 rounded-xl border border-gray-800 text-xs">
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
        <div className="p-2 rounded-xl bg-gray-900/60 border border-gray-800 text-[10px] font-mono text-gray-400">
          {scaleMode === 'true' ? (
            <span className="text-emerald-300">
              📏 <strong>True 1:1 Scale:</strong> Distance is 60.33 Earth radii (384,400 km). Moon diameter is 27.3% of Earth.
            </span>
          ) : (
            <span className="text-blue-300">
              👁️ <strong>Enhanced Visual:</strong> Body sizes and cislunar distances scaled for simultaneous multi-body viewing.
            </span>
          )}
        </div>
      </div>

      {/* Geocentric Specific Features */}
      {referenceFrame !== 'heliocentric' && (
        <div className="space-y-2 pt-2 border-t border-gray-800/80 text-xs">
          <label className="text-[11px] font-mono uppercase text-amber-400 flex items-center space-x-1.5 font-bold">
            <Sun className="w-3.5 h-3.5 text-amber-400" />
            <span>Geocentric Celestial Features</span>
          </label>

          <label className="flex items-center justify-between cursor-pointer group p-1.5 rounded-lg bg-gray-900/40 hover:bg-gray-900 border border-gray-800/60">
            <span className="flex items-center space-x-2 text-amber-300">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block shadow-sm shadow-amber-400/50" />
              <span>Apparent Ecliptic Solar Orbit (Sun vs Earth)</span>
            </span>
            <input
              type="checkbox"
              checked={showGeocentricSolarOrbit}
              onChange={onToggleGeocentricSolarOrbit}
              className="w-4 h-4 rounded text-amber-600 focus:ring-0 focus:outline-none bg-gray-800 border-gray-700 cursor-pointer"
            />
          </label>

          <label className="flex items-center justify-between cursor-pointer group p-1.5 rounded-lg bg-gray-900/40 hover:bg-gray-900 border border-gray-800/60">
            <span className="flex items-center space-x-2 text-indigo-300">
              <ShieldAlert className="w-3.5 h-3.5 text-indigo-400" />
              <span>Earth Umbra Shadow Cone (Eclipse Region)</span>
            </span>
            <input
              type="checkbox"
              checked={showEarthUmbraShadow}
              onChange={onToggleEarthUmbraShadow}
              className="w-4 h-4 rounded text-indigo-600 focus:ring-0 focus:outline-none bg-gray-800 border-gray-700 cursor-pointer"
            />
          </label>

          <label className="flex items-center justify-between cursor-pointer group p-1.5 rounded-lg bg-gray-900/40 hover:bg-gray-900 border border-gray-800/60">
            <span className="flex items-center space-x-2 text-cyan-300">
              <Disc className="w-3.5 h-3.5 text-cyan-400" />
              <span>Geostationary (GEO) & LEO Belts</span>
            </span>
            <input
              type="checkbox"
              checked={showGeoLeoBelts}
              onChange={onToggleGeoLeoBelts}
              className="w-4 h-4 rounded text-cyan-600 focus:ring-0 focus:outline-none bg-gray-800 border-gray-700 cursor-pointer"
            />
          </label>

          <label className="flex items-center justify-between cursor-pointer group p-1.5 rounded-lg bg-gray-900/40 hover:bg-gray-900 border border-gray-800/60">
            <span className="flex items-center space-x-2 text-emerald-300">
              <Eye className="w-3.5 h-3.5 text-emerald-400" />
              <span>Ecliptic-Lunar Line of Nodes</span>
            </span>
            <input
              type="checkbox"
              checked={showLineOfNodes}
              onChange={onToggleLineOfNodes}
              className="w-4 h-4 rounded text-emerald-600 focus:ring-0 focus:outline-none bg-gray-800 border-gray-700 cursor-pointer"
            />
          </label>
        </div>
      )}

      {/* Heliocentric Orbits */}
      {referenceFrame === 'heliocentric' && (
        <div className="space-y-2 pt-2 border-t border-gray-800/80 text-xs">
          <label className="text-[11px] font-mono uppercase text-gray-400">Heliocentric Orbits</label>

          <label className="flex items-center justify-between cursor-pointer group p-1.5 rounded-lg bg-gray-900/40 hover:bg-gray-900 border border-gray-800/60">
            <span className="flex items-center space-x-2 text-cyan-300">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 inline-block shadow-sm shadow-cyan-400/50" />
              <span>Earth Orbit around Sun</span>
            </span>
            <input
              type="checkbox"
              checked={showEarthOrbit}
              onChange={onToggleEarthOrbit}
              className="w-4 h-4 rounded text-cyan-600 focus:ring-0 focus:outline-none bg-gray-800 border-gray-700 cursor-pointer"
            />
          </label>

          <label className="flex items-center justify-between cursor-pointer group p-1.5 rounded-lg bg-gray-900/40 hover:bg-gray-900 border border-gray-800/60">
            <span className="flex items-center space-x-2 text-pink-300">
              <span className="w-2.5 h-2.5 rounded-full bg-pink-500 inline-block shadow-sm shadow-pink-500/50" />
              <span>1-Year Lunar Epicycloid Ribbon</span>
            </span>
            <input
              type="checkbox"
              checked={showComposedMoonSunOrbit}
              onChange={onToggleComposedMoonSunOrbit}
              className="w-4 h-4 rounded text-pink-600 focus:ring-0 focus:outline-none bg-gray-800 border-gray-700 cursor-pointer"
            />
          </label>
        </div>
      )}

      <div className="space-y-2 pt-2 border-t border-gray-800/80 text-xs">
        <label className="text-[11px] font-mono uppercase text-gray-400">Cislunar Visual Overlays</label>

        <label className="flex items-center justify-between cursor-pointer group p-1.5 rounded-lg bg-gray-900/40 hover:bg-gray-900 border border-gray-800/60">
          <span className="flex items-center space-x-2 text-purple-300">
            <span className="w-2.5 h-2.5 rounded-full bg-purple-400 inline-block shadow-sm shadow-purple-400/50" />
            <span>Moon Orbit around Earth</span>
          </span>
          <input
            type="checkbox"
            checked={showMoonOrbit}
            onChange={onToggleMoonOrbit}
            className="w-4 h-4 rounded text-purple-600 focus:ring-0 focus:outline-none bg-gray-800 border-gray-700 cursor-pointer"
          />
        </label>

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
          <span className="text-gray-300 group-hover:text-white">Lunar Sphere of Influence (SOI)</span>
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

        <label className="flex items-center justify-between cursor-pointer group p-1.5 rounded-lg bg-gray-900/40 hover:bg-gray-900 border border-gray-800/60">
          <span className="flex items-center space-x-2 text-emerald-300">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block shadow-sm shadow-emerald-400/50" />
            <span>Live Motion Breadcrumbs</span>
          </span>
          <input
            type="checkbox"
            checked={showDynamicTrails}
            onChange={onToggleDynamicTrails}
            className="w-4 h-4 rounded text-emerald-600 focus:ring-0 focus:outline-none bg-gray-800 border-gray-700 cursor-pointer"
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
