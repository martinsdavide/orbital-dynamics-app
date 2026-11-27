import { SUN, EARTH, MOON, SCALING, PLANET_CONFIGS, DWARF_PLANET_CONFIGS, type PlanetConfig } from './constants.ts';
import type { Vector3D, CelestialBodyState, PlanetState, LagrangePoint, EphemerisState, ReferenceFrame, ScaleMode } from '../types/celestial.ts';

export function calculateKeplerianOrbit(
  semiMajorAxis: number,
  eccentricity: number,
  orbitalPeriod: number,
  inclinationRad: number,
  timeSeconds: number,
  meanAnomalyOffset: number = 0,
  centralMu: number = EARTH.mu,
  argumentOfPerihelion = 0,
  ascendingNode = 0
): { position: Vector3D; velocity: Vector3D } {
  const meanMotion = (2 * Math.PI) / orbitalPeriod;
  let meanAnomaly = (meanAnomalyOffset + meanMotion * timeSeconds) % (2 * Math.PI);
  let E = meanAnomaly;
  let iterationLimit = 6;
  if (eccentricity > 0.8) {
    // Start highly eccentric orbits on the same side of periapsis as the solution.
    if (meanAnomaly > Math.PI) meanAnomaly -= 2 * Math.PI;
    if (meanAnomaly < -Math.PI) meanAnomaly += 2 * Math.PI;
    E = Math.sign(meanAnomaly) * Math.PI;
    iterationLimit = 20;
  }
  for (let i = 0; i < iterationLimit; i++) {
    const dE = (E - eccentricity * Math.sin(E) - meanAnomaly) / (1 - eccentricity * Math.cos(E));
    E -= dE;
    if (Math.abs(dE) < 1e-7) break;
  }

  const sinNu = (Math.sqrt(1 - eccentricity * eccentricity) * Math.sin(E)) / (1 - eccentricity * Math.cos(E));
  const cosNu = (Math.cos(E) - eccentricity) / (1 - eccentricity * Math.cos(E));
  const nu = Math.atan2(sinNu, cosNu);

  const r = semiMajorAxis * (1 - eccentricity * Math.cos(E));

  // The scene uses XZ for the ecliptic and +Y for ecliptic north.
  const cosInc = Math.cos(inclinationRad);
  const sinInc = Math.sin(inclinationRad);
  const cosNode = Math.cos(ascendingNode);
  const sinNode = Math.sin(ascendingNode);
  const orient = (alongNode: number, acrossNode: number): Vector3D => ({
    x: alongNode * cosNode - acrossNode * cosInc * sinNode,
    y: acrossNode * sinInc,
    z: -alongNode * sinNode - acrossNode * cosInc * cosNode,
  });
  const argumentOfLatitude = nu + argumentOfPerihelion;
  const p = Math.max(1e3, semiMajorAxis * (1 - eccentricity * eccentricity));
  const velocityScale = Math.sqrt(centralMu / p);
  const alongNode = velocityScale * (-Math.sin(argumentOfLatitude) - eccentricity * Math.sin(argumentOfPerihelion));
  const acrossNode = velocityScale * (Math.cos(argumentOfLatitude) + eccentricity * Math.cos(argumentOfPerihelion));

  return {
    position: orient(r * Math.cos(argumentOfLatitude), r * Math.sin(argumentOfLatitude)),
    velocity: orient(alongNode, acrossNode),
  };
}

export function calculatePlanetOrbit(planet: PlanetConfig, timeSeconds: number) {
  return calculateKeplerianOrbit(
    planet.semiMajorAxis, planet.eccentricity, planet.orbitalPeriod,
    planet.inclinationToEclipticRad, timeSeconds, planet.meanAnomalyJ2000Rad ?? 0, SUN.mu,
    planet.argumentOfPerihelionRad, planet.ascendingNodeRad
  );
}

export const EARTH_ORBIT = PLANET_CONFIGS.find(planet => planet.key === 'earth')!;

export const LAGRANGE_POINT_NAMES = ['L1', 'L2', 'L3', 'L4', 'L5'] as const;

// Solve the collinear equilibria of the circular restricted three-body model.
// The coordinate is in units of the pair's separation, measured from the primary.
function collinearLagrangeFractions(primaryMass: number, secondaryMass: number) {
  const mu = secondaryMass / (primaryMass + secondaryMass);
  const force = (x: number) =>
    x - mu - (1 - mu) * x / Math.abs(x) ** 3 - mu * (x - 1) / Math.abs(x - 1) ** 3;
  const epsilon = 1e-6;
  return [[epsilon, 1 - epsilon], [1 + epsilon, 3], [-3, -epsilon]].map(([low, high]) => {
    for (let i = 0; i < 55; i++) {
      const middle = (low + high) / 2;
      if (force(middle) < 0) low = middle;
      else high = middle;
    }
    return [(low + high) / 2, 0] as const;
  });
}

const LAGRANGE_POSITIONS = {
  'Earth-Moon': collinearLagrangeFractions(EARTH.mass, MOON.mass),
  'Sun-Earth': collinearLagrangeFractions(SUN.mass, EARTH.mass),
};

export function lagrangeFractions(system: LagrangePoint['system']) {
  return [...LAGRANGE_POSITIONS[system], [0.5, Math.sqrt(3) / 2], [0.5, -Math.sqrt(3) / 2]] as const;
}

const LAGRANGE_DESCRIPTIONS = [
  'Between the two bodies', 'Beyond the secondary', 'Beyond the primary',
  'Leading triangular equilibrium point', 'Trailing triangular equilibrium point',
];

function getLagrangePoints(relativePosition: Vector3D, relativeVelocity: Vector3D, system: LagrangePoint['system']): LagrangePoint[] {
  const separation = magnitude(relativePosition);
  const radial = normalize(relativePosition);
  const orbitalPole = normalize(crossProduct(relativePosition, relativeVelocity));
  const transverse = crossProduct(orbitalPole, radial);
  const fractions = lagrangeFractions(system);

  return LAGRANGE_POINT_NAMES.map((name, index) => {
    const [x, y] = fractions[index];
    return {
      name, system, description: LAGRANGE_DESCRIPTIONS[index], isStable: index >= 3,
      position: {
        x: separation * (radial.x * x + transverse.x * y),
        y: separation * (radial.y * x + transverse.y * y),
        z: separation * (radial.z * x + transverse.z * y),
      },
    };
  });
}

export function getEphemerisState(timeSeconds: number): EphemerisState {
  const earthOrbit = calculatePlanetOrbit(EARTH_ORBIT, timeSeconds);

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

  const lagrangePoints = [
    ...getLagrangePoints(moonPosRelEarth, moonOrbitRel.velocity, 'Earth-Moon'),
    ...getLagrangePoints(earthOrbit.position, earthOrbit.velocity, 'Sun-Earth'),
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

  const toPlanetState = (cfg: PlanetConfig): PlanetState => {
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

    const orbit = calculatePlanetOrbit(cfg, timeSeconds);

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
  };

  return {
    timeSeconds,
    sun: sunState,
    earth: earthState,
    moon: moonState,
    planets: PLANET_CONFIGS.map(toPlanetState),
    dwarfPlanets: DWARF_PLANET_CONFIGS.map(toPlanetState),
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

  if (referenceFrame !== 'heliocentric') {
    const earth = ephemeris.earth.position;
    const moon = ephemeris.moon.position;
    const moonFraction = referenceFrame === 'barycentric' ? MOON.mass / (EARTH.mass + MOON.mass) : 0;
    relPos = {
      x: posMeters.x - earth.x - (moon.x - earth.x) * moonFraction,
      y: posMeters.y - earth.y - (moon.y - earth.y) * moonFraction,
      z: posMeters.z - earth.z - (moon.z - earth.z) * moonFraction,
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
