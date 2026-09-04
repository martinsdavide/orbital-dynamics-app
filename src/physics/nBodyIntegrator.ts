import { EARTH, MOON, SUN } from './constants.ts';
import type { Vector3D } from '../types/celestial.ts';

export interface NBodyState {
  r: Vector3D;
  v: Vector3D;
}

/**
 * Computes gravitational acceleration on a body at position pos
 * in an Earth-centered (geocentric accelerating) frame.
 *
 * Earth is fixed at the origin (earthPos). Because this frame accelerates
 * with Earth under the influence of the Moon and Sun, third-body gravitational
 * accelerations are strictly differential (tidal relative to Earth):
 *   a_body = mu_body * ((r_body - r) / |r_body - r|^3 - (r_body - r_earth) / |r_body - r_earth|^3)
 *
 * Property: when pos == earthPos, a_moon == 0 and a_sun == 0.
 */
export function computeGravitationalAcceleration(
  pos: Vector3D,
  earthPos: Vector3D = { x: 0, y: 0, z: 0 },
  moonPos: Vector3D = { x: 0, y: 0, z: 0 },
  sunPos: Vector3D = { x: 0, y: 0, z: 0 },
  includeSun: boolean = true
): Vector3D {
  let ax = 0;
  let ay = 0;
  let az = 0;

  // 1. Earth Central Gravity: a_E = mu_E * (earthPos - pos) / |earthPos - pos|^3
  const dxE = earthPos.x - pos.x;
  const dyE = earthPos.y - pos.y;
  const dzE = earthPos.z - pos.z;
  const distE = Math.sqrt(dxE * dxE + dyE * dyE + dzE * dzE);
  if (distE > 1000) {
    const fE = EARTH.mu / (distE * distE * distE);
    ax += dxE * fE;
    ay += dyE * fE;
    az += dzE * fE;
  }

  // 2. Moon Differential (Tidal) Gravity relative to Earth:
  // Spacecraft-to-Moon vector
  const dxM_sc = moonPos.x - pos.x;
  const dyM_sc = moonPos.y - pos.y;
  const dzM_sc = moonPos.z - pos.z;
  const distM_sc = Math.sqrt(dxM_sc * dxM_sc + dyM_sc * dyM_sc + dzM_sc * dzM_sc);

  // Earth-to-Moon vector
  const dxM_E = moonPos.x - earthPos.x;
  const dyM_E = moonPos.y - earthPos.y;
  const dzM_E = moonPos.z - earthPos.z;
  const distM_E = Math.sqrt(dxM_E * dxM_E + dyM_E * dyM_E + dzM_E * dzM_E);

  if (distM_sc > 1000 && distM_E > 1000) {
    const fM_sc = MOON.mu / (distM_sc * distM_sc * distM_sc);
    const fM_E = MOON.mu / (distM_E * distM_E * distM_E);
    ax += dxM_sc * fM_sc - dxM_E * fM_E;
    ay += dyM_sc * fM_sc - dyM_E * fM_E;
    az += dzM_sc * fM_sc - dzM_E * fM_E;
  }

  // 3. Sun Differential (Tidal) Gravity relative to Earth:
  if (includeSun) {
    // Spacecraft-to-Sun vector
    const dxS_sc = sunPos.x - pos.x;
    const dyS_sc = sunPos.y - pos.y;
    const dzS_sc = sunPos.z - pos.z;
    const distS_sc = Math.sqrt(dxS_sc * dxS_sc + dyS_sc * dyS_sc + dzS_sc * dzS_sc);

    // Earth-to-Sun vector
    const dxS_E = sunPos.x - earthPos.x;
    const dyS_E = sunPos.y - earthPos.y;
    const dzS_E = sunPos.z - earthPos.z;
    const distS_E = Math.sqrt(dxS_E * dxS_E + dyS_E * dyS_E + dzS_E * dzS_E);

    if (distS_sc > 1e10 && distS_E > 1e10) {
      const fS_sc = SUN.mu / (distS_sc * distS_sc * distS_sc);
      const fS_E = SUN.mu / (distS_E * distS_E * distS_E);
      ax += dxS_sc * fS_sc - dxS_E * fS_E;
      ay += dyS_sc * fS_sc - dyS_E * fS_E;
      az += dzS_sc * fS_sc - dzS_E * fS_E;
    }
  }

  return { x: ax, y: ay, z: az };
}

/**
 * 4th-Order Runge-Kutta (RK4) Numerical Integration Step (static bodies)
 */
export function rk4Step(
  state: NBodyState,
  earthPos: Vector3D,
  moonPos: Vector3D,
  dt: number,
  sunPos: Vector3D = { x: 0, y: 0, z: 0 }
): NBodyState {
  const a1 = computeGravitationalAcceleration(state.r, earthPos, moonPos, sunPos);
  const v1 = state.v;

  const r2: Vector3D = {
    x: state.r.x + 0.5 * dt * v1.x,
    y: state.r.y + 0.5 * dt * v1.y,
    z: state.r.z + 0.5 * dt * v1.z,
  };
  const v2Mid: Vector3D = {
    x: state.v.x + 0.5 * dt * a1.x,
    y: state.v.y + 0.5 * dt * a1.y,
    z: state.v.z + 0.5 * dt * a1.z,
  };
  const a2 = computeGravitationalAcceleration(r2, earthPos, moonPos, sunPos);

  const r3: Vector3D = {
    x: state.r.x + 0.5 * dt * v2Mid.x,
    y: state.r.y + 0.5 * dt * v2Mid.y,
    z: state.r.z + 0.5 * dt * v2Mid.z,
  };
  const v3Mid: Vector3D = {
    x: state.v.x + 0.5 * dt * a2.x,
    y: state.v.y + 0.5 * dt * a2.y,
    z: state.v.z + 0.5 * dt * a2.z,
  };
  const a3 = computeGravitationalAcceleration(r3, earthPos, moonPos, sunPos);

  const r4: Vector3D = {
    x: state.r.x + dt * v3Mid.x,
    y: state.r.y + dt * v3Mid.y,
    z: state.r.z + dt * v3Mid.z,
  };
  const v4End: Vector3D = {
    x: state.v.x + dt * a3.x,
    y: state.v.y + dt * a3.y,
    z: state.v.z + dt * a3.z,
  };
  const a4 = computeGravitationalAcceleration(r4, earthPos, moonPos, sunPos);

  const nextR: Vector3D = {
    x: state.r.x + (dt / 6) * (v1.x + 2 * v2Mid.x + 2 * v3Mid.x + v4End.x),
    y: state.r.y + (dt / 6) * (v1.y + 2 * v2Mid.y + 2 * v3Mid.y + v4End.y),
    z: state.r.z + (dt / 6) * (v1.z + 2 * v2Mid.z + 2 * v3Mid.z + v4End.z),
  };

  const nextV: Vector3D = {
    x: state.v.x + (dt / 6) * (a1.x + 2 * a2.x + 2 * a3.x + a4.x),
    y: state.v.y + (dt / 6) * (a1.y + 2 * a2.y + 2 * a3.y + a4.y),
    z: state.v.z + (dt / 6) * (a1.z + 2 * a2.z + 2 * a3.z + a4.z),
  };

  return { r: nextR, v: nextV };
}

/**
 * Time-Dependent 4th-Order Runge-Kutta (RK4) Step.
 * Evaluates ephemerides of moving bodies (Moon, Sun) at all four RK4 sub-stages:
 * Stage 1: t
 * Stage 2: t + dt / 2
 * Stage 3: t + dt / 2
 * Stage 4: t + dt
 */
export function rk4StepTimeDependent(
  state: NBodyState,
  t: number,
  dt: number,
  includeSun: boolean = true
): NBodyState {
  const earthPos: Vector3D = { x: 0, y: 0, z: 0 };

  // Stage 1: at t
  const m1 = getMoonEphemeris(t).position;
  const s1 = includeSun ? getSunEphemeris(t).position : { x: 0, y: 0, z: 0 };
  const a1 = computeGravitationalAcceleration(state.r, earthPos, m1, s1, includeSun);
  const v1 = state.v;

  // Stage 2: at t + 0.5 * dt
  const tMid = t + 0.5 * dt;
  const m2 = getMoonEphemeris(tMid).position;
  const s2 = includeSun ? getSunEphemeris(tMid).position : { x: 0, y: 0, z: 0 };
  const r2: Vector3D = {
    x: state.r.x + 0.5 * dt * v1.x,
    y: state.r.y + 0.5 * dt * v1.y,
    z: state.r.z + 0.5 * dt * v1.z,
  };
  const v2Mid: Vector3D = {
    x: state.v.x + 0.5 * dt * a1.x,
    y: state.v.y + 0.5 * dt * a1.y,
    z: state.v.z + 0.5 * dt * a1.z,
  };
  const a2 = computeGravitationalAcceleration(r2, earthPos, m2, s2, includeSun);

  // Stage 3: at t + 0.5 * dt
  const r3: Vector3D = {
    x: state.r.x + 0.5 * dt * v2Mid.x,
    y: state.r.y + 0.5 * dt * v2Mid.y,
    z: state.r.z + 0.5 * dt * v2Mid.z,
  };
  const v3Mid: Vector3D = {
    x: state.v.x + 0.5 * dt * a2.x,
    y: state.v.y + 0.5 * dt * a2.y,
    z: state.v.z + 0.5 * dt * a2.z,
  };
  const a3 = computeGravitationalAcceleration(r3, earthPos, m2, s2, includeSun);

  // Stage 4: at t + dt
  const tEnd = t + dt;
  const m4 = getMoonEphemeris(tEnd).position;
  const s4 = includeSun ? getSunEphemeris(tEnd).position : { x: 0, y: 0, z: 0 };
  const r4: Vector3D = {
    x: state.r.x + dt * v3Mid.x,
    y: state.r.y + dt * v3Mid.y,
    z: state.r.z + dt * v3Mid.z,
  };
  const v4End: Vector3D = {
    x: state.v.x + dt * a3.x,
    y: state.v.y + dt * a3.y,
    z: state.v.z + dt * a3.z,
  };
  const a4 = computeGravitationalAcceleration(r4, earthPos, m4, s4, includeSun);

  const nextR: Vector3D = {
    x: state.r.x + (dt / 6) * (v1.x + 2 * v2Mid.x + 2 * v3Mid.x + v4End.x),
    y: state.r.y + (dt / 6) * (v1.y + 2 * v2Mid.y + 2 * v3Mid.y + v4End.y),
    z: state.r.z + (dt / 6) * (v1.z + 2 * v2Mid.z + 2 * v3Mid.z + v4End.z),
  };

  const nextV: Vector3D = {
    x: state.v.x + (dt / 6) * (a1.x + 2 * a2.x + 2 * a3.x + a4.x),
    y: state.v.y + (dt / 6) * (a1.y + 2 * a2.y + 2 * a3.y + a4.y),
    z: state.v.z + (dt / 6) * (a1.z + 2 * a2.z + 2 * a3.z + a4.z),
  };

  return { r: nextR, v: nextV };
}

/**
 * Returns analytical Moon position in Geocentric frame at time t (seconds)
 */
export function getMoonEphemeris(t: number): { position: Vector3D; velocity: Vector3D } {
  const omegaM = (2 * Math.PI) / MOON.orbitalPeriod;
  const angle = omegaM * t;
  const dist = MOON.semiMajorAxis;
  const cosInc = Math.cos(MOON.inclinationToEcliptic);
  const sinInc = Math.sin(MOON.inclinationToEcliptic);

  const x = dist * Math.cos(angle);
  const z = -dist * cosInc * Math.sin(angle);
  const y = dist * sinInc * Math.sin(angle);

  const vx = -dist * omegaM * Math.sin(angle);
  const vz = -dist * omegaM * cosInc * Math.cos(angle);
  const vy = dist * omegaM * sinInc * Math.cos(angle);

  return {
    position: { x, y, z },
    velocity: { x: vx, y: vy, z: vz },
  };
}

/**
 * Returns analytical Sun position in Geocentric frame at time t (seconds)
 */
export function getSunEphemeris(t: number): { position: Vector3D; velocity: Vector3D } {
  const omegaE = (2 * Math.PI) / EARTH.orbitalPeriod;
  const angle = omegaE * t + Math.PI; // Sun is opposite Earth in geocentric frame
  const dist = EARTH.semiMajorAxis;
  const sinTilt = Math.sin(EARTH.axialTilt);

  const x = dist * Math.cos(angle);
  const z = -dist * Math.sin(angle);
  const y = dist * sinTilt * Math.sin(angle);

  return {
    position: { x, y, z },
    velocity: { x: 0, y: 0, z: 0 },
  };
}

/**
 * Computes specific orbital energy E = 1/2 v^2 - mu_E/r_E - mu_M/r_M
 */
export function computeSpecificEnergy(
  r: Vector3D,
  v: Vector3D,
  earthPos: Vector3D = { x: 0, y: 0, z: 0 },
  moonPos: Vector3D = { x: 0, y: 0, z: 0 }
): number {
  const vSq = v.x * v.x + v.y * v.y + v.z * v.z;
  const dxE = r.x - earthPos.x;
  const dyE = r.y - earthPos.y;
  const dzE = r.z - earthPos.z;
  const distE = Math.sqrt(dxE * dxE + dyE * dyE + dzE * dzE) || 1;

  const dxM = r.x - moonPos.x;
  const dyM = r.y - moonPos.y;
  const dzM = r.z - moonPos.z;
  const distM = Math.sqrt(dxM * dxM + dyM * dyM + dzM * dzM) || 1;

  return 0.5 * vSq - EARTH.mu / distE - MOON.mu / distM;
}
