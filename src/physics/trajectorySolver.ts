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

  // Sidereal day length ~23.934 hours
  const siderealDayHours = 23.9344;

  // Compute nodal launch azimuths
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
    // High latitude spaceport (e.g. Baikonur at 45.9°)
    azAscending = 90;
    azDescending = 90;
    const deltaIncRad = ((Math.abs(lat) - moonInclinationDeg) * Math.PI) / 180;
    const vLEO = Math.sqrt(EARTH.mu / (EARTH.radius + 200000));
    planePenaltyDV = Math.round(2 * vLEO * Math.sin(deltaIncRad / 2));
    planeEfficiency = Math.max(75, Math.round(100 - (planePenaltyDV / 3140) * 100));
  }

  // Calculate upcoming 4 daily launch windows from current sim time
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
    const duration = Math.abs(lat) < 15 ? 45 : 30; // equatorial spaceports have wider launch windows

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

  const points = generateTrajectoryPoints(type, spaceport, departureAltitudeMeters, flightTimeHoursTarget);

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

function generateTrajectoryPoints(
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
  const omegaMoon = (2 * Math.PI) / MOON.orbitalPeriod;

  // Spaceport initial surface position
  const latRad = (spaceport.latitude * Math.PI) / 180;
  const lonRad = (spaceport.longitude * Math.PI) / 180;
  // Phase 1: Launch Pad to LEO Insertion (Steps 0 to 20)
  const ascentSteps = 20;
  const tAscent = 600; // 10 minutes to orbit
  for (let i = 0; i <= ascentSteps; i++) {
    const p = i / ascentSteps;
    const t = p * tAscent;
    const curAlt = p * leoAlt;
    const rCur = rEarth + curAlt;

    // Curve along launch azimuth
    const defaultAz = (spaceport.minLaunchAzimuth + spaceport.maxLaunchAzimuth) / 2;
    const azRad = (defaultAz * Math.PI) / 180;
    const dLon = p * 0.25 * Math.sin(azRad);
    const dLat = p * 0.15 * Math.cos(azRad);

    const curLat = latRad + dLat;
    const curLon = lonRad + dLon;

    const x = rCur * Math.cos(curLat) * Math.cos(curLon);
    const y = rCur * Math.sin(curLat);
    const z = -rCur * Math.cos(curLat) * Math.sin(curLon);

    points.push({
      t,
      position: { x, y, z },
      velocity: { x: 0, y: 0, z: 0 },
      distanceToEarth: rCur,
      distanceToMoon: rMoon - rCur,
      speed: Math.round(spaceport.equatorialBoostVelocity + p * (7800 - spaceport.equatorialBoostVelocity)),
      altitudeEarthKm: Math.round(curAlt / 1000),
      phase: i === 0 ? 'Launch Pad Liftoff' : i < 10 ? 'Atmospheric Ascent & Gravity Turn' : 'LEO Insertion Burn',
    });
  }

  // Phase 2: LEO Parking Orbit Coast (Steps 21 to 40)
  const parkingSteps = 20;
  const tParking = 5400; // 90 min orbital period
  const lastAscentPoint = points[points.length - 1];
  const startAngle = Math.atan2(-lastAscentPoint.position.z, lastAscentPoint.position.x);

  for (let i = 1; i <= parkingSteps; i++) {
    const p = i / parkingSteps;
    const t = tAscent + p * tParking;
    const orbitAngle = startAngle + p * Math.PI * 1.2;

    const x = rLEO * Math.cos(orbitAngle);
    const y = rLEO * 0.1 * Math.sin(orbitAngle);
    const z = -rLEO * Math.sin(orbitAngle);

    points.push({
      t,
      position: { x, y, z },
      velocity: { x: 0, y: 0, z: 0 },
      distanceToEarth: rLEO,
      distanceToMoon: rMoon - rLEO,
      speed: 7780,
      altitudeEarthKm: Math.round(leoAlt / 1000),
      phase: i === parkingSteps ? 'Trans-Lunar Injection (TLI) Burn' : 'LEO Parking Orbit Coast',
    });
  }

  // Phase 3 & 4: Trans-Lunar Transfer & Lunar Capture / Flyby (Steps 41 to 240)
  const transferSteps = 200;
  const tliLeadAngle = (125 * Math.PI) / 180;
  const remainingSeconds = totalSeconds - (tAscent + tParking);

  for (let i = 1; i <= transferSteps; i++) {
    const fraction = i / transferSteps;
    const t = tAscent + tParking + fraction * remainingSeconds;

    let rCur = 0;
    let angleRad = 0;
    let phase = 'Trans-Lunar Coast (Cislunar Space)';

    if (type === 'free_return') {
      if (fraction <= 0.48) {
        const p = fraction / 0.48;
        rCur = rLEO + (rMoon - rLEO) * Math.sin((p * Math.PI) / 2);
        angleRad = tliLeadAngle * (1 - p * 0.9);
        phase = 'Trans-Lunar Outbound Coast';
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

        const distEarth = Math.sqrt(x * x + y * y + z * z);
        points.push({
          t,
          position: { x, y, z },
          velocity: { x: 0, y: 0, z: 0 },
          distanceToEarth: distEarth,
          distanceToMoon: swingRadius,
          speed: 2150,
          altitudeEarthKm: Math.round((distEarth - rEarth) / 1000),
          phase: 'Lunar Far-Side Flyby / Gravity Slingshot',
        });
        continue;
      } else {
        const p = (fraction - 0.52) / 0.48;
        rCur = rMoon - (rMoon - rLEO) * Math.sin((p * Math.PI) / 2);
        angleRad = omegaMoon * (0.52 * totalSeconds) + Math.PI * p * 0.85;
        phase = 'Earth Atmospheric Re-entry Return Arc';
      }
    } else {
      rCur = rLEO + (rMoon - rLEO) * Math.sin((fraction * Math.PI) / 2);
      angleRad = tliLeadAngle * (1 - fraction * 0.95);
      if (fraction > 0.95) phase = 'Lunar Orbit Insertion (LOI) Burn';
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
      speed: Math.round(speed),
      altitudeEarthKm: Math.round((distEarth - rEarth) / 1000),
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
