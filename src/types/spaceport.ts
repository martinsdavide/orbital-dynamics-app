export interface Spaceport {
  id: string;
  name: string;
  shortName: string;
  country: string;
  operator: string;
  latitude: number; // degrees
  longitude: number; // degrees
  elevation: number; // meters
  minLaunchAzimuth: number; // degrees (clockwise from North)
  maxLaunchAzimuth: number; // degrees
  equatorialBoostVelocity: number; // m/s (omega * R * cos(lat))
  minOrbitalInclination: number; // degrees (equal to latitude without dogleg)
  flag: string;
  description: string;
  historicMissions: string[];
  advantages: string[];
}
