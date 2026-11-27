import { degreesLat, degreesLong, eciToEcf, eciToGeodetic, gstime, invjday, json2satrec, propagate, twoline2satrec } from 'satellite.js';
import type { SatRec } from 'satellite.js';

export const SATELLITE_EARTH_RADIUS_KM = 6378.137;
const MINUTE_MS = 60_000;
export const MAX_ELEMENT_AGE_MS = 7 * 24 * 60 * MINUTE_MS;

// Archived ISS elements from the satellite.js documentation example.
export const archivedIss = twoline2satrec(
  '1 25544U 98067A   19156.50900463  .00003075  00000-0  59442-4 0  9992',
  '2 25544  51.6433  59.2583 0008217  16.4489 347.6017 15.51174618173442',
);

export function readIssFeed(value: unknown) {
  if (!value || typeof value !== 'object' || !('elements' in value) || !('fetchedAt' in value)) return;
  const { elements, fetchedAt } = value;
  if (!elements || typeof elements !== 'object' || typeof fetchedAt !== 'string' || !Number.isFinite(Date.parse(fetchedAt))) return;
  const fields = elements as Record<string, unknown>;
  const orbitalFields = ['MEAN_MOTION', 'ECCENTRICITY', 'INCLINATION', 'RA_OF_ASC_NODE', 'ARG_OF_PERICENTER', 'MEAN_ANOMALY', 'BSTAR', 'MEAN_MOTION_DOT', 'MEAN_MOTION_DDOT'];
  if (Number(fields.NORAD_CAT_ID) !== 25544 || typeof fields.EPOCH !== 'string'
    || !Number.isFinite(Date.parse(fields.EPOCH.endsWith('Z') ? fields.EPOCH : fields.EPOCH + 'Z'))
    || orbitalFields.some(key => !['string', 'number'].includes(typeof fields[key]) || !Number.isFinite(Number(fields[key])))
    || Number(fields.MEAN_MOTION) <= 0 || Number(fields.ECCENTRICITY) < 0 || Number(fields.ECCENTRICITY) >= 1) return;
  const record = json2satrec(fields as Parameters<typeof json2satrec>[0]);
  if (!sampleSatellite(record, satelliteEpoch(record))) return;
  return { record, fetchedAt };
}

export function satelliteEpoch(record: SatRec) {
  return (invjday(record.jdsatepoch) as Date).getTime();
}

const scenePoint = (p: { x: number; y: number; z: number }) =>
  [p.x / SATELLITE_EARTH_RADIUS_KM, p.z / SATELLITE_EARTH_RADIUS_KM, -p.y / SATELLITE_EARTH_RADIUS_KM] as const;

export function sampleSatellite(record: SatRec, timeMs: number) {
  const date = new Date(timeMs);
  const state = propagate(record, date);
  if (!state?.position || !state.velocity) return;
  const { position, velocity } = state;
  const sidereal = gstime(date);
  const geodetic = eciToGeodetic(position, sidereal);
  const speed = Math.hypot(velocity.x, velocity.y, velocity.z);
  if (![speed, geodetic.height, geodetic.latitude, geodetic.longitude].every(Number.isFinite)) return;
  return {
    point: scenePoint(eciToEcf(position, sidereal)),
    altitude: geodetic.height,
    latitude: degreesLat(geodetic.latitude),
    longitude: degreesLong(geodetic.longitude),
    speed,
  };
}

export function satellitePeriodMinutes(record: SatRec) {
  return 2 * Math.PI / record.no;
}

export function sampleSatellitePaths(record: SatRec, timeMs: number) {
  const orbit = [];
  const ground = [];
  const sidereal = gstime(new Date(timeMs));
  const duration = satellitePeriodMinutes(record) * MINUTE_MS;

  for (let i = 0; i <= 180; i++) {
    const date = new Date(timeMs + duration * i / 180);
    const state = propagate(record, date);
    if (!state?.position) return { orbit: [], ground: [] };
    orbit.push(scenePoint(eciToEcf(state.position, sidereal)));
    const { latitude, longitude } = eciToGeodetic(state.position, gstime(date));
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return { orbit: [], ground: [] };
    // Draw on the spherical display globe at the geodetic subpoint.
    const radius = SATELLITE_EARTH_RADIUS_KM * 1.002;
    ground.push(scenePoint({
      x: radius * Math.cos(latitude) * Math.cos(longitude),
      y: radius * Math.cos(latitude) * Math.sin(longitude),
      z: radius * Math.sin(latitude),
    }));
  }
  return { orbit, ground };
}
