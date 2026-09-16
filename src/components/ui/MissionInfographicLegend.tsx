import React, { useState } from 'react';
import type { EarthMoonTrajectory, MissionMilestone } from '../../types/trajectory';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface MissionInfographicLegendProps {
  activeTrajectory: EarthMoonTrajectory;
  trajectoryProgress: number;
  onSelectMilestone: (m: MissionMilestone) => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const MissionInfographicLegend: React.FC<MissionInfographicLegendProps> = ({
  activeTrajectory,
  trajectoryProgress,
  onSelectMilestone,
  isCollapsed,
  onToggleCollapse,
}) => {
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const collapsed = isCollapsed !== undefined ? isCollapsed : internalCollapsed;
  const toggleCollapse = onToggleCollapse || (() => setInternalCollapsed(!internalCollapsed));

  const milestones = activeTrajectory.milestones || [];
  const outboundMilestones = milestones.filter(
    (m) => m.category === 'outbound' || m.id <= 4
  );
  const inboundMilestones = milestones.filter(
    (m) => m.category !== 'outbound' && m.id > 4
  );

  const currentIdx = Math.min(
    milestones.length - 1,
    Math.max(
      0,
      milestones.findIndex((m, i) => {
        const next = milestones[i + 1];
        if (!next) return true;
        return trajectoryProgress >= m.tFraction && trajectoryProgress < next.tFraction;
      })
    )
  );

  const activeMilestone = milestones[currentIdx] || milestones[0];

  if (collapsed) {
    return (
      <div className="absolute top-16 right-4 z-20">
        <button
          onClick={toggleCollapse}
          className="flex items-center space-x-2 px-3.5 py-2.5 bg-gray-950/90 backdrop-blur-md border border-gray-800/90 rounded-2xl text-gray-200 shadow-2xl hover:border-purple-500/50 hover:bg-gray-900/90 transition-all group font-sans"
          title="Expand Mission Flight Profile"
        >
          <span className="w-2.5 h-2.5 rounded-full bg-purple-400 animate-pulse" />
          <span className="font-bold text-xs uppercase tracking-wider text-gray-300">
            Mission Timeline
          </span>
          <span className="text-[11px] text-purple-300 font-mono px-1.5 py-0.5 bg-purple-950/50 rounded border border-purple-800/50">
            {Math.round(trajectoryProgress * 100)}%
          </span>
          <ChevronDown className="w-4 h-4 text-gray-400 group-hover:text-purple-400 transition-colors ml-1" />
        </button>
      </div>
    );
  }

  return (
    <div className="absolute top-16 right-4 z-20 w-[420px] bg-gray-950/90 backdrop-blur-lg border border-gray-800/90 rounded-2xl p-4 text-gray-200 shadow-2xl space-y-3 font-sans max-h-[calc(100vh-120px)] overflow-y-auto">
      {/* Infographic Header Title */}
      <div className="flex items-center justify-between pb-2 border-b border-gray-800">
        <div>
          <h2 className="text-sm font-bold text-white tracking-wide flex items-center space-x-2">
            <span>{activeTrajectory.name}</span>
          </h2>
          <p className="text-[10px] text-gray-400 font-mono mt-0.5">
            Mission Timeline & Sequential Cislunar Flight Profile
          </p>
        </div>
        <button
          onClick={toggleCollapse}
          className="p-1 text-gray-400 hover:text-gray-200 hover:bg-gray-800/80 rounded-lg transition-colors ml-2"
          title="Collapse panel"
        >
          <ChevronUp className="w-4 h-4" />
        </button>
      </div>

      {/* Two-Tone Legend Key */}
      <div className="flex items-center space-x-6 text-[11px] font-mono px-1">
        <div className="flex items-center space-x-2">
          <span className="w-4 h-1 bg-purple-500 rounded-full inline-block"></span>
          <span className="text-purple-300 font-bold">Outbound Leg</span>
        </div>
        <div className="flex items-center space-x-2">
          <span
            className="w-4 h-1 rounded-full inline-block"
            style={{
              backgroundColor:
                activeTrajectory.type === 'free_return'
                  ? '#f59e0b'
                  : activeTrajectory.type === 'direct_loi'
                    ? '#06b6d4'
                    : '#10b981',
            }}
          ></span>
          <span
            className="font-bold"
            style={{
              color:
                activeTrajectory.type === 'free_return'
                  ? '#fbbf24'
                  : activeTrajectory.type === 'direct_loi'
                    ? '#22d3ee'
                    : '#34d399',
            }}
          >
            {activeTrajectory.type === 'free_return'
              ? 'Inbound Leg'
              : activeTrajectory.type === 'direct_loi'
                ? 'Lunar Orbit Leg'
                : 'Interplanetary Escape'}
          </span>
        </div>
      </div>

      {/* 2-Column Milestones Grid (1-4 on left, 5-8 on right) */}
      <div className="grid grid-cols-2 gap-2 text-xs font-mono">
        {/* Outbound Column */}
        <div className="space-y-1.5">
          {outboundMilestones.map((m) => {
            const isCurrent = activeMilestone?.id === m.id;
            return (
              <button
                key={m.id}
                onClick={() => onSelectMilestone(m)}
                className={`w-full text-left p-2 rounded-xl border transition-all flex items-start space-x-2 cursor-pointer ${
                  isCurrent
                    ? 'bg-purple-900/40 border-purple-500 text-white shadow-md shadow-purple-950/60 ring-1 ring-purple-400'
                    : 'bg-gray-900/60 border-gray-800 text-gray-300 hover:border-gray-700 hover:bg-gray-900'
                }`}
              >
                <span
                  className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 text-white shadow-sm mt-0.5"
                  style={{ backgroundColor: m.color }}
                >
                  {m.id}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-[11px] truncate leading-tight">{m.label}</div>
                  <div className="text-[9px] text-gray-400 leading-tight mt-0.5 line-clamp-2">
                    {m.description}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Inbound / Orbit Column */}
        <div className="space-y-1.5">
          {inboundMilestones.map((m) => {
            const isCurrent = activeMilestone?.id === m.id;
            return (
              <button
                key={m.id}
                onClick={() => onSelectMilestone(m)}
                className={`w-full text-left p-2 rounded-xl border transition-all flex items-start space-x-2 cursor-pointer ${
                  isCurrent
                    ? 'bg-amber-950/40 border-amber-500 text-white shadow-md shadow-amber-950/60 ring-1 ring-amber-400'
                    : 'bg-gray-900/60 border-gray-800 text-gray-300 hover:border-gray-700 hover:bg-gray-900'
                }`}
              >
                <span
                  className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 text-white shadow-sm mt-0.5"
                  style={{ backgroundColor: m.color }}
                >
                  {m.id}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-[11px] truncate leading-tight">{m.label}</div>
                  <div className="text-[9px] text-gray-400 leading-tight mt-0.5 line-clamp-2">
                    {m.description}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Active Milestone Status Footer */}
      {activeMilestone && (
        <div className="pt-2 border-t border-gray-800/80 flex items-center justify-between text-[10px] font-mono text-gray-400">
          <div className="flex items-center space-x-1.5">
            <span
              className="w-2 h-2 rounded-full animate-ping"
              style={{ backgroundColor: activeMilestone.color }}
            ></span>
            <span>Current Event: <strong className="text-white">#{activeMilestone.id} {activeMilestone.label}</strong></span>
          </div>
          <span className="text-cyan-300 font-bold">T+{activeMilestone.timeHours}h</span>
        </div>
      )}
    </div>
  );
};
