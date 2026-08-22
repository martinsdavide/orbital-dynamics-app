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
  inclinationToEcliptic: 5.145 * (Math.PI / 180), // rad (5.145 deg)
  inclinationToEarthEquatorMean: 23.44 + 5.145, // approx range 18.3° to 28.6°
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
