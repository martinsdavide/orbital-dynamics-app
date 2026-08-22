import React from 'react';
import type { RocketTelemetry } from '../../types/rocket';
import { EARTH } from '../../physics/constants';
import { Activity } from 'lucide-react';

interface TelemetryHUDProps {
  telemetry: RocketTelemetry;
}

export const TelemetryHUD: React.FC<TelemetryHUDProps> = ({ telemetry }) => {
  return (
    <div className="absolute top-16 right-4 z-20 w-80 bg-gray-950/85 backdrop-blur-md border border-gray-800/80 rounded-2xl p-4 text-gray-200 shadow-2xl space-y-3 font-mono">
      <div className="flex items-center justify-between pb-2 border-b border-gray-800">
        <div className="flex items-center space-x-2">
          <Activity className="w-4 h-4 text-cyan-400 animate-pulse" />
          <span className="font-bold text-xs uppercase tracking-wider text-gray-300">
            Live Flight Telemetry
          </span>
        </div>
        <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
          telemetry.isOrbitAchieved
            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
            : telemetry.phase === 'pad'
            ? 'bg-gray-800 text-gray-400'
            : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
        }`}>
          {telemetry.isOrbitAchieved ? 'ORBIT INSERTION' : telemetry.phase.toUpperCase().replace('_', ' ')}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="bg-gray-900/80 p-2.5 rounded-xl border border-gray-800">
          <span className="text-[10px] text-gray-400 uppercase">Altitude</span>
          <div className="text-base font-bold text-white">
            {telemetry.altitude < 100000
              ? `${(telemetry.altitude / 1000).toFixed(1)} km`
              : `${Math.round(telemetry.altitude / 1000)} km`}
          </div>
        </div>

        <div className="bg-gray-900/80 p-2.5 rounded-xl border border-gray-800">
          <span className="text-[10px] text-gray-400 uppercase">Inertial Speed</span>
          <div className="text-base font-bold text-cyan-300">
            {Math.round(telemetry.velocity)} m/s
            <span className="text-[10px] text-gray-400 block font-normal">
              Mach {telemetry.machNumber.toFixed(2)}
            </span>
          </div>
        </div>

        <div className="bg-gray-900/80 p-2.5 rounded-xl border border-gray-800">
          <span className="text-[10px] text-gray-400 uppercase">Dynamic Pressure (q)</span>
          <div className="text-sm font-bold text-amber-400">
            {(telemetry.dynamicPressure / 1000).toFixed(1)} kPa
            <span className="text-[10px] text-gray-500 block font-normal">
              Max: {(telemetry.maxQ / 1000).toFixed(1)} kPa
            </span>
          </div>
        </div>

        <div className="bg-gray-900/80 p-2.5 rounded-xl border border-gray-800">
          <span className="text-[10px] text-gray-400 uppercase">G-Load / TWR</span>
          <div className="text-sm font-bold text-emerald-400">
            {telemetry.accelerationG.toFixed(2)} G
            <span className="text-[10px] text-gray-400 block font-normal">
              TWR: {telemetry.twr.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      <div className="p-2.5 rounded-xl bg-gray-900/60 border border-gray-800/80 space-y-1 text-[11px]">
        <div className="flex justify-between">
          <span className="text-gray-400">Apoapsis (Ap):</span>
          <span className="text-blue-300 font-bold">
            {telemetry.apoapsis > 0 ? `${Math.round(telemetry.apoapsis / 1000)} km` : '--'}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Periapsis (Pe):</span>
          <span className="text-blue-300 font-bold">
            {telemetry.periapsis > -EARTH.radius ? `${Math.round(telemetry.periapsis / 1000)} km` : 'Suborbital'}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Pitch Angle:</span>
          <span className="text-gray-200">{Math.round(telemetry.pitchAngle)}°</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Δv Expended / Budget:</span>
          <span className="text-emerald-400">
            {Math.round(telemetry.deltaVExpended)} m/s / {Math.round(telemetry.deltaVRemaining)} m/s
          </span>
        </div>
      </div>

      <div className="space-y-1 text-xs">
        <div className="flex justify-between text-[10px] uppercase text-gray-400">
          <span>Stage {telemetry.activeStageIndex + 1} Propellant</span>
          <span className="text-cyan-400 font-bold">{Math.round(telemetry.stageFuelFraction * 100)}%</span>
        </div>
        <div className="w-full h-2 bg-gray-900 rounded-full overflow-hidden border border-gray-800">
          <div
            className="h-full bg-gradient-to-r from-red-500 via-amber-400 to-cyan-400 transition-all duration-150"
            style={{ width: `${Math.max(0, Math.min(100, telemetry.stageFuelFraction * 100))}%` }}
          />
        </div>
      </div>

      <div className="p-2 rounded-xl bg-gray-900/90 border border-gray-800 text-[10px] text-gray-300 flex items-center space-x-2">
        <div className="w-2 h-2 rounded-full bg-cyan-400 animate-ping shrink-0" />
        <span className="truncate">{telemetry.statusMessage}</span>
      </div>
    </div>
  );
};
