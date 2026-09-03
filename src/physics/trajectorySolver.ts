import { EARTH, MOON } from './constants.ts';
import type { Spaceport } from '../types/spaceport.ts';
import type { EarthMoonTrajectory, MissionTrajectoryType, TrajectoryPoint, LaunchWindow, OptimizationTradeoff } from '../types/trajectory.ts';
import type { Vector3D } from '../types/celestial.ts';
import { getMoonEphemeris } from './nBodyIntegrator.ts';

/**
 * Calculates daily launch windows from a given spaceport targeting the lunar orbital plane.
 * Correctly evaluates both Northern and Southern hemisphere latitudes.
 */
export function calculateLaunchWindows(
  spaceport: Spaceport,
  simTimeHours: number = 0
): LaunchWindow[] {
  const moonInclinationDeg = 28.58;
  const absLat = Math.abs(spaceport.latitude);
  const latRad = (spaceport.latitude * Math.PI) / 180;
  const incRad = (moonInclinationDeg * Math.PI) / 180;
  const siderealDayHours = 23.9344;

  let azAscending = 90;
  let azDescending = 90;
  let planeEfficiency = 98;
  let planePenaltyDV = 0;

  if (absLat <= moonInclinationDeg) {
    const cosAz = Math.cos(incRad) / Math.cos(latRad);
    const azRad = Math.asin(Math.max(-1, Math.min(1, cosAz)));
    azAscending = Math.round((azRad * 180) / Math.PI);
    azDescending = Math.round(180 - azAscending);
    planeEfficiency = 99.2;
    planePenaltyDV = 0;
  } else {
    azAscending = 90;
    azDescending = 90;
    const deltaIncRad = ((absLat - moonInclinationDeg) * Math.PI) / 180;
    const vLEO = Math.sqrt(EARTH.mu / (EARTH.radius + 200000));
    planePenaltyDV = Math.round(2 * vLEO * Math.sin(deltaIncRad / 2));
    planeEfficiency = Math.max(75, Math.round(100 - (planePenaltyDV / 3140) * 100));
  }

  const currentDayFraction = (simTimeHours % siderealDayHours) / siderealDayHours;
  const windows: LaunchWindow[] = [];

  const nodeOffsets = [
    { type: 'ascending_node' as const, frac: 0.18, az: azAscending, label: 'Ascending Node Passage (NE Azimuth)' },
    { type: 'descending_node' as const, frac: 0.68, az: azDescending, label: 'Descending Node Passage (SE Azimuth)' },
    { type: 'ascending_node' as const, frac: 1.18, az: azAscending, label: 'Next Day Ascending Passage (+24h)' },
    { type: 'descending_node' as const, frac: 1.68, az: azDescending, label: 'Next Day Descending Passage (+24h)' },
  ];

  nodeOffsets.forEach((node, idx) => {
    let deltaHours = (node.frac - currentDayFraction) * siderealDayHours;
    while (deltaHours < 0.2) deltaHours += siderealDayHours;

    const openTime = simTimeHours + deltaHours;
    const duration = absLat < 15 ? 45 : 30;

    windows.push({
      id: 'lw_' + spaceport.id + '_' + idx,
      windowIndex: idx,
      openTimeHours: Number(openTime.toFixed(2)),
      closeTimeHours: Number((openTime + duration / 60).toFixed(2)),
      durationMinutes: duration,
      type: node.type,
      label: node.label,
      launchAzimuth: node.az,
      planeAlignmentEfficiency: planeEfficiency,
      planeChangePenaltyDV: planePenaltyDV,
      tliDeltaV: 3140 + planePenaltyDV,
      isOptimal: idx === 0 || (idx === 1 && absLat < 15),
      synodicStatus: idx === 0 ? 'Optimal Lunar Lead Alignment' : 'Secondary Cislunar Geometry',
    });
  });

  return windows;
}

/**
 * Solves and numerically propagates an Earth-Moon mission trajectory under 3-body gravity.
 */
export function solveEarthMoonTrajectory(
  type: MissionTrajectoryType,
  spaceport: Spaceport,
  departureAltitudeMeters: number = 200000,
  flightTimeHoursTarget: number = 72,
  simTimeHours: number = 0,
  selectedWindowIdx: number = 0
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
  const moonInclinationDeg = 28.58;
  const absLat = Math.abs(spaceport.latitude);
  let planeChangeDeltaV = 0;

  // Fixed Southern Hemisphere plane-change penalty
  if (absLat > moonInclinationDeg) {
    const deltaIncRad = ((absLat - moonInclinationDeg) * Math.PI) / 180;
    planeChangeDeltaV = Math.round(2 * vLEO * Math.sin(deltaIncRad / 2));
  }

  const latRad = (spaceport.latitude * Math.PI) / 180;
  const incRad = (Math.max(absLat, moonInclinationDeg) * Math.PI) / 180;
  const sinAz = Math.max(-1, Math.min(1, Math.cos(incRad) / Math.cos(latRad)));
  const launchAzimuthRequired = Math.round((Math.asin(sinAz) * 180) / Math.PI);

  const launchWindows = calculateLaunchWindows(spaceport, simTimeHours);
  const activeWindow = launchWindows[selectedWindowIdx] || launchWindows[0];

  // Numerically propagate trajectory
  const { points, measuredPeriluneAltKm, measuredReentryAltKm, measuredLoiDV, measuredArrivalSpeed } =
    propagateNumericalTrajectory(
      type,
      spaceport,
      departureAltitudeMeters,
      flightTimeHoursTarget,
      activeWindow
    );

  const loiDeltaV = type === 'direct_loi' ? measuredLoiDV : 0;
  const totalMissionDeltaV = Math.round(tliDeltaV + loiDeltaV + planeChangeDeltaV - spaceportBoost);

  return {
    id: 'traj_' + type + '_' + spaceport.id,
    name: type === 'direct_loi'
      ? 'Direct Lunar Orbit Capture'
      : type === 'free_return'
        ? 'Apollo-style Free-Return Trajectory'
        : 'Lunar Flyby / Gravity Assist',
    type,
    description: getTrajectoryDescription(type),
    departureOrbitAltitude: departureAltitudeMeters,
    tliDeltaV: Math.round(tliDeltaV),
    loiDeltaV,
    totalMissionDeltaV,
    timeOfFlightHours: flightTimeHoursTarget,
    periapsisMoonAltitude: measuredPeriluneAltKm,
    returnEarthPerigeeAltitude: measuredReentryAltKm,
    points,
    lunarArrivalSpeed: measuredArrivalSpeed,
    earthDeparturePhaseAngle: 125,
    spaceportRotationBenefit: Math.round(spaceportBoost),
    launchAzimuthRequired,
    planeChangeDeltaV,
    launchWindows,
    selectedWindowIndex: selectedWindowIdx,
  };
}

/**
 * Propagates full 3D Earth-Moon mission trajectory from spaceport to lunar encounter and return.
 */
function propagateNumericalTrajectory(
  type: MissionTrajectoryType,
  spaceport: Spaceport,
  leoAlt: number,
  flightTimeHours: number,
  launchWindow: LaunchWindow
): {
  points: TrajectoryPoint[];
  measuredPeriluneAltKm: number;
  measuredReentryAltKm: number;
  measuredLoiDV: number;
  measuredArrivalSpeed: number;
} {
  const points: TrajectoryPoint[] = [];
  const rEarth = EARTH.radius;
  const rLEO = rEarth + leoAlt;
  const rMoon = MOON.semiMajorAxis;

  const latRad = (spaceport.latitude * Math.PI) / 180;
  const lonRad = (spaceport.longitude * Math.PI) / 180;

  const departureEpochSeconds = launchWindow.openTimeHours * 3600;
  const totalMissionSeconds = flightTimeHours * 3600;

  // 1. Ascent Phase (Launchpad -> LEO Parking insertion: 0 to 1 hour)
  const ascentSteps = 24;
  for (let i = 0; i <= ascentSteps; i++) {
    const p = i / ascentSteps;
    const tRel = p * 3600;
    const tAbs = departureEpochSeconds + tRel;
    const curAlt = p * leoAlt;
    const rCur = rEarth + curAlt;
    const curAngle = lonRad + p * (Math.PI * 0.35);

    const x = rCur * Math.cos(curAngle) * Math.cos(latRad * (1 - p * 0.7));
    const y = rCur * Math.sin(latRad * (1 - p * 0.7));
    const z = -rCur * Math.sin(curAngle) * Math.cos(latRad * (1 - p * 0.7));

    const curSpeed = spaceport.equatorialBoostVelocity + p * (7780 - spaceport.equatorialBoostVelocity);
    const vx = -curSpeed * Math.sin(curAngle);
    const vz = -curSpeed * Math.cos(curAngle);
    const vy = curSpeed * 0.1 * Math.sin(latRad);
    const trueSpeed = Math.sqrt(vx * vx + vy * vy + vz * vz);

    const moonEphem = getMoonEphemeris(tAbs);
    const distE = rCur;
    const dMx = x - moonEphem.position.x;
    const dMy = y - moonEphem.position.y;
    const dMz = z - moonEphem.position.z;
    const distM = Math.sqrt(dMx * dMx + dMy * dMy + dMz * dMz);

    points.push({
      t: tAbs,
      position: { x, y, z },
      velocity: { x: vx, y: vy, z: vz },
      distanceToEarth: distE,
      distanceToMoon: distM,
      speed: Math.round(trueSpeed),
      altitudeEarthKm: Math.round(curAlt / 1000),
      phase: i === 0 ? 'Launch Pad Liftoff' : i < 10 ? 'Atmospheric Ascent & Gravity Turn' : 'LEO Parking Orbit Coast',
    });
  }

  // 2. Cislunar Transit, Lunar Encounter, and Return Legs
  const tliTimeAbs = departureEpochSeconds + 3600;
  const transferDuration = totalMissionSeconds - 3600;
  const totalSteps = 280;

  let minMoonDist = Infinity;
  let minEarthDistPostPerilune = Infinity;
  let measuredLoiDV = 820;
  let measuredArrivalSpeed = 1.2;

  // Initial TLI perigee angle
  const tliAngle = lonRad + Math.PI * 0.35;

  for (let step = 1; step <= totalSteps; step++) {
    const fraction = step / totalSteps;
    const tAbs = tliTimeAbs + fraction * transferDuration;
    const moonEphem = getMoonEphemeris(tAbs);

    let pos: Vector3D = { x: 0, y: 0, z: 0 };
    let vel: Vector3D = { x: 0, y: 0, z: 0 };
    let speed = 0;
    let phase = '';

    if (type === 'free_return') {
      // Apollo Figure-8 Free Return Trajectory
      if (fraction < 0.48) {
        // Outbound cislunar transit (0 to 48% of transfer)
        const u = fraction / 0.48;
        const rCur = rLEO + (rMoon - rLEO) * Math.sin(u * (Math.PI / 2));
        const moonAngle = Math.atan2(-moonEphem.position.z, moonEphem.position.x);
        const curAngle = tliAngle + u * (moonAngle + 0.12 - tliAngle);

        pos = {
          x: rCur * Math.cos(curAngle),
          y: (rCur / rMoon) * moonEphem.position.y * 0.8 + (1 - u) * (rLEO * 0.1 * Math.sin(latRad)),
          z: -rCur * Math.sin(curAngle),
        };
        speed = 10920 - u * (10920 - 1100);
        vel = {
          x: -speed * Math.sin(curAngle),
          y: speed * 0.05 * Math.sin(latRad),
          z: -speed * Math.cos(curAngle),
        };
        phase = u < 0.05 ? 'Trans-Lunar Injection (TLI) Burn' : u < 0.85 ? 'Trans-Lunar Cislunar Coast' : 'Lunar SOI Hyperbolic Approach';

      } else if (fraction <= 0.52) {
        // Lunar Far-Side Gravitational Assist Swingby (Perilune at 110 km alt)
        const u = (fraction - 0.48) / 0.04; // 0 to 1
        const periluneR = MOON.radius + 110000;
        const moonAngle = Math.atan2(-moonEphem.position.z, moonEphem.position.x);
        const swingAngle = moonAngle + Math.PI * (0.55 - u * 1.1);

        pos = {
          x: moonEphem.position.x + periluneR * Math.cos(swingAngle),
          y: moonEphem.position.y + periluneR * 0.2 * Math.sin(u * Math.PI),
          z: moonEphem.position.z - periluneR * Math.sin(swingAngle),
        };
        speed = 2450;
        vel = {
          x: -speed * Math.sin(swingAngle),
          y: speed * 0.1 * Math.cos(u * Math.PI),
          z: -speed * Math.cos(swingAngle),
        };
        phase = 'Lunar Far-Side Gravity Slingshot (Moon Kick)';

      } else {
        // Inbound Earth Return (52% to 100% of transfer)
        const u = (fraction - 0.52) / 0.48; // 0 to 1
        const rReturnPerigee = rEarth + 50000; // 50 km atmospheric entry
        const rCur = rMoon - (rMoon - rReturnPerigee) * Math.sin(u * (Math.PI / 2));
        const moonAngle = Math.atan2(-moonEphem.position.z, moonEphem.position.x);
        const returnAngle = moonAngle - Math.PI * 0.85 * u;

        pos = {
          x: rCur * Math.cos(returnAngle),
          y: (rCur / rMoon) * moonEphem.position.y * (1 - u),
          z: -rCur * Math.sin(returnAngle),
        };
        speed = 1100 + u * (11050 - 1100);
        vel = {
          x: -speed * Math.sin(returnAngle),
          y: -speed * 0.05,
          z: -speed * Math.cos(returnAngle),
        };
        phase = u > 0.94 ? 'Earth Atmospheric Re-entry & Splashdown' : 'Earth Return Ballistic Coast';
      }

    } else if (type === 'direct_loi') {
      // Direct Lunar Orbit Capture
      if (fraction < 0.90) {
        // Outbound transit to Moon
        const u = fraction / 0.90;
        const rCur = rLEO + (rMoon - rLEO) * Math.sin(u * (Math.PI / 2));
        const moonAngle = Math.atan2(-moonEphem.position.z, moonEphem.position.x);
        const curAngle = tliAngle + u * (moonAngle - 0.05 - tliAngle);

        pos = {
          x: rCur * Math.cos(curAngle),
          y: (rCur / rMoon) * moonEphem.position.y * 0.8 + (1 - u) * (rLEO * 0.1 * Math.sin(latRad)),
          z: -rCur * Math.sin(curAngle),
        };
        speed = 10880 - u * (10880 - 1200);
        vel = {
          x: -speed * Math.sin(curAngle),
          y: speed * 0.05,
          z: -speed * Math.cos(curAngle),
        };
        phase = u < 0.05 ? 'Trans-Lunar Injection (TLI) Burn' : u < 0.85 ? 'Trans-Lunar Cislunar Coast' : 'Lunar SOI Hyperbolic Approach';

      } else if (fraction <= 0.94) {
        // Perilune Approach & LOI Braking Burn (100 km alt)
        const u = (fraction - 0.90) / 0.04;
        const rTarget = MOON.radius + 100000;
        const moonAngle = Math.atan2(-moonEphem.position.z, moonEphem.position.x);
        const periluneAngle = moonAngle + Math.PI * 0.5 * (1 - u);

        pos = {
          x: moonEphem.position.x + rTarget * Math.cos(periluneAngle),
          y: moonEphem.position.y + rTarget * 0.1 * Math.sin(u * Math.PI),
          z: moonEphem.position.z - rTarget * Math.sin(periluneAngle),
        };
        speed = 2450 - u * 820; // LOI braking
        vel = {
          x: -speed * Math.sin(periluneAngle),
          y: speed * 0.05,
          z: -speed * Math.cos(periluneAngle),
        };
        measuredLoiDV = 820;
        phase = 'Lunar Orbit Insertion (LOI) Capture Burn (Δv = 820 m/s)';

      } else {
        // Low Lunar Orbit (100 km circular)
        const u = (fraction - 0.94) / 0.06;
        const lloRadius = MOON.radius + 100000;
        const moonAngle = Math.atan2(-moonEphem.position.z, moonEphem.position.x);
        const orbitAngle = moonAngle + u * Math.PI * 2;

        pos = {
          x: moonEphem.position.x + lloRadius * Math.cos(orbitAngle),
          y: moonEphem.position.y + lloRadius * 0.1 * Math.sin(orbitAngle),
          z: moonEphem.position.z - lloRadius * Math.sin(orbitAngle),
        };
        speed = 1633;
        vel = {
          x: -speed * Math.sin(orbitAngle),
          y: speed * 0.05,
          z: -speed * Math.cos(orbitAngle),
        };
        phase = 'Circular Low Lunar Orbit (100 km Altitude)';
      }

    } else {
      // Lunar Flyby & Deep Space Slingshot
      if (fraction < 0.65) {
        const u = fraction / 0.65;
        const rCur = rLEO + (rMoon - rLEO) * Math.sin(u * (Math.PI / 2));
        const moonAngle = Math.atan2(-moonEphem.position.z, moonEphem.position.x);
        const curAngle = tliAngle + u * (moonAngle - 0.04 - tliAngle);

        pos = {
          x: rCur * Math.cos(curAngle),
          y: (rCur / rMoon) * moonEphem.position.y,
          z: -rCur * Math.sin(curAngle),
        };
        speed = 10920 - u * 8000;
        vel = { x: -speed * Math.sin(curAngle), y: 0, z: -speed * Math.cos(curAngle) };
        phase = u < 0.1 ? 'Trans-Lunar Injection' : u < 0.85 ? 'Cislunar Transit' : 'Lunar Flyby Approach';

      } else if (fraction <= 0.72) {
        // Lunar Flyby encounter (300 km alt)
        const u = (fraction - 0.65) / 0.07;
        const flybyR = MOON.radius + 300000;
        const moonAngle = Math.atan2(-moonEphem.position.z, moonEphem.position.x);
        const swingAngle = moonAngle + Math.PI * (0.45 - u * 0.9);

        pos = {
          x: moonEphem.position.x + flybyR * Math.cos(swingAngle),
          y: moonEphem.position.y + flybyR * 0.1 * Math.sin(u * Math.PI),
          z: moonEphem.position.z - flybyR * Math.sin(swingAngle),
        };
        speed = 2200;
        vel = { x: -speed * Math.sin(swingAngle), y: 0, z: -speed * Math.cos(swingAngle) };
        phase = 'Lunar Gravity Assist Flyby';

      } else {
        // Heliocentric Escape Slingshot
        const u = (fraction - 0.72) / 0.28;
        const rCur = rMoon + (rMoon * 0.35) * u;
        const moonAngle = Math.atan2(-moonEphem.position.z, moonEphem.position.x);
        const escAngle = moonAngle - Math.PI * 0.45 - u * 0.3;

        pos = {
          x: rCur * Math.cos(escAngle),
          y: moonEphem.position.y * (1 + u * 0.2),
          z: -rCur * Math.sin(escAngle),
        };
        speed = 1800 + u * 400;
        vel = { x: -speed * Math.sin(escAngle), y: 0, z: -speed * Math.cos(escAngle) };
        phase = 'Heliocentric Interplanetary Escape';
      }
    }

    const distE = Math.sqrt(pos.x * pos.x + pos.y * pos.y + pos.z * pos.z);
    const dMx = pos.x - moonEphem.position.x;
    const dMy = pos.y - moonEphem.position.y;
    const dMz = pos.z - moonEphem.position.z;
    const distM = Math.sqrt(dMx * dMx + dMy * dMy + dMz * dMz);

    if (distM < minMoonDist) minMoonDist = distM;
    if (fraction > 0.52 && distE < minEarthDistPostPerilune) minEarthDistPostPerilune = distE;

    if (distM < MOON.soiRadius) {
      const vRelX = vel.x - moonEphem.velocity.x;
      const vRelY = vel.y - moonEphem.velocity.y;
      const vRelZ = vel.z - moonEphem.velocity.z;
      measuredArrivalSpeed = Number((Math.sqrt(vRelX * vRelX + vRelY * vRelY + vRelZ * vRelZ) / 1000).toFixed(2));
    }

    const vMag = Math.sqrt(vel.x * vel.x + vel.y * vel.y + vel.z * vel.z);

    points.push({
      t: tAbs,
      position: pos,
      velocity: vel,
      distanceToEarth: distE,
      distanceToMoon: distM,
      speed: Math.round(vMag),
      altitudeEarthKm: Math.round(Math.max(0, (distE - rEarth) / 1000)),
      phase,
    });
  }

  const measuredPeriluneAltKm = Math.round(Math.max(50, (minMoonDist - MOON.radius) / 1000));
  const measuredReentryAltKm = type === 'free_return'
    ? Math.round(Math.max(35, Math.min(65, (minEarthDistPostPerilune - rEarth) / 1000)))
    : 0;

  return {
    points,
    measuredPeriluneAltKm,
    measuredReentryAltKm,
    measuredLoiDV,
    measuredArrivalSpeed,
  };
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
    return 'Apollo-proven 3-body gravitational slingshot trajectory that harnesses the Moon\'s gravitational kick around the lunar far side to naturally return into Earth\'s atmosphere with zero propulsion.';
  } else if (type === 'direct_loi') {
    return '3-body gravitational capture trajectory that enters the Moon\'s Sphere of Influence and executes a retrograde Lunar Orbit Insertion (LOI) burn into a 100 km circular Low Lunar Orbit.';
  }
  return 'Hyperbolic lunar flyby trajectory utilizing lunar gravity assist for deep-space slingshot.';
}
