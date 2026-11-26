import type { BoosterSeparation } from '../types/rocket.ts';

export const SUPER_HEAVY_PRESET_ID = 'starship_v3';
export const BOOSTBACK_IGNITION_SECONDS = 9;
export const BOOSTBACK_CUTOFF_SECONDS = 39;
const COAST_PREVIEW_SECONDS = 15;
const BOOSTBACK_ACCELERATION = 25;
const RETURN_PITCH = 170;

export function sampleBoosterReturn(separation: BoosterSeparation, elapsedSeconds: number) {
  // Illustrative planar return segment with constant gravity and a timed burn.
  const end = BOOSTBACK_CUTOFF_SECONDS + COAST_PREVIEW_SECONDS;
  const elapsed = Math.min(end, Math.max(0, elapsedSeconds));
  const flip = Math.min(1, elapsed / BOOSTBACK_IGNITION_SECONDS);
  const pitchAngle = separation.pitchAngle + (RETURN_PITCH - separation.pitchAngle) * flip ** 2 * (3 - 2 * flip);
  const burnTime = Math.max(0, Math.min(elapsed, BOOSTBACK_CUTOFF_SECONDS) - BOOSTBACK_IGNITION_SECONDS);
  const driftTime = Math.max(0, elapsed - BOOSTBACK_CUTOFF_SECONDS);
  const drivenDistance = burnTime * (burnTime / 2 + driftTime);
  const pitch = RETURN_PITCH * Math.PI / 180;
  const horizontalAcceleration = BOOSTBACK_ACCELERATION * Math.cos(pitch);
  const verticalAcceleration = BOOSTBACK_ACCELERATION * Math.sin(pitch);
  const altitude = separation.altitude + separation.verticalSpeed * elapsed - 4.9 * elapsed ** 2
    + verticalAcceleration * drivenDistance;
  const phase = altitude <= 0 || elapsed >= end ? 'Preview complete'
    : elapsed < BOOSTBACK_IGNITION_SECONDS ? 'Separation flip'
    : elapsed < BOOSTBACK_CUTOFF_SECONDS ? 'Boostback burn'
    : 'Post-burn coast';
  return {
    phase,
    elapsed,
    pitchAngle,
    altitude: Math.max(0, altitude),
    downrangeDistance: separation.downrangeDistance + separation.horizontalSpeed * elapsed + horizontalAcceleration * drivenDistance,
    horizontalSpeed: separation.horizontalSpeed + horizontalAcceleration * burnTime,
    verticalSpeed: separation.verticalSpeed - 9.8 * elapsed + verticalAcceleration * burnTime,
  };
}
