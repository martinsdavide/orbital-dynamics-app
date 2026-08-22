export interface RocketStage {
  stageNumber: number;
  name: string;
  dryMass: number; // kg
  fuelMass: number; // kg
  thrustSeaLevel: number; // N
  thrustVacuum: number; // N
  ispSeaLevel: number; // s
  ispVacuum: number; // s
  burnTime: number; // s
  diameter: number; // m
  height: number; // m
  engineCount: number;
  engineName: string;
  propellant: string;
}

export interface RocketPreset {
  id: string;
  name: string;
  agency: string;
  description: string;
  height: number; // m
  diameter: number; // m
  totalLiftoffMass: number; // kg
  totalLiftoffThrust: number; // N
  payloadToLEO: number; // kg
  payloadToTLI: number; // kg
  stages: RocketStage[];
  fairingMass: number; // kg
}

export interface RocketTelemetry {
  time: number; // seconds from launch
  altitude: number; // m
  downrangeDistance: number; // m
  velocity: number; // m/s (inertial)
  velocityEarthRelative: number; // m/s
  verticalSpeed: number; // m/s
  horizontalSpeed: number; // m/s
  machNumber: number;
  dynamicPressure: number; // Pa (q = 0.5 * rho * v^2)
  maxQ: number; // Pa (peak dynamic pressure recorded)
  accelerationG: number; // Gs
  totalMass: number; // kg
  remainingFuel: number; // kg
  stageFuelFraction: number; // 0.0 - 1.0
  activeStageIndex: number;
  thrust: number; // N
  twr: number; // Thrust to Weight Ratio
  pitchAngle: number; // deg (90 = vertical, 0 = horizontal)
  flightPathAngle: number; // deg
  apoapsis: number; // m
  periapsis: number; // m
  orbitalEnergy: number; // J/kg
  deltaVExpended: number; // m/s
  deltaVRemaining: number; // m/s
  isOrbitAchieved: boolean;
  statusMessage: string;
  phase: 'pad' | 'boost_stage1' | 'staging_1_2' | 'boost_stage2' | 'staging_2_3' | 'boost_stage3' | 'parking_orbit' | 'tli_burn' | 'lunar_transit' | 'loi_burn' | 'lunar_orbit' | 'abort';
}
