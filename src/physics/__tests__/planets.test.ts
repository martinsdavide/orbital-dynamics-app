import test from 'node:test';
import assert from 'node:assert/strict';
import { getEphemerisState, magnitude } from '../orbitalMechanics.ts';
import { EARTH, MOON, PLANET_CONFIGS, SUN } from '../constants.ts';
import { Vector3 } from 'three';
import { getMoonOrbitScale, getSolarSystemOffset, projectPlanet, samplePlanetOrbit } from '../../components/canvas/PlanetaryScene.ts';
import { calculatePlanetaryMoonPosition, PLANETARY_MOONS } from '../planetaryMoons.ts';

test('Planetary Ephemeris - All 8 Major Planets Populated in EphemerisState', () => {
  assert.equal(PLANET_CONFIGS.length, 8, 'Should have 8 planet configurations');
  const eph = getEphemerisState(0);
  assert.ok(eph.planets, 'planets array should exist');
  assert.equal(eph.planets.length, 8, 'Should have 8 solar system planets');

  const expectedKeys = ['mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune'];
  expectedKeys.forEach((key) => {
    const found = eph.planets.find((p) => p.key === key);
    assert.ok(found, `Planet ${key} should be present in ephemeris`);
    assert.ok(found.mass > 0, `Planet ${key} must have positive mass`);
    assert.ok(found.radius > 0, `Planet ${key} must have positive radius`);
  });
});

test('Planetary Ephemeris - Keplerian Ordering and Distance Boundaries', () => {
  const eph = getEphemerisState(86400 * 30); // 30 days into simulation

  // Verify semi-major axis increases monotonically
  for (let i = 0; i < eph.planets.length - 1; i++) {
    const current = eph.planets[i];
    const next = eph.planets[i + 1];
    assert.ok(
      next.semiMajorAxis > current.semiMajorAxis,
      `${next.name} semi-major axis must exceed ${current.name}`
    );
    assert.ok(
      next.orbitalPeriod > current.orbitalPeriod,
      `${next.name} orbital period must exceed ${current.name} (Kepler's 3rd Law)`
    );
  }

  // Verify distance from Sun remains within perihelion [a(1-e)] and aphelion [a(1+e)]
  eph.planets.forEach((p) => {
    const rSun = p.distanceFromSunMeters;
    const perihelion = p.semiMajorAxis * (1 - p.eccentricity) * 0.99;
    const aphelion = p.semiMajorAxis * (1 + p.eccentricity) * 1.01;
    assert.ok(
      rSun >= perihelion && rSun <= aphelion,
      `${p.name} distance ${rSun} must lie within [${perihelion}, ${aphelion}]`
    );
  });
});

test('Planetary Ephemeris - Earth State Agreement & Geocentric Relative Distance', () => {
  const eph = getEphemerisState(86400 * 180);
  const earthPlanet = eph.planets.find((p) => p.key === 'earth');
  assert.ok(earthPlanet, 'Earth planet state must be found');

  // Exact position agreement with central earth state
  assert.equal(earthPlanet.position.x, eph.earth.position.x);
  assert.equal(earthPlanet.position.y, eph.earth.position.y);
  assert.equal(earthPlanet.position.z, eph.earth.position.z);
  assert.equal(earthPlanet.distanceFromEarthMeters, 0, 'Distance from Earth to itself must be 0');

  // Other planets must have strictly positive distances from Earth
  eph.planets
    .filter((p) => p.key !== 'earth')
    .forEach((p) => {
      assert.ok(
        p.distanceFromEarthMeters > 1e9,
        `${p.name} distance from Earth must be > 1,000,000 km`
      );
    });
});

test('Planetary Ephemeris - Orbital Velocity Vis-Viva Consistency', () => {
  const eph = getEphemerisState(86400 * 90);

  eph.planets.forEach((p) => {
    const speed = magnitude(p.velocity);
    const r = p.distanceFromSunMeters;
    const a = p.semiMajorAxis;
    // Theoretical vis-viva speed v = sqrt(GM * (2/r - 1/a))
    const expectedSpeed = Math.sqrt(SUN.mu * (2 / r - 1 / a));
    const relError = Math.abs(speed - expectedSpeed) / expectedSpeed;
    assert.ok(
      relError < 0.05,
      `${p.name} orbital velocity ${speed} m/s matches vis-viva ${expectedSpeed} m/s within 5%`
    );
  });
});

test('Planetary scene guides follow the ephemeris in both scales', () => {
  for (const [scaleMode, sunEarthDistance] of [['visual', 320], ['true', 1200]] as const) {
    for (const planet of PLANET_CONFIGS) {
      const guide = samplePlanetOrbit(planet, scaleMode, sunEarthDistance);
      assert.ok(guide[0].distanceTo(guide.at(-1)!) < 1e-8, `${planet.name} orbit closes`);

      for (const index of [0, 1, 64, 128, 192, 256]) {
        const time = index / (guide.length - 1) * planet.orbitalPeriod;
        const { position } = getEphemerisState(time).planets.find(body => body.key === planet.key)!;
        const mesh = projectPlanet(position, planet, scaleMode, sunEarthDistance);
        assert.ok(mesh.distanceTo(guide[index]) < 1e-8, `${planet.name} lies on its orbit guide`);
      }

      const eclipticAngularMomentum = guide[0].clone().cross(guide[1]).y;
      assert.ok(eclipticAngularMomentum > 0, `${planet.name} revolves prograde`);
      if (planet.inclinationDeg > 0) {
        assert.ok(guide.some(point => point.y > 0) && guide.some(point => point.y < 0));
      }
    }
  }
});

test('Planetary scene uses the selected origin while preserving relative distances', () => {
  const earth = new Vector3(-30, 0, -320);
  const moonRelativeToEarth = new Vector3(3, 4, 70);
  const planet = new Vector3(20, 7, 110);
  const geocentric = getSolarSystemOffset('geocentric', earth, moonRelativeToEarth);
  assert.equal(earth.clone().add(geocentric).length(), 0);
  assert.ok(planet.clone().add(geocentric).distanceTo(planet.clone().sub(earth)) < 1e-10);

  const barycentric = getSolarSystemOffset('barycentric', earth, moonRelativeToEarth);
  const earthInFrame = earth.clone().add(barycentric);
  const moonInFrame = earthInFrame.clone().add(moonRelativeToEarth);
  const centerOfMass = earthInFrame.clone().addScaledVector(moonInFrame, MOON.mass / EARTH.mass);
  assert.ok(centerOfMass.length() < 1e-10);
  assert.ok(planet.clone().add(barycentric).sub(earthInFrame).distanceTo(planet.clone().sub(earth)) < 1e-10);
});

test('Planetary moons revolve around their hosts in tilted prograde orbits', () => {
  for (const moon of PLANETARY_MOONS) {
    const host = PLANET_CONFIGS.find(planet => planet.key === moon.host)!;
    const positionAt = (time: number) => new Vector3().copy(calculatePlanetaryMoonPosition(moon, host, time));
    const start = positionAt(0);
    const next = positionAt(moon.orbitalPeriod / 256);
    const fullOrbit = positionAt(moon.orbitalPeriod);
    assert.ok(start.distanceTo(fullOrbit) < moon.semiMajorAxis * 1e-12, moon.name);

    const normal = start.clone().cross(next).normalize();
    const hostPole = new Vector3(-Math.sin(host.axialTiltRad), Math.cos(host.axialTiltRad), 0);
    assert.ok(Math.abs(normal.angleTo(hostPole) - moon.inclinationDeg * Math.PI / 180) < 1e-10, moon.name);

    const periapsis = moon.semiMajorAxis * (1 - moon.eccentricity);
    const apoapsis = moon.semiMajorAxis * (1 + moon.eccentricity);
    for (let i = 0; i < 32; i++) {
      const distance = positionAt(i / 32 * moon.orbitalPeriod).length();
      assert.ok(distance >= periapsis - 1e-5 && distance <= apoapsis + 1e-5, moon.name);
    }
  }
});

test('Jupiter moon orbits retain their relative spacing in visual scale', () => {
  const jupiter = PLANET_CONFIGS.find(planet => planet.key === 'jupiter')!;
  const [ganymede, callisto] = PLANETARY_MOONS.filter(moon => moon.host === 'jupiter');
  const scale = getMoonOrbitScale(jupiter, 'visual');
  assert.ok(ganymede.semiMajorAxis * scale > jupiter.visualRadius);
  assert.ok(ganymede.semiMajorAxis * scale < callisto.semiMajorAxis * scale);
  assert.ok(callisto.semiMajorAxis * scale <= 100 + 1e-10);
});
