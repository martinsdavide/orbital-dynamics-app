import test from 'node:test';
import assert from 'node:assert/strict';
import { generateMainBelt } from '../asteroidBelt.ts';

test('The main belt population is reproducible and leaves the principal Kirkwood gaps', () => {
  const belt = generateMainBelt(1_000);
  assert.deepEqual(belt, generateMainBelt(1_000));
  assert.ok(belt.every(body => body.semiMajorAxisAu >= 2.1 && body.semiMajorAxisAu <= 3.28));
  for (const center of [2.5, 2.82, 2.96]) {
    assert.ok(belt.every(body => Math.abs(body.semiMajorAxisAu - center) >= 0.015));
    assert.ok(belt.some(body => Math.abs(body.semiMajorAxisAu - center) < 0.05));
  }
});

test('Inner belt asteroids revolve faster than the outer population', () => {
  const belt = generateMainBelt(200).sort((a, b) => a.semiMajorAxisAu - b.semiMajorAxisAu);
  assert.ok(belt[0].meanMotionPerDay > belt.at(-1)!.meanMotionPerDay);
  assert.ok(belt.every(body => body.eccentricity > 0 && body.inclination > 0));
});
