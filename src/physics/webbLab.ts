import { EARTH, SUN } from './constants.ts';
import { lagrangeFractions, LAGRANGE_POINT_NAMES } from './orbitalMechanics.ts';

export type WebbPoint = typeof LAGRANGE_POINT_NAMES[number];
export type WebbExperiment = WebbPoint | 'compare';
export type WebbOffset = 'radial' | 'along-track';

const mu = EARTH.mass / (SUN.mass + EARTH.mass);
const separationKm = EARTH.semiMajorAxis / 1000;
const timeScaleDays = Math.sqrt(EARTH.semiMajorAxis ** 3 / (SUN.mu + EARTH.mu)) / 86400;
const stepDays = 0.05;
export const WEBB_LAB_DAYS = 180;
export const WEBB_PATH_MAGNIFICATION = 25;

type State = [number, number, number, number];

export function webbEquilibrium(point: WebbPoint) {
  const [x, y] = lagrangeFractions('Sun-Earth')[LAGRANGE_POINT_NAMES.indexOf(point)];
  return { x, y };
}

function derivative([x, y, vx, vy]: State): State {
  const sun = (1 - mu) / Math.hypot(x, y) ** 3;
  const earth = mu / Math.hypot(x - 1, y) ** 3;
  return [vx, vy, 2 * vy + x - mu - sun * x - earth * (x - 1), -2 * vx + y - (sun + earth) * y];
}

const add = (a: State, b: State, scale: number) => a.map((value, i) => value + b[i] * scale) as State;

export function simulateWebbExperiment(point: WebbPoint, offsetKm: number, offset: WebbOffset) {
  const equilibrium = webbEquilibrium(point);
  const magnitude = offsetKm / separationKm;
  let state: State = [equilibrium.x + (offset === 'radial' ? magnitude : 0),
    equilibrium.y + (offset === 'along-track' ? magnitude : 0), 0, 0];
  const samples = [];
  let impact: 'Earth' | 'Sun' | undefined;
  const step = stepDays / timeScaleDays;
  for (let i = 0; i <= WEBB_LAB_DAYS / stepDays; i++) {
    const [x, y] = state;
    samples.push({ day: i * stepDays, x, y, distanceKm: Math.hypot(x - equilibrium.x, y - equilibrium.y) * separationKm });
    if (Math.hypot(x - 1, y) < EARTH.radius / EARTH.semiMajorAxis) impact = 'Earth';
    else if (Math.hypot(x, y) < SUN.radius / EARTH.semiMajorAxis) impact = 'Sun';
    if (impact || i === WEBB_LAB_DAYS / stepDays) break;
    const k1 = derivative(state);
    const k2 = derivative(add(state, k1, step / 2));
    const k3 = derivative(add(state, k2, step / 2));
    const k4 = derivative(add(state, k3, step));
    state = state.map((value, j) => value + step / 6 * (k1[j] + 2 * k2[j] + 2 * k3[j] + k4[j])) as State;
  }
  return { point, equilibrium, samples, impact };
}

export type WebbRun = ReturnType<typeof simulateWebbExperiment>;
export const webbSampleIndex = (run: WebbRun, day: number) =>
  Math.min(run.samples.length - 1, Math.max(0, Math.floor(day / stepDays + 1e-8)));

export interface WebbSceneState {
  runs: WebbRun[];
  day: number;
  focus: WebbPoint;
}
