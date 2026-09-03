import type { Vector3D } from './celestial';

export type MissionTrajectoryType = 'direct_loi' | 'free_return' | 'lunar_flyby';

export interface TrajectoryPoint {
  t: number; // seconds
  position: Vector3D; // m (in geocentric frame)
  velocity: Vector3D; // m/s
  distanceToEarth: number; // m
  distanceToMoon: number; // m
  speed: number; // m/s
  altitudeEarthKm: number; // km
  phase: string;
}

export interface LaunchWindow {
  id: string;
  windowIndex: number;
  openTimeHours: number; // hours from sim start
  closeTimeHours: number;
  durationMinutes: number;
  type: 'ascending_node' | 'descending_node' | 'direct_equatorial';
  label: string;
  launchAzimuth: number; // deg East of North
  planeAlignmentEfficiency: number; // %
  planeChangePenaltyDV: number; // m/s
  tliDeltaV: number; // m/s
  isOptimal: boolean;
  synodicStatus: string;
}

export interface MissionMilestone {
  id: number; // 1 to 8
  label: string;
  description: string;
  tFraction: number; // 0.0 to 1.0
  timeHours: number;
  color: string;
  category: 'outbound' | 'inbound' | 'orbit' | 'escape';
  pointIndex?: number;
}

export interface EarthMoonTrajectory {
  id: string;
  name: string;
  type: MissionTrajectoryType;
  description: string;
  departureOrbitAltitude: number; // m (e.g. 200,000m LEO)
  tliDeltaV: number; // m/s
  loiDeltaV: number; // m/s (0 for free return)
  totalMissionDeltaV: number; // m/s
  timeOfFlightHours: number; // hours (e.g. 72h)
  periapsisMoonAltitude: number; // km above lunar surface
  returnEarthPerigeeAltitude: number; // km (for free return)
  points: TrajectoryPoint[];
  milestones: MissionMilestone[];
  outboundSplitFraction: number; // e.g. 0.52 for free return, 0.94 for direct LOI
  lunarArrivalSpeed: number; // km/s
  earthDeparturePhaseAngle: number; // deg
  spaceportRotationBenefit: number; // m/s bonus
  launchAzimuthRequired: number; // deg
  planeChangeDeltaV: number; // m/s penalty from high latitude spaceports
  launchWindows: LaunchWindow[];
  selectedWindowIndex: number;
}

export interface OptimizationTradeoff {
  timeOfFlightHours: number;
  tliDeltaV: number;
  loiDeltaV: number;
  totalDeltaV: number;
  moonArrivalSpeed: number;
  isFeasible: boolean;
}
