import { EARTH, SUN } from './constants.ts';

const BELT_INNER_EDGE = 2.1;
const BELT_OUTER_EDGE = 3.28;
const RADIANS_PER_DEGREE = Math.PI / 180;
const RADIANS_PER_ORBIT = 2 * Math.PI;

// Main Kirkwood gaps from the 3:1, 5:2, and 7:3 resonances with Jupiter.
const KIRKWOOD_GAPS = [[2.50, 0.027], [2.82, 0.021], [2.96, 0.016]] as const;

export function generateMainBelt(count: number) {
  // Keep the same representative population when the viewport is reopened.
  let seed = 19760407;
  const random = () => {
    seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
    return seed / 0x100000000;
  };

  return Array.from({ length: count }, () => {
    let semiMajorAxisAu: number;
    do {
      semiMajorAxisAu = BELT_INNER_EDGE + (BELT_OUTER_EDGE - BELT_INNER_EDGE) * random();
    } while (KIRKWOOD_GAPS.some(([center, halfWidth]) => Math.abs(semiMajorAxisAu - center) < halfWidth));

    return {
      semiMajorAxisAu,
      eccentricity: 0.015 + 0.13 * random() ** 1.8,
      inclination: (0.5 + 18 * random() ** 2.4) * RADIANS_PER_DEGREE,
      ascendingNode: random() * RADIANS_PER_ORBIT,
      perihelionAngle: random() * RADIANS_PER_ORBIT,
      meanAnomaly: random() * RADIANS_PER_ORBIT,
      meanMotionPerDay: Math.sqrt(SUN.mu / (semiMajorAxisAu * EARTH.semiMajorAxis) ** 3) * 86_400,
      prominence: random() ** 3,
    };
  });
}
