import React from 'react';
import type { Spaceport } from '../../types/spaceport';
import type { RocketPreset, RocketTelemetry } from '../../types/rocket';
import { SPACEPORTS } from '../../data/spaceports';
import { ROCKET_PRESETS } from '../../data/rockets';
import { Rocket, MapPin, Gauge, Flame, AlertTriangle } from 'lucide-react';

interface LaunchViewControlsProps {
  selectedSpaceport: Spaceport;
  onSelectSpaceport: (port: Spaceport) => void;
  activeRocket: RocketPreset;
  onSelectRocket: (rocket: RocketPreset) => void;
  rocketTelemetry: RocketTelemetry;
  onLaunch: () => void;
  onAbort: () => void;
  autoGuidance: boolean;
  onToggleAutoGuidance: () => void;
  throttle: number;
  onChangeThrottle: (val: number) => void;
  manualPitch: number;
  onChangeManualPitch: (val: number) => void;
}

export const LaunchViewControls: React.FC<LaunchViewControlsProps> = ({
  selectedSpaceport,
  onSelectSpaceport,
  activeRocket,
  onSelectRocket,
  rocketTelemetry,
  onLaunch,
  onAbort,
  autoGuidance,
  onToggleAutoGuidance,
  throttle,
  onChangeThrottle,
  manualPitch,
  onChangeManualPitch,
}) => {
  const isPad = rocketTelemetry.phase === 'pad';

  return (
    <div className="absolute top-16 left-4 z-20 w-80 bg-gray-950/85 backdrop-blur-md border border-gray-800/80 rounded-2xl p-4 text-gray-200 shadow-2xl space-y-4 max-h-[calc(100vh-130px)] overflow-y-auto">
      <div className="flex items-center justify-between pb-2 border-b border-gray-800">
        <div className="flex items-center space-x-2">
          <Rocket className="w-4 h-4 text-cyan-400" />
          <span className="font-semibold text-xs uppercase tracking-wider text-gray-300">
            Launch Operations Console
          </span>
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-[11px] font-mono uppercase text-gray-400 flex items-center space-x-1.5">
          <MapPin className="w-3.5 h-3.5 text-emerald-400" />
          <span>Launch Complex Spaceport</span>
        </label>
        <select
          value={selectedSpaceport.id}
          onChange={(e) => {
            const port = SPACEPORTS.find((p) => p.id === e.target.value);
            if (port) onSelectSpaceport(port);
          }}
          disabled={!isPad}
          className="w-full bg-gray-900/90 border border-gray-800 rounded-xl px-3 py-2 text-xs text-gray-200 focus:outline-none focus:border-cyan-500 cursor-pointer disabled:opacity-50"
        >
          {SPACEPORTS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.flag} {p.shortName} ({p.latitude > 0 ? `${p.latitude.toFixed(1)}°N` : `${Math.abs(p.latitude).toFixed(1)}°S`})
            </option>
          ))}
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
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-gray-300">Gravity Turn Flight Director</span>
          <button
            onClick={onToggleAutoGuidance}
            className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-colors ${
              autoGuidance ? 'bg-cyan-600 text-white' : 'bg-gray-800 text-gray-400'
            }`}
          >
            {autoGuidance ? 'AUTO PROGRAM' : 'MANUAL PITCH'}
          </button>
        </div>

        {!autoGuidance && (
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
            <span>Main Engine Throttle:</span>
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
