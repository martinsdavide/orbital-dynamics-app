import type { BoosterSeparation, RocketTelemetry } from '../types/rocket.ts';
import type { Spaceport } from '../types/spaceport.ts';

export const SUPER_HEAVY_PRESET_ID = 'starship_v3';
export const BOOSTBACK_IGNITION_SECONDS = 9;
export const BOOSTBACK_CUTOFF_SECONDS = 84;

const GRAVITY = 9.8;
const ENTRY_HEIGHT = 55_000;
const GATE_HEIGHT = 1_400;
const CATCH_HEIGHT = 45;
const LANDING_SECONDS = 22;
const RETURN_PITCH = 170;

export function hasSuperHeavyCatchTower(site: Spaceport) {
  return site.id === 'spacex_starbase';
}

export function boosterReturnElapsed(telemetry: RocketTelemetry) {
  return telemetry.boosterElapsedSeconds ?? telemetry.time - (telemetry.boosterSeparation?.time ?? telemetry.time);
}

function descendingCrossing(height: number, speed: number, target: number) {
  return (speed + Math.sqrt(Math.max(0, speed ** 2 + 2 * GRAVITY * (height - target)))) / GRAVITY;
}

function blend(start: number, end: number, fraction: number) {
  return start + (end - start) * fraction ** 2 * (3 - 2 * fraction);
}

interface AxisState {
  position: number;
  speed: number;
}

// Match position and velocity at both ends of each illustrative approach segment.
function interpolate(start: AxisState, end: AxisState, duration: number, time: number): AxisState {
  const t = time / duration;
  const delta = end.position - start.position;
  const a = 3 * delta - duration * (2 * start.speed + end.speed);
  const b = -2 * delta + duration * (start.speed + end.speed);
  return {
    position: start.position + t * (duration * start.speed + t * (a + t * b)),
    speed: start.speed + t * (2 * a + 3 * b * t) / duration,
  };
}

export function createBoosterReturn(separation: BoosterSeparation, site: Spaceport) {
  const ground = site.elevation;
  const towerAvailable = hasSuperHeavyCatchTower(site);
  const burnDuration = BOOSTBACK_CUTOFF_SECONDS - BOOSTBACK_IGNITION_SECONDS;
  const verticalBoost = 2.5;
  const cutoffHeight = separation.altitude + separation.verticalSpeed * BOOSTBACK_CUTOFF_SECONDS
    - GRAVITY * BOOSTBACK_CUTOFF_SECONDS ** 2 / 2 + verticalBoost * burnDuration ** 2 / 2;
  const cutoffVerticalSpeed = separation.verticalSpeed - GRAVITY * BOOSTBACK_CUTOFF_SECONDS + verticalBoost * burnDuration;
  const entryHeight = Math.min(ground + ENTRY_HEIGHT, cutoffHeight);
  const coastDuration = Math.max(0, descendingCrossing(cutoffHeight, cutoffVerticalSpeed, entryHeight));

  // Only the tower scenario aims back at the pad. Limit the illustrative correction so an off-profile ascent can miss.
  const uncorrectedEntryRange = separation.downrangeDistance + separation.horizontalSpeed * (BOOSTBACK_CUTOFF_SECONDS + coastDuration);
  const horizontalBoost = towerAvailable
    ? Math.max(-50, Math.min(0, (25_000 - uncorrectedEntryRange) / (burnDuration * (burnDuration / 2 + coastDuration))))
    : -25;
  const entryTime = BOOSTBACK_CUTOFF_SECONDS + coastDuration;

  function freeFlight(time: number) {
    const burnTime = Math.max(0, Math.min(time, BOOSTBACK_CUTOFF_SECONDS) - BOOSTBACK_IGNITION_SECONDS);
    const drivenDistance = burnTime * (burnTime / 2 + Math.max(0, time - BOOSTBACK_CUTOFF_SECONDS));
    return {
      altitude: separation.altitude + separation.verticalSpeed * time - GRAVITY * time ** 2 / 2 + verticalBoost * drivenDistance,
      verticalSpeed: separation.verticalSpeed - GRAVITY * time + verticalBoost * burnTime,
      downrangeDistance: separation.downrangeDistance + separation.horizontalSpeed * time + horizontalBoost * drivenDistance,
      horizontalSpeed: separation.horizontalSpeed + horizontalBoost * burnTime,
    };
  }

  const entry = freeFlight(entryTime);
  const catches = towerAvailable && Math.abs(entry.downrangeDistance) <= 100_000
    && Math.abs(entry.horizontalSpeed) <= 1_250 && entry.altitude > ground + GATE_HEIGHT;
  const gateHeight = ground + Math.min(GATE_HEIGHT, Math.max(0, entry.altitude - ground) * 0.65);
  const gateVerticalSpeed = -Math.min(115, (gateHeight - ground) / 10);
  const descentDuration = Math.max(0.001, 1.65 * (entry.altitude - gateHeight) / Math.max(100, -entry.verticalSpeed));
  const gateRange = catches ? Math.sign(entry.downrangeDistance) * 450
    : entry.downrangeDistance + entry.horizontalSpeed * descentDuration * 0.45;
  const gateSpeed = catches ? -Math.sign(gateRange) * 45 : entry.horizontalSpeed * 0.2;
  const landingTime = entryTime + descentDuration;
  let earlySurfaceTime: number | undefined;
  if (cutoffHeight <= ground) {
    let low = 0;
    let high = BOOSTBACK_CUTOFF_SECONDS;
    for (let i = 0; i < 32; i++) {
      const mid = (low + high) / 2;
      if (freeFlight(mid).altitude > ground) low = mid;
      else high = mid;
    }
    earlySurfaceTime = high;
  }
  const endTime = earlySurfaceTime ?? landingTime + LANDING_SECONDS;

  return {
    entryTime,
    landingTime,
    endTime,
    sample(elapsedSeconds: number) {
      const elapsed = Math.min(endTime, Math.max(0, elapsedSeconds));
      if (earlySurfaceTime !== undefined && elapsed >= earlySurfaceTime) {
        return {
          ...freeFlight(elapsed), elapsed, altitude: ground, pitchAngle: RETURN_PITCH,
          phase: 'Recovery missed', engineOn: false, atTower: false,
        };
      }
      if (elapsed < entryTime) {
        const phase = elapsed < BOOSTBACK_IGNITION_SECONDS ? 'Separation flip'
          : elapsed < BOOSTBACK_CUTOFF_SECONDS ? 'Boostback burn' : 'Post-burn coast';
        return {
          ...freeFlight(elapsed), elapsed, phase, atTower: false,
          engineOn: phase === 'Boostback burn',
          pitchAngle: blend(separation.pitchAngle, RETURN_PITCH, Math.min(1, elapsed / BOOSTBACK_IGNITION_SECONDS)),
        };
      }

      const descending = elapsed < landingTime;
      const duration = descending ? descentDuration : LANDING_SECONDS;
      const time = elapsed - (descending ? entryTime : landingTime);
      const height = descending
        ? interpolate({ position: entry.altitude, speed: entry.verticalSpeed }, { position: gateHeight, speed: gateVerticalSpeed }, duration, time)
        : interpolate({ position: gateHeight, speed: gateVerticalSpeed }, { position: ground + (catches ? CATCH_HEIGHT : 0), speed: catches ? 0 : -Math.min(23, (gateHeight - ground) / LANDING_SECONDS) }, duration, time);
      const range = descending
        ? interpolate({ position: entry.downrangeDistance, speed: entry.horizontalSpeed }, { position: gateRange, speed: gateSpeed }, duration, time)
        : interpolate({ position: gateRange, speed: gateSpeed },
          { position: catches ? 0 : gateRange + gateSpeed * duration / 2, speed: 0 }, duration, time);
      const complete = elapsed >= endTime;
      return {
        elapsed,
        altitude: height.position,
        downrangeDistance: range.position,
        horizontalSpeed: range.speed,
        verticalSpeed: height.speed,
        pitchAngle: descending ? blend(RETURN_PITCH, 93, time / duration) : blend(93, 90, time / duration),
        phase: complete ? (catches ? 'Tower catch' : 'Recovery missed') : descending ? 'Atmospheric descent' : 'Landing burn',
        engineOn: !complete && !descending,
        atTower: catches && !descending,
      };
    },
  };
}

export type BoosterReturn = ReturnType<typeof createBoosterReturn>;
export type BoosterReturnSample = ReturnType<BoosterReturn['sample']>;
