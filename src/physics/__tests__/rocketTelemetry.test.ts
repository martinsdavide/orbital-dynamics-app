import test from 'node:test';
import assert from 'node:assert/strict';
import { ROCKET_PRESETS } from '../../data/rockets.ts';
import { SPACEPORTS } from '../../data/spaceports.ts';
import { calculateEarthEscapeSpeed, createPadTelemetry, KARMAN_LINE_ALTITUDE, simulateRocketAscentStep } from '../rocketDynamics.ts';

test('Earth escape speed is about 11.2 km/s at sea level and falls with altitude', () => {
  const surface = calculateEarthEscapeSpeed(0);
  assert.ok(surface > 11_180 && surface < 11_200);
  assert.ok(calculateEarthEscapeSpeed(420_000) < calculateEarthEscapeSpeed(KARMAN_LINE_ALTITUDE));
  assert.ok(calculateEarthEscapeSpeed(KARMAN_LINE_ALTITUDE) < surface);
});

test('First upward Kármán line crossing is timed within the simulation step and clears on pad reset', () => {
  const rocket = ROCKET_PRESETS.find(preset => preset.id === 'starship_v3')!;
  const spaceport = SPACEPORTS.find(site => site.id === 'spacex_starbase')!;
  const pad = createPadTelemetry(rocket, spaceport);
  const initial = { ...pad, phase: 'boost_stage1' as const, altitude: KARMAN_LINE_ALTITUDE - 25, verticalSpeed: 450, time: 100 };
  const options = { timeSeconds: initial.time, dt: 1, rocket, spaceport, userThrottle: 0, autoGuidance: true };
  const climbed = simulateRocketAscentStep({ ...options, telemetry: initial });
  assert.ok(climbed.altitude >= KARMAN_LINE_ALTITUDE);
  const expectedTime = initial.time + (KARMAN_LINE_ALTITUDE - initial.altitude) / (climbed.altitude - initial.altitude);
  assert.ok(Math.abs(climbed.karmanCrossingTime! - expectedTime) < 1e-12);

  const descending = simulateRocketAscentStep({ ...options, telemetry: { ...climbed, verticalSpeed: -1000 } });
  assert.ok(descending.altitude < KARMAN_LINE_ALTITUDE);
  assert.equal(descending.karmanCrossingTime, climbed.karmanCrossingTime);
  const reset = simulateRocketAscentStep({ ...options, telemetry: { ...descending, phase: 'pad' } });
  assert.equal(reset.karmanCrossingTime, undefined);
});
