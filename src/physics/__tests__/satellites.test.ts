import assert from 'node:assert/strict';
import { test } from 'node:test';
import { archivedIss, readIssFeed, sampleSatellite, sampleSatellitePaths, satelliteEpoch, satellitePeriodMinutes } from '../satellites.ts';

test('ISS telemetry matches independent SGP4 and WGS84 reference values at a fixed UTC time', () => {
  // Cross-checked using Python sgp4 2.27 and a WGS84 geodetic conversion.
  const utc = Date.parse('2019-06-05T13:00:00Z');
  const sample = sampleSatellite(archivedIss, utc);
  assert.ok(sample);
  assert.ok(Math.abs(sample.altitude - 420.366034) < 0.001);
  assert.ok(Math.abs(sample.speed - 7.656846) < 0.00001);
  assert.ok(Math.abs(sample.latitude - (-5.264349)) < 0.0001);
  assert.ok(Math.abs(sample.longitude - 154.584523) < 0.0001);
  assert.ok(Math.abs(satellitePeriodMinutes(archivedIss) - 92.83) < 0.1);
});

test('The orbit starts at the ISS marker and the ground track uses rotating-Earth subpoints', () => {
  const time = satelliteEpoch(archivedIss);
  const { orbit, ground } = sampleSatellitePaths(archivedIss, time);
  assert.equal(orbit.length, 181);
  assert.equal(ground.length, 181);
  assert.deepEqual(orbit[0], sampleSatellite(archivedIss, time)?.point);
  for (const point of ground) assert.ok(Math.abs(Math.hypot(...point) - 1.002) < 1e-12);
  const separation = Math.hypot(...ground[0].map((axis, i) => axis - ground.at(-1)![i]));
  assert.ok(separation > 0.35 && separation < 0.5);
});

test('The ISS feed accepts CelesTrak OMM elements and rejects malformed or unrelated records', () => {
  const elements = {
    OBJECT_NAME: 'ISS (ZARYA)', OBJECT_ID: '1998-067A', NORAD_CAT_ID: 25544, ELEMENT_SET_NO: 999,
    EPOCH: '2019-06-05T12:12:58.000000', MEAN_MOTION: 15.51174618, ECCENTRICITY: 0.0008217,
    INCLINATION: 51.6433, RA_OF_ASC_NODE: 59.2583, ARG_OF_PERICENTER: 16.4489, MEAN_ANOMALY: 347.6017,
    BSTAR: 0.000059442, MEAN_MOTION_DOT: 0.00003075, MEAN_MOTION_DDOT: 0,
  };
  const fetchedAt = '2019-06-05T13:00:00Z';
  const feed = readIssFeed({ elements, fetchedAt });
  assert.equal(feed?.fetchedAt, fetchedAt);
  assert.equal(feed?.record.satnum, '25544');
  assert.equal(readIssFeed({ elements: { ...elements, NORAD_CAT_ID: 1 }, fetchedAt }), undefined);
  assert.equal(readIssFeed({ elements: { ...elements, MEAN_MOTION: 'invalid' }, fetchedAt }), undefined);
});
