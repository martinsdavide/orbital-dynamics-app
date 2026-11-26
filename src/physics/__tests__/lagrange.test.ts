import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Vector3 } from 'three';
import { getEphemerisState } from '../orbitalMechanics.ts';

test('Lagrange points follow the geometry and orbital direction of each pair', () => {
  const ephemeris = getEphemerisState(7 * 86400);
  const vector = (v: { x: number; y: number; z: number }) => new Vector3(v.x, v.y, v.z);
  const pairs = [
    ['Sun-Earth', ephemeris.sun, ephemeris.earth],
    ['Earth-Moon', ephemeris.earth, ephemeris.moon],
  ] as const;

  for (const [system, primary, secondary] of pairs) {
    const displacement = vector(secondary.position).sub(vector(primary.position));
    const separation = displacement.length();
    const radial = displacement.clone().normalize();
    const velocity = vector(secondary.velocity).sub(vector(primary.velocity));
    const points = ephemeris.lagrangePoints.filter(point => point.system === system);
    assert.deepEqual(points.map(point => point.name), ['L1', 'L2', 'L3', 'L4', 'L5']);
    assert.deepEqual(points.map(point => point.isStable), [false, false, false, true, true]);
    const [l1, l2, l3, l4, l5] = points.map(point => vector(point.position).divideScalar(separation));
    const mu = secondary.mass / (primary.mass + secondary.mass);

    assert.ok(l1.dot(radial) > 0 && l1.dot(radial) < 1);
    assert.ok(l2.dot(radial) > 1);
    assert.ok(l3.dot(radial) < 0);
    for (const position of [l1, l2, l3]) {
      const fromSecondary = position.clone().sub(radial);
      const acceleration = position.clone().addScaledVector(radial, -mu)
        .addScaledVector(position, -(1 - mu) / position.length() ** 3)
        .addScaledVector(fromSecondary, -mu / fromSecondary.length() ** 3);
      assert.ok(acceleration.length() < 1e-10);
    }

    for (const position of [l4, l5]) {
      assert.ok(Math.abs(position.length() - 1) < 1e-10);
      assert.ok(Math.abs(position.distanceTo(radial) - 1) < 1e-10);
    }
    const forward = velocity.addScaledVector(radial, -velocity.dot(radial));
    assert.ok(l4.dot(forward) > 0);
    assert.ok(l5.dot(forward) < 0);
  }
});
