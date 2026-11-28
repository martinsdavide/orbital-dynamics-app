import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EARTH, PLANET_CONFIGS } from '../constants.ts';
import { calculateHalleyOrbit, getHalleyActivity, halleyLabTime, HALLEY_PERIOD_SECONDS, HALLEY_PERIHELION_SECONDS, HALLEY_SATURN_DISTANCE_SECONDS } from '../halley.ts';

const radiusAu = (time: number) => {
  const { x, y, z } = calculateHalleyOrbit(time).position;
  return Math.hypot(x, y, z) / EARTH.semiMajorAxis;
};

test('Halley follows a retrograde orbit with a close perihelion and distant aphelion', () => {
  const perihelion = HALLEY_PERIHELION_SECONDS;
  const { position, velocity } = calculateHalleyOrbit(perihelion);
  assert.ok(position.z * velocity.x - position.x * velocity.z < 0);
  assert.ok(Math.abs(radiusAu(perihelion) - 0.586) < 0.001);
  assert.ok(Math.abs(radiusAu(perihelion + HALLEY_PERIOD_SECONDS / 2) - 35.08) < 0.01);
  assert.ok(Math.abs(radiusAu(perihelion - HALLEY_PERIOD_SECONDS) - radiusAu(perihelion)) < 1e-10);

  for (const days of [1, 4, 20, 60, 100]) {
    const offset = days * 86400;
    assert.ok(Math.abs(radiusAu(perihelion - offset) - radiusAu(perihelion + offset)) < 1e-10);
    assert.ok(radiusAu(perihelion + offset) > radiusAu(perihelion + offset - 86400));
  }
});

test('Halley’s rendered activity fades in smoothly as it approaches the Sun', () => {
  assert.equal(getHalleyActivity(3), 0);
  assert.equal(getHalleyActivity(10), 0);
  assert.ok(getHalleyActivity(2.99) < 0.001);
  assert.ok(getHalleyActivity(1) > getHalleyActivity(2));
  assert.equal(getHalleyActivity(radiusAu(HALLEY_PERIHELION_SECONDS)), 1);
});

test('The Halley preview starts at Saturn’s orbital distance while inbound', () => {
  const start = HALLEY_SATURN_DISTANCE_SECONDS;
  const saturn = PLANET_CONFIGS.find(planet => planet.key === 'saturn')!;
  assert.ok(start < HALLEY_PERIHELION_SECONDS);
  assert.ok(Math.abs(radiusAu(start) - saturn.semiMajorAxis / EARTH.semiMajorAxis) < 1e-8);
  assert.ok(radiusAu(start + 86400) < radiusAu(start));
  assert.equal(getHalleyActivity(radiusAu(start)), 0);
});

test('The guided trip starts far away, reaches perihelion, and stops on the active outbound leg', () => {
  assert.equal(halleyLabTime(0, 1), HALLEY_SATURN_DISTANCE_SECONDS);
  assert.equal(halleyLabTime(1, 0), halleyLabTime(0, 1));
  assert.ok(Math.abs(radiusAu(halleyLabTime(1, 0.45)) - 3) < 1e-8);
  assert.equal(halleyLabTime(1, 1), HALLEY_PERIHELION_SECONDS);
  assert.equal(halleyLabTime(2, 0), HALLEY_PERIHELION_SECONDS);
  const outbound = halleyLabTime(2, 1);
  assert.ok(radiusAu(outbound + 86400) > radiusAu(outbound));
  assert.ok(getHalleyActivity(radiusAu(outbound)) > 0);
  const { position: p, velocity: v } = calculateHalleyOrbit(outbound);
  const directionCosine = (p.x * v.x + p.y * v.y + p.z * v.z)
    / (Math.hypot(p.x, p.y, p.z) * Math.hypot(v.x, v.y, v.z));
  assert.ok(directionCosine > 0 && directionCosine < 0.9);
});
