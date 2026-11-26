import { type BoosterReturnSample, SUPER_HEAVY_PRESET_ID } from '../../physics/boosterReturn';
import { ISS_ORBIT_ALTITUDE } from '../../physics/constants';
import React, { useState } from 'react';
import type { Spaceport } from '../../types/spaceport';
import type { RocketPreset, RocketTelemetry } from '../../types/rocket';
import { SPACEPORTS, SPACEX_SPACEPORTS } from '../../data/spaceports';
import { ROCKET_PRESETS } from '../../data/rockets';
import { Rocket, MapPin, Gauge, Flame, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';

function renderSpaceportOption(port: Spaceport) {
  const latitude = `${Math.abs(port.latitude).toFixed(1)}°${port.latitude >= 0 ? 'N' : 'S'}`;
  return <option key={port.id} value={port.id}>{port.flag} {port.shortName} ({latitude})</option>;
}

interface LaunchViewControlsProps {
  selectedSpaceport: Spaceport;
  onSelectSpaceport: (port: Spaceport) => void;
  activeRocket: RocketPreset;
  onSelectRocket: (rocket: RocketPreset) => void;
  rocketTelemetry: RocketTelemetry;
  booster?: BoosterReturnSample;
  showBoosterInset: boolean;
  onToggleBoosterInset: () => void;
  onLaunch: () => void;
  onAbort: () => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
  playbackRate: number;
  onChangePlaybackRate: (rate: number) => void;
  autoGuidance: boolean;
  orbitTargetAltitude?: number;
  onOrbitTargetChange: (altitude?: number) => void;
  onToggleAutoGuidance: () => void;
  throttle: number;
  onChangeThrottle: (val: number) => void;
  manualPitch: number;
  onChangeManualPitch: (val: number) => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const LaunchViewControls: React.FC<LaunchViewControlsProps> = ({
  selectedSpaceport,
  onSelectSpaceport,
  activeRocket,
  onSelectRocket,
  rocketTelemetry,
  booster,
  showBoosterInset,
  onToggleBoosterInset,
  onLaunch,
  onAbort,
  isPlaying,
  onTogglePlay,
  playbackRate,
  onChangePlaybackRate,
  autoGuidance,
  orbitTargetAltitude,
  onOrbitTargetChange,
  onToggleAutoGuidance,
  throttle,
  onChangeThrottle,
  manualPitch,
  onChangeManualPitch,
  isCollapsed,
  onToggleCollapse,
}) => {
  const hasOrbitTarget = orbitTargetAltitude !== undefined;
  const isPad = rocketTelemetry.phase === 'pad';
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const collapsed = isCollapsed !== undefined ? isCollapsed : internalCollapsed;
  const toggleCollapse = onToggleCollapse || (() => setInternalCollapsed(!internalCollapsed));

  if (collapsed) {
    return (
      <div className="absolute top-16 left-4 z-20">
        <button
          onClick={toggleCollapse}
          className="flex items-center space-x-2 px-3.5 py-2.5 bg-gray-950/90 backdrop-blur-md border border-gray-800/80 rounded-2xl text-gray-200 shadow-2xl hover:border-cyan-500/50 hover:bg-gray-900/90 transition-all group"
          title="Expand Launch Operations Console"
        >
          <Rocket className="w-4 h-4 text-cyan-400 group-hover:scale-110 transition-transform" />
          <span className="font-semibold text-xs uppercase tracking-wider text-gray-300">
            Launch Console
          </span>
          <ChevronDown className="w-4 h-4 text-gray-400 group-hover:text-cyan-400 transition-colors ml-1" />
        </button>
      </div>
    );
  }

  return (
    <div className="absolute top-16 left-4 z-20 w-80 bg-gray-950/85 backdrop-blur-md border border-gray-800/80 rounded-2xl p-4 text-gray-200 shadow-2xl space-y-4 max-h-[calc(100vh-130px)] overflow-y-auto">
      <div className="flex items-center justify-between pb-2 border-b border-gray-800">
        <div className="flex items-center space-x-2">
          <Rocket className="w-4 h-4 text-cyan-400" />
          <span className="font-semibold text-xs uppercase tracking-wider text-gray-300">
            Launch Operations Console
          </span>
        </div>
        <button
          onClick={toggleCollapse}
          className="p-1 text-gray-400 hover:text-gray-200 hover:bg-gray-800/80 rounded-lg transition-colors"
          title="Collapse panel"
        >
          <ChevronUp className="w-4 h-4" />
        </button>
      </div>

      {activeRocket.id === SUPER_HEAVY_PRESET_ID && (
        <section className="space-y-1.5 rounded-lg border border-amber-900/60 bg-amber-950/20 p-2.5 text-xs">
          <h2 className="font-semibold text-amber-200">Super Heavy return</h2>
          <label className="flex items-center justify-between gap-2">
            Show booster camera inset
            <input type="checkbox" checked={showBoosterInset} onChange={onToggleBoosterInset} className="accent-amber-400" />
          </label>
          <p className="text-gray-300">{booster?.phase ?? 'Starts at first-stage separation'}</p>
          {booster && (
            <dl className="grid grid-cols-2 gap-1 font-mono text-[11px]">
              <dt>Altitude</dt><dd>{(booster.altitude / 1000).toFixed(1)} km</dd>
              <dt>Downrange</dt><dd>{(booster.downrangeDistance / 1000).toFixed(1)} km</dd>
              <dt>Vertical speed</dt><dd>{booster.verticalSpeed.toFixed(0)} m/s</dd>
              <dt>Along-track speed</dt><dd>{booster.horizontalSpeed.toFixed(0)} m/s</dd>
              <dt>Pitch</dt><dd>{booster.pitchAngle.toFixed(0)}°</dd>
            </dl>
          )}
        </section>
      )}

      <div className="space-y-1.5">
        <label className="text-[11px] font-mono uppercase text-gray-400 flex items-center space-x-1.5">
          <MapPin className="w-3.5 h-3.5 text-emerald-400" />
          <span>Launch Complex Spaceport</span>
        </label>
        <select
          aria-label="Launch Complex Spaceport"
          value={selectedSpaceport.id}
          onChange={(e) => {
            const port = SPACEPORTS.find((p) => p.id === e.target.value);
            if (port) onSelectSpaceport(port);
          }}
          disabled={!isPad}
          className="w-full bg-gray-900/90 border border-gray-800 rounded-xl px-3 py-2 text-xs text-gray-200 focus:outline-none focus:border-cyan-500 cursor-pointer disabled:opacity-50"
        >
          {SPACEPORTS.filter(port => port.operator !== 'SpaceX').map(renderSpaceportOption)}
          <optgroup label="SpaceX">{SPACEX_SPACEPORTS.map(renderSpaceportOption)}</optgroup>
        </select>
        <div className="p-2 rounded-xl bg-gray-900/60 border border-gray-800/60 text-[11px] font-mono text-gray-300 space-y-1">
          <div className="flex justify-between">
            <span className="text-gray-400">Earth Rotational Boost:</span>
            <span className="text-emerald-400 font-bold">+{selectedSpaceport.equatorialBoostVelocity} m/s</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Min Inclination:</span>
            <span className="text-blue-300">{selectedSpaceport.minOrbitalInclination}°</span>
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-[11px] font-mono uppercase text-gray-400 flex items-center space-x-1.5">
          <Gauge className="w-3.5 h-3.5 text-cyan-400" />
          <span>Multi-Stage Rocket Configuration</span>
        </label>
        <select
          value={activeRocket.id}
          onChange={(e) => {
            const r = ROCKET_PRESETS.find((p) => p.id === e.target.value);
            if (r) onSelectRocket(r);
          }}
          disabled={!isPad}
          className="w-full bg-gray-900/90 border border-gray-800 rounded-xl px-3 py-2 text-xs text-gray-200 focus:outline-none focus:border-cyan-500 cursor-pointer disabled:opacity-50"
        >
          {ROCKET_PRESETS.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name} ({r.stages.length} Stages)
            </option>
          ))}
        </select>
        <div className="p-2 rounded-xl bg-gray-900/60 border border-gray-800/60 text-[11px] font-mono text-gray-300 space-y-1">
          <div className="flex justify-between">
            <span className="text-gray-400">Liftoff Thrust:</span>
            <span className="text-amber-400">{(activeRocket.totalLiftoffThrust / 1e6).toFixed(1)} MN</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Liftoff Wet Mass:</span>
            <span className="text-gray-200">{(activeRocket.totalLiftoffMass / 1000).toLocaleString()} t</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Payload to Moon (TLI):</span>
            <span className="text-purple-300">{(activeRocket.payloadToTLI / 1000).toFixed(1)} tonnes</span>
          </div>
        </div>
      </div>

      <div className="space-y-2 pt-2 border-t border-gray-800/80">
        <label className="flex items-center justify-between gap-2 text-xs text-gray-300">
          <span>Flight target</span>
          <select
            value={orbitTargetAltitude ?? ''}
            disabled={!isPad}
            onChange={event => onOrbitTargetChange(event.target.value ? Number(event.target.value) : undefined)}
            className="rounded-lg border border-gray-700 bg-gray-900 px-2 py-1 text-gray-200 disabled:opacity-60"
          >
            <option value="">Open ascent</option>
            <option value={300_000}>300 km parking orbit</option>
            <option value={ISS_ORBIT_ALTITUDE}>ISS altitude · 420 km</option>
            <option value={600_000}>600 km parking orbit</option>
          </select>
        </label>
        {hasOrbitTarget && (
          <p className="text-[11px] text-gray-400">Targets a circular orbit at the selected altitude. Matching the ISS orbital plane and rendezvous are separate.</p>
        )}

        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-gray-300">Gravity Turn Flight Director</span>
          <button
            onClick={onToggleAutoGuidance}
            disabled={hasOrbitTarget}
            className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-colors ${
              autoGuidance || hasOrbitTarget ? 'bg-cyan-600 text-white' : 'bg-gray-800 text-gray-400'
            }`}
          >
            {hasOrbitTarget ? 'ORBIT GUIDANCE' : autoGuidance ? 'AUTO PROGRAM' : 'MANUAL PITCH'}
          </button>
        </div>

        {!autoGuidance && !hasOrbitTarget && (
          <div className="space-y-1">
            <div className="flex justify-between text-[11px] font-mono text-gray-400">
              <span>Target Pitch Angle:</span>
              <span className="text-cyan-400 font-bold">{manualPitch}°</span>
            </div>
            <input
              type="range"
              min="0"
              max="90"
              value={manualPitch}
              onChange={(e) => onChangeManualPitch(Number(e.target.value))}
              className="w-full h-1.5 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
            />
          </div>
        )}

        <div className="space-y-1">
          <div className="flex justify-between text-[11px] font-mono text-gray-400">
            <span>{hasOrbitTarget ? 'Throttle limit' : 'Main Engine Throttle'}:</span>
            <span className="text-amber-400 font-bold">{Math.round(throttle * 100)}%</span>
          </div>
          <input
            type="range"
            min="0.2"
            max="1.0"
            step="0.05"
            value={throttle}
            onChange={(e) => onChangeThrottle(Number(e.target.value))}
            className="w-full h-1.5 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
          />
        </div>
      </div>

      <div className="flex items-center gap-2 text-xs">
        <label className="flex items-center gap-2">
          <span>Playback speed</span>
          <select value={playbackRate} onChange={(event) => onChangePlaybackRate(Number(event.target.value))} className="rounded bg-gray-800 px-2 py-1">
            <option value={1}>1×</option>
            <option value={2}>2×</option>
            <option value={10}>10×</option>
            <option value={25}>25×</option>
          </select>
        </label>
        {!isPad && (
          <button type="button" onClick={onTogglePlay} className="ml-auto rounded bg-gray-800 px-2 py-1 hover:bg-gray-700">
            {isPlaying ? 'Pause' : 'Resume'}
          </button>
        )}
      </div>

      <div className="space-y-1 text-xs text-gray-300">
        <p className="flex items-center gap-2"><span aria-hidden="true" className="h-0.5 w-3 bg-amber-300" />Rocket trail</p>
        <p className="flex items-center gap-2"><span aria-hidden="true" className="h-0.5 w-3 bg-sky-400" />ISS reference orbit · 420 km · 51.6°</p>
      </div>

      <div className="pt-2 border-t border-gray-800/80">
        {isPad ? (
          <button
            onClick={onLaunch}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-red-600 via-amber-600 to-yellow-500 hover:from-red-500 hover:to-yellow-400 text-white font-bold text-sm shadow-lg shadow-red-600/30 flex items-center justify-center space-x-2 transition-all transform hover:scale-[1.02]"
          >
            <Flame className="w-5 h-5 animate-bounce" />
            <span>IGNITION & LIFTOFF</span>
          </button>
        ) : (
          <button
            onClick={onAbort}
            className="w-full py-2.5 rounded-xl bg-red-800 hover:bg-red-700 text-white font-bold text-xs shadow-md shadow-red-900/40 flex items-center justify-center space-x-2 transition-colors"
          >
            <AlertTriangle className="w-4 h-4" />
            <span>RESET LAUNCHPAD / ABORT</span>
          </button>
        )}
      </div>
    </div>
  );
};
