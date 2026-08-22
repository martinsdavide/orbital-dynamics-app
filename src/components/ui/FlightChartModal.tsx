import React from 'react';
import { X, TrendingUp } from 'lucide-react';

interface FlightChartModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const FlightChartModal: React.FC<FlightChartModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl bg-gray-950 border border-gray-800 rounded-2xl p-6 shadow-2xl text-gray-200 space-y-4 font-mono">
        <div className="flex items-center justify-between pb-3 border-b border-gray-800">
          <div className="flex items-center space-x-2">
            <TrendingUp className="w-5 h-5 text-cyan-400" />
            <h3 className="font-bold text-base text-white">Ascent Flight Profile & Telemetry Curves</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Descriptive overview of physics curves */}
        <div className="grid grid-cols-2 gap-4 text-xs">
          <div className="p-3 rounded-xl bg-gray-900/80 border border-gray-800 space-y-2">
            <h4 className="font-bold text-cyan-400">1. Dynamic Pressure (Max Q)</h4>
            <p className="text-gray-400 text-[11px]">
              Dynamic pressure $q = rac{1}{2}ho v^2$ peaks between 11 km and 14 km altitude where rising velocity intersects exponentially falling atmospheric density $ho(h)$.
            </p>
          </div>

          <div className="p-3 rounded-xl bg-gray-900/80 border border-gray-800 space-y-2">
            <h4 className="font-bold text-amber-400">2. Gravity Turn Pitch Program</h4>
            <p className="text-gray-400 text-[11px]">
              Pitch program starts vertical, initiates a pitch-over at 1.2 km altitude, and uses gravitational torque to naturally align flight path horizontally for orbital circularization at 200 km.
            </p>
          </div>

          <div className="p-3 rounded-xl bg-gray-900/80 border border-gray-800 space-y-2">
            <h4 className="font-bold text-emerald-400">3. Staging & Tsiolkovsky Δv</h4>
            <p className="text-gray-400 text-[11px]">
              Multi-staging sheds spent tank deadweight, boosting effective mass ratio and enabling total mission Δv &gt; 9,400 m/s required to reach LEO and lunar transfer.
            </p>
          </div>

          <div className="p-3 rounded-xl bg-gray-900/80 border border-gray-800 space-y-2">
            <h4 className="font-bold text-purple-400">4. Spaceport Rotational Velocity</h4>
            <p className="text-gray-400 text-[11px]">
              Launches from equatorial spaceports like Kourou (+463 m/s) and Cape Canaveral (+409 m/s) gain free tangential momentum from Earth rotation (v = ω · R · cos φ).
            </p>
          </div>
        </div>

        <div className="pt-2 text-right">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-sans text-xs font-semibold transition-colors"
          >
            Close Overview
          </button>
        </div>
      </div>
    </div>
  );
};
