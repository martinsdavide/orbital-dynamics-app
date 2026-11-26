import test from 'node:test';
import assert from 'node:assert/strict';
import { ROCKET_PRESETS } from '../../data/rockets.ts';
import { SPACEPORTS } from '../../data/spaceports.ts';
import { BOOSTBACK_CUTOFF_SECONDS, BOOSTBACK_IGNITION_SECONDS, boosterReturnElapsed, createBoosterReturn, SUPER_HEAVY_PRESET_ID } from '../boosterReturn.ts';
import { EARTH, ISS_ORBIT_ALTITUDE } from '../constants.ts';
import { calculateEarthCircularSpeed, calculateEarthEscapeSpeed, createPadTelemetry, KARMAN_LINE_ALTITUDE, simulateRocketAscentStep } from '../rocketDynamics.ts';

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

test('ISS-altitude guidance coasts to apoapsis and achieves a near-circular orbit with each rocket preset', () => {
  const spaceport = SPACEPORTS.find(site => site.id === 'spacex_starbase')!;
  const targetSpeed = calculateEarthCircularSpeed(ISS_ORBIT_ALTITUDE);
  for (const rocket of ROCKET_PRESETS) {
    let telemetry: ReturnType<typeof createPadTelemetry> = { ...createPadTelemetry(rocket, spaceport), phase: 'boost_stage1' };
    const step = () => simulateRocketAscentStep({
      timeSeconds: telemetry.time, dt: 0.1, rocket, spaceport, telemetry, userThrottle: 1,
      autoGuidance: true, orbitTargetAltitude: ISS_ORBIT_ALTITUDE,
    });
    const phases = new Set<string>();
    for (let i = 0; i < 30_000; i++) {
      const next = step();
      if (telemetry.orbitTargetPhase === 'coast to apoapsis' && next.orbitTargetPhase === 'coast to apoapsis') {
        assert.equal(next.thrust, 0);
        assert.equal(next.remainingFuel, telemetry.remainingFuel);
      }
      telemetry = next;
      if (telemetry.orbitTargetPhase) phases.add(telemetry.orbitTargetPhase);
      if (telemetry.orbitTargetPhase === 'target reached' || telemetry.orbitTargetPhase === 'target missed') break;
    }
    assert.deepEqual([...phases], ['ascent', 'coast to apoapsis', 'circularization', 'target reached'], rocket.name);
    assert.equal(telemetry.phase, 'parking_orbit', rocket.name);
    assert.ok(telemetry.isOrbitAchieved && telemetry.remainingFuel > 0, rocket.name);
    assert.ok(Math.abs(telemetry.apoapsis - ISS_ORBIT_ALTITUDE) < 8000, rocket.name);
    assert.ok(Math.abs(telemetry.periapsis - ISS_ORBIT_ALTITUDE) < 8000, rocket.name);
    assert.ok(Math.abs(telemetry.velocity - targetSpeed) < 10, rocket.name);
    assert.equal(step().thrust, 0, rocket.name);
  }
});

test('Super Heavy return starts from first-stage separation while the ship keeps flying', () => {
  const rocket = ROCKET_PRESETS.find(preset => preset.id === SUPER_HEAVY_PRESET_ID)!;
  const spaceport = SPACEPORTS.find(site => site.id === 'spacex_starbase')!;
  const step = (telemetry: ReturnType<typeof createPadTelemetry>) =>
    simulateRocketAscentStep({ timeSeconds: telemetry.time, dt: 0.1, rocket, spaceport, telemetry, userThrottle: 1, autoGuidance: true });
  const pad = createPadTelemetry(rocket, spaceport);
  let flight = step({ ...pad, phase: 'boost_stage1' });
  for (let i = 0; i < 5000 && flight.activeStageIndex === 0; i++) flight = step(flight);

  const separation = flight.boosterSeparation;
  assert.ok(separation);
  assert.equal(separation.time, flight.time);
  assert.equal(separation.altitude, flight.altitude);
  assert.equal(separation.downrangeDistance, flight.downrangeDistance);
  const profile = createBoosterReturn(separation, spaceport);
  const flip = profile.sample(0);
  const ignition = profile.sample(BOOSTBACK_IGNITION_SECONDS);
  const cutoff = profile.sample(BOOSTBACK_CUTOFF_SECONDS);
  assert.equal(flip.phase, 'Separation flip');
  assert.equal(flip.pitchAngle, flight.pitchAngle);
  assert.equal(ignition.phase, 'Boostback burn');
  assert.equal(ignition.horizontalSpeed, flip.horizontalSpeed);
  assert.ok(ignition.pitchAngle > 90);
  assert.equal(cutoff.phase, 'Post-burn coast');
  assert.ok(cutoff.horizontalSpeed < ignition.horizontalSpeed);
  assert.equal(profile.sample(BOOSTBACK_CUTOFF_SECONDS + 1).horizontalSpeed, cutoff.horizontalSpeed);
  const entry = profile.sample(profile.entryTime);
  const landing = profile.sample(profile.landingTime);
  const catchResult = profile.sample(profile.endTime + 1);
  assert.equal(entry.phase, 'Atmospheric descent');
  assert.ok(entry.verticalSpeed < 0 && entry.altitude > landing.altitude);
  assert.equal(landing.phase, 'Landing burn');
  assert.ok(landing.engineOn);
  assert.equal(catchResult.phase, 'Tower catch');
  assert.equal(catchResult.altitude, spaceport.elevation + 45);
  assert.equal(catchResult.downrangeDistance, 0);
  assert.equal(catchResult.verticalSpeed, 0);
  assert.equal(catchResult.horizontalSpeed, 0);
  assert.equal(catchResult.engineOn, false);

  for (const boundary of [profile.entryTime, profile.landingTime, profile.endTime]) {
    const before = profile.sample(boundary - 0.00001);
    const after = profile.sample(boundary);
    assert.ok(Math.abs(after.altitude - before.altitude) < 0.03);
    assert.ok(Math.abs(after.verticalSpeed - before.verticalSpeed) < 0.03);
  }
  let lastAltitude = entry.altitude;
  for (let time = profile.entryTime + 1; time <= profile.endTime; time++) {
    const sample = profile.sample(time);
    assert.ok(sample.altitude <= lastAltitude && sample.altitude >= spaceport.elevation);
    lastAltitude = sample.altitude;
  }

  const otherSite = SPACEPORTS.find(site => site.id === 'ksc')!;
  const offsite = createBoosterReturn(separation, otherSite);
  const missed = offsite.sample(offsite.endTime);
  assert.equal(missed.phase, 'Recovery missed');
  assert.ok(missed.downrangeDistance > 0);
  assert.equal(missed.altitude, otherSite.elevation);

  const aborted = step({ ...flight, phase: 'abort' });
  assert.equal(aborted.time, flight.time);
  assert.equal(boosterReturnElapsed(aborted), 0.1);

  const continued = step(flight);
  assert.equal(continued.boosterSeparation, separation);
  assert.equal(continued.activeStageIndex, 1);
  assert.ok(continued.thrust > 0);
  assert.equal(pad.boosterSeparation, undefined);
});
