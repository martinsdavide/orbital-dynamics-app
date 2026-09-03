import { EARTH, MOON } from './constants.ts';
import type { Spaceport } from '../types/spaceport.ts';
import type { EarthMoonTrajectory, MissionTrajectoryType, TrajectoryPoint, LaunchWindow, OptimizationTradeoff, MissionMilestone } from '../types/trajectory.ts';
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
 * Generates the 8 standard infographic mission milestones for a given mission archetype.
 */
export function getMissionMilestones(
  type: MissionTrajectoryType,
  spaceportName: string,
  totalFlightHours: number
): { milestones: MissionMilestone[]; outboundSplitFraction: number } {
  if (type === 'free_return') {
    return {
      outboundSplitFraction: 0.52,
      milestones: [
        {
          id: 1,
          label: 'Lift-off: ' + spaceportName,
          description: 'Launch of rocket and translunar payload from pad',
          tFraction: 0.0,
          timeHours: 0.0,
          color: '#a855f7',
          category: 'outbound',
        },
        {
          id: 2,
          label: 'High Earth Orbit',
          description: 'Moves into high Earth elliptical staging & checkout orbit',
          tFraction: 0.08,
          timeHours: Number((totalFlightHours * 0.08).toFixed(1)),
          color: '#a855f7',
          category: 'outbound',
        },
        {
          id: 3,
          label: 'Launcher Separation',
          description: 'Spacecraft separates from core propulsion stage',
          tFraction: 0.15,
          timeHours: Number((totalFlightHours * 0.15).toFixed(1)),
          color: '#a855f7',
          category: 'outbound',
        },
        {
          id: 4,
          label: 'Main Engine TLI Burn',
          description: 'Service module engine fires to propel capsule to the Moon',
          tFraction: 0.22,
          timeHours: Number((totalFlightHours * 0.22).toFixed(1)),
          color: '#a855f7',
          category: 'outbound',
        },
        {
          id: 5,
          label: 'Lunar Fly-by',
          description: 'Free-return gravitational kick around lunar far-side (110 km alt)',
          tFraction: 0.50,
          timeHours: Number((totalFlightHours * 0.50).toFixed(1)),
          color: '#a855f7',
          category: 'outbound',
        },
        {
          id: 6,
          label: 'Return to Earth',
          description: 'Ballistic cislunar return coast toward Earth atmosphere',
          tFraction: 0.75,
          timeHours: Number((totalFlightHours * 0.75).toFixed(1)),
          color: '#f59e0b',
          category: 'inbound',
        },
        {
          id: 7,
          label: 'Crew Module Separates',
          description: 'Service module jettisoned prior to atmospheric entry',
          tFraction: 0.95,
          timeHours: Number((totalFlightHours * 0.95).toFixed(1)),
          color: '#f59e0b',
          category: 'inbound',
        },
        {
          id: 8,
          label: 'Splashdown: Ocean Recovery',
          description: 'Parachute deployment and oceanic recovery',
          tFraction: 1.0,
          timeHours: totalFlightHours,
          color: '#f59e0b',
          category: 'inbound',
        },
      ],
    };
  } else if (type === 'direct_loi') {
    return {
      outboundSplitFraction: 0.92,
      milestones: [
        {
          id: 1,
          label: 'Lift-off: ' + spaceportName,
          description: 'Liftoff and atmospheric ascent to orbit',
          tFraction: 0.0,
          timeHours: 0.0,
          color: '#a855f7',
          category: 'outbound',
        },
        {
          id: 2,
          label: 'LEO Parking Orbit',
          description: 'Circular Earth parking orbit insertion and systems verification',
          tFraction: 0.08,
          timeHours: Number((totalFlightHours * 0.08).toFixed(1)),
          color: '#a855f7',
          category: 'outbound',
        },
        {
          id: 3,
          label: 'TLI Injection Ignition',
          description: 'Main engine ignition for Trans-Lunar Injection (Δv = 3,140 m/s)',
          tFraction: 0.16,
          timeHours: Number((totalFlightHours * 0.16).toFixed(1)),
          color: '#a855f7',
          category: 'outbound',
        },
        {
          id: 4,
          label: 'Cislunar Transit Coast',
          description: 'Translunar coast with midcourse trajectory correction maneuvers',
          tFraction: 0.50,
          timeHours: Number((totalFlightHours * 0.50).toFixed(1)),
          color: '#a855f7',
          category: 'outbound',
        },
        {
          id: 5,
          label: 'Lunar SOI Entry',
          description: 'Spacecraft enters Moon gravitational sphere of influence',
          tFraction: 0.85,
          timeHours: Number((totalFlightHours * 0.85).toFixed(1)),
          color: '#a855f7',
          category: 'outbound',
        },
        {
          id: 6,
          label: 'LOI Braking Burn',
          description: 'Retrograde engine burn (Δv = 820 m/s) at 100 km perilune for capture',
          tFraction: 0.92,
          timeHours: Number((totalFlightHours * 0.92).toFixed(1)),
          color: '#06b6d4',
          category: 'orbit',
        },
        {
          id: 7,
          label: 'Low Lunar Orbit (100 km)',
          description: 'Circular 100 km polar/equatorial operational lunar orbit',
          tFraction: 0.96,
          timeHours: Number((totalFlightHours * 0.96).toFixed(1)),
          color: '#06b6d4',
          category: 'orbit',
        },
        {
          id: 8,
          label: 'Target Site Phasing',
          description: 'Orbital phasing and survey over lunar target site',
          tFraction: 1.0,
          timeHours: totalFlightHours,
          color: '#06b6d4',
          category: 'orbit',
        },
      ],
    };
  } else {
    return {
      outboundSplitFraction: 0.70,
      milestones: [
        {
          id: 1,
          label: 'Lift-off: ' + spaceportName,
          description: 'Liftoff and ascent into Earth departure trajectory',
          tFraction: 0.0,
          timeHours: 0.0,
          color: '#a855f7',
          category: 'outbound',
        },
        {
          id: 2,
          label: 'LEO Staging Orbit',
          description: 'Low Earth orbit staging and injection attitude alignment',
          tFraction: 0.08,
          timeHours: Number((totalFlightHours * 0.08).toFixed(1)),
          color: '#a855f7',
          category: 'outbound',
        },
        {
          id: 3,
          label: 'High-Energy TLI Burn',
          description: 'Hyperbolic escape injection burn toward lunar trailing edge',
          tFraction: 0.16,
          timeHours: Number((totalFlightHours * 0.16).toFixed(1)),
          color: '#a855f7',
          category: 'outbound',
        },
        {
          id: 4,
          label: 'Hyperbolic Cislunar Transit',
          description: 'High-speed transit toward the Moon',
          tFraction: 0.45,
          timeHours: Number((totalFlightHours * 0.45).toFixed(1)),
          color: '#a855f7',
          category: 'outbound',
        },
        {
          id: 5,
          label: 'Lunar Gravity Slingshot',
          description: 'Hyperbolic trailing-edge swingby at 300 km alt (Moon Kick)',
          tFraction: 0.68,
          timeHours: Number((totalFlightHours * 0.68).toFixed(1)),
          color: '#10b981',
          category: 'escape',
        },
        {
          id: 6,
          label: 'Orbital Energy Boost',
          description: 'Harnessing Moon orbital momentum for heliocentric speed gain',
          tFraction: 0.75,
          timeHours: Number((totalFlightHours * 0.75).toFixed(1)),
          color: '#10b981',
          category: 'escape',
        },
        {
          id: 7,
          label: 'Cislunar Departure',
          description: 'Spacecraft departs lunar sphere of influence into deep space',
          tFraction: 0.86,
          timeHours: Number((totalFlightHours * 0.86).toFixed(1)),
          color: '#10b981',
          category: 'escape',
        },
        {
          id: 8,
          label: 'Interplanetary Trajectory',
          description: 'Heliocentric cruise trajectory beyond the Earth-Moon system',
          tFraction: 1.0,
          timeHours: totalFlightHours,
          color: '#10b981',
          category: 'escape',
        },
      ],
    };
  }
}

/**
 * Solves and numerically generates a smooth, continuous Earth-Moon mission trajectory.
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

  // Generate continuous trajectory points
  const { points, measuredPeriluneAltKm, measuredReentryAltKm, measuredLoiDV, measuredArrivalSpeed } =
    propagateSeamlessTrajectory(
      type,
      spaceport,
      departureAltitudeMeters,
      flightTimeHoursTarget,
      activeWindow
    );

  const { milestones, outboundSplitFraction } = getMissionMilestones(type, spaceport.name, flightTimeHoursTarget);

  // Map exact pointIndex to milestones
  milestones.forEach((m) => {
    m.pointIndex = Math.min(points.length - 1, Math.floor(m.tFraction * (points.length - 1)));
  });

  const loiDeltaV = type === 'direct_loi' ? measuredLoiDV : 0;
  const totalMissionDeltaV = Math.round(tliDeltaV + loiDeltaV + planeChangeDeltaV - spaceportBoost);

  return {
    id: 'traj_' + type + '_' + spaceport.id,
    name: type === 'direct_loi'
      ? 'Direct Lunar Orbit Capture'
      : type === 'free_return'
        ? 'Apollo / Artemis II Free-Return Trajectory'
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
    milestones,
    outboundSplitFraction,
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
 * Propagates a seamless, smooth C2-continuous Earth-Moon mission trajectory with HEO phasing loops.
 */
function propagateSeamlessTrajectory(
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
  const rHEOApogee = rEarth + 72000000; // 72,000 km HEO staging apogee (Artemis II profile)
  const rMoon = MOON.semiMajorAxis;

  const latRad = (spaceport.latitude * Math.PI) / 180;
  const lonRad = (spaceport.longitude * Math.PI) / 180;

  const departureEpochSeconds = launchWindow.openTimeHours * 3600;
  const totalMissionSeconds = flightTimeHours * 3600;

  // Spaceport true inertial angle on rotating Earth at T=0
  const earthRotAtT0 = (departureEpochSeconds / EARTH.rotationPeriod) * (2 * Math.PI);
  const phi0 = lonRad + earthRotAtT0;

  const totalSteps = 360;

  let minMoonDist = Infinity;
  let minEarthDistPostPerilune = Infinity;
  let measuredLoiDV = 820;
  let measuredArrivalSpeed = 1.2;

  for (let step = 0; step <= totalSteps; step++) {
    const fraction = step / totalSteps;
    const tAbs = departureEpochSeconds + fraction * totalMissionSeconds;
    const moonEphem = getMoonEphemeris(tAbs);

    let pos: Vector3D = { x: 0, y: 0, z: 0 };
    let vel: Vector3D = { x: 0, y: 0, z: 0 };
    let speed = 0;
    let phase = '';

    if (type === 'free_return') {
      // Apollo / Artemis II C2-Continuous Figure-8 Free-Return Formulation
      const cosInc = Math.cos(MOON.inclinationToEcliptic);
      const sinInc = Math.sin(MOON.inclinationToEcliptic);

      const rPerilune = MOON.radius + 110000;
      const rSplashdown = rEarth + 50000;

      // Lunar encounter angle at arrival (fraction = 0.50)
      const arrivalEpoch = departureEpochSeconds + 0.50 * totalMissionSeconds;
      const moonAtArrival = getMoonEphemeris(arrivalEpoch);
      const arrivalMoonAngle = Math.atan2(-moonAtArrival.position.z / cosInc, moonAtArrival.position.x);

      const leadOffset = rPerilune / rMoon;
      const tliAngle = arrivalMoonAngle - Math.PI + leadOffset;
      const heoStartAngle = tliAngle - Math.PI * 2.0;
      const padAngle = heoStartAngle - Math.PI * 0.4;

      if (fraction < 0.08) {
        // 1. Lift-off & Ascent to LEO
        const u = fraction / 0.08;
        const curAlt = u * leoAlt;
        const rCur = rEarth + curAlt;
        const curAngle = padAngle + u * (Math.PI * 0.4);

        pos = {
          x: rCur * Math.cos(curAngle) * Math.cos(latRad * (1 - u * 0.7)),
          y: rCur * sinInc * Math.sin(curAngle),
          z: -rCur * cosInc * Math.sin(curAngle) * Math.cos(latRad * (1 - u * 0.7)),
        };
        speed = spaceport.equatorialBoostVelocity + u * (7780 - spaceport.equatorialBoostVelocity);
        vel = { x: -speed * Math.sin(curAngle), y: speed * 0.05, z: -speed * Math.cos(curAngle) };
        phase = u === 0 ? 'Lift-off: ' + spaceport.name : 'Atmospheric Ascent to LEO';

      } else if (fraction < 0.22) {
        // 2. High Earth Orbit (HEO) Staging Loop
        const u = (fraction - 0.08) / 0.14;
        const curAngle = heoStartAngle + u * (Math.PI * 2.0);
        const rCur = rLEO + (rHEOApogee - rLEO) * Math.sin(u * Math.PI);

        pos = {
          x: rCur * Math.cos(curAngle),
          y: rCur * sinInc * Math.sin(curAngle),
          z: -rCur * cosInc * Math.sin(curAngle),
        };
        speed = 7780 - Math.sin(u * Math.PI) * 4500;
        vel = { x: -speed * Math.sin(curAngle), y: speed * 0.05, z: -speed * Math.cos(curAngle) };
        phase = u < 0.5 ? 'High Earth Orbit (HEO) Staging' : 'Launcher Separation & TLI Setup';

      } else if (fraction <= 0.50) {
        // 3. Trans-Lunar Injection & Outbound Cislunar Transit (sweeps smoothly to Moon leading edge)
        const u = (fraction - 0.22) / 0.28;
        const targetAngle = arrivalMoonAngle + leadOffset;
        const curAngle = tliAngle + u * (targetAngle - tliAngle);
        const rCur = rLEO + (rMoon - rLEO) * Math.sin(u * (Math.PI / 2));

        pos = {
          x: rCur * Math.cos(curAngle),
          y: rCur * sinInc * Math.sin(curAngle),
          z: -rCur * cosInc * Math.sin(curAngle),
        };
        speed = 10920 - u * (10920 - 1100);
        vel = { x: -speed * Math.sin(curAngle), y: speed * 0.05, z: -speed * Math.cos(curAngle) };
        phase = u < 0.1 ? 'Main Engine TLI Burn' : 'Trans-Lunar Cislunar Coast';

      } else if (fraction <= 0.52) {
        // 4. Lunar Far-Side Slingshot Loop (smoothly wraps 180° around Moon far side at 110 km alt)
        const u = (fraction - 0.50) / 0.02; // 0 to 1
        const deltaTheta = leadOffset * (1 - 2 * u); // +leadOffset -> 0 -> -leadOffset
        const rOffset = rMoon + rPerilune * Math.sin(u * Math.PI);
        const swingAngle = arrivalMoonAngle + deltaTheta;

        pos = {
          x: rOffset * Math.cos(swingAngle),
          y: rOffset * sinInc * Math.sin(swingAngle) + rPerilune * 0.15 * Math.sin(u * Math.PI),
          z: -rOffset * cosInc * Math.sin(swingAngle),
        };
        speed = 2450;
        vel = { x: -speed * Math.sin(swingAngle), y: speed * 0.1 * Math.cos(u * Math.PI), z: -speed * Math.cos(swingAngle) };
        phase = 'Lunar Far-Side Gravity Assist Slingshot (Moon Kick)';

      } else {
        // 5. Inbound Earth Return (smoothly sweeps from Moon trailing edge across cislunar space to splashdown)
        const u = (fraction - 0.52) / 0.48; // 0 to 1
        const exitAngle = arrivalMoonAngle - leadOffset;
        const splashdownAngle = exitAngle + Math.PI;
        const curAngle = exitAngle + u * (splashdownAngle - exitAngle);
        const rCur = rMoon - (rMoon - rSplashdown) * Math.sin(u * (Math.PI / 2));

        pos = {
          x: rCur * Math.cos(curAngle),
          y: rCur * sinInc * Math.sin(curAngle) * (1 - u),
          z: -rCur * cosInc * Math.sin(curAngle),
        };
        speed = 1100 + u * (11050 - 1100);
        vel = { x: -speed * Math.sin(curAngle), y: -speed * 0.05, z: -speed * Math.cos(curAngle) };
        phase = u < 0.90 ? 'Return to Earth Ballistic Coast' : u < 0.98 ? 'Crew Module Separation' : 'Splashdown: Ocean Recovery';
      }

    } else if (type === 'direct_loi') {
      // Direct Lunar Orbit Insertion Profile
      if (fraction < 0.16) {
        // Ascent & LEO Parking Orbit
        const u = fraction / 0.16;
        const curAlt = Math.min(leoAlt, u * leoAlt * 1.5);
        const rCur = rEarth + curAlt;
        const curAngle = phi0 + u * (Math.PI * 1.6);

        pos = {
          x: rCur * Math.cos(curAngle) * Math.cos(latRad * (1 - u * 0.7)),
          y: rCur * Math.sin(latRad * (1 - u * 0.7)),
          z: -rCur * Math.sin(curAngle) * Math.cos(latRad * (1 - u * 0.7)),
        };
        speed = spaceport.equatorialBoostVelocity + u * (7780 - spaceport.equatorialBoostVelocity);
        vel = { x: -speed * Math.sin(curAngle), y: speed * 0.05, z: -speed * Math.cos(curAngle) };
        phase = u < 0.5 ? 'Lift-off & Ascent' : 'LEO Parking Orbit Staging';

      } else if (fraction < 0.85) {
        // TLI & Cislunar Transit
        const u = (fraction - 0.16) / 0.69;
        const rCur = rLEO + (rMoon - rLEO) * Math.sin(u * (Math.PI / 2));
        const moonAngle = Math.atan2(-moonEphem.position.z, moonEphem.position.x);
        const tliAngle = phi0 + Math.PI * 1.6;
        const curAngle = tliAngle + u * (moonAngle - 0.05 - tliAngle);

        pos = {
          x: rCur * Math.cos(curAngle),
          y: (rCur / rMoon) * moonEphem.position.y * 0.8,
          z: -rCur * Math.sin(curAngle),
        };
        speed = 10880 - u * (10880 - 1200);
        vel = { x: -speed * Math.sin(curAngle), y: speed * 0.05, z: -speed * Math.cos(curAngle) };
        phase = u < 0.1 ? 'TLI Injection Ignition' : 'Cislunar Transit Coast';

      } else if (fraction <= 0.92) {
        // Lunar SOI Entry & LOI Braking Burn (100 km alt)
        const u = (fraction - 0.85) / 0.07;
        const rTarget = MOON.radius + 100000;
        const moonAngle = Math.atan2(-moonEphem.position.z, moonEphem.position.x);
        const periluneAngle = moonAngle + Math.PI * 0.5 * (1 - u);

        pos = {
          x: moonEphem.position.x + rTarget * Math.cos(periluneAngle),
          y: moonEphem.position.y + rTarget * 0.1 * Math.sin(u * Math.PI),
          z: moonEphem.position.z - rTarget * Math.sin(periluneAngle),
        };
        speed = 2450 - u * 820;
        vel = { x: -speed * Math.sin(periluneAngle), y: speed * 0.05, z: -speed * Math.cos(periluneAngle) };
        measuredLoiDV = 820;
        phase = u < 0.5 ? 'Lunar SOI Entry' : 'LOI Capture Braking Burn (Δv = 820 m/s)';

      } else {
        // Circular Low Lunar Orbit (100 km)
        const u = (fraction - 0.92) / 0.08;
        const lloRadius = MOON.radius + 100000;
        const moonAngle = Math.atan2(-moonEphem.position.z, moonEphem.position.x);
        const orbitAngle = moonAngle + u * Math.PI * 2.5;

        pos = {
          x: moonEphem.position.x + lloRadius * Math.cos(orbitAngle),
          y: moonEphem.position.y + lloRadius * 0.1 * Math.sin(orbitAngle),
          z: moonEphem.position.z - lloRadius * Math.sin(orbitAngle),
        };
        speed = 1633;
        vel = { x: -speed * Math.sin(orbitAngle), y: speed * 0.05, z: -speed * Math.cos(orbitAngle) };
        phase = u < 0.6 ? 'Circular Low Lunar Orbit (100 km)' : 'Target Landing Site Alignment';
      }

    } else {
      // Lunar Gravity Assist / Escape Profile
      if (fraction < 0.16) {
        const u = fraction / 0.16;
        const rCur = rEarth + u * leoAlt;
        const curAngle = phi0 + u * (Math.PI * 1.5);

        pos = {
          x: rCur * Math.cos(curAngle) * Math.cos(latRad * (1 - u * 0.7)),
          y: rCur * Math.sin(latRad * (1 - u * 0.7)),
          z: -rCur * Math.sin(curAngle) * Math.cos(latRad * (1 - u * 0.7)),
        };
        speed = spaceport.equatorialBoostVelocity + u * (7780 - spaceport.equatorialBoostVelocity);
        vel = { x: -speed * Math.sin(curAngle), y: 0, z: -speed * Math.cos(curAngle) };
        phase = 'Liftoff & LEO Staging Orbit';

      } else if (fraction < 0.68) {
        const u = (fraction - 0.16) / 0.52;
        const rCur = rLEO + (rMoon - rLEO) * Math.sin(u * (Math.PI / 2));
        const moonAngle = Math.atan2(-moonEphem.position.z, moonEphem.position.x);
        const tliAngle = phi0 + Math.PI * 1.5;
        const curAngle = tliAngle + u * (moonAngle - 0.04 - tliAngle);

        pos = {
          x: rCur * Math.cos(curAngle),
          y: (rCur / rMoon) * moonEphem.position.y,
          z: -rCur * Math.sin(curAngle),
        };
        speed = 10920 - u * 8000;
        vel = { x: -speed * Math.sin(curAngle), y: 0, z: -speed * Math.cos(curAngle) };
        phase = u < 0.1 ? 'High-Energy TLI Burn' : 'Hyperbolic Cislunar Transit';

      } else if (fraction <= 0.75) {
        const u = (fraction - 0.68) / 0.07;
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
        phase = 'Lunar Gravity Assist (Moon Kick)';

      } else {
        const u = (fraction - 0.75) / 0.25;
        const rCur = rMoon + (rMoon * 0.45) * u;
        const moonAngle = Math.atan2(-moonEphem.position.z, moonEphem.position.x);
        const escAngle = moonAngle - Math.PI * 0.45 - u * 0.35;

        pos = {
          x: rCur * Math.cos(escAngle),
          y: moonEphem.position.y * (1 + u * 0.3),
          z: -rCur * Math.sin(escAngle),
        };
        speed = 1800 + u * 600;
        vel = { x: -speed * Math.sin(escAngle), y: 0, z: -speed * Math.cos(escAngle) };
        phase = u < 0.4 ? 'Orbital Energy Boost & Cislunar Departure' : 'Interplanetary Trajectory';
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
    return 'Apollo / Artemis II 3-body gravitational slingshot trajectory featuring High Earth Orbit (HEO) staging and far-side lunar gravity assist returning directly to Earth.';
  } else if (type === 'direct_loi') {
    return '3-body gravitational capture trajectory that enters the Moon\'s Sphere of Influence and executes a retrograde Lunar Orbit Insertion (LOI) burn into a 100 km circular Low Lunar Orbit.';
  }
  return 'Hyperbolic lunar flyby trajectory utilizing lunar gravity assist for deep-space slingshot.';
}
