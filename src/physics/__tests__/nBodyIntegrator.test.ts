import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeGravitationalAcceleration,
  rk4Step,
  getMoonEphemeris,
  getSunEphemeris,
  computeSpecificEnergy,
} from '../nBodyIntegrator.ts';
import { EARTH, MOON } from '../constants.ts';

test('N-Body Integrator - Earth Surface Gravity Verification', () => {
  const surfacePos = { x: EARTH.radius, y: 0, z: 0 };
  const acc = computeGravitationalAcceleration(surfacePos, { x: 0, y: 0, z: 0 }, { x: 1e9, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, false);
  const gMag = Math.sqrt(acc.x * acc.x + acc.y * acc.y + acc.z * acc.z);

  // Standard surface gravity g0 = mu / r^2 ≈ 9.81 m/s^2
  assert.ok(Math.abs(gMag - 9.82) < 0.05, `Surface gravity ${gMag} m/s^2 should be ~9.82 m/s^2`);
  assert.ok(acc.x < 0, 'Acceleration must point towards Earth center');
});

test('N-Body Integrator - RK4 Energy Conservation in Circular Orbit', () => {
  const rOrbit = EARTH.radius + 400000; // 400 km ISS orbit
  const vCirc = Math.sqrt(EARTH.mu / rOrbit);

  let state = {
    r: { x: rOrbit, y: 0, z: 0 },
    v: { x: 0, y: vCirc, z: 0 },
  };

  const initialEnergy = computeSpecificEnergy(state.r, state.v);
  const dt = 10; // 10s steps
  const steps = 550; // approx 1 full orbit (~5500s)

  for (let i = 0; i < steps; i++) {
    state = rk4Step(state, { x: 0, y: 0, z: 0 }, { x: 1e9, y: 0, z: 0 }, dt, { x: 0, y: 0, z: 0 });
  }

  const finalEnergy = computeSpecificEnergy(state.r, state.v);
  const energyDriftFraction = Math.abs((finalEnergy - initialEnergy) / initialEnergy);

  assert.ok(
    energyDriftFraction < 1e-6,
    `RK4 orbital energy drift (${energyDriftFraction}) must be < 1e-6 over a full orbit`
  );
});

test('N-Body Integrator - Ephemeris Continuity and Realistic Ranges', () => {
  const moon0 = getMoonEphemeris(0);
  const moonDay = getMoonEphemeris(86400);

  const dist0 = Math.sqrt(moon0.position.x * moon0.position.x + moon0.position.y * moon0.position.y + moon0.position.z * moon0.position.z);
  const distDay = Math.sqrt(moonDay.position.x * moonDay.position.x + moonDay.position.y * moonDay.position.y + moonDay.position.z * moonDay.position.z);

  assert.ok(Math.abs(dist0 - MOON.semiMajorAxis) < 1000, 'Moon distance should match semi-major axis');
  assert.ok(Math.abs(distDay - MOON.semiMajorAxis) < 1000, 'Moon distance after 1 day should remain consistent');

  const sun0 = getSunEphemeris(0);
  const sunDist = Math.sqrt(sun0.position.x * sun0.position.x + sun0.position.y * sun0.position.y + sun0.position.z * sun0.position.z);
  assert.ok(Math.abs(sunDist - EARTH.semiMajorAxis) < 1000, 'Sun distance should match 1 AU');
});
