import { Vector3 } from 'three';
import { EARTH, SUN } from './constants.ts';

export const AU_METERS = EARTH.semiMajorAxis;
export const SECONDS_PER_DAY = 86_400;
const MS_PER_DAY = SECONDS_PER_DAY * 1000;
const J2000_MS = Date.UTC(2000, 0, 1, 12);
const DEGREES = Math.PI / 180;
const MARS_MU = 4.282837e13;
const MARS_RADIUS = 3_389_500;

export const DEFAULT_MARS_DEPARTURE = '2028-12-01';
export const DEFAULT_MARS_ARRIVAL = '2029-08-20';

export type MarsTransferBody = 'earth' | 'mars';

// JPL's approximate mean elements and rates per Julian century, valid for 1800–2050.
const ELEMENTS = {
  earth: [
    [1.00000261, 0.00000562], [0.01671123, -0.00004392], [-0.00001531, -0.01294668],
    [100.46457166, 35999.37244981], [102.93768193, 0.32327364], [0, 0],
  ],
  mars: [
    [1.52371034, 0.00001847], [0.09339410, 0.00007882], [1.84969142, -0.00813131],
    [-4.55343205, 19140.30268499], [-23.94362959, 0.44441088], [49.55953891, -0.29257343],
  ],
} as const;

export function getMarsMissionPlanetPosition(body: MarsTransferBody, epochMs: number): Vector3 {
  const centuries = (epochMs - J2000_MS) / (36_525 * MS_PER_DAY);
  const [axis, eccentricity, inc, meanLongitude, perihelionLongitude, ascendingNode] =
    ELEMENTS[body].map(([base, rate]) => base + rate * centuries);

  const meanAnomaly = ((meanLongitude - perihelionLongitude) % 360) * DEGREES;
  let anomaly = meanAnomaly;
  for (let i = 0; i < 8; i++) {
    anomaly -= (anomaly - eccentricity * Math.sin(anomaly) - meanAnomaly) /
      (1 - eccentricity * Math.cos(anomaly));
  }

  const a = axis * AU_METERS;
  const inclination = inc * DEGREES;
  const node = ascendingNode * DEGREES;
  const perihelion = (perihelionLongitude - ascendingNode) * DEGREES;
  const orbitalX = a * (Math.cos(anomaly) - eccentricity);
  const orbitalY = a * Math.sqrt(1 - eccentricity * eccentricity) * Math.sin(anomaly);
  const nodeX = orbitalX * Math.cos(perihelion) - orbitalY * Math.sin(perihelion);
  const nodeY = orbitalX * Math.sin(perihelion) + orbitalY * Math.cos(perihelion);
  // Convert the ecliptic plane to AstroSim's XZ plane with north along +Y.
  return new Vector3(
    nodeX * Math.cos(node) - nodeY * Math.cos(inclination) * Math.sin(node),
    nodeY * Math.sin(inclination),
    -(nodeX * Math.sin(node) + nodeY * Math.cos(inclination) * Math.cos(node)),
  );
}

function planetVelocity(body: MarsTransferBody, epochMs: number) {
  const halfStep = 60;
  return getMarsMissionPlanetPosition(body, epochMs + halfStep * 1000)
    .sub(getMarsMissionPlanetPosition(body, epochMs - halfStep * 1000))
    .multiplyScalar(1 / (2 * halfStep));
}

function stumpff(z: number): [number, number] {
  if (Math.abs(z) < 1e-3) {
    return [1 / 2 - z / 24 + z * z / 720, 1 / 6 - z / 120 + z * z / 5040];
  }
  const root = Math.sqrt(Math.abs(z));
  return z > 0
    ? [(1 - Math.cos(root)) / z, (root - Math.sin(root)) / root ** 3]
    : [(Math.cosh(root) - 1) / -z, (Math.sinh(root) - root) / root ** 3];
}

// One prograde, zero-revolution solution using the universal-variable Lambert formulation.
export function solveProgradeLambert(start: Vector3, end: Vector3, duration: number, mu: number) {
  const length = start.length();
  const speed = Math.sqrt(mu / length);
  const targetDuration = duration * speed / length;
  const r2 = end.length() / length;
  const cosAngle = Math.max(-1, Math.min(1, start.dot(end) / (length * end.length())));
  const angularMomentum = start.clone().cross(end);
  const orientation = angularMomentum.y < 0 ? -1 : 1;
  const a = orientation * Math.sqrt(r2 * (1 + cosAngle));

  if (angularMomentum.length() / (length * end.length()) < 1e-6 || !Number.isFinite(a)) {
    throw new Error('Earth and Mars are nearly collinear on these dates. Try shifting either date.');
  }

  const evaluate = (z: number) => {
    const [c, s] = stumpff(z);
    const y = 1 + r2 + a * (z * s - 1) / Math.sqrt(c);
    const time = y < 0 ? -Infinity : (y / c) ** 1.5 * s + a * Math.sqrt(y);
    return { time, y };
  };

  let low = -1;
  const upperLimit = 4 * Math.PI ** 2 - 1e-3;
  let high = upperLimit;
  while (low > -128 && evaluate(low).time > targetDuration) low *= 2;
  if (evaluate(low).time > targetDuration || evaluate(high).time < targetDuration) {
    throw new Error('No supported prograde transfer for these dates. Try a longer transfer.');
  }

  for (let i = 0; i < 80; i++) {
    const middle = (high + low) / 2;
    if (evaluate(middle).time < targetDuration) low = middle;
    else high = middle;
  }

  const { y } = evaluate((high + low) / 2);
  const f = 1 - y;
  const g = a * Math.sqrt(y) * length / speed;
  const gDot = 1 - y / r2;
  if (!Number.isFinite(g) || Math.abs(g) < 1e-5) {
    throw new Error('The transfer is singular. Try different departure or arrival dates.');
  }

  return {
    departureVelocity: end.clone().addScaledVector(start, -f).multiplyScalar(1 / g),
    arrivalVelocity: end.clone().multiplyScalar(gDot).sub(start).multiplyScalar(1 / g),
  };
}

export interface MarsTransferSample {
  spacecraft: Vector3;
  earth: Vector3;
  mars: Vector3;
}

export interface MarsTransfer {
  departureDate: string;
  arrivalDate: string;
  departureEpoch: number;
  duration: number;
  c3: number;
  marsArrivalSpeed: number;
  samples: MarsTransferSample[];
}

function parseDate(value: string): number {
  const date = new Date(value + 'T00:00:00Z');
  if (!Number.isFinite(date.getTime()) || !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
      date.toISOString().slice(0, 10) !== value || value < '1900-01-01' || value > '2050-01-01') {
    throw new Error('Enter valid UTC dates from 1900 through January 1, 2050.');
  }
  return date.getTime();
}

export function estimateMarsCaptureDeltaV(arrivalSpeed: number, altitudeKm: number): number {
  const periapsisRadius = MARS_RADIUS + altitudeKm * 1000;
  const circularSpeed = Math.sqrt(MARS_MU / periapsisRadius);
  return Math.hypot(arrivalSpeed, Math.SQRT2 * circularSpeed) - circularSpeed;
}

export function solveMarsTransfer(departureDate: string, arrivalDate: string): MarsTransfer {
  const departureEpoch = parseDate(departureDate);
  const arrivalEpoch = parseDate(arrivalDate);
  const duration = (arrivalEpoch - departureEpoch) / 1000;
  if (duration < 30 * SECONDS_PER_DAY || duration > 600 * SECONDS_PER_DAY) {
    throw new Error('Choose an arrival 30 to 600 days after departure.');
  }

  const start = getMarsMissionPlanetPosition('earth', departureEpoch);
  const end = getMarsMissionPlanetPosition('mars', arrivalEpoch);
  const { departureVelocity, arrivalVelocity } = solveProgradeLambert(start, end, duration, SUN.mu);
  const c3 = departureVelocity.clone().sub(planetVelocity('earth', departureEpoch)).lengthSq() / 1e6;
  const marsArrivalSpeed = arrivalVelocity.clone().sub(planetVelocity('mars', arrivalEpoch)).length();

  // Independently propagate the Lambert state with RK4 to draw and validate the trajectory.
  const position = start.clone();
  const velocity = departureVelocity.clone();
  const acceleration = (r: Vector3) => r.clone().multiplyScalar(-SUN.mu / r.length() ** 3);
  const segments = 260;
  const segmentTime = duration / segments;
  const stepsPerSegment = Math.ceil(segmentTime / 7200);
  const step = segmentTime / stepsPerSegment;
  const samples: MarsTransferSample[] = [];
  for (let i = 0; i <= segments; i++) {
    if (!Number.isFinite(position.lengthSq()) || position.length() < 0.1 * AU_METERS) {
      throw new Error('This transfer passes too close to the Sun for this mission model. Try different dates.');
    }
    const epoch = departureEpoch + i * segmentTime * 1000;
    samples.push({
      spacecraft: position.clone(),
      earth: getMarsMissionPlanetPosition('earth', epoch),
      mars: getMarsMissionPlanetPosition('mars', epoch),
    });
    if (i === segments) break;

    for (let j = 0; j < stepsPerSegment; j++) {
      const a0 = acceleration(position);
      const v1 = velocity.clone().addScaledVector(a0, step / 2);
      const a1 = acceleration(position.clone().addScaledVector(velocity, step / 2));
      const v2 = velocity.clone().addScaledVector(a1, step / 2);
      const a2 = acceleration(position.clone().addScaledVector(v1, step / 2));
      const v3 = velocity.clone().addScaledVector(a2, step);
      const a3 = acceleration(position.clone().addScaledVector(v2, step));
      position.addScaledVector(velocity, step / 6).addScaledVector(v1, step / 3)
        .addScaledVector(v2, step / 3).addScaledVector(v3, step / 6);
      velocity.addScaledVector(a0, step / 6).addScaledVector(a1, step / 3)
        .addScaledVector(a2, step / 3).addScaledVector(a3, step / 6);
    }
  }

  if (position.distanceTo(end) > 500_000 || velocity.distanceTo(arrivalVelocity) > 10) {
    throw new Error('The propagated trajectory did not match Mars at arrival. Try different dates.');
  }
  return { departureDate, arrivalDate, departureEpoch, duration, c3, marsArrivalSpeed, samples };
}
