import { SUN, EARTH, MOON, SCALING, PLANET_CONFIGS } from './constants.ts';
import type { Vector3D, CelestialBodyState, PlanetState, LagrangePoint, EphemerisState, ReferenceFrame, ScaleMode } from '../types/celestial.ts';

export function calculateKeplerianOrbit(
  semiMajorAxis: number,
  eccentricity: number,
  orbitalPeriod: number,
  inclinationRad: number,
  timeSeconds: number,
  meanAnomalyOffset: number = 0,
  centralMu: number = EARTH.mu
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

  // Authoritative convention: XZ = Ecliptic plane, +Y = Ecliptic North, Ascending node on +X
  const cosInc = Math.cos(inclinationRad);
  const sinInc = Math.sin(inclinationRad);

  const x = r * Math.cos(nu);
  const y = r * sinInc * Math.sin(nu);
  const z = -r * cosInc * Math.sin(nu);

  const p = Math.max(1e3, semiMajorAxis * (1 - eccentricity * eccentricity));
  const vxOrb = -Math.sqrt(centralMu / p) * Math.sin(nu);
  const vtransOrb = Math.sqrt(centralMu / p) * (eccentricity + Math.cos(nu));

  const vx = vxOrb;
  const vy = sinInc * vtransOrb;
  const vz = -cosInc * vtransOrb;

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
    0.0,
    SUN.mu
  );

  const earthRotation = (timeSeconds / EARTH.rotationPeriod) * (2 * Math.PI);

  // Reconciled with getMoonEphemeris convention: circular baseline in XZ, tilted to +Y
  const moonOrbitRel = calculateKeplerianOrbit(
    MOON.semiMajorAxis,
    0,
    MOON.orbitalPeriod,
    MOON.inclinationToEcliptic,
    timeSeconds,
    0.0,
    EARTH.mu
  );

  const moonPosRelEarth: Vector3D = moonOrbitRel.position;

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

  // Normal to Moon orbital plane in 3D: n = cross(r, v)
  const emNormal = normalize(crossProduct(moonOrbitRel.position, moonOrbitRel.velocity));
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

  const planets: PlanetState[] = PLANET_CONFIGS.map((cfg) => {
    if (cfg.key === 'earth') {
      const distFromSun = magnitude(earthState.position);
      return {
        name: cfg.name,
        key: 'earth',
        position: earthState.position,
        velocity: earthState.velocity,
        radius: cfg.radius,
        mass: cfg.mass,
        rotationAngle: earthState.rotationAngle,
        semiMajorAxis: cfg.semiMajorAxis,
        eccentricity: cfg.eccentricity,
        orbitalPeriod: cfg.orbitalPeriod,
        inclinationDeg: cfg.inclinationDeg,
        axialTiltDeg: cfg.axialTiltDeg,
        colorHex: cfg.colorHex,
        colorNumber: cfg.color,
        distanceFromSunMeters: distFromSun,
        distanceFromEarthMeters: 0,
      };
    }

    const orbit = calculateKeplerianOrbit(
      cfg.semiMajorAxis,
      cfg.eccentricity,
      cfg.orbitalPeriod,
      cfg.inclinationToEclipticRad,
      timeSeconds,
      cfg.meanAnomalyJ2000Rad ?? 0,
      SUN.mu
    );

    const rotationAngle = (timeSeconds / cfg.rotationPeriod) * (2 * Math.PI);
    const distFromSun = magnitude(orbit.position);
    const dx = orbit.position.x - earthState.position.x;
    const dy = orbit.position.y - earthState.position.y;
    const dz = orbit.position.z - earthState.position.z;
    const distFromEarth = Math.sqrt(dx * dx + dy * dy + dz * dz);

    return {
      name: cfg.name,
      key: cfg.key,
      position: orbit.position,
      velocity: orbit.velocity,
      radius: cfg.radius,
      mass: cfg.mass,
      rotationAngle,
      semiMajorAxis: cfg.semiMajorAxis,
      eccentricity: cfg.eccentricity,
      orbitalPeriod: cfg.orbitalPeriod,
      inclinationDeg: cfg.inclinationDeg,
      axialTiltDeg: cfg.axialTiltDeg,
      colorHex: cfg.colorHex,
      colorNumber: cfg.color,
      distanceFromSunMeters: distFromSun,
      distanceFromEarthMeters: distFromEarth,
    };
  });

  return {
    timeSeconds,
    sun: sunState,
    earth: earthState,
    moon: moonState,
    planets,
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
