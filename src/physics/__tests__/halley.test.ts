import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EARTH } from '../constants.ts';
import { calculateHalleyOrbit, getHalleyActivity, HALLEY_PERIOD_SECONDS, HALLEY_PERIHELION_SECONDS } from '../halley.ts';

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
