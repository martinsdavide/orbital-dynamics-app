import type { PlanetConfig } from './constants.ts';
import { calculateKeplerianOrbit } from './orbitalMechanics.ts';

export type PlanetaryMoonKey = 'phobos' | 'deimos' | 'io' | 'europa' | 'ganymede' | 'callisto' | 'titan';

interface PlanetaryMoon {
  key: PlanetaryMoonKey;
  name: string;
  host: 'mars' | 'jupiter' | 'saturn';
  radius: number;
  semiMajorAxis: number;
  eccentricity: number;
  orbitalPeriod: number;
  inclinationDeg: number;
  phase: number;
  color: string;
}

export const PLANETARY_MOONS: PlanetaryMoon[] = [
  {
    key: 'phobos', name: 'Phobos', host: 'mars', radius: 11_267,
    semiMajorAxis: 9_376_000, eccentricity: 0.0151, orbitalPeriod: 0.31891 * 86_400,
    inclinationDeg: 1.09, phase: 0.25, color: '#a89585',
  },
  {
    key: 'deimos', name: 'Deimos', host: 'mars', radius: 6_200,
    semiMajorAxis: 23_463_000, eccentricity: 0.00033, orbitalPeriod: 1.26244 * 86_400,
    inclinationDeg: 1.79, phase: 2.3, color: '#c0b2a1',
  },
  {
    key: 'io', name: 'Io', host: 'jupiter', radius: 1_821_600,
    semiMajorAxis: 421_700_000, eccentricity: 0.0041, orbitalPeriod: 1.769138 * 86_400,
    inclinationDeg: 0.04, phase: 5.3, color: '#e9bc5b',
  },
  {
    key: 'europa', name: 'Europa', host: 'jupiter', radius: 1_560_800,
    semiMajorAxis: 671_100_000, eccentricity: 0.0094, orbitalPeriod: 3.551181 * 86_400,
    inclinationDeg: 0.47, phase: 4.2, color: '#dbc3a4',
  },
  {
    key: 'ganymede', name: 'Ganymede', host: 'jupiter', radius: 2_634_100,
    semiMajorAxis: 1_070_400_000, eccentricity: 0.0013, orbitalPeriod: 7.15455 * 86_400,
    inclinationDeg: 0.20, phase: 0.9, color: '#b2a99f',
  },
  {
    key: 'callisto', name: 'Callisto', host: 'jupiter', radius: 2_410_300,
    semiMajorAxis: 1_882_700_000, eccentricity: 0.0074, orbitalPeriod: 16.68902 * 86_400,
    inclinationDeg: 0.28, phase: 2.65, color: '#817368',
  },
  {
    key: 'titan', name: 'Titan', host: 'saturn', radius: 2_574_700,
    semiMajorAxis: 1_221_870_000, eccentricity: 0.0288, orbitalPeriod: 15.945 * 86_400,
    inclinationDeg: 0.35, phase: 1.6, color: '#e5ae62',
  },
];

export function calculatePlanetaryMoonPosition(moon: PlanetaryMoon, host: PlanetConfig, timeSeconds: number) {
  const hostMu = 6.67430e-11 * host.mass;
  const { position } = calculateKeplerianOrbit(
    moon.semiMajorAxis, moon.eccentricity, moon.orbitalPeriod,
    moon.inclinationDeg * Math.PI / 180, timeSeconds, moon.phase, hostMu
  );
  const cosTilt = Math.cos(host.axialTiltRad);
  const sinTilt = Math.sin(host.axialTiltRad);
  return {
    x: position.x * cosTilt - position.y * sinTilt,
    y: position.x * sinTilt + position.y * cosTilt,
    z: position.z,
  };
}
