import type { Vector3D } from './celestial';

export type MissionTrajectoryType = 'direct_loi' | 'free_return' | 'lunar_flyby';

export interface TrajectoryPoint {
  t: number; // seconds
  position: Vector3D; // m (in geocentric frame)
  velocity: Vector3D; // m/s
  distanceToEarth: number; // m
  distanceToMoon: number; // m
  speed: number; // m/s
  phase: string;
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
  lunarArrivalSpeed: number; // km/s
  earthDeparturePhaseAngle: number; // deg
  spaceportRotationBenefit: number; // m/s bonus
  launchAzimuthRequired: number; // deg
  planeChangeDeltaV: number; // m/s penalty from high latitude spaceports
}

export interface OptimizationTradeoff {
  timeOfFlightHours: number;
  tliDeltaV: number;
  loiDeltaV: number;
  totalDeltaV: number;
  moonArrivalSpeed: number;
  isFeasible: boolean;
}
