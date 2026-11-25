import { EARTH, ATMOSPHERE } from './constants.ts';
import type { RocketPreset, RocketTelemetry } from '../types/rocket';
import type { Spaceport } from '../types/spaceport';
import { getAtmosphericState } from './atmosphere.ts';

export const KARMAN_LINE_ALTITUDE = 100_000;

export function calculateEarthEscapeSpeed(altitude: number): number {
  return Math.sqrt(2 * EARTH.mu / (EARTH.radius + altitude));
}

export function createPadTelemetry(rocket: RocketPreset, site: Spaceport): RocketTelemetry {
  let totalWetMass = rocket.fairingMass;
  for (const stage of rocket.stages) {
    totalWetMass += stage.dryMass + stage.fuelMass;
  }
  return {
    time: 0,
    altitude: site.elevation,
    downrangeDistance: 0,
    velocity: site.equatorialBoostVelocity,
    velocityEarthRelative: 0,
    verticalSpeed: 0,
    horizontalSpeed: 0,
    machNumber: 0,
    dynamicPressure: 0,
    maxQ: 0,
    accelerationG: 1.0,
    totalMass: totalWetMass,
    remainingFuel: rocket.stages[0].fuelMass,
    stageFuelFraction: 1.0,
    activeStageIndex: 0,
    thrust: 0,
    twr: 0,
    pitchAngle: 90,
    flightPathAngle: 90,
    apoapsis: site.elevation,
    periapsis: -EARTH.radius,
    orbitalEnergy: 0,
    deltaVExpended: 0,
    deltaVRemaining: calculateTotalRocketDeltaV(rocket),
    isOrbitAchieved: false,
    statusMessage: 'Pad clear. Ready for countdown and liftoff.',
    phase: 'pad',
  };
}

export interface RocketSimulationStepInput {
  timeSeconds: number;
  dt: number;
  rocket: RocketPreset;
  spaceport: Spaceport;
  telemetry: RocketTelemetry;
  userThrottle: number;
  autoGuidance: boolean;
  manualPitchOverride?: number;
}

function dragPerMass(altitude: number, relativeSpeed: number, diameter: number, mass: number): number {
  const atmosphere = getAtmosphericState(altitude, relativeSpeed);
  const area = Math.PI * (diameter / 2) ** 2;
  return atmosphere.dynamicPressure * atmosphere.dragCoefficient * area / mass;
}

function coastStep(altitude: number, verticalSpeed: number, tangentialSpeed: number, boost: number, diameter: number, mass: number, dt: number) {
  // Inertial polar coordinates. The apparent radial and tangential terms
  // account for the rotating local frame and do not contribute to felt G-load.
  const rates = (height: number, radial: number, tangential: number) => {
    const radius = EARTH.radius + Math.max(0, height);
    const horizontal = tangential - boost;
    const relativeSpeed = Math.hypot(radial, horizontal);
    const drag = dragPerMass(Math.max(0, height), relativeSpeed, diameter, mass);
    const dragFactor = relativeSpeed > 0 ? drag / relativeSpeed : 0;
    return {
      radial: (tangential ** 2) / radius - EARTH.mu / radius ** 2 - dragFactor * radial,
      tangential: -radial * tangential / radius - dragFactor * horizontal,
      downrange: EARTH.radius * tangential / radius - boost,
    };
  };

  const initial = rates(altitude, verticalSpeed, tangentialSpeed);
  const half = dt / 2;
  const midpoint = rates(altitude + verticalSpeed * half, verticalSpeed + initial.radial * half, tangentialSpeed + initial.tangential * half);
  return {
    altitude: altitude + (verticalSpeed + initial.radial * half) * dt,
    verticalSpeed: verticalSpeed + midpoint.radial * dt,
    horizontalSpeed: tangentialSpeed + midpoint.tangential * dt - boost,
    downrange: midpoint.downrange * dt,
  };
}

export function simulateRocketAscentStep(input: RocketSimulationStepInput): RocketTelemetry {
  const { dt, rocket, spaceport, telemetry, userThrottle, autoGuidance, manualPitchOverride } = input;

  if (telemetry.phase === 'abort') return telemetry;
  if (telemetry.phase === 'pad') {
    const latRad = (spaceport.latitude * Math.PI) / 180;
    const vSurface = (2 * Math.PI * EARTH.radius * Math.cos(latRad)) / EARTH.rotationPeriod;

    return {
      ...createPadTelemetry(rocket, spaceport),
      velocity: vSurface,
      statusMessage: 'Ready for liftoff at ' + spaceport.name,
    };
  }

  let {
    time,
    altitude,
    downrangeDistance,
    velocityEarthRelative,
    verticalSpeed,
    horizontalSpeed,
    activeStageIndex,
    remainingFuel,
    totalMass,
    maxQ,
    deltaVExpended,
    pitchAngle,
  } = telemetry;
  let phase: RocketTelemetry['phase'] = telemetry.phase;

  const currentStage = rocket.stages[activeStageIndex];
  const coasting = phase === 'coast' || phase === 'parking_orbit' || !currentStage ||
    (activeStageIndex === rocket.stages.length - 1 && remainingFuel <= 0.1);
  const diameter = (currentStage ?? rocket.stages.at(-1))?.diameter ?? rocket.diameter;
  const boost = spaceport.equatorialBoostVelocity;
  const atmo = getAtmosphericState(altitude, Math.hypot(verticalSpeed, horizontalSpeed));
  time += dt;

  const pressureRatio = Math.max(0, Math.min(1, atmo.pressure / ATMOSPHERE.seaLevelPressure));
  const requestedThrust = !coasting && currentStage
    ? (currentStage.thrustVacuum - (currentStage.thrustVacuum - currentStage.thrustSeaLevel) * pressureRatio) * userThrottle
    : 0;
  const currentIsp = currentStage
    ? currentStage.ispVacuum - (currentStage.ispVacuum - currentStage.ispSeaLevel) * pressureRatio
    : 0;
  const requestedFuel = currentIsp > 0 ? requestedThrust * dt / (currentIsp * ATMOSPHERE.standardGravity) : 0;
  const fuelBurned = Math.min(remainingFuel, requestedFuel);
  const burnThrust = requestedFuel > 0 ? requestedThrust * fuelBurned / requestedFuel : 0;
  remainingFuel -= fuelBurned;
  totalMass -= fuelBurned;

  if (totalMass > 0 && fuelBurned > 0) {
    const dV = currentIsp * ATMOSPHERE.standardGravity * Math.log((totalMass + fuelBurned) / totalMass);
    deltaVExpended += dV;
  }

  if (!coasting && autoGuidance) {
    if (altitude < 1200) {
      pitchAngle = 90;
    } else if (altitude < 10000) {
      const pitchProgress = (altitude - 1200) / (10000 - 1200);
      pitchAngle = 90 - 25 * Math.pow(pitchProgress, 0.8);
    } else if (altitude < 60000) {
      const pitchProgress = (altitude - 10000) / (60000 - 10000);
      pitchAngle = 65 - 45 * Math.pow(pitchProgress, 0.9);
    } else if (altitude < 140000) {
      pitchAngle = Math.max(0, 20 - 20 * ((altitude - 60000) / 80000));
    } else {
      pitchAngle = 0;
    }
  } else if (!coasting && manualPitchOverride !== undefined) {
    pitchAngle = manualPitchOverride;
  }

  let accelerationG = 0;
  if (coasting) {
    const coast = coastStep(altitude, verticalSpeed, horizontalSpeed + boost, boost, diameter, totalMass, dt);
    altitude = coast.altitude;
    verticalSpeed = coast.verticalSpeed;
    horizontalSpeed = coast.horizontalSpeed;
    downrangeDistance += coast.downrange;
  } else {
    const pitchRad = pitchAngle * Math.PI / 180;
    const radius = EARTH.radius + altitude;
    const velAngle = Math.atan2(verticalSpeed, Math.max(1, horizontalSpeed));
    const drag = dragPerMass(altitude, velocityEarthRelative, diameter, totalMass);
    const forwardAcceleration = burnThrust * Math.cos(pitchRad) / totalMass - drag * Math.cos(velAngle);
    const radialAcceleration = burnThrust * Math.sin(pitchRad) / totalMass - drag * Math.sin(velAngle);
    accelerationG = Math.hypot(forwardAcceleration, radialAcceleration) / ATMOSPHERE.standardGravity;

    verticalSpeed += (radialAcceleration - EARTH.mu / radius ** 2 + horizontalSpeed ** 2 / radius) * dt;
    horizontalSpeed += forwardAcceleration * dt;
    altitude += verticalSpeed * dt;
    downrangeDistance += horizontalSpeed * dt;
  }

  const hitSurface = coasting && altitude <= 0 && verticalSpeed < 0;
  altitude = Math.max(0, altitude);
  if (hitSurface) {
    verticalSpeed = 0;
    horizontalSpeed = 0;
  }
  velocityEarthRelative = Math.hypot(horizontalSpeed, verticalSpeed);
  const tangentialSpeed = horizontalSpeed + boost;
  const inertialSpeed = Math.hypot(tangentialSpeed, verticalSpeed);
  const currentAtmosphere = getAtmosphericState(altitude, velocityEarthRelative);
  let karmanCrossingTime = telemetry.karmanCrossingTime;
  if (karmanCrossingTime === undefined && telemetry.altitude < KARMAN_LINE_ALTITUDE && altitude >= KARMAN_LINE_ALTITUDE) {
    const fraction = (KARMAN_LINE_ALTITUDE - telemetry.altitude) / (altitude - telemetry.altitude);
    karmanCrossingTime = telemetry.time + fraction * dt;
  }

  maxQ = Math.max(maxQ, currentAtmosphere.dynamicPressure);

  const radius = EARTH.radius + altitude;
  const specificEnergy = inertialSpeed ** 2 / 2 - EARTH.mu / radius;
  const angularMomentum = radius * tangentialSpeed;
  const eccentricity = Math.sqrt(Math.max(0, 1 + 2 * specificEnergy * angularMomentum ** 2 / EARTH.mu ** 2));
  const periapsis = angularMomentum ** 2 / (EARTH.mu * (1 + eccentricity)) - EARTH.radius;
  const apoapsis = specificEnergy < 0 ? (-EARTH.mu / (2 * specificEnergy)) * (1 + eccentricity) - EARTH.radius : 0;
  const isOrbitAchieved = specificEnergy < 0 && periapsis > 140000;
  const engineCutoff = coasting || (remainingFuel <= 0.1 && activeStageIndex === rocket.stages.length - 1);
  const thrust = engineCutoff ? 0 : burnThrust;
  const twr = thrust / (totalMass * EARTH.mu / radius ** 2);
  const flightPathAngle = Math.atan2(verticalSpeed, tangentialSpeed) * 180 / Math.PI;

  let statusMessage = 'Stage ' + (activeStageIndex + 1) + ' firing (' + Math.round(pitchAngle) + '° pitch)';
  if (engineCutoff) {
    accelerationG = dragPerMass(altitude, velocityEarthRelative, diameter, totalMass) / ATMOSPHERE.standardGravity;
    if (hitSurface) {
      phase = 'abort';
      statusMessage = 'Coast ended at Earth’s surface.';
    } else if (isOrbitAchieved) {
      phase = 'parking_orbit';
      statusMessage = 'SECO: Engine cutoff. Coasting in a bound orbit.';
    } else {
      phase = 'coast';
      statusMessage = specificEnergy >= 0
        ? 'SECO: Engine cutoff. Unbound coast.'
        : 'SECO: Engine cutoff. Suborbital coast.';
    }
  } else if (remainingFuel <= 0.1) {
    activeStageIndex += 1;
    const nextStage = rocket.stages[activeStageIndex];
    remainingFuel = nextStage.fuelMass;
    totalMass -= currentStage!.dryMass;
    phase = activeStageIndex === 1 ? 'staging_1_2' : 'staging_2_3';
    statusMessage = 'MECO! Stage ' + activeStageIndex + ' separation. Stage ' + (activeStageIndex + 1) + ' ignition.';
  }

  const nominalFuel = rocket.stages[activeStageIndex]?.fuelMass ?? 0;
  return {
    time,
    altitude: Math.max(0, altitude),
    karmanCrossingTime,
    downrangeDistance,
    velocity: inertialSpeed,
    velocityEarthRelative,
    verticalSpeed,
    horizontalSpeed,
    machNumber: currentAtmosphere.machNumber,
    dynamicPressure: currentAtmosphere.dynamicPressure,
    maxQ,
    accelerationG,
    totalMass,
    remainingFuel,
    stageFuelFraction: nominalFuel > 0 ? Math.max(0, remainingFuel / nominalFuel) : 0,
    activeStageIndex,
    thrust,
    twr,
    pitchAngle,
    flightPathAngle,
    apoapsis: Math.max(0, apoapsis),
    periapsis,
    orbitalEnergy: specificEnergy,
    deltaVExpended,
    deltaVRemaining: engineCutoff ? 0 : Math.max(0, calculateTotalRocketDeltaV(rocket) - deltaVExpended),
    isOrbitAchieved,
    statusMessage,
    phase,
  };
}

export function calculateTotalRocketDeltaV(rocket: RocketPreset): number {
  let totalDeltaV = 0;
  let currentMass = rocket.fairingMass;

  for (const stage of rocket.stages) {
    currentMass += stage.dryMass + stage.fuelMass;
  }

  for (const stage of rocket.stages) {
    const mInitial = currentMass;
    const mFinal = currentMass - stage.fuelMass;
    if (mFinal > 0 && mInitial > mFinal) {
      const dV = stage.ispVacuum * ATMOSPHERE.standardGravity * Math.log(mInitial / mFinal);
      totalDeltaV += dV;
    }
    currentMass -= stage.dryMass + stage.fuelMass;
  }

  return Math.round(totalDeltaV);
}
