import test from 'node:test';
import assert from 'node:assert/strict';
import { ROCKET_PRESETS } from '../../data/rockets.ts';
import { SPACEPORTS } from '../../data/spaceports.ts';
import { EARTH } from '../constants.ts';
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

test('Starship stops thrust at final cutoff and coasts without spending fuel or adding energy', () => {
  const rocket = ROCKET_PRESETS.find(preset => preset.id === 'starship_v3')!;
  const spaceport = SPACEPORTS.find(site => site.id === 'spacex_starbase')!;
  const step = (telemetry: ReturnType<typeof createPadTelemetry>) =>
    simulateRocketAscentStep({ timeSeconds: telemetry.time, dt: 0.1, rocket, spaceport, telemetry, userThrottle: 1, autoGuidance: true });
  let flight = step({ ...createPadTelemetry(rocket, spaceport), phase: 'boost_stage1' });
  for (let i = 0; i < 15_000 && flight.phase !== 'coast' && flight.phase !== 'parking_orbit'; i++) {
    flight = step(flight);
  }
  assert.equal(flight.phase, 'coast');
  assert.equal(flight.remainingFuel, 0);
  assert.equal(flight.thrust, 0);
  assert.equal(flight.twr, 0);
  assert.equal(flight.isOrbitAchieved, false);
  const cutoff = flight;
  for (let i = 0; i < 100; i++) flight = step(flight);
  assert.equal(flight.thrust, 0);
  assert.equal(flight.accelerationG, 0);
  assert.equal(flight.deltaVExpended, cutoff.deltaVExpended);
  assert.equal(flight.totalMass, cutoff.totalMass);
  assert.ok(flight.altitude > cutoff.altitude);
  assert.ok(flight.velocity < cutoff.velocity);
  assert.ok(Math.abs(flight.orbitalEnergy - cutoff.orbitalEnergy) < 1);
});

test('A circular coast holds speed while a descending vacuum coast gains speed without G-load', () => {
  const rocket = ROCKET_PRESETS.find(preset => preset.id === 'starship_v3')!;
  const spaceport = SPACEPORTS.find(site => site.id === 'spacex_starbase')!;
  const altitude = 420_000;
  const circularSpeed = Math.sqrt(EARTH.mu / (EARTH.radius + altitude));
  const coast = {
    ...createPadTelemetry(rocket, spaceport), phase: 'parking_orbit' as const,
    activeStageIndex: rocket.stages.length - 1, remainingFuel: 0, altitude,
    horizontalSpeed: circularSpeed - spaceport.equatorialBoostVelocity, velocity: circularSpeed,
  };
  const step = (telemetry: ReturnType<typeof createPadTelemetry>) =>
    simulateRocketAscentStep({ timeSeconds: telemetry.time, dt: 0.2, rocket, spaceport, telemetry, userThrottle: 1, autoGuidance: true });
  let circular = step(coast);
  for (let i = 0; i < 1000; i++) circular = step(circular);
  assert.ok(Math.abs(circular.altitude - altitude) < 0.1);
  assert.ok(Math.abs(circular.velocity - circularSpeed) < 0.01);
  assert.equal(circular.accelerationG, 0);
  assert.equal(circular.isOrbitAchieved, true);
  const descending = step({ ...coast, verticalSpeed: -600 });
  assert.ok(descending.altitude < altitude);
  assert.ok(descending.velocity > Math.hypot(600, circularSpeed));
  assert.equal(descending.accelerationG, 0);
});
