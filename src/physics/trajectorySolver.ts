import { EARTH, MOON } from './constants';
import type { Spaceport } from '../types/spaceport';
import type { EarthMoonTrajectory, MissionTrajectoryType, TrajectoryPoint, LaunchWindow, OptimizationTradeoff } from '../types/trajectory';

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

  const points = generateSmoothTrajectoryPoints(type, spaceport, departureAltitudeMeters, flightTimeHoursTarget);

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

function generateSmoothTrajectoryPoints(
  type: MissionTrajectoryType,
  spaceport: Spaceport,
  leoAlt: number,
  flightTimeHours: number
): TrajectoryPoint[] {
  const points: TrajectoryPoint[] = [];
  const rEarth = EARTH.radius;
  const rLEO = rEarth + leoAlt;
  const rMoon = MOON.semiMajorAxis;
  const totalSeconds = flightTimeHours * 3600;

  const latRad = (spaceport.latitude * Math.PI) / 180;
  const lonRad = (spaceport.longitude * Math.PI) / 180;

  const totalSteps = 240;

  for (let i = 0; i <= totalSteps; i++) {
    const u = i / totalSteps; // Normalized parameter [0, 1]
    const t = u * totalSeconds;

    let r = rEarth;
    let angleRad = 0;
    let zOffset = 0;
    let phase = 'Cislunar Coast';

    if (type === 'free_return') {
      // Apollo figure-8 / teardrop free return loop
      if (u <= 0.5) {
        // Outbound cislunar arc: smoothly interpolates from pad (rEarth) -> LEO -> Moon encounter
        const p = u / 0.5;
        // Smooth continuous S-curve radius growth
        const smoothP = 0.5 - 0.5 * Math.cos(p * Math.PI);
        r = rEarth + (rMoon - rEarth) * smoothP;

        // Smooth continuous angular sweep from spaceport longitude to lunar lead position
        angleRad = lonRad + p * (Math.PI * 0.85);
        zOffset = (r / rMoon) * (rMoon * 0.05) * Math.sin(p * Math.PI);

        if (u < 0.05) {
          phase = 'Launch Pad Liftoff & Gravity Turn';
        } else if (u < 0.12) {
          phase = 'LEO Parking Orbit & TLI Ignition';
        } else {
          phase = 'Trans-Lunar Outbound Coast';
        }
      } else {
        // Inbound return arc: loops around Moon and returns smoothly to Earth atmosphere
        const p = (u - 0.5) / 0.5;
        const smoothP = 0.5 + 0.5 * Math.cos(p * Math.PI);
        r = rEarth + (rMoon - rEarth) * smoothP;

        angleRad = lonRad + (Math.PI * 0.85) + p * (Math.PI * 0.9);
        zOffset = (r / rMoon) * (rMoon * 0.05) * Math.sin((1 - p) * Math.PI);

        if (u < 0.56) {
          phase = 'Lunar Far-Side Flyby / Gravity Assist';
        } else if (u > 0.95) {
          phase = 'Earth Atmospheric Re-entry';
        } else {
          phase = 'Earth Return Coast Arc';
        }
      }
    } else {
      // Direct Lunar Orbit Capture (LOI)
      // Smooth monotonic outward conic from pad through LEO to Low Lunar Orbit
      const smoothP = 0.5 - 0.5 * Math.cos(u * Math.PI);
      r = rEarth + (rMoon - rEarth) * smoothP;
      angleRad = lonRad + u * (Math.PI * 0.92);
      zOffset = (r / rMoon) * (rMoon * 0.06) * Math.sin(u * Math.PI);

      if (u < 0.05) {
        phase = 'Launch Pad Liftoff & Ascent';
      } else if (u < 0.12) {
        phase = 'LEO Insertion & TLI Burn';
      } else if (u > 0.92) {
        phase = 'Lunar Orbit Insertion (LOI) Capture';
      } else {
        phase = 'Trans-Lunar Cislunar Coast';
      }
    }

    const x = r * Math.cos(angleRad);
    const y = r * Math.sin(latRad * (1 - u * 0.8)) * 0.4 + zOffset;
    const z = -r * Math.sin(angleRad);

    const distEarth = Math.sqrt(x * x + y * y + z * z);
    const moonAngleAtT = ((2 * Math.PI) / MOON.orbitalPeriod) * t;
    const moonPosAtT = { x: rMoon * Math.cos(moonAngleAtT), y: 0, z: -rMoon * Math.sin(moonAngleAtT) };
    const distMoon = Math.sqrt(
      Math.pow(x - moonPosAtT.x, 2) + Math.pow(y - moonPosAtT.y, 2) + Math.pow(z - moonPosAtT.z, 2)
    );

    const speed = Math.round(
      Math.sqrt(Math.max(400, EARTH.mu * (2 / distEarth - 1 / ((rLEO + rMoon) / 2))))
    );

    points.push({
      t,
      position: { x, y, z },
      velocity: { x: 0, y: 0, z: 0 },
      distanceToEarth: distEarth,
      distanceToMoon: distMoon,
      speed,
      altitudeEarthKm: Math.round(Math.max(0, (distEarth - rEarth) / 1000)),
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
