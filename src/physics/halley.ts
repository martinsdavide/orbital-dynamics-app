import { EARTH, SUN, PLANET_CONFIGS } from './constants.ts';
import { calculateKeplerianOrbit } from './orbitalMechanics.ts';

const radians = Math.PI / 180;
const semiMajorAxis = 17.834 * EARTH.semiMajorAxis;
const eccentricity = 0.96714;
export const HALLEY_PERIOD_SECONDS = 2 * Math.PI * Math.sqrt(semiMajorAxis ** 3 / SUN.mu);
export const HALLEY_PERIHELION_SECONDS =
  (Date.UTC(2061, 6, 28) - Date.UTC(2000, 0, 1, 12)) / 1000;

// Use Saturn’s mean orbital radius and the inbound branch of Halley’s orbit.
const saturnOrbit = PLANET_CONFIGS.find(planet => planet.key === 'saturn')!;
function halleyTimeFromPerihelionAtDistance(distance: number) {
  const anomaly = Math.acos((1 - distance / semiMajorAxis) / eccentricity);
  return (anomaly - eccentricity * Math.sin(anomaly)) * HALLEY_PERIOD_SECONDS / (2 * Math.PI);
}

export const HALLEY_SATURN_DISTANCE_SECONDS =
  HALLEY_PERIHELION_SECONDS - halleyTimeFromPerihelionAtDistance(saturnOrbit.semiMajorAxis);
export const HALLEY_ACTIVITY_APPROACH_SECONDS =
  HALLEY_PERIHELION_SECONDS - halleyTimeFromPerihelionAtDistance(3 * EARTH.semiMajorAxis);
export const HALLEY_OUTBOUND_LAB_SECONDS =
  HALLEY_PERIHELION_SECONDS + halleyTimeFromPerihelionAtDistance(1.2 * EARTH.semiMajorAxis);

export function halleyLabTime(stop: 0 | 1 | 2, progress: number) {
  const interpolate = (start: number, end: number, fraction: number) => start + (end - start) * fraction;
  if (stop === 0) return HALLEY_SATURN_DISTANCE_SECONDS;
  if (stop === 2) return interpolate(HALLEY_PERIHELION_SECONDS, HALLEY_OUTBOUND_LAB_SECONDS, progress);
  // Give the approach inside 3 AU enough screen time to see the tails grow.
  return progress < 0.45
    ? interpolate(HALLEY_SATURN_DISTANCE_SECONDS, HALLEY_ACTIVITY_APPROACH_SECONDS, progress / 0.45)
    : interpolate(HALLEY_ACTIVITY_APPROACH_SECONDS, HALLEY_PERIHELION_SECONDS, (progress - 0.45) / 0.55);
}

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
