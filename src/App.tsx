import { useState, useEffect, useRef } from 'react';
import { ThreeViewport } from './components/canvas/ThreeViewport';
import type { ActiveAppMode, CameraPreset, ThreeViewportHandle } from './components/canvas/ThreeViewport';
import { Header } from './components/ui/Header';
import { TimeControls } from './components/ui/TimeControls';
import { SystemViewControls } from './components/ui/SystemViewControls';
import { LaunchViewControls } from './components/ui/LaunchViewControls';
import { TrajectoryPlanner } from './components/ui/TrajectoryPlanner';
import { MarsMissionControls } from './components/ui/MarsMissionControls';
import { MissionInfographicLegend } from './components/ui/MissionInfographicLegend';
import { TelemetryHUD } from './components/ui/TelemetryHUD';
import { ZoomControls } from './components/ui/ZoomControls';
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
import { DEFAULT_MARS_ARRIVAL, DEFAULT_MARS_DEPARTURE, SECONDS_PER_DAY, solveMarsTransfer, type MarsTransfer } from './physics/marsTransfer.ts';
import { solveEarthMoonTrajectory } from './physics/trajectorySolver';

const DEFAULT_LAUNCH_SITE = SPACEPORTS.find(site => site.id === 'spacex_starbase')!;
const DEFAULT_LAUNCH_ROCKET = ROCKET_PRESETS.find(rocket => rocket.id === 'starship_v3')!;

function createPadTelemetry(rocket: RocketPreset, site: Spaceport): RocketTelemetry {
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
    periapsis: -6.371e6,
    orbitalEnergy: 0,
    deltaVExpended: 0,
    deltaVRemaining: calculateTotalRocketDeltaV(rocket),
    isOrbitAchieved: false,
    statusMessage: 'Pad clear. Ready for countdown and liftoff.',
    phase: 'pad',
  };
}

export function App() {
  const viewportRef = useRef<ThreeViewportHandle>(null);

  const [appMode, setAppMode] = useState<ActiveAppMode>('system');
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>('free');

  const [isLeftPanelCollapsed, setIsLeftPanelCollapsed] = useState<boolean>(false);
  const [isRightPanelCollapsed, setIsRightPanelCollapsed] = useState<boolean>(false);

  const isDecluttered = isLeftPanelCollapsed && isRightPanelCollapsed;

  const handleToggleDeclutter = () => {
    if (isDecluttered) {
      setIsLeftPanelCollapsed(false);
      setIsRightPanelCollapsed(false);
    } else {
      setIsLeftPanelCollapsed(true);
      setIsRightPanelCollapsed(true);
    }
  };

  const [simTimeSeconds, setSimTimeSeconds] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [timeWarp, setTimeWarp] = useState<number>(100);
  const [launchRate, setLaunchRate] = useState(2);
  const [isLaunchPlaying, setIsLaunchPlaying] = useState(true);

  const [referenceFrame, setReferenceFrame] = useState<ReferenceFrame>('heliocentric');
  const [scaleMode, setScaleMode] = useState<ScaleMode>('visual');

  // Orbit Line & Trail Toggles
  const [showLagrangePoints, setShowLagrangePoints] = useState<boolean>(true);
  const [showEarthOrbit, setShowEarthOrbit] = useState<boolean>(true);
  const [showMoonOrbit, setShowMoonOrbit] = useState<boolean>(true);
  const [showComposedMoonSunOrbit, setShowComposedMoonSunOrbit] = useState<boolean>(true);
  const [showDynamicTrails, setShowDynamicTrails] = useState<boolean>(true);
  const [showLunarSOI, setShowLunarSOI] = useState<boolean>(true);
  const [showAtmosphereGlow, setShowAtmosphereGlow] = useState<boolean>(true);
  const [showGeocentricSolarOrbit, setShowGeocentricSolarOrbit] = useState<boolean>(true);
  const [showEarthUmbraShadow, setShowEarthUmbraShadow] = useState<boolean>(true);
  const [showGeoLeoBelts, setShowGeoLeoBelts] = useState<boolean>(true);
  const [showLineOfNodes, setShowLineOfNodes] = useState<boolean>(true);
  const [showPlanetaryOrbits, setShowPlanetaryOrbits] = useState<boolean>(true);
  const [showPlanetLabels, setShowPlanetLabels] = useState<boolean>(true);

  const [launchSpaceport, setLaunchSpaceport] = useState(DEFAULT_LAUNCH_SITE);
  const [transferSpaceport, setTransferSpaceport] = useState(SPACEPORTS[0]);
  const [activeRocket, setActiveRocket] = useState(DEFAULT_LAUNCH_ROCKET);
  const selectedSpaceport = appMode === 'launch' ? launchSpaceport : transferSpaceport;

  const [rocketTelemetry, setRocketTelemetry] = useState(() => createPadTelemetry(DEFAULT_LAUNCH_ROCKET, DEFAULT_LAUNCH_SITE));

  const [autoGuidance, setAutoGuidance] = useState<boolean>(true);
  const [userThrottle, setUserThrottle] = useState<number>(1.0);
  const [manualPitch, setManualPitch] = useState<number>(85);

  const [activeTrajectory, setActiveTrajectory] = useState<EarthMoonTrajectory>(() =>
    solveEarthMoonTrajectory('direct_loi', SPACEPORTS[0], 200000, 72)
  );
  const [trajectoryProgress, setTrajectoryProgress] = useState<number>(0.15);

  const [marsMission, setMarsMission] = useState<MarsTransfer | null>(null);
  const [marsProgress, setMarsProgress] = useState(0);
  const [marsPlaying, setMarsPlaying] = useState(false);
  const isMarsPlaying = marsPlaying && marsProgress < 1;

  useEffect(() => {
    if (appMode !== 'mars' || !marsMission || !isMarsPlaying) return;
    let frame: number;
    let lastTime = performance.now();
    const update = (timestamp: number) => {
      const elapsed = Math.min(0.1, Math.max(0, (timestamp - lastTime) / 1000));
      lastTime = timestamp;
      setMarsProgress(progress => Math.min(1, progress + elapsed * 15 * SECONDS_PER_DAY / marsMission.duration));
      frame = requestAnimationFrame(update);
    };
    frame = requestAnimationFrame(update);
    return () => cancelAnimationFrame(frame);
  }, [appMode, marsMission, isMarsPlaying]);

  const [isInfoOpen, setIsInfoOpen] = useState<boolean>(false);
  const [isChartsOpen, setIsChartsOpen] = useState<boolean>(false);

  const ephemeris = getEphemerisState(simTimeSeconds);

  useEffect(() => {
    let animFrame: number;
    let lastTimestamp = performance.now();

    const loop = (timestamp: number) => {
      const realDt = Math.min(0.1, (timestamp - lastTimestamp) / 1000);
      lastTimestamp = timestamp;

      if (isPlaying) {
        if (appMode === 'system') {
          const dtSim = realDt * timeWarp * 3600;
          setSimTimeSeconds((prev) => prev + dtSim);
        } else if (appMode === 'transfer') {
          const totalMissionSeconds = activeTrajectory.timeOfFlightHours * 3600;
          // In Lunar Mission mode: warp speed scaled for mission timeline
          const progressDelta = (realDt * Math.min(timeWarp, 720) * 3600) / totalMissionSeconds;
          setTrajectoryProgress((prev) => {
            const next = prev + progressDelta;
            return next > 1.0 ? 0 : next;
          });
        }
      }

      if (appMode === 'launch' && isLaunchPlaying && rocketTelemetry.phase !== 'pad') {
        const launchDt = realDt * launchRate;
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

      animFrame = requestAnimationFrame(loop);
    };

    animFrame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animFrame);
  }, [isPlaying, timeWarp, launchRate, isLaunchPlaying, appMode, activeRocket, selectedSpaceport, userThrottle, autoGuidance, manualPitch, rocketTelemetry.phase]);

  const handleSelectMode = (mode: ActiveAppMode) => {
    setAppMode(mode);
    if (mode !== 'mars') setMarsPlaying(false);
    if (mode === 'system') {
      setCameraPreset('free');
    } else if (mode === 'launch') {
      setReferenceFrame('geocentric');
      setScaleMode('true');
      setCameraPreset('spaceport');
    } else if (mode === 'transfer') {
      setReferenceFrame('geocentric');
      setScaleMode('true');
      setCameraPreset('infographic');
      setTimeWarp(1);
    } else if (mode === 'mars') {
      setCameraPreset('free');
      if (!marsMission) setMarsMission(solveMarsTransfer(DEFAULT_MARS_DEPARTURE, DEFAULT_MARS_ARRIVAL));
    }
  };

  const handleLaunch = () => {
    setRocketTelemetry({
      ...createPadTelemetry(activeRocket, launchSpaceport),
      phase: 'boost_stage1',
      statusMessage: 'Ignition! Liftoff of ' + activeRocket.name + ' from ' + launchSpaceport.name,
    });
    setIsLaunchPlaying(true);
  };

  const handleAbort = () => {
    setRocketTelemetry({
      ...createPadTelemetry(activeRocket, launchSpaceport),
      statusMessage: 'Launchpad reset. Ready for ignition.',
    });
    if (appMode === 'launch') {
      if (cameraPreset === 'spaceport') viewportRef.current?.resetZoom();
      setCameraPreset('spaceport');
    }
  };

  const scrubMars = (progress: number) => {
    setMarsPlaying(false);
    setMarsProgress(progress);
  };

  const handleResetSimulation = () => {
    if (appMode === 'mars') {
      scrubMars(0);
      viewportRef.current?.resetZoom();
      return;
    }
    setSimTimeSeconds(0);
    setTrajectoryProgress(0.15);
    handleAbort();
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-gray-950 text-gray-100 font-sans select-none">
      <ThreeViewport
        ref={viewportRef}
        appMode={appMode}
        ephemeris={ephemeris}
        referenceFrame={referenceFrame}
        scaleMode={scaleMode}
        showLagrangePoints={showLagrangePoints}
        showEarthOrbit={showEarthOrbit}
        showMoonOrbit={showMoonOrbit}
        showComposedMoonSunOrbit={showComposedMoonSunOrbit}
        showDynamicTrails={showDynamicTrails}
        showLunarSOI={showLunarSOI}
        showAtmosphereGlow={showAtmosphereGlow}
        showGeocentricSolarOrbit={showGeocentricSolarOrbit}
        showEarthUmbraShadow={showEarthUmbraShadow}
        showGeoLeoBelts={showGeoLeoBelts}
        showLineOfNodes={showLineOfNodes}
        showPlanetaryOrbits={showPlanetaryOrbits}
        showPlanetLabels={showPlanetLabels}
        selectedSpaceport={selectedSpaceport}
        activeRocket={activeRocket}
        rocketTelemetry={rocketTelemetry}
        activeTrajectory={activeTrajectory}
        cameraPreset={cameraPreset}
        trajectoryProgress={trajectoryProgress}
        marsMission={marsMission}
        marsProgress={marsProgress}
      />

      <Header
        appMode={appMode}
        onSelectMode={handleSelectMode}
        cameraPreset={cameraPreset}
        onSelectCamera={setCameraPreset}
        onOpenInfo={() => setIsInfoOpen(true)}
        onOpenCharts={() => setIsChartsOpen(true)}
        onResetSimulation={handleResetSimulation}
        isDecluttered={isDecluttered}
        onToggleDeclutter={handleToggleDeclutter}
      />

      {appMode === 'system' && (
        <SystemViewControls
          referenceFrame={referenceFrame}
          onChangeFrame={setReferenceFrame}
          scaleMode={scaleMode}
          onChangeScale={setScaleMode}
          showLagrangePoints={showLagrangePoints}
          onToggleLagrange={() => setShowLagrangePoints(!showLagrangePoints)}
          showEarthOrbit={showEarthOrbit}
          onToggleEarthOrbit={() => setShowEarthOrbit(!showEarthOrbit)}
          showMoonOrbit={showMoonOrbit}
          onToggleMoonOrbit={() => setShowMoonOrbit(!showMoonOrbit)}
          showComposedMoonSunOrbit={showComposedMoonSunOrbit}
          onToggleComposedMoonSunOrbit={() => setShowComposedMoonSunOrbit(!showComposedMoonSunOrbit)}
          showDynamicTrails={showDynamicTrails}
          onToggleDynamicTrails={() => setShowDynamicTrails(!showDynamicTrails)}
          showLunarSOI={showLunarSOI}
          onToggleLunarSOI={() => setShowLunarSOI(!showLunarSOI)}
          showAtmosphereGlow={showAtmosphereGlow}
          onToggleAtmosphere={() => setShowAtmosphereGlow(!showAtmosphereGlow)}
          showGeocentricSolarOrbit={showGeocentricSolarOrbit}
          onToggleGeocentricSolarOrbit={() => setShowGeocentricSolarOrbit(!showGeocentricSolarOrbit)}
          showEarthUmbraShadow={showEarthUmbraShadow}
          onToggleEarthUmbraShadow={() => setShowEarthUmbraShadow(!showEarthUmbraShadow)}
          showGeoLeoBelts={showGeoLeoBelts}
          onToggleGeoLeoBelts={() => setShowGeoLeoBelts(!showGeoLeoBelts)}
          showLineOfNodes={showLineOfNodes}
          onToggleLineOfNodes={() => setShowLineOfNodes(!showLineOfNodes)}
          showPlanetaryOrbits={showPlanetaryOrbits}
          onTogglePlanetaryOrbits={() => setShowPlanetaryOrbits(!showPlanetaryOrbits)}
          showPlanetLabels={showPlanetLabels}
          onTogglePlanetLabels={() => setShowPlanetLabels(!showPlanetLabels)}
          ephemeris={ephemeris}
          isCollapsed={isLeftPanelCollapsed}
          onToggleCollapse={() => setIsLeftPanelCollapsed(!isLeftPanelCollapsed)}
        />
      )}

      {appMode === 'launch' && (
        <LaunchViewControls
          selectedSpaceport={selectedSpaceport}
          onSelectSpaceport={site => {
            setLaunchSpaceport(site);
            setRocketTelemetry(createPadTelemetry(activeRocket, site));
          }}
          activeRocket={activeRocket}
          onSelectRocket={rocket => {
            setActiveRocket(rocket);
            setRocketTelemetry(createPadTelemetry(rocket, launchSpaceport));
          }}
          rocketTelemetry={rocketTelemetry}
          onLaunch={handleLaunch}
          onAbort={handleAbort}
          isPlaying={isLaunchPlaying}
          onTogglePlay={() => setIsLaunchPlaying(!isLaunchPlaying)}
          playbackRate={launchRate}
          onChangePlaybackRate={setLaunchRate}
          autoGuidance={autoGuidance}
          onToggleAutoGuidance={() => setAutoGuidance(!autoGuidance)}
          throttle={userThrottle}
          onChangeThrottle={setUserThrottle}
          manualPitch={manualPitch}
          onChangeManualPitch={setManualPitch}
          isCollapsed={isLeftPanelCollapsed}
          onToggleCollapse={() => setIsLeftPanelCollapsed(!isLeftPanelCollapsed)}
        />
      )}

      {appMode === 'transfer' && (
        <>
          <TrajectoryPlanner
            selectedSpaceport={selectedSpaceport}
            onSelectSpaceport={setTransferSpaceport}
            activeTrajectory={activeTrajectory}
            onUpdateTrajectory={setActiveTrajectory}
            trajectoryProgress={trajectoryProgress}
            onChangeProgress={setTrajectoryProgress}
            onSelectLaunchWindow={(win) => {
              setSimTimeSeconds(win.openTimeHours * 3600);
            }}
            isCollapsed={isLeftPanelCollapsed}
            onToggleCollapse={() => setIsLeftPanelCollapsed(!isLeftPanelCollapsed)}
          />
          <MissionInfographicLegend
            activeTrajectory={activeTrajectory}
            trajectoryProgress={trajectoryProgress}
            onSelectMilestone={(m) => {
              setTrajectoryProgress(m.tFraction);
              if (activeTrajectory.points[m.pointIndex || 0]) {
                setSimTimeSeconds(activeTrajectory.points[m.pointIndex || 0].t);
              }
            }}
            isCollapsed={isRightPanelCollapsed}
            onToggleCollapse={() => setIsRightPanelCollapsed(!isRightPanelCollapsed)}
          />
        </>
      )}

      {appMode === 'launch' && (
        <TelemetryHUD
          telemetry={rocketTelemetry}
          isCollapsed={isRightPanelCollapsed}
          onToggleCollapse={() => setIsRightPanelCollapsed(!isRightPanelCollapsed)}
        />
      )}

      {appMode === 'mars' && marsMission && (
        <MarsMissionControls
          mission={marsMission}
          progress={marsProgress}
          playing={isMarsPlaying}
          collapsed={isLeftPanelCollapsed}
          onCollapse={() => setIsLeftPanelCollapsed(value => !value)}
          onSolve={mission => {
            setMarsMission(mission);
            scrubMars(0);
          }}
          onScrub={scrubMars}
          onTogglePlay={() => {
            if (marsProgress >= 1) setMarsProgress(0);
            setMarsPlaying(!isMarsPlaying);
          }}
        />
      )}

      {(appMode === 'system' || appMode === 'transfer') && (
        <TimeControls
          isPlaying={isPlaying}
          onTogglePlay={() => setIsPlaying(!isPlaying)}
          timeWarp={timeWarp}
          onSetTimeWarp={setTimeWarp}
          simTimeDays={simTimeSeconds / 86400}
          onResetTime={() => setSimTimeSeconds(0)}
        />
      )}

      <ZoomControls
        onZoomIn={() => viewportRef.current?.zoomIn()}
        onZoomOut={() => viewportRef.current?.zoomOut()}
        onResetZoom={() => viewportRef.current?.resetZoom()}
        isDecluttered={isDecluttered}
        onToggleDeclutter={handleToggleDeclutter}
      />

      <InfoModal isOpen={isInfoOpen} onClose={() => setIsInfoOpen(false)} />
      <FlightChartModal isOpen={isChartsOpen} onClose={() => setIsChartsOpen(false)} />
    </div>
  );
}

export default App;
