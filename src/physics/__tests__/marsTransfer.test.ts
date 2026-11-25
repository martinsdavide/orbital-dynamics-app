import test from 'node:test';
import assert from 'node:assert/strict';
import { Vector3 } from 'three';
import {
  AU_METERS, DEFAULT_MARS_ARRIVAL, DEFAULT_MARS_DEPARTURE, SECONDS_PER_DAY,
  estimateMarsCaptureDeltaV, getMarsMissionPlanetPosition, solveMarsTransfer, solveProgradeLambert,
} from '../marsTransfer.ts';

test('Lambert solver reproduces the Vallado textbook transfer velocities', () => {
  // Published vectors use inertial +Z north. Convert to AstroSim's +Y north.
  const start = new Vector3(5000, 2100, -10000);
  const end = new Vector3(-14600, 7000, -2500);
  const { departureVelocity, arrivalVelocity } = solveProgradeLambert(start, end, 3600, 398600);
  assert.ok(departureVelocity.distanceTo(new Vector3(-5.9925, 3.2456, -1.9254)) < 1e-4);
  assert.ok(arrivalVelocity.distanceTo(new Vector3(-3.3125, -0.3853, 4.1966)) < 1e-4);
});

test('Dated Mars transfers start at Earth and independently propagate to Mars', () => {
  const cases = [
    [DEFAULT_MARS_DEPARTURE, DEFAULT_MARS_ARRIVAL, 262, 3.84],
    ['2028-12-01', '2029-06-01', 182, 8.32],
  ] as const;
  for (const [departure, arrival, days, expectedArrivalKmPerSecond] of cases) {
    const mission = solveMarsTransfer(departure, arrival);
    const first = mission.samples[0];
    const last = mission.samples.at(-1)!;
    assert.equal(mission.duration, days * SECONDS_PER_DAY);
    assert.ok(first.spacecraft.distanceTo(first.earth) < 1);
    assert.ok(last.spacecraft.distanceTo(last.mars) < 1000);
    assert.ok(mission.c3 > 0 && mission.c3 < 40);
    assert.ok(Math.abs(mission.marsArrivalSpeed / 1000 - expectedArrivalKmPerSecond) < 0.02);
    assert.ok(estimateMarsCaptureDeltaV(mission.marsArrivalSpeed, 300) > 0);
  }
});

test('Dated planet positions progress prograde and use physically plausible solar distances', () => {
  const epoch = Date.UTC(2028, 11, 1);
  for (const [body, minRadius, maxRadius] of [['earth', 0.98, 1.02], ['mars', 1.37, 1.67]] as const) {
    const first = getMarsMissionPlanetPosition(body, epoch);
    const next = getMarsMissionPlanetPosition(body, epoch + SECONDS_PER_DAY * 1000);
    const radius = first.length() / AU_METERS;
    assert.ok(radius >= minRadius && radius <= maxRadius);
    assert.ok(first.cross(next).y > 0);
  }
});

test('Mission endpoint ephemerides agree with independent VSOP87 positions within 0.0005 AU', () => {
  // Astronomy Engine 2.1.19 HelioVector transformed from J2000 equator to J2000 ecliptic.
  const earth = new Vector3(0.3546850176, -0.0000634094, -0.9200479158);
  const mars = new Vector3(-0.3354041055, -0.0220651878, 1.4460767248);
  assert.ok(getMarsMissionPlanetPosition('earth', Date.UTC(2028, 11, 1)).divideScalar(AU_METERS).distanceTo(earth) < 0.0005);
  assert.ok(getMarsMissionPlanetPosition('mars', Date.UTC(2029, 7, 20)).divideScalar(AU_METERS).distanceTo(mars) < 0.0005);
});

test('Mars planner rejects invalid dates and reversed or unsupported durations', () => {
  assert.throws(() => solveMarsTransfer('2028-02-30', '2028-08-01'), /valid UTC dates/);
  assert.throws(() => solveMarsTransfer('2029-08-01', '2028-12-01'), /30 to 600 days/);
  assert.throws(() => solveMarsTransfer('2028-12-01', '2031-06-01'), /30 to 600 days/);
});
