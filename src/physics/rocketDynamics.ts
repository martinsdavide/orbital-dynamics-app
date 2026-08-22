import { EARTH, ATMOSPHERE } from './constants';
import type { RocketPreset, RocketTelemetry } from '../types/rocket';
import type { Spaceport } from '../types/spaceport';
import { getAtmosphericState } from './atmosphere';

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

export function simulateRocketAscentStep(input: RocketSimulationStepInput): RocketTelemetry {
  const { dt, rocket, spaceport, telemetry, userThrottle, autoGuidance, manualPitchOverride } = input;

  if (telemetry.phase === 'pad') {
    const latRad = (spaceport.latitude * Math.PI) / 180;
    const vSurface = (2 * Math.PI * EARTH.radius * Math.cos(latRad)) / EARTH.rotationPeriod;

    let totalWetMass = rocket.fairingMass;
    for (const stage of rocket.stages) {
      totalWetMass += stage.dryMass + stage.fuelMass;
    }

    return {
      ...telemetry,
      time: 0,
      altitude: spaceport.elevation,
      downrangeDistance: 0,
      velocity: vSurface,
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
      apoapsis: spaceport.elevation,
      periapsis: -EARTH.radius,
      deltaVExpended: 0,
      deltaVRemaining: calculateTotalRocketDeltaV(rocket),
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
    phase,
    pitchAngle,
  } = telemetry;

  const currentStage = rocket.stages[activeStageIndex];
  if (!currentStage) {
    return { ...telemetry, phase: 'parking_orbit', statusMessage: 'All stages depleted. In orbit.' };
  }

  time += dt;

  const atmo = getAtmosphericState(altitude, Math.sqrt(verticalSpeed * verticalSpeed + horizontalSpeed * horizontalSpeed));

  const pressureRatio = Math.max(0, Math.min(1, atmo.pressure / ATMOSPHERE.seaLevelPressure));
  const currentThrust = (currentStage.thrustVacuum - (currentStage.thrustVacuum - currentStage.thrustSeaLevel) * pressureRatio) * userThrottle;
  const currentIsp = currentStage.ispVacuum - (currentStage.ispVacuum - currentStage.ispSeaLevel) * pressureRatio;

  const massFlowRate = currentIsp > 0 ? currentThrust / (currentIsp * ATMOSPHERE.standardGravity) : 0;
  const fuelBurned = Math.min(remainingFuel, massFlowRate * dt);
  remainingFuel -= fuelBurned;
  totalMass -= fuelBurned;

  const stageFuelFraction = currentStage.fuelMass > 0 ? Math.max(0, remainingFuel / currentStage.fuelMass) : 0;

  if (totalMass > 0 && fuelBurned > 0) {
    const dV = currentIsp * ATMOSPHERE.standardGravity * Math.log((totalMass + fuelBurned) / totalMass);
    deltaVExpended += dV;
  }

  if (autoGuidance) {
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
  } else if (manualPitchOverride !== undefined) {
    pitchAngle = manualPitchOverride;
  }

  const pitchRad = (pitchAngle * Math.PI) / 180;

  const crossSectionArea = Math.PI * Math.pow(currentStage.diameter / 2, 2);
  const dragForce = 0.5 * atmo.density * Math.pow(velocityEarthRelative, 2) * atmo.dragCoefficient * crossSectionArea;

  const r = EARTH.radius + altitude;
  const localGravity = (EARTH.mu / (r * r));

  const centrifugalAccel = (horizontalSpeed * horizontalSpeed) / r;

  const thrustAlongPitch = currentThrust;
  const dragAgainstVelocity = dragForce;

  const velAngleRad = Math.atan2(verticalSpeed, Math.max(1, horizontalSpeed));

  const fThrustX = thrustAlongPitch * Math.cos(pitchRad);
  const fThrustY = thrustAlongPitch * Math.sin(pitchRad);

  const fDragX = dragAgainstVelocity * Math.cos(velAngleRad);
  const fDragY = dragAgainstVelocity * Math.sin(velAngleRad);

  const accelX = (fThrustX - fDragX) / totalMass;
  const accelY = (fThrustY - fDragY) / totalMass - localGravity + centrifugalAccel;

  const totalAccelMag = Math.sqrt(accelX * accelX + (accelY + localGravity) * (accelY + localGravity));
  const accelerationG = totalAccelMag / ATMOSPHERE.standardGravity;

  horizontalSpeed += accelX * dt;
  verticalSpeed += accelY * dt;

  velocityEarthRelative = Math.sqrt(horizontalSpeed * horizontalSpeed + verticalSpeed * verticalSpeed);
  const inertialSpeed = Math.sqrt(Math.pow(horizontalSpeed + spaceport.equatorialBoostVelocity, 2) + verticalSpeed * verticalSpeed);

  altitude += verticalSpeed * dt;
  downrangeDistance += horizontalSpeed * dt;

  if (atmo.dynamicPressure > maxQ) {
    maxQ = atmo.dynamicPressure;
  }

  let statusMessage = 'Stage ' + (activeStageIndex + 1) + ' firing (' + Math.round(pitchAngle) + '° pitch)';
  if (remainingFuel <= 0.1) {
    if (activeStageIndex + 1 < rocket.stages.length) {
      activeStageIndex += 1;
      const nextStage = rocket.stages[activeStageIndex];
      remainingFuel = nextStage.fuelMass;
      totalMass -= currentStage.dryMass;
      phase = ('staging_' + activeStageIndex + '_' + (activeStageIndex + 1)) as any;
      statusMessage = 'MECO! Stage ' + activeStageIndex + ' separation. Stage ' + (activeStageIndex + 1) + ' ignition.';
    } else {
      phase = 'parking_orbit';
      statusMessage = 'SECO: Main engine cutoff. Parking orbit reached.';
    }
  }

  const specificEnergy = (inertialSpeed * inertialSpeed) / 2 - EARTH.mu / r;
  let semiMajorAxis = 0;
  let apoapsis = altitude;
  let periapsis = altitude;

  if (specificEnergy < 0) {
    semiMajorAxis = -EARTH.mu / (2 * specificEnergy);
    const hOrb = r * (horizontalSpeed + spaceport.equatorialBoostVelocity);
    const eccentricity = Math.sqrt(Math.max(0, 1 - (hOrb * hOrb) / (EARTH.mu * semiMajorAxis)));
    apoapsis = semiMajorAxis * (1 + eccentricity) - EARTH.radius;
    periapsis = semiMajorAxis * (1 - eccentricity) - EARTH.radius;
  }

  const isOrbitAchieved = periapsis > 140000;
  const twr = totalMass > 0 ? currentThrust / (totalMass * localGravity) : 0;
  const flightPathAngle = (velAngleRad * 180) / Math.PI;

  return {
    time,
    altitude: Math.max(0, altitude),
    downrangeDistance,
    velocity: inertialSpeed,
    velocityEarthRelative,
    verticalSpeed,
    horizontalSpeed,
    machNumber: atmo.machNumber,
    dynamicPressure: atmo.dynamicPressure,
    maxQ,
    accelerationG,
    totalMass,
    remainingFuel,
    stageFuelFraction,
    activeStageIndex,
    thrust: currentThrust,
    twr,
    pitchAngle,
    flightPathAngle,
    apoapsis: Math.max(0, apoapsis),
    periapsis,
    orbitalEnergy: specificEnergy,
    deltaVExpended,
    deltaVRemaining: Math.max(0, calculateTotalRocketDeltaV(rocket) - deltaVExpended),
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
