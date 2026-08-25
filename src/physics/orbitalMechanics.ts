import { SUN, EARTH, MOON, SCALING } from './constants';
import type { Vector3D, CelestialBodyState, LagrangePoint, EphemerisState, ReferenceFrame, ScaleMode } from '../types/celestial';

export function calculateKeplerianOrbit(
  semiMajorAxis: number,
  eccentricity: number,
  orbitalPeriod: number,
  inclinationRad: number,
  timeSeconds: number,
  meanAnomalyOffset: number = 0
): { position: Vector3D; velocity: Vector3D } {
  const meanMotion = (2 * Math.PI) / orbitalPeriod;
  const meanAnomaly = (meanAnomalyOffset + meanMotion * timeSeconds) % (2 * Math.PI);

  let E = meanAnomaly;
  for (let i = 0; i < 6; i++) {
    const dE = (E - eccentricity * Math.sin(E) - meanAnomaly) / (1 - eccentricity * Math.cos(E));
    E -= dE;
    if (Math.abs(dE) < 1e-7) break;
  }

  const sinNu = (Math.sqrt(1 - eccentricity * eccentricity) * Math.sin(E)) / (1 - eccentricity * Math.cos(E));
  const cosNu = (Math.cos(E) - eccentricity) / (1 - eccentricity * Math.cos(E));
  const nu = Math.atan2(sinNu, cosNu);

  const r = semiMajorAxis * (1 - eccentricity * Math.cos(E));

  const xOrb = r * Math.cos(nu);
  const yOrb = r * Math.sin(nu);

  const x = xOrb;
  const y = yOrb * Math.cos(inclinationRad);
  const z = yOrb * Math.sin(inclinationRad);

  const vMag = Math.sqrt(EARTH.mu * (2 / r - 1 / semiMajorAxis));
  const vx = -vMag * Math.sin(nu);
  const vy = vMag * (eccentricity + Math.cos(nu)) * Math.cos(inclinationRad);
  const vz = vMag * (eccentricity + Math.cos(nu)) * Math.sin(inclinationRad);

  return {
    position: { x, y, z },
    velocity: { x: vx, y: vy, z: vz },
  };
}

export function getEphemerisState(timeSeconds: number): EphemerisState {
  const earthOrbit = calculateKeplerianOrbit(
    EARTH.semiMajorAxis,
    EARTH.eccentricity,
    EARTH.orbitalPeriod,
    0,
    timeSeconds,
    0.0
  );

  const earthRotation = (timeSeconds / EARTH.rotationPeriod) * (2 * Math.PI);

  const nodalPrecessionRate = -(2 * Math.PI) / (18.6 * 365.25 * 86400);
  const nodalAngle = nodalPrecessionRate * timeSeconds;

  const moonOrbitRel = calculateKeplerianOrbit(
    MOON.semiMajorAxis,
    MOON.eccentricity,
    MOON.orbitalPeriod,
    MOON.inclinationToEcliptic,
    timeSeconds,
    0.5
  );

  const cosNode = Math.cos(nodalAngle);
  const sinNode = Math.sin(nodalAngle);
  const moonX = moonOrbitRel.position.x * cosNode - moonOrbitRel.position.y * sinNode;
  const moonY = moonOrbitRel.position.x * sinNode + moonOrbitRel.position.y * cosNode;
  const moonZ = moonOrbitRel.position.z;

  const moonPosRelEarth: Vector3D = { x: moonX, y: moonY, z: moonZ };

  const sunState: CelestialBodyState = {
    name: 'Sun',
    position: { x: 0, y: 0, z: 0 },
    velocity: { x: 0, y: 0, z: 0 },
    radius: SUN.radius,
    mass: SUN.mass,
    rotationAngle: (timeSeconds / (25.38 * 86400)) * (2 * Math.PI),
  };

  const earthState: CelestialBodyState = {
    name: 'Earth',
    position: earthOrbit.position,
    velocity: earthOrbit.velocity,
    radius: EARTH.radius,
    mass: EARTH.mass,
    rotationAngle: earthRotation,
  };

  const moonState: CelestialBodyState = {
    name: 'Moon',
    position: {
      x: earthOrbit.position.x + moonPosRelEarth.x,
      y: earthOrbit.position.y + moonPosRelEarth.y,
      z: earthOrbit.position.z + moonPosRelEarth.z,
    },
    velocity: {
      x: earthOrbit.velocity.x + moonOrbitRel.velocity.x,
      y: earthOrbit.velocity.y + moonOrbitRel.velocity.y,
      z: earthOrbit.velocity.z + moonOrbitRel.velocity.z,
    },
    radius: MOON.radius,
    mass: MOON.mass,
    rotationAngle: (timeSeconds / MOON.orbitalPeriod) * (2 * Math.PI),
  };

  const muEM = MOON.mass / (EARTH.mass + MOON.mass);
  const gamma = Math.pow(muEM / 3, 1 / 3);

  const emDir = normalize(moonPosRelEarth);
  const emDist = magnitude(moonPosRelEarth);

  const emNormal = { x: 0, y: 0, z: 1 };
  const emTransverse = crossProduct(emNormal, emDir);

  const rL1 = emDist * (1 - gamma);
  const posL1: Vector3D = {
    x: emDir.x * rL1,
    y: emDir.y * rL1,
    z: emDir.z * rL1,
  };

  const rL2 = emDist * (1 + gamma);
  const posL2: Vector3D = {
    x: emDir.x * rL2,
    y: emDir.y * rL2,
    z: emDir.z * rL2,
  };

  const rL3 = emDist * (1 + (5 / 12) * muEM);
  const posL3: Vector3D = {
    x: -emDir.x * rL3,
    y: -emDir.y * rL3,
    z: -emDir.z * rL3,
  };

  const cos60 = Math.cos(Math.PI / 3);
  const sin60 = Math.sin(Math.PI / 3);
  const posL4: Vector3D = {
    x: emDist * (emDir.x * cos60 - emTransverse.x * sin60),
    y: emDist * (emDir.y * cos60 - emTransverse.y * sin60),
    z: emDist * (emDir.z * cos60 - emTransverse.z * sin60),
  };

  const posL5: Vector3D = {
    x: emDist * (emDir.x * cos60 + emTransverse.x * sin60),
    y: emDist * (emDir.y * cos60 + emTransverse.y * sin60),
    z: emDist * (emDir.z * cos60 + emTransverse.z * sin60),
  };

  const lagrangePoints: LagrangePoint[] = [
    { name: 'L1', description: 'Inter-body equilibrium point (cislunar gateway)', position: posL1, system: 'Earth-Moon', isStable: false },
    { name: 'L2', description: 'Lunar farside balance point (farside comms)', position: posL2, system: 'Earth-Moon', isStable: false },
    { name: 'L3', description: 'Anti-Earth equilibrium point', position: posL3, system: 'Earth-Moon', isStable: false },
    { name: 'L4', description: 'Leading Trojan equilibrium point', position: posL4, system: 'Earth-Moon', isStable: true },
    { name: 'L5', description: 'Trailing Trojan equilibrium point', position: posL5, system: 'Earth-Moon', isStable: true },
  ];

  const sunToEarth = normalize(earthState.position);
  const earthToMoon = normalize(moonPosRelEarth);
  const alignmentDot = dotProduct(sunToEarth, earthToMoon);

  let eclipseStatus: 'none' | 'solar_eclipse' | 'lunar_eclipse' = 'none';
  if (Math.abs(moonPosRelEarth.z) < (EARTH.radius + MOON.radius) * 2) {
    if (alignmentDot < -0.998) {
      eclipseStatus = 'solar_eclipse';
    } else if (alignmentDot > 0.998) {
      eclipseStatus = 'lunar_eclipse';
    }
  }

  const moonPhaseAngle = Math.acos(Math.max(-1, Math.min(1, dotProduct(normalize({ x: -earthState.position.x, y: -earthState.position.y, z: -earthState.position.z }), earthToMoon))));

  return {
    timeSeconds,
    sun: sunState,
    earth: earthState,
    moon: moonState,
    lagrangePoints,
    earthPhaseAngle: (timeSeconds / EARTH.orbitalPeriod) * 360,
    moonPhaseAngle: (moonPhaseAngle * 180) / Math.PI,
    eclipseStatus,
  };
}

export function transformToSceneCoordinates(
  posMeters: Vector3D,
  referenceFrame: ReferenceFrame,
  scaleMode: ScaleMode,
  ephemeris: EphemerisState
): Vector3D {
  let relPos = { ...posMeters };

  if (referenceFrame === 'geocentric') {
    relPos = {
      x: posMeters.x - ephemeris.earth.position.x,
      y: posMeters.y - ephemeris.earth.position.y,
      z: posMeters.z - ephemeris.earth.position.z,
    };
  }

  if (scaleMode === 'visual') {
    if (referenceFrame === 'heliocentric') {
      const distFromSun = magnitude(relPos);
      const scaledDist = (distFromSun / EARTH.semiMajorAxis) * SCALING.visual.sunEarthDistance;
      const dir = normalize(relPos);
      return {
        x: dir.x * scaledDist,
        y: dir.y * scaledDist,
        z: dir.z * scaledDist,
      };
    } else {
      const distFromCenter = magnitude(relPos);
      const scaledDist = (distFromCenter / MOON.semiMajorAxis) * SCALING.visual.earthMoonDistance;
      const dir = normalize(relPos);
      return {
        x: dir.x * scaledDist,
        y: dir.y * scaledDist,
        z: dir.z * scaledDist,
      };
    }
  } else {
    const scaleFactor = 1 / EARTH.radius;
    return {
      x: relPos.x * scaleFactor,
      y: relPos.y * scaleFactor,
      z: relPos.z * scaleFactor,
    };
  }
}

export function magnitude(v: Vector3D): number {
  return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
}

export function normalize(v: Vector3D): Vector3D {
  const m = magnitude(v);
  if (m === 0) return { x: 0, y: 0, z: 0 };
  return { x: v.x / m, y: v.y / m, z: v.z / m };
}

export function dotProduct(a: Vector3D, b: Vector3D): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

export function crossProduct(a: Vector3D, b: Vector3D): Vector3D {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}
