import React from 'react';
import { X, BookOpen, Orbit, Rocket, Compass } from 'lucide-react';

interface InfoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const InfoModal: React.FC<InfoModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
      <div className="relative w-full max-w-3xl max-h-[85vh] bg-gray-950 border border-gray-800 rounded-2xl p-6 shadow-2xl text-gray-200 overflow-y-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-gray-800 sticky top-0 bg-gray-950 z-10">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-blue-500/20 text-blue-400 border border-blue-500/30">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Astrodynamics & Physics Technical Manual</h2>
              <p className="text-xs text-gray-400 font-mono">Sun-Earth-Moon Mechanics, Rocketry & Trajectory Mathematics</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Section 1: Celestial Mechanics */}
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-blue-400 uppercase tracking-wider flex items-center space-x-2">
            <Orbit className="w-4 h-4" />
            <span>1. Sun-Earth-Moon Gravitational Dynamics</span>
          </h3>
          <p className="text-xs text-gray-300 leading-relaxed">
            The Earth orbits the Sun along an elliptical orbit (e = 0.0167, a = 1.496 × 10¹¹ m) with an axial obliquity of 23.44°. The Moon orbits Earth with an orbital period of 27.32 days (sidereal) at a mean distance of 384,400 km, inclined by 5.145° to the ecliptic plane with a nodal regression cycle of 18.6 years.
          </p>
          <div className="p-3 rounded-xl bg-gray-900/80 border border-gray-800 text-xs font-mono text-gray-300">
            <div className="font-bold text-cyan-300 mb-1">Lagrange Equilibrium Points (Earth-Moon):</div>
            <ul className="space-y-1 text-[11px]">
              <li>• <span className="text-amber-400">L1</span> (~326,000 km from Earth): Gravitational balance between Earth and Moon. Gateway for cislunar exploration.</li>
              <li>• <span className="text-amber-400">L2</span> (~445,000 km from Earth): Behind lunar farside, ideal for farside deep-space communications.</li>
              <li>• <span className="text-emerald-400">L4 &amp; L5</span> (60° ahead / behind Moon): Dynamically stable Trojan points forming equilateral triangles.</li>
            </ul>
          </div>
        </div>

        {/* Section 2: Rocket Launch Ascent */}
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-cyan-400 uppercase tracking-wider flex items-center space-x-2">
            <Rocket className="w-4 h-4" />
            <span>2. Multi-Stage Atmospheric Ascent Dynamics</span>
          </h3>
          <p className="text-xs text-gray-300 leading-relaxed">
            The simulation models the multi-stage ascent using Tsiolkovsky&apos;s Rocket Equation Δv = Isp · g₀ · ln(m₀ / mf), dynamic pressure q = ½ρv² with US Standard Atmosphere 1976 barometric density falloff, Mach-dependent wave drag Cd(M), and zero-AoA gravity turn pitch guidance.
          </p>
        </div>

        {/* Section 3: Earth-Moon Trajectory Optimization */}
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-purple-400 uppercase tracking-wider flex items-center space-x-2">
            <Compass className="w-4 h-4" />
            <span>3. Earth-to-Moon Trajectory Optimization &amp; Spaceports</span>
          </h3>
          <p className="text-xs text-gray-300 leading-relaxed">
            Trans-Lunar Injection (TLI) accelerates the spacecraft from Low Earth Orbit (v ≈ 7,784 m/s) to the transfer ellipse (v ≈ 10,920 m/s, requiring Δv_TLI ≈ 3,140 m/s). Spaceports at lower latitudes (like Guiana Space Centre at 5.2° N) provide a substantial rotational velocity bonus (+463 m/s) and minimize costly orbital plane changes.
          </p>
        </div>

        <div className="pt-2 text-right">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-600/30 transition-all"
          >
            Got It
          </button>
        </div>
      </div>
    </div>
  );
};
