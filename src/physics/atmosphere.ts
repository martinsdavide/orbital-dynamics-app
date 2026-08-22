import { ATMOSPHERE } from './constants';

export interface AtmosphericState {
  temperature: number; // Kelvin
  pressure: number; // Pascal
  density: number; // kg/m^3
  speedOfSound: number; // m/s
  dynamicPressure: number; // Pa (0.5 * rho * v^2)
  machNumber: number;
  dragCoefficient: number;
}

/**
 * Computes atmospheric parameters up to 120km based on US Standard Atmosphere approximation.
 * @param altitudeMeters Altitude above sea level in meters
 * @param velocityMps Current vehicle speed in m/s
 */
export function getAtmosphericState(altitudeMeters: number, velocityMps: number): AtmosphericState {
  const h = Math.max(0, altitudeMeters);

  let T = 288.15; // Sea level temperature (K)
  let P = ATMOSPHERE.seaLevelPressure;
  let rho = ATMOSPHERE.seaLevelDensity;

  if (h < 11000) {
    // Troposphere (0 - 11 km)
    const lapseRate = -0.0065; // K/m
    T = 288.15 + lapseRate * h;
    P = ATMOSPHERE.seaLevelPressure * Math.pow(T / 288.15, -ATMOSPHERE.standardGravity / (lapseRate * ATMOSPHERE.gasConstantR));
    rho = P / (ATMOSPHERE.gasConstantR * T);
  } else if (h < 20000) {
    // Lower Stratosphere (11 - 20 km) - isothermal
    T = 216.65;
    const P11 = 22632.1;
    P = P11 * Math.exp(-ATMOSPHERE.standardGravity * (h - 11000) / (ATMOSPHERE.gasConstantR * T));
    rho = P / (ATMOSPHERE.gasConstantR * T);
  } else if (h < 32000) {
    // Upper Stratosphere (20 - 32 km)
    const lapseRate = 0.001;
    T = 216.65 + lapseRate * (h - 20000);
    const P20 = 5474.89;
    P = P20 * Math.pow(T / 216.65, -ATMOSPHERE.standardGravity / (lapseRate * ATMOSPHERE.gasConstantR));
    rho = P / (ATMOSPHERE.gasConstantR * T);
  } else if (h < 80000) {
    // Mesosphere (32 - 80 km) - exponential falloff
    T = Math.max(180, 228.65 - 0.0028 * (h - 32000));
    rho = ATMOSPHERE.seaLevelDensity * Math.exp(-h / ATMOSPHERE.scaleHeight);
    P = rho * ATMOSPHERE.gasConstantR * T;
  } else if (h < 120000) {
    // Thermosphere boundary
    T = 180 + 0.003 * (h - 80000);
    rho = ATMOSPHERE.seaLevelDensity * Math.exp(-h / 7200);
    P = rho * ATMOSPHERE.gasConstantR * T;
  } else {
    // Space vacuum (> 120 km)
    T = 200;
    P = 0;
    rho = 0;
  }

  // Speed of sound: a = sqrt(gamma * R * T)
  const a = Math.sqrt(ATMOSPHERE.gamma * ATMOSPHERE.gasConstantR * T);
  const mach = a > 0 ? velocityMps / a : 0;

  // Mach-dependent drag coefficient (transonic wave drag peak)
  let Cd = 0.30;
  if (mach < 0.8) {
    Cd = 0.30 - 0.05 * mach;
  } else if (mach <= 1.2) {
    // Transonic spike
    Cd = 0.26 + 0.35 * Math.sin(((mach - 0.8) / 0.4) * Math.PI / 2);
  } else if (mach < 5.0) {
    // Supersonic decay
    Cd = 0.61 * Math.pow(mach, -0.4);
  } else {
    // Hypersonic
    Cd = 0.32;
  }

  // Dynamic pressure: q = 0.5 * rho * v^2
  const dynamicPressure = 0.5 * rho * velocityMps * velocityMps;

  return {
    temperature: T,
    pressure: P,
    density: rho,
    speedOfSound: a,
    dynamicPressure,
    machNumber: mach,
    dragCoefficient: Cd,
  };
}
