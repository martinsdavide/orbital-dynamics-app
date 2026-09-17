// Fundamental Astrodynamics & Planetary Constants

export const G = 6.67430e-11; // m^3 kg^-1 s^-2

// Sun Constants
export const SUN = {
  mass: 1.9885e30, // kg
  radius: 6.96340e8, // m (696,340 km)
  mu: 1.32712440018e20, // m^3/s^2 (G * M_sun)
  color: 0xffdd44,
};

// Earth Constants
export const EARTH = {
  mass: 5.9722e24, // kg
  radius: 6.371e6, // m (6,371 km mean radius)
  mu: 3.986004418e14, // m^3/s^2 (G * M_earth)
  rotationPeriod: 86164.0905, // s (1 sidereal day)
  axialTilt: 23.4392811 * (Math.PI / 180), // rad (23.44 deg)
  semiMajorAxis: 1.495978707e11, // m (1 AU)
  eccentricity: 0.0167086,
  orbitalPeriod: 365.256363004 * 86400, // s (1 sidereal year)
  orbitalSpeedMean: 29780, // m/s (29.78 km/s)
  color: 0x2b65ec,
};

// Moon Constants
export const MOON = {
  mass: 7.342e22, // kg
  radius: 1.7374e6, // m (1,737.4 km)
  mu: 4.9048695e12, // m^3/s^2 (G * M_moon)
  semiMajorAxis: 3.844e8, // m (384,400 km)
  eccentricity: 0.0549,
  inclinationToEcliptic: 5.145 * (Math.PI / 180), // rad (5.145 deg true ecliptic inclination)
  inclinationToEarthEquatorMean: 23.44 + 5.145, // approx range 18.3° to 28.6°
  maxDeclinationDeg: 28.58, // Maximum lunar declination relative to Earth equator (axial tilt 23.44° + 5.145°)
  orbitalPeriod: 27.321661 * 86400, // s (27.32 days sidereal)
  synodicPeriod: 29.530589 * 86400, // s (29.53 days)
  soiRadius: 6.61e7, // m (66,100 km Laplace SOI)
  color: 0xc8c8c8,
};

// Atmospheric standard conditions
export const ATMOSPHERE = {
  seaLevelPressure: 101325, // Pa
  seaLevelDensity: 1.225, // kg/m^3
  scaleHeight: 8500, // m
  gamma: 1.4, // adiabatic index
  gasConstantR: 287.058, // J/(kg*K)
  standardGravity: 9.80665, // m/s^2 (g0)
};

// Solar System Planets Constants (IAU / NASA Planetary Fact Sheets)
export interface PlanetConfig {
  name: string;
  key: 'mercury' | 'venus' | 'earth' | 'mars' | 'jupiter' | 'saturn' | 'uranus' | 'neptune';
  mass: number; // kg
  radius: number; // m
  semiMajorAxis: number; // m
  eccentricity: number;
  orbitalPeriod: number; // s
  inclinationToEclipticRad: number; // rad
  inclinationDeg: number;
  rotationPeriod: number; // s
  axialTiltRad: number;
  axialTiltDeg: number;
  color: number;
  colorHex: string;
  visualRadius: number;
  visualDistance: number;
  hasRings?: boolean;
  meanAnomalyJ2000Rad?: number;
}

export const PLANET_CONFIGS: PlanetConfig[] = [
  {
    name: 'Mercury',
    key: 'mercury',
    mass: 3.3011e23,
    radius: 2.4397e6,
    semiMajorAxis: 5.7909e10, // 0.3871 AU
    eccentricity: 0.20563,
    orbitalPeriod: 87.969 * 86400,
    inclinationToEclipticRad: 7.005 * (Math.PI / 180),
    inclinationDeg: 7.005,
    rotationPeriod: 58.646 * 86400,
    axialTiltRad: 0.034 * (Math.PI / 180),
    axialTiltDeg: 0.034,
    color: 0x9e9e9e,
    colorHex: '#9e9e9e',
    visualRadius: 3.8,
    visualDistance: 130,
    meanAnomalyJ2000Rad: 3.0508,
  },
  {
    name: 'Venus',
    key: 'venus',
    mass: 4.8675e24,
    radius: 6.0518e6,
    semiMajorAxis: 1.0821e11, // 0.7233 AU
    eccentricity: 0.00677,
    orbitalPeriod: 224.701 * 86400,
    inclinationToEclipticRad: 3.3947 * (Math.PI / 180),
    inclinationDeg: 3.395,
    rotationPeriod: -243.02 * 86400, // retrograde
    axialTiltRad: 177.36 * (Math.PI / 180),
    axialTiltDeg: 177.36,
    color: 0xe5c158,
    colorHex: '#e5c158',
    visualRadius: 9.5,
    visualDistance: 220,
    meanAnomalyJ2000Rad: 0.8745,
  },
  {
    name: 'Earth',
    key: 'earth',
    mass: EARTH.mass,
    radius: EARTH.radius,
    semiMajorAxis: EARTH.semiMajorAxis,
    eccentricity: EARTH.eccentricity,
    orbitalPeriod: EARTH.orbitalPeriod,
    inclinationToEclipticRad: 0,
    inclinationDeg: 0,
    rotationPeriod: EARTH.rotationPeriod,
    axialTiltRad: EARTH.axialTilt,
    axialTiltDeg: 23.44,
    color: 0x2b65ec,
    colorHex: '#2b65ec',
    visualRadius: 10.0,
    visualDistance: 320,
    meanAnomalyJ2000Rad: 0.0,
  },
  {
    name: 'Mars',
    key: 'mars',
    mass: 6.4171e23,
    radius: 3.3895e6,
    semiMajorAxis: 2.2792e11, // 1.5237 AU
    eccentricity: 0.0934,
    orbitalPeriod: 686.98 * 86400,
    inclinationToEclipticRad: 1.85 * (Math.PI / 180),
    inclinationDeg: 1.85,
    rotationPeriod: 88642.66, // 24.62 h
    axialTiltRad: 25.19 * (Math.PI / 180),
    axialTiltDeg: 25.19,
    color: 0xc1440e,
    colorHex: '#c1440e',
    visualRadius: 5.3,
    visualDistance: 430,
    meanAnomalyJ2000Rad: 0.338,
  },
  {
    name: 'Jupiter',
    key: 'jupiter',
    mass: 1.8982e27,
    radius: 6.9911e7,
    semiMajorAxis: 7.7857e11, // 5.2044 AU
    eccentricity: 0.0489,
    orbitalPeriod: 4332.59 * 86400,
    inclinationToEclipticRad: 1.303 * (Math.PI / 180),
    inclinationDeg: 1.303,
    rotationPeriod: 35730, // 9.925 h
    axialTiltRad: 3.13 * (Math.PI / 180),
    axialTiltDeg: 3.13,
    color: 0xd4a373,
    colorHex: '#d4a373',
    visualRadius: 22.0,
    visualDistance: 620,
    meanAnomalyJ2000Rad: 0.349,
  },
  {
    name: 'Saturn',
    key: 'saturn',
    mass: 5.6834e26,
    radius: 5.8232e7,
    semiMajorAxis: 1.4335e12, // 9.582 AU
    eccentricity: 0.0565,
    orbitalPeriod: 10759.22 * 86400,
    inclinationToEclipticRad: 2.485 * (Math.PI / 180),
    inclinationDeg: 2.485,
    rotationPeriod: 38360, // 10.65 h
    axialTiltRad: 26.73 * (Math.PI / 180),
    axialTiltDeg: 26.73,
    color: 0xe0c080,
    colorHex: '#e0c080',
    visualRadius: 18.0,
    visualDistance: 820,
    hasRings: true,
    meanAnomalyJ2000Rad: 5.533,
  },
  {
    name: 'Uranus',
    key: 'uranus',
    mass: 8.6810e25,
    radius: 2.5362e7,
    semiMajorAxis: 2.8725e12, // 19.20 AU
    eccentricity: 0.0463,
    orbitalPeriod: 30685.4 * 86400,
    inclinationToEclipticRad: 0.772 * (Math.PI / 180),
    inclinationDeg: 0.772,
    rotationPeriod: -62060, // -17.24 h retrograde
    axialTiltRad: 97.77 * (Math.PI / 180),
    axialTiltDeg: 97.77,
    color: 0x76b6c4,
    colorHex: '#76b6c4',
    visualRadius: 12.0,
    visualDistance: 1040,
    meanAnomalyJ2000Rad: 2.482,
  },
  {
    name: 'Neptune',
    key: 'neptune',
    mass: 1.0241e26,
    radius: 2.4622e7,
    semiMajorAxis: 4.4951e12, // 30.05 AU
    eccentricity: 0.00946,
    orbitalPeriod: 60189.0 * 86400,
    inclinationToEclipticRad: 1.769 * (Math.PI / 180),
    inclinationDeg: 1.769,
    rotationPeriod: 57996, // 16.11 h
    axialTiltRad: 28.32 * (Math.PI / 180),
    axialTiltDeg: 28.32,
    color: 0x274687,
    colorHex: '#274687',
    visualRadius: 11.5,
    visualDistance: 1260,
    meanAnomalyJ2000Rad: 4.472,
  },
];

// Visual Scaling Factor Presets
export const SCALING = {
  // Visual Mode (exaggerated sizes so bodies are clearly visible in the same frame)
  visual: {
    earthRadius: 10,
    moonRadius: 2.7,
    sunRadius: 35,
    earthMoonDistance: 70,
    sunEarthDistance: 320,
    orbitLineWidth: 1.5,
  },
  // True Scale Mode
  trueScale: {
    earthRadius: 1,
    moonRadius: 0.272,
    sunRadius: 109.2,
    earthMoonDistance: 60.3, // Earth radii units
    sunEarthDistance: 23481, // Earth radii units
    orbitLineWidth: 1.0,
  }
};
