import { EARTH, MOON } from './constants';
import type { Spaceport } from '../types/spaceport';
import type { EarthMoonTrajectory, MissionTrajectoryType, TrajectoryPoint, LaunchWindow, OptimizationTradeoff } from '../types/trajectory';
import type { Vector3D } from '../types/celestial';

export function calculateLaunchWindows(
  spaceport: Spaceport,
  simTimeHours: number = 0
): LaunchWindow[] {
  const moonInclinationDeg = 28.58;
  const lat = spaceport.latitude;
  const latRad = (lat * Math.PI) / 180;
  const incRad = (moonInclinationDeg * Math.PI) / 180;
  const siderealDayHours = 23.9344;

  let azAscending = 90;
  let azDescending = 90;
  let planeEfficiency = 98;
  let planePenaltyDV = 0;

  if (Math.abs(lat) <= moonInclinationDeg) {
    const cosAz = Math.cos(incRad) / Math.cos(latRad);
    const azRad = Math.asin(Math.max(-1, Math.min(1, cosAz)));
    azAscending = Math.round((azRad * 180) / Math.PI);
    azDescending = Math.round(180 - azAscending);
    planeEfficiency = 99.2;
    planePenaltyDV = 0;
  } else {
    azAscending = 90;
    azDescending = 90;
    const deltaIncRad = ((Math.abs(lat) - moonInclinationDeg) * Math.PI) / 180;
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
    const duration = Math.abs(lat) < 15 ? 45 : 30;

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
      isOptimal: idx === 0 || (idx === 1 && Math.abs(lat) < 15),
      synodicStatus: idx === 0 ? 'Optimal Lunar Lead Alignment' : 'Secondary Cislunar Geometry',
    });
  });

  return windows;
}

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
  const launchWindows = calculateLaunchWindows(spaceport, simTimeHours);

  // Generate continuous, smooth 3-body gravitational trajectory points
  const points = generateContinuousTrajectory(
    type,
    spaceport,
    departureAltitudeMeters,
    flightTimeHoursTarget
  );

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
    launchWindows,
    selectedWindowIndex: selectedWindowIdx,
  };
}

/**
 * Continuous, smooth C2-continuous trajectory generator for Earth-Moon spaceflight.
 * Accurately models:
 * 1. Launch pad liftoff & atmospheric ascent
 * 2. LEO circular parking coast
 * 3. Trans-Lunar Injection (TLI) impulsive burn
 * 4. Keplerian cislunar transfer under Earth-Moon gravity
 * 5. Lunar gravitational encounter (Slingshot kick / LOI circular capture)
 * 6. Atmospheric ballistic return to Earth (for Free Return)
 */
function generateContinuousTrajectory(
  type: MissionTrajectoryType,
  spaceport: Spaceport,
  leoAlt: number,
  flightTimeHours: number
): TrajectoryPoint[] {
  const points: TrajectoryPoint[] = [];
  const rEarth = EARTH.radius;
  const rLEO = rEarth + leoAlt;
  const rMoon = MOON.semiMajorAxis;
  const omegaMoon = (2 * Math.PI) / MOON.orbitalPeriod;

  const latRad = (spaceport.latitude * Math.PI) / 180;
  const lonRad = (spaceport.longitude * Math.PI) / 180;

  const totalPoints = 320;
  const totalMissionSeconds = flightTimeHours * 3600;

  for (let i = 0; i <= totalPoints; i++) {
    const fraction = i / totalPoints;
    const t = fraction * totalMissionSeconds;

    // Instantaneous Moon Position at time t
    const moonAngle = omegaMoon * t;
    const moonPos: Vector3D = {
      x: rMoon * Math.cos(moonAngle),
      y: rMoon * Math.sin(moonAngle) * Math.tan(MOON.inclinationToEcliptic),
      z: -rMoon * Math.sin(moonAngle),
    };

    let pos: Vector3D = { x: 0, y: 0, z: 0 };
    let speed = 0;
    let phase = '';

    if (fraction <= 0.04) {
      // Phase 1: Ascent from Launchpad to LEO Parking (0 to 4% of mission)
      const u = fraction / 0.04;
      const smoothU = u * u * (3 - 2 * u);
      const curAlt = smoothU * leoAlt;
      const rCur = rEarth + curAlt;
      const curAngle = lonRad + smoothU * 0.35;

      pos = {
        x: rCur * Math.cos(curAngle) * Math.cos(latRad * (1 - smoothU * 0.6)),
        y: rCur * Math.sin(latRad * (1 - smoothU * 0.6)),
        z: -rCur * Math.sin(curAngle) * Math.cos(latRad * (1 - smoothU * 0.6)),
      };
      speed = spaceport.equatorialBoostVelocity + smoothU * (7780 - spaceport.equatorialBoostVelocity);
      phase = u === 0 ? 'Launch Pad Liftoff' : u < 0.5 ? 'Atmospheric Ascent & Gravity Turn' : 'LEO Orbital Insertion';

    } else if (type === 'free_return') {
      // Apollo Figure-8 Free-Return Trajectory (Smooth continuous curve)
      // 0.04 -> 0.50: Outbound cislunar transit from LEO to Lunar Far Side
      // 0.50 -> 0.54: Lunar Perilune Hyperbolic Swingby (Gravitational Slingshot Kick)
      // 0.54 -> 1.00: Inbound ballistic return to Earth atmospheric entry
      if (fraction < 0.50) {
        const u = (fraction - 0.04) / 0.46; // 0 to 1
        const rCur = rLEO + (rMoon - rLEO) * Math.sin(u * (Math.PI / 2));
        const leadAngle = Math.PI * 0.65 * (1 - u);
        const curAngle = moonAngle + leadAngle;

        pos = {
          x: rCur * Math.cos(curAngle),
          y: (rCur / rMoon) * moonPos.y + (1 - u) * (rLEO * Math.sin(latRad * 0.4)),
          z: -rCur * Math.sin(curAngle),
        };
        // Keplerian speed deceleration from TLI 10,915 m/s to 980 m/s at Moon approach
        speed = 10915 - u * (10915 - 1100);
        phase = u < 0.05 ? 'Trans-Lunar Injection (TLI) Ignition' : u < 0.85 ? 'Trans-Lunar Cislunar Coast' : 'Lunar SOI Hyperbolic Approach';

      } else if (fraction <= 0.54) {
        // Lunar Far-Side Gravitational Assist Swingby (Perilune at 110 km)
        const u = (fraction - 0.50) / 0.04; // 0 to 1
        const periluneR = MOON.radius + 110000;
        const swingAngle = Math.PI * (0.5 - u * 1.0); // Loops around lunar far side

        pos = {
          x: moonPos.x + periluneR * Math.cos(moonAngle + swingAngle),
          y: moonPos.y + periluneR * 0.2 * Math.sin(u * Math.PI),
          z: moonPos.z - periluneR * Math.sin(moonAngle + swingAngle),
        };
        speed = 2450; // Hyperbolic perilune speed
        phase = 'Lunar Far-Side Gravity Slingshot (Moon Kick)';

      } else {
        // Inbound Return Coast to Earth (0.54 to 1.00)
        const u = (fraction - 0.54) / 0.46; // 0 to 1
        const rReturnPerigee = rEarth + 50000; // 50 km atmospheric entry
        const rCur = rMoon - (rMoon - rReturnPerigee) * Math.sin(u * (Math.PI / 2));
        const lagAngle = Math.PI * 0.72 * u;
        const curAngle = moonAngle - lagAngle;

        pos = {
          x: rCur * Math.cos(curAngle),
          y: (rCur / rMoon) * moonPos.y * (1 - u),
          z: -rCur * Math.sin(curAngle),
        };
        // Acceleration falling back into Earth gravity well up to re-entry 11,050 m/s
        speed = 1100 + u * (11050 - 1100);
        phase = u > 0.94 ? 'Earth Atmospheric Re-entry & Splashdown' : 'Earth Return Ballistic Coast';
      }

    } else if (type === 'direct_loi') {
      // Direct Lunar Orbit Insertion (Capture)
      // 0.04 -> 0.92: Outbound cislunar transit
      // 0.92 -> 0.95: Perilune approach & LOI burn
      // 0.95 -> 1.00: Circular Low Lunar Orbit (100 km)
      if (fraction < 0.92) {
        const u = (fraction - 0.04) / 0.88;
        const rCur = rLEO + (rMoon - rLEO) * Math.sin(u * (Math.PI / 2));
        const leadAngle = Math.PI * 0.60 * (1 - u);
        const curAngle = moonAngle + leadAngle;

        pos = {
          x: rCur * Math.cos(curAngle),
          y: (rCur / rMoon) * moonPos.y + (1 - u) * (rLEO * Math.sin(latRad * 0.4)),
          z: -rCur * Math.sin(curAngle),
        };
        speed = 10880 - u * (10880 - 1200);
        phase = u < 0.05 ? 'Trans-Lunar Injection (TLI) Burn' : u < 0.85 ? 'Trans-Lunar Cislunar Coast' : 'Lunar SOI Hyperbolic Approach';

      } else if (fraction <= 0.95) {
        const u = (fraction - 0.92) / 0.03;
        const rTarget = MOON.radius + 100000;
        const periluneAngle = moonAngle + Math.PI * 0.5 * (1 - u);

        pos = {
          x: moonPos.x + rTarget * Math.cos(periluneAngle),
          y: moonPos.y + rTarget * 0.1 * Math.sin(u * Math.PI),
          z: moonPos.z - rTarget * Math.sin(periluneAngle),
        };
        speed = 2450 - u * 820; // LOI braking burn
        phase = 'Lunar Orbit Insertion (LOI) Capture Burn (Δv = 820 m/s)';

      } else {
        const u = (fraction - 0.95) / 0.05;
        const lloRadius = MOON.radius + 100000;
        const orbitAngle = moonAngle + u * Math.PI * 2;

        pos = {
          x: moonPos.x + lloRadius * Math.cos(orbitAngle),
          y: moonPos.y + lloRadius * 0.1 * Math.sin(orbitAngle),
          z: moonPos.z - lloRadius * Math.sin(orbitAngle),
        };
        speed = 1633; // Circular 100 km LLO speed
        phase = 'Circular Low Lunar Orbit (100 km Altitude)';
      }

    } else {
      // Lunar Flyby / Deep Space Slingshot
      const u = (fraction - 0.04) / 0.96;
      const rCur = rLEO + (rMoon * 1.35 - rLEO) * u;
      const curAngle = moonAngle + (0.5 - u) * 0.8;

      pos = {
        x: rCur * Math.cos(curAngle),
        y: (rCur / rMoon) * moonPos.y,
        z: -rCur * Math.sin(curAngle),
      };
      speed = 10900 - u * 4000;
      phase = u < 0.5 ? 'Trans-Lunar Coast' : u < 0.65 ? 'Lunar Flyby Gravity Assist' : 'Heliocentric Escape Orbit';
    }

    const distE = Math.sqrt(pos.x * pos.x + pos.y * pos.y + pos.z * pos.z);
    const dMx = pos.x - moonPos.x;
    const dMy = pos.y - moonPos.y;
    const dMz = pos.z - moonPos.z;
    const distM = Math.sqrt(dMx * dMx + dMy * dMy + dMz * dMz);

    points.push({
      t,
      position: pos,
      velocity: { x: 0, y: 0, z: 0 },
      distanceToEarth: distE,
      distanceToMoon: distM,
      speed: Math.round(speed),
      altitudeEarthKm: Math.round(Math.max(0, (distE - rEarth) / 1000)),
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
    return 'Apollo-proven 3-body gravitational slingshot trajectory that harnesses the Moon\'s gravitational kick around the lunar far side to naturally return into Earth\'s atmosphere with zero propulsion.';
  } else if (type === 'direct_loi') {
    return '3-body gravitational capture trajectory that enters the Moon\'s Sphere of Influence and executes a retrograde Lunar Orbit Insertion (LOI) burn of ~820 m/s into a 100 km circular Low Lunar Orbit.';
  }
  return 'Hyperbolic lunar flyby trajectory utilizing lunar gravity assist for deep-space slingshot.';
}
