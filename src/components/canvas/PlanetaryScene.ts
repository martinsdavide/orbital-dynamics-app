import { Vector3 } from 'three';
import { EARTH, MOON, type PlanetConfig } from '../../physics/constants.ts';
import { PLANETARY_MOONS } from '../../physics/planetaryMoons.ts';
import { calculatePlanetOrbit } from '../../physics/orbitalMechanics.ts';
import type { ReferenceFrame, ScaleMode, Vector3D } from '../../types/celestial.ts';

export function projectPlanet(position: Vector3D, planet: PlanetConfig, scaleMode: ScaleMode, sunEarthDistance: number): Vector3 {
  const scale = scaleMode === 'true'
    ? sunEarthDistance / EARTH.semiMajorAxis
    : planet.visualDistance / planet.semiMajorAxis;
  return new Vector3(position.x, position.y, position.z).multiplyScalar(scale);
}

export function samplePlanetOrbit(planet: PlanetConfig, scaleMode: ScaleMode, sunEarthDistance: number): Vector3[] {
  const segments = 256;
  return Array.from({ length: segments + 1 }, (_, index) => {
    const time = index / segments * planet.orbitalPeriod;
    return projectPlanet(calculatePlanetOrbit(planet, time).position, planet, scaleMode, sunEarthDistance);
  });
}

export function getSolarSystemOffset(frame: ReferenceFrame, earth: Vector3, moonRelativeToEarth: Vector3): Vector3 {
  if (frame === 'heliocentric') return new Vector3();
  const offset = earth.clone().negate();
  if (frame === 'barycentric') {
    offset.addScaledVector(moonRelativeToEarth, -MOON.mass / (EARTH.mass + MOON.mass));
  }
  return offset;
}

export function getPlanetDisplayRadius(planet: PlanetConfig, scaleMode: ScaleMode): number {
  return scaleMode === 'true' ? 3 * planet.radius / EARTH.radius : planet.visualRadius;
}

export function getMoonOrbitScale(host: PlanetConfig, scaleMode: ScaleMode): number {
  const hostScale = getPlanetDisplayRadius(host, scaleMode) / host.radius;
  if (scaleMode === 'true') return hostScale;

  // Compress each moon system uniformly so the outermost orbit fits the overview.
  const outermostOrbit = Math.max(0, ...PLANETARY_MOONS
    .filter(moon => moon.host === host.key)
    .map(moon => moon.semiMajorAxis));
  return outermostOrbit > 0 ? Math.min(hostScale, 100 / outermostOrbit) : hostScale;
}
