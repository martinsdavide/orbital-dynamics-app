import assert from 'node:assert/strict';
import test from 'node:test';
import { LAGRANGE_POINT_NAMES } from '../orbitalMechanics.ts';
import { simulateWebbExperiment, WEBB_LAB_DAYS, webbSampleIndex } from '../webbLab.ts';

test('A probe exactly at each Sun–Earth equilibrium remains there in the rotating frame', () => {
  for (const point of LAGRANGE_POINT_NAMES) {
    const run = simulateWebbExperiment(point, 0, 'radial');
    assert.equal(run.impact, undefined);
    assert.equal(run.samples.at(-1)?.day, WEBB_LAB_DAYS);
    assert.ok(run.samples.every(sample => sample.distanceKm < 0.001), point);
  }
});

test('The same radial nudge grows much more at L2 than at L4', () => {
  const l2 = simulateWebbExperiment('L2', 100, 'radial');
  const l4 = simulateWebbExperiment('L4', 100, 'radial');
  assert.ok(Math.abs(l2.samples[0].distanceKm - 100) < 1e-6);
  assert.ok(Math.abs(l4.samples[0].distanceKm - 100) < 1e-6);
  assert.ok(l2.samples.at(-1)!.distanceKm > 100_000);
  assert.ok(l4.samples.every(sample => sample.distanceKm < 1200));
  assert.equal(l2.samples[webbSampleIndex(l2, 90)].day, 90);
  assert.equal(webbSampleIndex(l4, WEBB_LAB_DAYS + 1), l4.samples.length - 1);
});
