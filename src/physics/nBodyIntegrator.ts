import { EARTH, MOON, SUN } from './constants';
import type { Vector3D } from '../types/celestial';

export interface NBodyState {
  r: Vector3D;
  v: Vector3D;
}

export function computeGravitationalAcceleration(
  pos: Vector3D,
  earthPos: Vector3D,
  moonPos: Vector3D,
  sunPos: Vector3D = { x: 0, y: 0, z: 0 },
  includeSun: boolean = true
): Vector3D {
  let ax = 0;
  let ay = 0;
  let az = 0;

  // 1. Earth gravity
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

  // 2. Moon gravity
  const dxM = moonPos.x - pos.x;
  const dyM = moonPos.y - pos.y;
  const dzM = moonPos.z - pos.z;
  const distM = Math.sqrt(dxM * dxM + dyM * dyM + dzM * dzM);
  if (distM > 1000) {
    const fM = MOON.mu / (distM * distM * distM);
    ax += dxM * fM;
    ay += dyM * fM;
    az += dzM * fM;
  }

  // 3. Sun gravity
  if (includeSun) {
    const dxS = sunPos.x - pos.x;
    const dyS = sunPos.y - pos.y;
    const dzS = sunPos.z - pos.z;
    const distS = Math.sqrt(dxS * dxS + dyS * dyS + dzS * dzS);
    if (distS > 1e6) {
      const fS = SUN.mu / (distS * distS * distS);
      ax += dxS * fS;
      ay += dyS * fS;
      az += dzS * fS;
    }
  }

  return { x: ax, y: ay, z: az };
}

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
