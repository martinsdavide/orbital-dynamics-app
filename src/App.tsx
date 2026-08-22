import { useState, useEffect } from 'react';
import { ThreeViewport } from './components/canvas/ThreeViewport';
import type { ActiveAppMode, CameraPreset } from './components/canvas/ThreeViewport';
import { Header } from './components/ui/Header';
import { TimeControls } from './components/ui/TimeControls';
import { SystemViewControls } from './components/ui/SystemViewControls';
import { LaunchViewControls } from './components/ui/LaunchViewControls';
import { TrajectoryPlanner } from './components/ui/TrajectoryPlanner';
import { TelemetryHUD } from './components/ui/TelemetryHUD';
import { FlightChartModal } from './components/ui/FlightChartModal';
import { InfoModal } from './components/ui/InfoModal';

import type { ReferenceFrame, ScaleMode } from './types/celestial';
import type { Spaceport } from './types/spaceport';
import type { RocketPreset, RocketTelemetry } from './types/rocket';
import type { EarthMoonTrajectory } from './types/trajectory';

import { SPACEPORTS } from './data/spaceports';
import { ROCKET_PRESETS } from './data/rockets';
import { getEphemerisState } from './physics/orbitalMechanics';
import { simulateRocketAscentStep, calculateTotalRocketDeltaV } from './physics/rocketDynamics';
import { solveEarthMoonTrajectory } from './physics/trajectorySolver';

export function App() {
  // App Mode & Camera
  const [appMode, setAppMode] = useState<ActiveAppMode>('system');
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>('free');

  // Simulation Time & Warp
  const [simTimeSeconds, setSimTimeSeconds] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [timeWarp, setTimeWarp] = useState<number>(100);

  // Celestial System View Settings
  const [referenceFrame, setReferenceFrame] = useState<ReferenceFrame>('geocentric');
  const [scaleMode, setScaleMode] = useState<ScaleMode>('visual');
  const [showLagrangePoints, setShowLagrangePoints] = useState<boolean>(true);
  const [showOrbitLines, setShowOrbitLines] = useState<boolean>(true);
  const [showLunarSOI, setShowLunarSOI] = useState<boolean>(true);
  const [showAtmosphereGlow, setShowAtmosphereGlow] = useState<boolean>(true);

  // Spaceport & Rocket State
  const [selectedSpaceport, setSelectedSpaceport] = useState<Spaceport>(SPACEPORTS[0]); // Guiana Space Centre (Kourou)
  const [activeRocket, setActiveRocket] = useState<RocketPreset>(ROCKET_PRESETS[0]); // Saturn V

  // Rocket Launch Ascent Telemetry State
  const [rocketTelemetry, setRocketTelemetry] = useState<RocketTelemetry>(() => {
    const r = ROCKET_PRESETS[0];
    const sp = SPACEPORTS[0];
    let totalWetMass = r.fairingMass;
    for (const stage of r.stages) {
      totalWetMass += stage.dryMass + stage.fuelMass;
    }
    return {
      time: 0,
      altitude: sp.elevation,
      downrangeDistance: 0,
      velocity: sp.equatorialBoostVelocity,
      velocityEarthRelative: 0,
      verticalSpeed: 0,
      horizontalSpeed: 0,
      machNumber: 0,
      dynamicPressure: 0,
      maxQ: 0,
      accelerationG: 1.0,
      totalMass: totalWetMass,
      remainingFuel: r.stages[0].fuelMass,
      stageFuelFraction: 1.0,
      activeStageIndex: 0,
      thrust: 0,
      twr: 0,
      pitchAngle: 90,
      flightPathAngle: 90,
      apoapsis: sp.elevation,
      periapsis: -6.371e6,
      orbitalEnergy: 0,
      deltaVExpended: 0,
      deltaVRemaining: calculateTotalRocketDeltaV(r),
      isOrbitAchieved: false,
      statusMessage: 'Pad clear. Ready for countdown and liftoff.',
      phase: 'pad',
    };
  });

  const [autoGuidance, setAutoGuidance] = useState<boolean>(true);
  const [userThrottle, setUserThrottle] = useState<number>(1.0);
  const [manualPitch, setManualPitch] = useState<number>(85);

  // Earth-Moon Trajectory State
  const [activeTrajectory, setActiveTrajectory] = useState<EarthMoonTrajectory>(() =>
    solveEarthMoonTrajectory('direct_loi', SPACEPORTS[0], 200000, 72)
  );
  const [trajectoryProgress, setTrajectoryProgress] = useState<number>(0.15);

  // Modals
  const [isInfoOpen, setIsInfoOpen] = useState<boolean>(false);
  const [isChartsOpen, setIsChartsOpen] = useState<boolean>(false);

  // Compute Ephemeris state for current epoch
  const ephemeris = getEphemerisState(simTimeSeconds);

  // Simulation Loop Tick
  useEffect(() => {
    let animFrame: number;
    let lastTimestamp = performance.now();

    const loop = (timestamp: number) => {
      const realDt = Math.min(0.1, (timestamp - lastTimestamp) / 1000);
      lastTimestamp = timestamp;

      if (isPlaying) {
        // Advance Celestial System time
        if (appMode === 'system' || appMode === 'transfer') {
          const dtSim = realDt * timeWarp * 3600; // Warp scaled
          setSimTimeSeconds((prev) => prev + dtSim);
        }

        // Advance Rocket Ascent Simulation if launched
        if (appMode === 'launch' && rocketTelemetry.phase !== 'pad') {
          const launchDt = realDt * Math.min(5, Math.max(1, timeWarp === 1 ? 1 : 2));
          setRocketTelemetry((prev) =>
            simulateRocketAscentStep({
              timeSeconds: prev.time,
              dt: launchDt,
              rocket: activeRocket,
              spaceport: selectedSpaceport,
              telemetry: prev,
              userThrottle,
              autoGuidance,
              manualPitchOverride: manualPitch,
            })
          );
        }
      }

      animFrame = requestAnimationFrame(loop);
    };

    animFrame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animFrame);
  }, [isPlaying, timeWarp, appMode, activeRocket, selectedSpaceport, userThrottle, autoGuidance, manualPitch, rocketTelemetry.phase]);

  // Handle Mode Change
  const handleSelectMode = (mode: ActiveAppMode) => {
    setAppMode(mode);
    if (mode === 'system') {
      setCameraPreset('free');
    } else if (mode === 'launch') {
      setCameraPreset('spaceport');
    } else if (mode === 'transfer') {
      setCameraPreset('free');
    }
  };

  // Launch Ignition Trigger
  const handleLaunch = () => {
    setRocketTelemetry((prev) => ({
      ...prev,
      phase: 'boost_stage1',
      statusMessage: 'Ignition! Liftoff of ' + activeRocket.name + ' from ' + selectedSpaceport.name,
    }));
    setCameraPreset('rocket');
  };

  // Abort / Reset Launchpad
  const handleAbort = () => {
    let totalWetMass = activeRocket.fairingMass;
    for (const stage of activeRocket.stages) {
      totalWetMass += stage.dryMass + stage.fuelMass;
    }
    setRocketTelemetry({
      time: 0,
      altitude: selectedSpaceport.elevation,
      downrangeDistance: 0,
      velocity: selectedSpaceport.equatorialBoostVelocity,
      velocityEarthRelative: 0,
      verticalSpeed: 0,
      horizontalSpeed: 0,
      machNumber: 0,
      dynamicPressure: 0,
      maxQ: 0,
      accelerationG: 1.0,
      totalMass: totalWetMass,
      remainingFuel: activeRocket.stages[0].fuelMass,
      stageFuelFraction: 1.0,
      activeStageIndex: 0,
      thrust: 0,
      twr: 0,
      pitchAngle: 90,
      flightPathAngle: 90,
      apoapsis: selectedSpaceport.elevation,
      periapsis: -6.371e6,
      orbitalEnergy: 0,
      deltaVExpended: 0,
      deltaVRemaining: calculateTotalRocketDeltaV(activeRocket),
      isOrbitAchieved: false,
      statusMessage: 'Launchpad reset. Ready for ignition.',
      phase: 'pad',
    });
    setCameraPreset('spaceport');
  };

  // Reset Simulation
  const handleResetSimulation = () => {
    setSimTimeSeconds(0);
    setTrajectoryProgress(0.15);
    handleAbort();
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-gray-950 text-gray-100 font-sans select-none">
      {/* 3D WebGL Canvas Viewport */}
      <ThreeViewport
        appMode={appMode}
        ephemeris={ephemeris}
        referenceFrame={referenceFrame}
        scaleMode={scaleMode}
        showLagrangePoints={showLagrangePoints}
        showOrbitLines={showOrbitLines}
        showLunarSOI={showLunarSOI}
        showAtmosphereGlow={showAtmosphereGlow}
        selectedSpaceport={selectedSpaceport}
        activeRocket={activeRocket}
        rocketTelemetry={rocketTelemetry}
        activeTrajectory={activeTrajectory}
        cameraPreset={cameraPreset}
        trajectoryProgress={trajectoryProgress}
      />

      {/* Top Header Navigation */}
      <Header
        appMode={appMode}
        onSelectMode={handleSelectMode}
        cameraPreset={cameraPreset}
        onSelectCamera={setCameraPreset}
        onOpenInfo={() => setIsInfoOpen(true)}
        onOpenCharts={() => setIsChartsOpen(true)}
        onResetSimulation={handleResetSimulation}
      />

      {/* Left-Side Mode Specific Controls */}
      {appMode === 'system' && (
        <SystemViewControls
          referenceFrame={referenceFrame}
          onChangeFrame={setReferenceFrame}
          scaleMode={scaleMode}
          onChangeScale={setScaleMode}
          showLagrangePoints={showLagrangePoints}
          onToggleLagrange={() => setShowLagrangePoints(!showLagrangePoints)}
          showOrbitLines={showOrbitLines}
          onToggleOrbitLines={() => setShowOrbitLines(!showOrbitLines)}
          showLunarSOI={showLunarSOI}
          onToggleLunarSOI={() => setShowLunarSOI(!showLunarSOI)}
          showAtmosphereGlow={showAtmosphereGlow}
          onToggleAtmosphere={() => setShowAtmosphereGlow(!showAtmosphereGlow)}
          ephemeris={ephemeris}
        />
      )}

      {appMode === 'launch' && (
        <LaunchViewControls
          selectedSpaceport={selectedSpaceport}
          onSelectSpaceport={setSelectedSpaceport}
          activeRocket={activeRocket}
          onSelectRocket={setActiveRocket}
          rocketTelemetry={rocketTelemetry}
          onLaunch={handleLaunch}
          onAbort={handleAbort}
          autoGuidance={autoGuidance}
          onToggleAutoGuidance={() => setAutoGuidance(!autoGuidance)}
          throttle={userThrottle}
          onChangeThrottle={setUserThrottle}
          manualPitch={manualPitch}
          onChangeManualPitch={setManualPitch}
        />
      )}

      {appMode === 'transfer' && (
        <TrajectoryPlanner
          selectedSpaceport={selectedSpaceport}
          onSelectSpaceport={setSelectedSpaceport}
          activeTrajectory={activeTrajectory}
          onUpdateTrajectory={setActiveTrajectory}
          trajectoryProgress={trajectoryProgress}
          onChangeProgress={setTrajectoryProgress}
        />
      )}

      {/* Right-Side Telemetry HUD (Active in Launch mode or upon request) */}
      {appMode === 'launch' && <TelemetryHUD telemetry={rocketTelemetry} />}

      {/* Bottom Mission Elapsed Time Controls */}
      {appMode !== 'launch' && (
        <TimeControls
          isPlaying={isPlaying}
          onTogglePlay={() => setIsPlaying(!isPlaying)}
          timeWarp={timeWarp}
          onSetTimeWarp={setTimeWarp}
          simTimeDays={simTimeSeconds / 86400}
          onResetTime={() => setSimTimeSeconds(0)}
        />
      )}

      {/* Modals */}
      <InfoModal isOpen={isInfoOpen} onClose={() => setIsInfoOpen(false)} />
      <FlightChartModal isOpen={isChartsOpen} onClose={() => setIsChartsOpen(false)} />
    </div>
  );
}

export default App;
