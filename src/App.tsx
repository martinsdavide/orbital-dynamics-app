import { useState, useEffect, useRef } from 'react';
import { ThreeViewport } from './components/canvas/ThreeViewport';
import type { ActiveAppMode, CameraPreset, ThreeViewportHandle } from './components/canvas/ThreeViewport';
import { Header } from './components/ui/Header';
import { TimeControls } from './components/ui/TimeControls';
import { SystemViewControls } from './components/ui/SystemViewControls';
import { LaunchViewControls } from './components/ui/LaunchViewControls';
import { TrajectoryPlanner } from './components/ui/TrajectoryPlanner';
import { MissionInfographicLegend } from './components/ui/MissionInfographicLegend';
import { TelemetryHUD } from './components/ui/TelemetryHUD';
import { ZoomControls } from './components/ui/ZoomControls';
import { FlightChartModal } from './components/ui/FlightChartModal';
import { InfoModal } from './components/ui/InfoModal';

import type { ReferenceFrame, ScaleMode } from './types/celestial';
import type { EarthMoonTrajectory } from './types/trajectory';

import { SPACEPORTS } from './data/spaceports';
import { ROCKET_PRESETS } from './data/rockets';
import { getEphemerisState } from './physics/orbitalMechanics';
import { createPadTelemetry, simulateRocketAscentStep } from './physics/rocketDynamics';
import { solveEarthMoonTrajectory } from './physics/trajectorySolver';

const DEFAULT_LAUNCH_SITE = SPACEPORTS.find(site => site.id === 'spacex_starbase')!;
const DEFAULT_LAUNCH_ROCKET = ROCKET_PRESETS.find(rocket => rocket.id === 'starship_v3')!;

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
  const [showSunEarthLagrange, setShowSunEarthLagrange] = useState(true);
  const [showEarthMoonLagrange, setShowEarthMoonLagrange] = useState<boolean>(true);
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
  const [showAsteroidBelt, setShowAsteroidBelt] = useState(true);
  const [showPlanetaryOrbits, setShowPlanetaryOrbits] = useState<boolean>(true);
  const [showPlanetLabels, setShowPlanetLabels] = useState<boolean>(true);

  const [launchSpaceport, setLaunchSpaceport] = useState(DEFAULT_LAUNCH_SITE);
  const [transferSpaceport, setTransferSpaceport] = useState(SPACEPORTS[0]);
  const [activeRocket, setActiveRocket] = useState(DEFAULT_LAUNCH_ROCKET);
  const selectedSpaceport = appMode === 'launch' ? launchSpaceport : transferSpaceport;

  const [rocketTelemetry, setRocketTelemetry] = useState(() => createPadTelemetry(DEFAULT_LAUNCH_ROCKET, DEFAULT_LAUNCH_SITE));

  const [autoGuidance, setAutoGuidance] = useState<boolean>(true);
  const [orbitTargetAltitude, setOrbitTargetAltitude] = useState<number>();
  const [userThrottle, setUserThrottle] = useState<number>(1.0);
  const [manualPitch, setManualPitch] = useState<number>(85);

  const [activeTrajectory, setActiveTrajectory] = useState<EarthMoonTrajectory>(() =>
    solveEarthMoonTrajectory('direct_loi', SPACEPORTS[0], 200000, 72)
  );
  const [trajectoryProgress, setTrajectoryProgress] = useState<number>(0.15);

  const [isInfoOpen, setIsInfoOpen] = useState<boolean>(false);
  const [isChartsOpen, setIsChartsOpen] = useState<boolean>(false);

  const ephemeris = getEphemerisState(simTimeSeconds);

  useEffect(() => {
    let animFrame: number;
    let lastTimestamp = performance.now();

    const loop = (timestamp: number) => {
      const realDt = Math.max(0, Math.min(0.1, (timestamp - lastTimestamp) / 1000));
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

      if (appMode === 'launch' && isLaunchPlaying && rocketTelemetry.phase !== 'pad' && rocketTelemetry.phase !== 'abort') {
        const launchDt = realDt * launchRate;
        const steps = Math.max(1, Math.ceil(launchDt / 0.1));
        const dt = launchDt / steps;
        setRocketTelemetry(previous => {
          let telemetry = previous;
          for (let step = 0; step < steps; step++) {
            telemetry = simulateRocketAscentStep({
              timeSeconds: telemetry.time,
              dt,
              rocket: activeRocket,
              spaceport: selectedSpaceport,
              telemetry,
              userThrottle,
              autoGuidance,
              manualPitchOverride: manualPitch,
              orbitTargetAltitude,
            });
          }
          return telemetry;
        });
      }

      animFrame = requestAnimationFrame(loop);
    };

    animFrame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animFrame);
  }, [isPlaying, timeWarp, launchRate, isLaunchPlaying, appMode, activeRocket, selectedSpaceport, userThrottle, autoGuidance, manualPitch, orbitTargetAltitude, rocketTelemetry.phase]);

  const handleSelectMode = (mode: ActiveAppMode) => {
    setAppMode(mode);
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

  const handleResetSimulation = () => {
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
        showSunEarthLagrange={showSunEarthLagrange}
        showEarthMoonLagrange={showEarthMoonLagrange}
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
        showAsteroidBelt={showAsteroidBelt}
        showPlanetaryOrbits={showPlanetaryOrbits}
        showPlanetLabels={showPlanetLabels}
        selectedSpaceport={selectedSpaceport}
        activeRocket={activeRocket}
        rocketTelemetry={rocketTelemetry}
        activeTrajectory={activeTrajectory}
        cameraPreset={cameraPreset}
        trajectoryProgress={trajectoryProgress}
      />

      <Header
        appMode={appMode}
        onSelectMode={handleSelectMode}
        cameraPreset={cameraPreset}
        onSelectCamera={preset => {
          if (preset === 'asteroid_belt') setShowAsteroidBelt(true);
          setCameraPreset(preset);
        }}
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
          showEarthMoonLagrange={showEarthMoonLagrange}
          onToggleEarthMoonLagrange={() => setShowEarthMoonLagrange(value => !value)}
          showSunEarthLagrange={showSunEarthLagrange}
          onToggleSunEarthLagrange={() => setShowSunEarthLagrange(value => !value)}
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
          showAsteroidBelt={showAsteroidBelt}
          onToggleAsteroidBelt={() => setShowAsteroidBelt(value => !value)}
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
          orbitTargetAltitude={orbitTargetAltitude}
          onOrbitTargetChange={setOrbitTargetAltitude}
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
          orbitTargetAltitude={orbitTargetAltitude}
          isCollapsed={isRightPanelCollapsed}
          onToggleCollapse={() => setIsRightPanelCollapsed(!isRightPanelCollapsed)}
        />
      )}

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
