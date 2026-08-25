export type ReferenceFrame = 'heliocentric' | 'geocentric';
export type ScaleMode = 'visual' | 'true';

export interface Vector3D {
  x: number;
  y: number;
  z: number;
}

export interface CelestialBodyState {
  name: string;
  position: Vector3D;
  velocity: Vector3D;
  radius: number;
  mass: number;
  rotationAngle: number;
}

export interface LagrangePoint {
  name: string;
  description: string;
  position: Vector3D;
  system: 'Earth-Moon' | 'Sun-Earth';
  isStable: boolean;
}

export interface EphemerisState {
  timeSeconds: number;
  sun: CelestialBodyState;
  earth: CelestialBodyState;
  moon: CelestialBodyState;
  lagrangePoints: LagrangePoint[];
  earthPhaseAngle: number;
  moonPhaseAngle: number;
  eclipseStatus: 'none' | 'solar_eclipse' | 'lunar_eclipse';
}
