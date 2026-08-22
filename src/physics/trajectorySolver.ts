import { EARTH, MOON } from './constants';
import type { Spaceport } from '../types/spaceport';
import type { EarthMoonTrajectory, MissionTrajectoryType, TrajectoryPoint, OptimizationTradeoff } from '../types/trajectory';
import type { Vector3D } from '../types/celestial';

export function solveEarthMoonTrajectory(
  type: MissionTrajectoryType,
  spaceport: Spaceport,
  departureAltitudeMeters: number = 200000,
  flightTimeHoursTarget: number = 72
): EarthMoonTrajectory {
  const r1 = EARTH.radius + departureAltitudeMeters;
  const r2 = MOON.semiMajorAxis;

  const vLEO = Math.sqrt(EARTH.mu / r1);

  const aTrans = (r1 + r2) / 2;
  const vTransPerigee = Math.sqrt(EARTH.mu * (2 / r1 - 1 / aTrans));

  const nominalTOFSeconds = Math.PI * Math.sqrt(Math.pow(aTrans, 3) / EARTH.mu);
  const requestedTOFSeconds = flightTimeHoursTarget * 3600;
  const speedBoostFactor = Math.max(1.0, Math.min(1.25, Math.pow(nominalTOFSeconds / requestedTOFSeconds, 0.4)));

  const vTLIInertial = vTransPerigee * speedBoostFactor;
  const tliDeltaV = vTLIInertial - vLEO;

  const spaceportBoost = spaceport.equatorialBoostVelocity;
  const moonInclinationDeg = 28.5;
  let planeChangeDeltaV = 0;

  if (spaceport.latitude > moonInclinationDeg) {
    const deltaIncRad = ((spaceport.latitude - moonInclinationDeg) * Math.PI) / 180;
    planeChangeDeltaV = Math.round(2 * vLEO * Math.sin(deltaIncRad / 2));
  }

  const latRad = (spaceport.latitude * Math.PI) / 180;
  const incRad = (Math.max(spaceport.latitude, moonInclinationDeg) * Math.PI) / 180;
  const sinAz = Math.max(-1, Math.min(1, Math.cos(incRad) / Math.cos(latRad)));
  const launchAzimuthRequired = Math.round((Math.asin(sinAz) * 180) / Math.PI);

  const vMoonOrbital = Math.sqrt(EARTH.mu / r2);
  const vTransApogee = Math.sqrt(EARTH.mu * (2 / r2 - 1 / aTrans)) * speedBoostFactor;
  const vInfArrival = Math.abs(vMoonOrbital - vTransApogee);

  let loiDeltaV = 0;
  let periapsisMoonAltitude = 100;
  let returnEarthPerigeeAltitude = 0;

  if (type === 'direct_loi') {
    const rMoonOrbit = MOON.radius + 100000;
    const vLLOCircular = Math.sqrt(MOON.mu / rMoonOrbit);
    const vMoonPeriapsisHyperbolic = Math.sqrt(vInfArrival * vInfArrival + (2 * MOON.mu) / rMoonOrbit);
    loiDeltaV = Math.round(vMoonPeriapsisHyperbolic - vLLOCircular);
  } else if (type === 'free_return') {
    loiDeltaV = 0;
    periapsisMoonAltitude = 110;
    returnEarthPerigeeAltitude = 45;
  } else {
    loiDeltaV = 0;
    periapsisMoonAltitude = 500;
  }

  const totalMissionDeltaV = Math.round(tliDeltaV + loiDeltaV + planeChangeDeltaV - spaceportBoost);

  const points = generateTrajectoryPoints(type, departureAltitudeMeters, flightTimeHoursTarget);

  return {
    id: 'traj_' + type + '_' + spaceport.id,
    name: type === 'direct_loi' ? 'Direct Lunar Orbit Capture' : type === 'free_return' ? 'Apollo-style Free-Return Trajectory' : 'Lunar Flyby / Gravity Assist',
    type,
    description: getTrajectoryDescription(type),
    departureOrbitAltitude: departureAltitudeMeters,
    tliDeltaV: Math.round(tliDeltaV),
    loiDeltaV,
    totalMissionDeltaV,
    timeOfFlightHours: flightTimeHoursTarget,
    periapsisMoonAltitude,
    returnEarthPerigeeAltitude,
    points,
    lunarArrivalSpeed: Number((vInfArrival / 1000).toFixed(2)),
    earthDeparturePhaseAngle: 125,
    spaceportRotationBenefit: Math.round(spaceportBoost),
    launchAzimuthRequired,
    planeChangeDeltaV,
  };
}

function generateTrajectoryPoints(
  type: MissionTrajectoryType,
  leoAlt: number,
  flightTimeHours: number
): TrajectoryPoint[] {
  const points: TrajectoryPoint[] = [];
  const totalSteps = 240;
  const totalSeconds = flightTimeHours * 3600;
  const rLEO = EARTH.radius + leoAlt;
  const rMoon = MOON.semiMajorAxis;

  const omegaMoon = (2 * Math.PI) / MOON.orbitalPeriod;
  const tliLeadAngle = (125 * Math.PI) / 180;

  for (let i = 0; i <= totalSteps; i++) {
    const fraction = i / totalSteps;
    const t = fraction * totalSeconds;

    let rCur = 0;
    let angleRad = 0;
    let phase = 'Cislunar Coast';

    if (type === 'free_return') {
      if (fraction <= 0.48) {
        const p = fraction / 0.48;
        rCur = rLEO + (rMoon - rLEO) * Math.sin((p * Math.PI) / 2);
        angleRad = tliLeadAngle * (1 - p * 0.9);
        phase = 'Trans-Lunar Coast (Outbound)';
      } else if (fraction <= 0.52) {
        const p = (fraction - 0.48) / 0.04;
        const moonCurrentAngle = omegaMoon * (0.5 * totalSeconds);
        const moonCenter: Vector3D = {
          x: rMoon * Math.cos(moonCurrentAngle),
          y: rMoon * Math.sin(moonCurrentAngle),
          z: 0,
        };
        const swingRadius = MOON.radius + 110000;
        const swingAngle = Math.PI * (1 - 2 * p);

        const x = moonCenter.x + swingRadius * Math.cos(moonCurrentAngle + swingAngle);
        const y = moonCenter.y + swingRadius * Math.sin(moonCurrentAngle + swingAngle);
        const z = swingRadius * 0.2 * Math.sin(p * Math.PI);

        points.push({
          t,
          position: { x, y, z },
          velocity: { x: 0, y: 0, z: 0 },
          distanceToEarth: Math.sqrt(x * x + y * y + z * z),
          distanceToMoon: swingRadius,
          speed: 2.1,
          phase: 'Lunar Flyby / Gravitational Slingshot',
        });
        continue;
      } else {
        const p = (fraction - 0.52) / 0.48;
        rCur = rMoon - (rMoon - rLEO) * Math.sin((p * Math.PI) / 2);
        angleRad = omegaMoon * (0.52 * totalSeconds) + Math.PI * p * 0.85;
        phase = 'Earth Return Coast';
      }
    } else {
      rCur = rLEO + (rMoon - rLEO) * Math.sin((fraction * Math.PI) / 2);
      angleRad = tliLeadAngle * (1 - fraction * 0.95);
      if (fraction > 0.95) phase = 'Lunar Orbit Insertion';
    }

    const x = rCur * Math.cos(angleRad);
    const y = rCur * Math.sin(angleRad);
    const z = (rCur / rMoon) * (MOON.semiMajorAxis * 0.08) * Math.sin(fraction * Math.PI);

    const distEarth = Math.sqrt(x * x + y * y + z * z);
    const moonAngleAtT = omegaMoon * t;
    const moonPosAtT = { x: rMoon * Math.cos(moonAngleAtT), y: rMoon * Math.sin(moonAngleAtT), z: 0 };
    const distMoon = Math.sqrt(
      Math.pow(x - moonPosAtT.x, 2) + Math.pow(y - moonPosAtT.y, 2) + Math.pow(z - moonPosAtT.z, 2)
    );

    const speed = Math.sqrt(Math.max(200, EARTH.mu * (2 / distEarth - 1 / ((rLEO + rMoon) / 2))));

    points.push({
      t,
      position: { x, y, z },
      velocity: { x: 0, y: 0, z: 0 },
      distanceToEarth: distEarth,
      distanceToMoon: distMoon,
      speed,
      phase,
    });
  }

  return points;
}

export function generateTradeoffAnalysis(): OptimizationTradeoff[] {
  const results: OptimizationTradeoff[] = [];
  const times = [48, 60, 72, 84, 96, 110, 120];

  for (const tof of times) {
    const speedFactor = Math.pow(104 / tof, 0.45);
    const tliDV = Math.round(3140 * Math.max(1.0, speedFactor));
    const loiDV = Math.round(820 * (1 + (speedFactor - 1) * 0.6));
    results.push({
      timeOfFlightHours: tof,
      tliDeltaV: tliDV,
      loiDeltaV: loiDV,
      totalDeltaV: tliDV + loiDV,
      moonArrivalSpeed: Number((1.2 * speedFactor).toFixed(2)),
      isFeasible: tof >= 50 && tof <= 120,
    });
  }

  return results;
}

function getTrajectoryDescription(type: MissionTrajectoryType): string {
  if (type === 'free_return') {
    return 'Apollo-proven abort-safe circumlunar trajectory that loops around the Moon and naturally returns the spacecraft into Earth atmosphere without any propulsion burn.';
  } else if (type === 'direct_loi') {
    return 'High-efficiency transfer orbit terminating in a retrograde Lunar Orbit Insertion (LOI) burn of ~820 m/s into a 100 km circular Low Lunar Orbit.';
  }
  return 'Hyperbolic lunar flyby trajectory utilizing lunar gravity assist for deep-space slingshot.';
}
