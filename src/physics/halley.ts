import { EARTH, SUN } from './constants.ts';
import { calculateKeplerianOrbit } from './orbitalMechanics.ts';

const radians = Math.PI / 180;
const semiMajorAxis = 17.834 * EARTH.semiMajorAxis;
const eccentricity = 0.96714;
export const HALLEY_PERIOD_SECONDS = 2 * Math.PI * Math.sqrt(semiMajorAxis ** 3 / SUN.mu);
export const HALLEY_PERIHELION_SECONDS =
  (Date.UTC(2061, 6, 28) - Date.UTC(2000, 0, 1, 12)) / 1000;

export function calculateHalleyOrbit(timeSeconds: number) {
  // Fixed, approximate orbital elements for 1P/Halley, phased to the 2061 return.
  return calculateKeplerianOrbit(
    semiMajorAxis, eccentricity, HALLEY_PERIOD_SECONDS, 162.26 * radians,
    timeSeconds - HALLEY_PERIHELION_SECONDS, 0, SUN.mu, 111.33 * radians, 58.42 * radians,
  );
}

export function getHalleyActivity(distanceAu: number) {
  // A gradual visual approximation of increasing activity with solar heating.
  const t = Math.min(1, Math.max(0, (3 - distanceAu) / (3 - 0.6)));
  return t * t * (3 - 2 * t);
}
