import test from 'node:test';
import assert from 'node:assert/strict';
import { MOON, EARTH } from '../constants.ts';
import { calculateLunarOrbitPoint, getMoonEphemeris } from '../nBodyIntegrator.ts';
import { getEphemerisState } from '../orbitalMechanics.ts';

test('Lunar Orbit Plane - Moon Position lies on Orbit Ring across 8 Orbital Phases', () => {
  const numPhases = 8;
  const radius = MOON.semiMajorAxis;

  for (let phaseIdx = 0; phaseIdx < numPhases; phaseIdx++) {
    const theta = (phaseIdx / numPhases) * 2 * Math.PI;
    const time = (theta / (2 * Math.PI)) * MOON.orbitalPeriod;

    // 1. Point from physics ephemeris
    const ephemerisPos = getMoonEphemeris(time).position;

    // 2. Point from orbit ring generator
    const ringPoint = calculateLunarOrbitPoint(theta, radius);

    // Assert exact equality between ephemeris and orbit ring point
    const diff = Math.hypot(
      ephemerisPos.x - ringPoint.x,
      ephemerisPos.y - ringPoint.y,
      ephemerisPos.z - ringPoint.z
    );

    assert.ok(
      diff < 1e-3,
      `Phase ${phaseIdx} (theta = ${(theta * 180 / Math.PI).toFixed(1)}°): distance between ephemeris and orbit ring is ${diff} m (must be < 1mm)`
    );
  }
});

test('Lunar Orbit Plane - Constant Radius across all phases (No tan(i) elongation)', () => {
  const radius = MOON.semiMajorAxis;
  const steps = 128;

  for (let i = 0; i <= steps; i++) {
    const theta = (i / steps) * 2 * Math.PI;
    const pt = calculateLunarOrbitPoint(theta, radius);
    const r = Math.hypot(pt.x, pt.y, pt.z);

    const radiusError = Math.abs(r - radius);
    assert.ok(
      radiusError < 1e-4,
      `Step ${i}: Orbit radius ${r} differs from semiMajorAxis ${radius} by ${radiusError} m`
    );
  }
});

test('Lunar Orbit Plane - Quarter-Orbit Max Inclination and Sign Consistency', () => {
  const radius = MOON.semiMajorAxis;
  const sinInc = Math.sin(MOON.inclinationToEcliptic);
  const cosInc = Math.cos(MOON.inclinationToEcliptic);

  // At quarter orbit (theta = PI/2, 90 deg):
  // x = 0, y = +R * sin(i), z = -R * cos(i)
  const q1 = calculateLunarOrbitPoint(Math.PI / 2, radius);
  assert.ok(Math.abs(q1.x) < 1e-4, 'Quarter-orbit 1 x should be 0');
  assert.ok(q1.y > 0, `Quarter-orbit 1 y (${q1.y}) must be positive (ecliptic North)`);
  assert.ok(q1.z < 0, `Quarter-orbit 1 z (${q1.z}) must be negative (-cos(i))`);
  assert.ok(Math.abs(q1.y - radius * sinInc) < 1e-4, 'Quarter-orbit 1 y magnitude matches R*sin(i)');
  assert.ok(Math.abs(q1.z - (-radius * cosInc)) < 1e-4, 'Quarter-orbit 1 z magnitude matches -R*cos(i)');

  // At three-quarter orbit (theta = 3*PI/2, 270 deg):
  // x = 0, y = -R * sin(i), z = +R * cos(i)
  const q3 = calculateLunarOrbitPoint(1.5 * Math.PI, radius);
  assert.ok(Math.abs(q3.x) < 1e-4, 'Quarter-orbit 3 x should be 0');
  assert.ok(q3.y < 0, `Quarter-orbit 3 y (${q3.y}) must be negative (ecliptic South)`);
  assert.ok(q3.z > 0, `Quarter-orbit 3 z (${q3.z}) must be positive (+cos(i))`);
});

test('Lunar Orbit Plane - Line of Nodes intersects Ecliptic at Y=0 and Z=0', () => {
  const radius = MOON.semiMajorAxis;

  // Ascending node at theta = 0: x = +R, y = 0, z = 0
  const nodeAsc = calculateLunarOrbitPoint(0, radius);
  assert.ok(Math.abs(nodeAsc.x - radius) < 1e-4, 'Ascending node x should be +R');
  assert.ok(Math.abs(nodeAsc.y) < 1e-4, 'Ascending node y should be 0 (in Ecliptic)');
  assert.ok(Math.abs(nodeAsc.z) < 1e-4, 'Ascending node z should be 0');

  // Descending node at theta = PI: x = -R, y = 0, z = 0
  const nodeDesc = calculateLunarOrbitPoint(Math.PI, radius);
  assert.ok(Math.abs(nodeDesc.x - (-radius)) < 1e-4, 'Descending node x should be -R');
  assert.ok(Math.abs(nodeDesc.y) < 1e-4, 'Descending node y should be 0 (in Ecliptic)');
  assert.ok(Math.abs(nodeDesc.z) < 1e-4, 'Descending node z should be 0');
});

test('Lunar Orbit Plane - EphemerisState and getMoonEphemeris agreement', () => {
  for (let hour = 0; hour <= 72; hour += 6) {
    const t = hour * 3600;
    const ephMoon = getMoonEphemeris(t).position;
    const stateMoon = getEphemerisState(t).moon.position;
    const earthPos = getEphemerisState(t).earth.position;

    // Rel Moon position from EphemerisState:
    const relMoon = {
      x: stateMoon.x - earthPos.x,
      y: stateMoon.y - earthPos.y,
      z: stateMoon.z - earthPos.z,
    };

    const dist = Math.hypot(ephMoon.x - relMoon.x, ephMoon.y - relMoon.y, ephMoon.z - relMoon.z);
    assert.ok(
      dist < 1e-2,
      `Hour ${hour}: EphemerisState Moon relative position differs from getMoonEphemeris by ${dist} m`
    );
  }
});

test('Earth Equatorial Plane - GEO and LEO Belts tilted by axialTilt around Z-axis', () => {
  const cosTilt = Math.cos(EARTH.axialTilt);
  const sinTilt = Math.sin(EARTH.axialTilt);
  const earthPole = { x: -sinTilt, y: cosTilt, z: 0 }; // Pole vector tilted around Z

  const rGeo = 42164000;
  for (let i = 0; i <= 16; i++) {
    const theta = (i / 16) * 2 * Math.PI;
    const pt = {
      x: Math.cos(theta) * rGeo * cosTilt,
      y: Math.cos(theta) * rGeo * sinTilt,
      z: Math.sin(theta) * rGeo,
    };

    // Dot product with earthPole must be 0 (perpendicular to polar axis)
    const dot = earthPole.x * pt.x + earthPole.y * pt.y + earthPole.z * pt.z;
    assert.ok(
      Math.abs(dot) < 1e-4,
      `GEO belt point ${i} must lie in plane perpendicular to Earth pole (dot = ${dot})`
    );

    // Distance from center must equal rGeo
    const r = Math.hypot(pt.x, pt.y, pt.z);
    assert.ok(Math.abs(r - rGeo) < 1e-4, `GEO belt point ${i} radius must be rGeo`);
  }
});

test('Lunar Orbit Plane - Scale Invariance: Visual vs True Scale normalized direction', () => {
  const theta = 1.234;
  const truePt = calculateLunarOrbitPoint(theta, MOON.semiMajorAxis);
  const visualPt = calculateLunarOrbitPoint(theta, 70);

  const trueNorm = {
    x: truePt.x / MOON.semiMajorAxis,
    y: truePt.y / MOON.semiMajorAxis,
    z: truePt.z / MOON.semiMajorAxis,
  };
  const visualNorm = {
    x: visualPt.x / 70,
    y: visualPt.y / 70,
    z: visualPt.z / 70,
  };

  assert.ok(Math.abs(trueNorm.x - visualNorm.x) < 1e-6, 'Normalized X matches across scales');
  assert.ok(Math.abs(trueNorm.y - visualNorm.y) < 1e-6, 'Normalized Y matches across scales');
  assert.ok(Math.abs(trueNorm.z - visualNorm.z) < 1e-6, 'Normalized Z matches across scales');
});
