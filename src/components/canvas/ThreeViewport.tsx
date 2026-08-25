import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import type { EphemerisState, ReferenceFrame, ScaleMode } from '../../types/celestial';
import type { Spaceport } from '../../types/spaceport';
import type { RocketPreset, RocketTelemetry } from '../../types/rocket';
import type { EarthMoonTrajectory } from '../../types/trajectory';
import { SCALING, EARTH, MOON, SUN } from '../../physics/constants';
import {
  createEarthTexture,
  createMoonTexture,
  createSunTexture,
  createParticleTexture,
} from './TextureGenerator';

export type ActiveAppMode = 'system' | 'launch' | 'transfer';

export function getScalingConfig(scaleMode: ScaleMode) {
  if (scaleMode === 'true') {
    // True 1:1 Astronomical Scale Proportions
    // Earth-Moon distance is exactly 60.33 Earth radii
    // Moon radius is exactly 27.27% of Earth radius
    // Sun radius is exactly 109.3x Earth radius
    const earthR = 3.0;
    const moonR = earthR * (MOON.radius / EARTH.radius); // ~0.818
    const sunR = earthR * Math.min(45, (SUN.radius / EARTH.radius) * 0.4); // ~38
    const emDist = earthR * (MOON.semiMajorAxis / EARTH.radius); // ~181 units (60.3x Earth radius)
    const seDist = 1200; // 1 AU heliocentric orbit

    return {
      earthRadius: earthR,
      moonRadius: moonR,
      sunRadius: sunR,
      earthMoonDistance: emDist,
      sunEarthDistance: seDist,
      waveAmplitude: 14.2,
      earthCameraRadius: 20,
      moonCameraRadius: 6,
      sunCameraRadius: 1400,
    };
  } else {
    // Enhanced Visual Mode (Optimized for side-by-side multi-body viewing)
    return {
      earthRadius: SCALING.visual.earthRadius, // 10
      moonRadius: SCALING.visual.moonRadius, // 2.7
      sunRadius: SCALING.visual.sunRadius, // 35
      earthMoonDistance: SCALING.visual.earthMoonDistance, // 70
      sunEarthDistance: SCALING.visual.sunEarthDistance, // 320
      waveAmplitude: 12.5,
      earthCameraRadius: 35,
      moonCameraRadius: 16,
      sunCameraRadius: 380,
    };
  }
}

export type CameraPreset = 'free' | 'earth' | 'moon' | 'sun' | 'rocket' | 'spaceport' | 'earthrise';

interface ThreeViewportProps {
  appMode: ActiveAppMode;
  ephemeris: EphemerisState;
  referenceFrame: ReferenceFrame;
  scaleMode: ScaleMode;
  showLagrangePoints: boolean;
  showEarthOrbit: boolean;
  showMoonOrbit: boolean;
  showComposedMoonSunOrbit: boolean;
  showDynamicTrails: boolean;
  showLunarSOI: boolean;
  showAtmosphereGlow: boolean;
  selectedSpaceport: Spaceport;
  activeRocket: RocketPreset;
  rocketTelemetry: RocketTelemetry;
  activeTrajectory: EarthMoonTrajectory | null;
  cameraPreset: CameraPreset;
  trajectoryProgress: number;
}

export const ThreeViewport: React.FC<ThreeViewportProps> = ({
  appMode,
  ephemeris,
  referenceFrame,
  scaleMode,
  showLagrangePoints,
  showEarthOrbit,
  showMoonOrbit,
  showComposedMoonSunOrbit,
  showDynamicTrails,
  showLunarSOI,
  showAtmosphereGlow,
  selectedSpaceport,
  rocketTelemetry,
  activeTrajectory,
  cameraPreset,
  trajectoryProgress,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);

  const sunMeshRef = useRef<THREE.Mesh | null>(null);
  const sunCoronaRef = useRef<THREE.Mesh | null>(null);
  const sunLightRef = useRef<THREE.PointLight | null>(null);
  const earthGroupRef = useRef<THREE.Group | null>(null);
  const earthMeshRef = useRef<THREE.Mesh | null>(null);
  const earthAtmoRef = useRef<THREE.Mesh | null>(null);
  const moonGroupRef = useRef<THREE.Group | null>(null);
  const moonMeshRef = useRef<THREE.Mesh | null>(null);
  const lunarSOIMeshRef = useRef<THREE.Mesh | null>(null);

  // Orbit Line Refs
  const earthOrbitLineRef = useRef<THREE.Line | null>(null);
  const moonOrbitLineRef = useRef<THREE.Line | null>(null);
  const composedMoonSunLineRef = useRef<THREE.Line | null>(null);
  const lagrangeGroupRef = useRef<THREE.Group | null>(null);

  // Dynamic Live Trail Breadcrumb Refs
  const earthDynamicTrailLineRef = useRef<THREE.Line | null>(null);
  const moonDynamicTrailLineRef = useRef<THREE.Line | null>(null);
  const earthTrailPositionsRef = useRef<THREE.Vector3[]>([]);
  const moonTrailPositionsRef = useRef<THREE.Vector3[]>([]);

  const rocketGroupRef = useRef<THREE.Group | null>(null);
  const exhaustParticlesRef = useRef<THREE.Points | null>(null);
  const launchpadMarkerRef = useRef<THREE.Group | null>(null);
  const ascentTrajectoryLineRef = useRef<THREE.Line | null>(null);
  const ascentPositionsRef = useRef<THREE.Vector3[]>([]);

  const transferTrajectoryLineRef = useRef<THREE.Line | null>(null);
  const spacecraftMarkerRef = useRef<THREE.Group | null>(null);

  const isDraggingRef = useRef(false);
  const prevMousePosRef = useRef({ x: 0, y: 0 });
  const cameraSphericalRef = useRef({ radius: 140, theta: Math.PI / 4, phi: Math.PI / 3 });
  const cameraTargetRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 0, 0));
  const prevFrameRef = useRef<ReferenceFrame>(referenceFrame);
  const prevAppModeRef = useRef<ActiveAppMode>(appMode);

  useEffect(() => {
    if (!mountRef.current) return;

    while (mountRef.current.firstChild) {
      mountRef.current.removeChild(mountRef.current.firstChild);
    }

    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color(0x02040a);

    const width = mountRef.current.clientWidth || window.innerWidth || 1200;
    const height = mountRef.current.clientHeight || window.innerHeight || 800;
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100000);
    cameraRef.current = camera;
    camera.position.set(0, 100, 150);

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        powerPreference: 'high-performance',
        alpha: false,
      });
    } catch {
      renderer = new THREE.WebGLRenderer({ antialias: false });
    }

    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Starfield Background
    const starCount = 3000;
    const starGeo = new THREE.BufferGeometry();
    const starPos = new Float32Array(starCount * 3);
    const starColors = new Float32Array(starCount * 3);

    for (let i = 0; i < starCount * 3; i += 3) {
      const r = 2500 + Math.random() * 2000;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      starPos[i] = r * Math.sin(phi) * Math.cos(theta);
      starPos[i + 1] = r * Math.sin(phi) * Math.sin(theta);
      starPos[i + 2] = r * Math.cos(phi);

      const colVal = 0.7 + Math.random() * 0.3;
      const isBlue = Math.random() > 0.8;
      const isRed = Math.random() < 0.15;
      starColors[i] = isRed ? 1.0 : isBlue ? colVal * 0.8 : colVal;
      starColors[i + 1] = isRed ? colVal * 0.7 : colVal;
      starColors[i + 2] = isBlue ? 1.0 : colVal;
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    starGeo.setAttribute('color', new THREE.BufferAttribute(starColors, 3));
    const starMat = new THREE.PointsMaterial({
      size: 2.2,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
    });
    const starfield = new THREE.Points(starGeo, starMat);
    scene.add(starfield);

    // Dynamic Lighting
    const ambientLight = new THREE.AmbientLight(0x334155, 1.2);
    scene.add(ambientLight);

    const dirFillLight = new THREE.DirectionalLight(0x94a3b8, 0.8);
    dirFillLight.position.set(100, 200, 100);
    scene.add(dirFillLight);

    const sunLight = new THREE.PointLight(0xffffff, 3.0, 0, 0);
    sunLight.position.set(-280, 0, 0);
    scene.add(sunLight);
    sunLightRef.current = sunLight;

    // Sun Mesh
    const sunTex = createSunTexture();
    const sunGeo = new THREE.SphereGeometry(SCALING.visual.sunRadius, 48, 48);
    const sunMat = new THREE.MeshBasicMaterial({ map: sunTex });
    const sunMesh = new THREE.Mesh(sunGeo, sunMat);
    sunMesh.position.set(-280, 0, 0);
    scene.add(sunMesh);
    sunMeshRef.current = sunMesh;

    const coronaGeo = new THREE.SphereGeometry(SCALING.visual.sunRadius * 1.25, 32, 32);
    const coronaMat = new THREE.MeshBasicMaterial({
      color: 0xffa500,
      transparent: true,
      opacity: 0.25,
      side: THREE.BackSide,
    });
    const sunCorona = new THREE.Mesh(coronaGeo, coronaMat);
    sunMesh.add(sunCorona);
    sunCoronaRef.current = sunCorona;

    // Earth Group
    const earthGroup = new THREE.Group();
    scene.add(earthGroup);
    earthGroupRef.current = earthGroup;

    const earthTex = createEarthTexture();
    const earthGeo = new THREE.SphereGeometry(SCALING.visual.earthRadius, 48, 48);
    const earthMat = new THREE.MeshStandardMaterial({
      map: earthTex,
      roughness: 0.6,
      metalness: 0.1,
    });
    const earthMesh = new THREE.Mesh(earthGeo, earthMat);
    earthMesh.rotation.z = EARTH.axialTilt;
    earthGroup.add(earthMesh);
    earthMeshRef.current = earthMesh;

    const atmoGeo = new THREE.SphereGeometry(SCALING.visual.earthRadius * 1.04, 36, 36);
    const atmoMat = new THREE.MeshBasicMaterial({
      color: 0x4da6ff,
      transparent: true,
      opacity: 0.25,
      side: THREE.BackSide,
    });
    const earthAtmo = new THREE.Mesh(atmoGeo, atmoMat);
    earthMesh.add(earthAtmo);
    earthAtmoRef.current = earthAtmo;

    // Launchpad Marker
    const launchpadGroup = new THREE.Group();
    const pinGeo = new THREE.ConeGeometry(0.5, 1.8, 16);
    const pinMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
    const pinMesh = new THREE.Mesh(pinGeo, pinMat);
    pinMesh.rotation.x = Math.PI;
    pinMesh.position.y = 0.9;
    launchpadGroup.add(pinMesh);

    const ringGeo = new THREE.RingGeometry(0.8, 1.2, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.7,
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.rotation.x = Math.PI / 2;
    launchpadGroup.add(ringMesh);
    earthMesh.add(launchpadGroup);
    launchpadMarkerRef.current = launchpadGroup;

    // Moon Group
    const moonGroup = new THREE.Group();
    scene.add(moonGroup);
    moonGroupRef.current = moonGroup;

    const moonTex = createMoonTexture();
    const moonGeo = new THREE.SphereGeometry(SCALING.visual.moonRadius, 36, 36);
    const moonMat = new THREE.MeshStandardMaterial({
      map: moonTex,
      roughness: 0.85,
      metalness: 0.05,
    });
    const moonMesh = new THREE.Mesh(moonGeo, moonMat);
    moonGroup.add(moonMesh);
    moonMeshRef.current = moonMesh;

    const soiGeo = new THREE.SphereGeometry(SCALING.visual.moonRadius * 4.5, 24, 24);
    const soiMat = new THREE.MeshBasicMaterial({
      color: 0x9333ea,
      wireframe: true,
      transparent: true,
      opacity: 0.25,
    });
    const soiMesh = new THREE.Mesh(soiGeo, soiMat);
    moonGroup.add(soiMesh);
    lunarSOIMeshRef.current = soiMesh;

    // Lagrange Group
    const lagrangeGroup = new THREE.Group();
    scene.add(lagrangeGroup);
    lagrangeGroupRef.current = lagrangeGroup;

    const lPoints = ['L1', 'L2', 'L3', 'L4', 'L5'];
    lPoints.forEach((lpName) => {
      const lpMarker = new THREE.Group();
      lpMarker.name = 'lagrange_' + lpName;

      const markerGeo = new THREE.OctahedronGeometry(0.8, 0);
      const markerMat = new THREE.MeshBasicMaterial({
        color: lpName === 'L4' || lpName === 'L5' ? 0x10b981 : 0xf59e0b,
        wireframe: true,
      });
      const markerMesh = new THREE.Mesh(markerGeo, markerMat);
      lpMarker.add(markerMesh);

      const haloGeo = new THREE.RingGeometry(1.2, 1.6, 16);
      const haloMat = new THREE.MeshBasicMaterial({
        color: lpName === 'L4' || lpName === 'L5' ? 0x10b981 : 0xf59e0b,
        transparent: true,
        opacity: 0.4,
        side: THREE.DoubleSide,
      });
      const haloMesh = new THREE.Mesh(haloGeo, haloMat);
      haloMesh.rotation.x = Math.PI / 2;
      lpMarker.add(haloMesh);

      lagrangeGroup.add(lpMarker);
    });

    // 1. Earth Orbit Line (Heliocentric)
    const earthOrbitPts: THREE.Vector3[] = [];
    for (let i = 0; i <= 256; i++) {
      const theta = (i / 256) * Math.PI * 2;
      earthOrbitPts.push(
        new THREE.Vector3(
          Math.cos(theta) * SCALING.visual.sunEarthDistance,
          0,
          Math.sin(theta) * SCALING.visual.sunEarthDistance
        )
      );
    }
    const earthOrbitGeo = new THREE.BufferGeometry().setFromPoints(earthOrbitPts);
    const earthOrbitMat = new THREE.LineBasicMaterial({
      color: 0x06b6d4, // Bright Cyan
      transparent: true,
      opacity: 0.6,
      linewidth: 2,
    });
    const earthOrbitLine = new THREE.Line(earthOrbitGeo, earthOrbitMat);
    scene.add(earthOrbitLine);
    earthOrbitLineRef.current = earthOrbitLine;

    // 2. Composed Lunar Orbit around the Sun (13.37-Wave Physically-Convex Epicycloid)
    // In real astrodynamics, v_Earth (30 km/s) >> v_Moon (1 km/s), so the Moon's path around the Sun
    // is everywhere strictly convex towards the Sun with 13 smooth sinusoidal ripples and NO retrogrades or cusps.
    const composedMoonPts: THREE.Vector3[] = [];
    const totalYearSteps = 1200;
    const moonToEarthRatio = EARTH.orbitalPeriod / MOON.orbitalPeriod; // ~13.368 lunar cycles/year
    const rSE = SCALING.visual.sunEarthDistance;
    // Visually scaled wave amplitude (kept within convex limit to avoid mathematical cusps)
    const waveAmplitude = 12.5;

    for (let i = 0; i <= totalYearSteps; i++) {
      const thetaE = (i / totalYearSteps) * Math.PI * 2;
      const thetaM = thetaE * moonToEarthRatio;

      // Heliocentric radial distance with smooth 13-wave lunar undulation
      const rCur = rSE + waveAmplitude * Math.cos(thetaM);
      const earthX = Math.cos(thetaE) * rCur;
      const earthZ = Math.sin(thetaE) * rCur;
      const moonRelY = Math.sin(thetaM) * 3.2;

      composedMoonPts.push(new THREE.Vector3(earthX, moonRelY, earthZ));
    }
    const composedMoonGeo = new THREE.BufferGeometry().setFromPoints(composedMoonPts);
    const composedMoonMat = new THREE.LineBasicMaterial({
      color: 0xf43f5e, // Hot Rose / Magenta
      transparent: true,
      opacity: 0.75,
      linewidth: 2,
    });
    const composedMoonSunLine = new THREE.Line(composedMoonGeo, composedMoonMat);
    scene.add(composedMoonSunLine);
    composedMoonSunLineRef.current = composedMoonSunLine;

    // 3. Moon Orbit Line around Earth (Geocentric)
    const moonOrbitPts: THREE.Vector3[] = [];
    for (let i = 0; i <= 128; i++) {
      const theta = (i / 128) * Math.PI * 2;
      const x = Math.cos(theta) * SCALING.visual.earthMoonDistance;
      const z = Math.sin(theta) * SCALING.visual.earthMoonDistance;
      const y = Math.sin(theta) * (SCALING.visual.earthMoonDistance * Math.tan(MOON.inclinationToEcliptic));
      moonOrbitPts.push(new THREE.Vector3(x, y, z));
    }
    const moonOrbitGeo = new THREE.BufferGeometry().setFromPoints(moonOrbitPts);
    const moonOrbitMat = new THREE.LineBasicMaterial({
      color: 0xa855f7, // Purple
      transparent: true,
      opacity: 0.7,
      linewidth: 2,
    });
    const moonOrbitLine = new THREE.Line(moonOrbitGeo, moonOrbitMat);
    earthGroup.add(moonOrbitLine);
    moonOrbitLineRef.current = moonOrbitLine;

    // 4. Live Dynamic Motion Breadcrumbs Trails
    const earthTrailGeo = new THREE.BufferGeometry();
    const earthTrailMat = new THREE.LineBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.85,
      linewidth: 2,
    });
    const earthDynamicTrailLine = new THREE.Line(earthTrailGeo, earthTrailMat);
    scene.add(earthDynamicTrailLine);
    earthDynamicTrailLineRef.current = earthDynamicTrailLine;

    const moonTrailGeo = new THREE.BufferGeometry();
    const moonTrailMat = new THREE.LineBasicMaterial({
      color: 0xf43f5e,
      transparent: true,
      opacity: 0.9,
      linewidth: 2,
    });
    const moonDynamicTrailLine = new THREE.Line(moonTrailGeo, moonTrailMat);
    scene.add(moonDynamicTrailLine);
    moonDynamicTrailLineRef.current = moonDynamicTrailLine;

    // Rocket 3D Model
    const rocketGroup = new THREE.Group();
    scene.add(rocketGroup);
    rocketGroupRef.current = rocketGroup;

    const rBodyGeo = new THREE.CylinderGeometry(0.4, 0.4, 3.2, 16);
    const rBodyMat = new THREE.MeshStandardMaterial({
      color: 0xf3f4f6,
      roughness: 0.3,
      metalness: 0.6,
    });
    const rBodyMesh = new THREE.Mesh(rBodyGeo, rBodyMat);
    rBodyMesh.position.y = 1.6;
    rocketGroup.add(rBodyMesh);

    const rConeGeo = new THREE.ConeGeometry(0.4, 1.0, 16);
    const rConeMat = new THREE.MeshStandardMaterial({ color: 0x1f2937 });
    const rConeMesh = new THREE.Mesh(rConeGeo, rConeMat);
    rConeMesh.position.y = 3.7;
    rocketGroup.add(rConeMesh);

    const particleCount = 120;
    const particleGeo = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount * 3; i++) {
      particlePositions[i] = 0;
    }
    particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));

    const particleTex = createParticleTexture();
    const particleMat = new THREE.PointsMaterial({
      size: 1.5,
      map: particleTex,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const exhaustParticles = new THREE.Points(particleGeo, particleMat);
    rocketGroup.add(exhaustParticles);
    exhaustParticlesRef.current = exhaustParticles;

    const ascentGeo = new THREE.BufferGeometry();
    const ascentMat = new THREE.LineBasicMaterial({
      color: 0x06b6d4,
      linewidth: 2,
    });
    const ascentLine = new THREE.Line(ascentGeo, ascentMat);
    scene.add(ascentLine);
    ascentTrajectoryLineRef.current = ascentLine;

    const transferGeo = new THREE.BufferGeometry();
    const transferMat = new THREE.LineBasicMaterial({
      color: 0x10b981,
      linewidth: 2,
    });
    const transferLine = new THREE.Line(transferGeo, transferMat);
    scene.add(transferLine);
    transferTrajectoryLineRef.current = transferLine;

    const scGroup = new THREE.Group();
    const scGeo = new THREE.OctahedronGeometry(0.7, 0);
    const scMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      roughness: 0.2,
      metalness: 0.8,
    });
    const scMesh = new THREE.Mesh(scGeo, scMat);
    scGroup.add(scMesh);

    const panelGeo = new THREE.BoxGeometry(2.4, 0.05, 0.5);
    const panelMat = new THREE.MeshStandardMaterial({ color: 0x1e3a8a, metalness: 0.9 });
    const panelMesh = new THREE.Mesh(panelGeo, panelMat);
    scGroup.add(panelMesh);
    scene.add(scGroup);
    spacecraftMarkerRef.current = scGroup;

    // Controls
    const dom = mountRef.current;
    const onMouseDown = (e: MouseEvent) => {
      isDraggingRef.current = true;
      prevMousePosRef.current = { x: e.clientX, y: e.clientY };
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const dx = e.clientX - prevMousePosRef.current.x;
      const dy = e.clientY - prevMousePosRef.current.y;
      prevMousePosRef.current = { x: e.clientX, y: e.clientY };

      cameraSphericalRef.current.theta -= dx * 0.006;
      cameraSphericalRef.current.phi = Math.max(
        0.05,
        Math.min(Math.PI - 0.05, cameraSphericalRef.current.phi - dy * 0.006)
      );
    };

    const onMouseUp = () => {
      isDraggingRef.current = false;
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const zoomFactor = Math.exp(e.deltaY * 0.0015);
      cameraSphericalRef.current.radius = Math.max(
        1.5,
        Math.min(35000, cameraSphericalRef.current.radius * zoomFactor)
      );
    };

    dom.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    dom.addEventListener('wheel', onWheel, { passive: false });

    const handleResize = () => {
      if (!mountRef.current || !rendererRef.current || !cameraRef.current) return;
      const w = mountRef.current.clientWidth || window.innerWidth || 800;
      const h = mountRef.current.clientHeight || window.innerHeight || 600;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h, false);
    };

    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });
    resizeObserver.observe(mountRef.current);
    window.addEventListener('resize', handleResize);

    handleResize();

    let animId: number;
    const animate = () => {
      animId = requestAnimationFrame(animate);

      if (cameraRef.current) {
        const { radius, theta, phi } = cameraSphericalRef.current;
        const target = cameraTargetRef.current;

        cameraRef.current.position.x = target.x + radius * Math.sin(phi) * Math.sin(theta);
        cameraRef.current.position.y = target.y + radius * Math.cos(phi);
        cameraRef.current.position.z = target.z + radius * Math.sin(phi) * Math.cos(theta);
        cameraRef.current.lookAt(target);
      }

      if (exhaustParticlesRef.current && exhaustParticlesRef.current.geometry) {
        const pAttr = exhaustParticlesRef.current.geometry.attributes.position as THREE.BufferAttribute;
        const arr = pAttr.array as Float32Array;
        for (let i = 0; i < particleCount; i++) {
          const idx = i * 3;
          arr[idx + 1] -= 0.15 + Math.random() * 0.1;
          arr[idx] += (Math.random() - 0.5) * 0.05;
          arr[idx + 2] += (Math.random() - 0.5) * 0.05;

          if (arr[idx + 1] < -3.0) {
            arr[idx] = (Math.random() - 0.5) * 0.2;
            arr[idx + 1] = 0;
            arr[idx + 2] = (Math.random() - 0.5) * 0.2;
          }
        }
        pAttr.needsUpdate = true;
      }

      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
    };
    animate();

    return () => {
      cancelAnimationFrame(animId);
      resizeObserver.disconnect();
      dom.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      dom.removeEventListener('wheel', onWheel);
      window.removeEventListener('resize', handleResize);
      if (rendererRef.current && rendererRef.current.domElement && dom.contains(rendererRef.current.domElement)) {
        dom.removeChild(rendererRef.current.domElement);
        rendererRef.current.dispose();
      }
    };
  }, []);

  useEffect(() => {
    if (!launchpadMarkerRef.current) return;
    const latRad = (selectedSpaceport.latitude * Math.PI) / 180;
    const lonRad = (selectedSpaceport.longitude * Math.PI) / 180;
    const r = SCALING.visual.earthRadius;

    const x = r * Math.cos(latRad) * Math.cos(lonRad);
    const y = r * Math.sin(latRad);
    const z = -r * Math.cos(latRad) * Math.sin(lonRad);

    launchpadMarkerRef.current.position.set(x, y, z);
    launchpadMarkerRef.current.lookAt(x * 2, y * 2, z * 2);
  }, [selectedSpaceport]);

  useEffect(() => {
    if (!sceneRef.current) return;

    const scales = getScalingConfig(scaleMode);
    const emDistScale = scales.earthMoonDistance;
    const sunDist = scales.sunEarthDistance;

    // Dynamically scale celestial body meshes
    if (earthMeshRef.current) {
      earthMeshRef.current.scale.setScalar(scales.earthRadius / SCALING.visual.earthRadius);
    }
    if (moonMeshRef.current) {
      moonMeshRef.current.scale.setScalar(scales.moonRadius / SCALING.visual.moonRadius);
    }
    if (sunMeshRef.current) {
      sunMeshRef.current.scale.setScalar(scales.sunRadius / SCALING.visual.sunRadius);
    }
    if (lunarSOIMeshRef.current) {
      // Laplace SOI: 66,100 km / 384,400 km = 0.172x Earth-Moon distance
      const soiRadius = emDistScale * 0.172;
      const baseSoiRadius = SCALING.visual.moonRadius * 4.5;
      lunarSOIMeshRef.current.scale.setScalar(soiRadius / baseSoiRadius);
    }

    // Rebuild exact Keplerian Moon Orbit Line around Earth
    if (moonOrbitLineRef.current) {
      const moonOrbitPts: THREE.Vector3[] = [];
      for (let i = 0; i <= 128; i++) {
        const theta = (i / 128) * Math.PI * 2;
        const x = Math.cos(theta) * emDistScale;
        const z = Math.sin(theta) * emDistScale;
        const y = Math.sin(theta) * (emDistScale * Math.tan(MOON.inclinationToEcliptic));
        moonOrbitPts.push(new THREE.Vector3(x, y, z));
      }
      moonOrbitLineRef.current.geometry.setFromPoints(moonOrbitPts);
      moonOrbitLineRef.current.scale.setScalar(1);
    }

    // Rebuild Earth Heliocentric Orbit Line around Sun
    if (earthOrbitLineRef.current) {
      const earthOrbitPts: THREE.Vector3[] = [];
      for (let i = 0; i <= 256; i++) {
        const theta = (i / 256) * Math.PI * 2;
        earthOrbitPts.push(new THREE.Vector3(Math.cos(theta) * sunDist, 0, Math.sin(theta) * sunDist));
      }
      earthOrbitLineRef.current.geometry.setFromPoints(earthOrbitPts);
      earthOrbitLineRef.current.scale.setScalar(1);
    }

    // Rebuild Composed Lunar Cycloid Orbit around Sun (Smooth & Convex)
    if (composedMoonSunLineRef.current) {
      const composedMoonPts: THREE.Vector3[] = [];
      const totalYearSteps = 1200;
      const moonToEarthRatio = EARTH.orbitalPeriod / MOON.orbitalPeriod; // ~13.368
      const waveAmp = Math.min(scales.waveAmplitude, emDistScale * 0.85);

      for (let i = 0; i <= totalYearSteps; i++) {
        const thetaE = (i / totalYearSteps) * Math.PI * 2;
        const thetaM = thetaE * moonToEarthRatio;
        const rCur = sunDist + waveAmp * Math.cos(thetaM);
        const x = Math.cos(thetaE) * rCur;
        const z = Math.sin(thetaE) * rCur;
        const y = Math.sin(thetaM) * (emDistScale * 0.1);
        composedMoonPts.push(new THREE.Vector3(x, y, z));
      }
      composedMoonSunLineRef.current.geometry.setFromPoints(composedMoonPts);
      composedMoonSunLineRef.current.scale.setScalar(1);
    }
    const moonAngle = (ephemeris.timeSeconds / MOON.orbitalPeriod) * (2 * Math.PI);
    const moonX = Math.cos(moonAngle) * emDistScale;
    const moonZ = Math.sin(moonAngle) * emDistScale;
    const moonY = Math.sin(moonAngle) * (emDistScale * Math.tan(MOON.inclinationToEcliptic));

    let currentEarthWorldPos = new THREE.Vector3(0, 0, 0);
    let currentMoonWorldPos = new THREE.Vector3(0, 0, 0);

    // Clear trail breadcrumbs when switching reference frames or app modes
    if (prevFrameRef.current !== referenceFrame || prevAppModeRef.current !== appMode) {
      prevFrameRef.current = referenceFrame;
      prevAppModeRef.current = appMode;
      earthTrailPositionsRef.current = [];
      moonTrailPositionsRef.current = [];
    }

    if (referenceFrame === 'heliocentric') {
      const earthAngle = (ephemeris.timeSeconds / EARTH.orbitalPeriod) * (2 * Math.PI);
      
      currentEarthWorldPos.set(Math.cos(earthAngle) * sunDist, 0, Math.sin(earthAngle) * sunDist);
      currentMoonWorldPos.set(
        currentEarthWorldPos.x + moonX,
        moonY,
        currentEarthWorldPos.z + moonZ
      );

      if (sunMeshRef.current && sunLightRef.current) {
        sunMeshRef.current.position.set(0, 0, 0);
        sunLightRef.current.position.set(0, 0, 0);
        sunMeshRef.current.visible = true;
      }

      if (earthGroupRef.current) {
        earthGroupRef.current.position.copy(currentEarthWorldPos);
      }
      if (moonGroupRef.current) {
        moonGroupRef.current.position.copy(currentMoonWorldPos);
        moonGroupRef.current.visible = true;
      }

      // Heliocentric orbit lines centered at Sun (0, 0, 0)
      if (earthOrbitLineRef.current) {
        earthOrbitLineRef.current.position.set(0, 0, 0);
        earthOrbitLineRef.current.visible = showEarthOrbit && appMode === 'system';
      }
      if (composedMoonSunLineRef.current) {
        composedMoonSunLineRef.current.position.set(0, 0, 0);
        composedMoonSunLineRef.current.visible = showComposedMoonSunOrbit && appMode === 'system';
      }
    } else {
      // Geocentric / Barycentric
      currentEarthWorldPos.set(0, 0, 0);
      currentMoonWorldPos.set(moonX, moonY, moonZ);

      if (earthGroupRef.current) {
        earthGroupRef.current.position.set(0, 0, 0);
      }
      if (moonGroupRef.current) {
        moonGroupRef.current.position.set(moonX, moonY, moonZ);
        moonGroupRef.current.visible = true;
      }
      if (sunMeshRef.current && sunLightRef.current) {
        sunMeshRef.current.position.set(-sunDist, 0, 0);
        sunLightRef.current.position.set(-sunDist, 0, 0);
        sunMeshRef.current.visible = appMode === 'system';
      }

      if (earthOrbitLineRef.current) {
        earthOrbitLineRef.current.visible = false;
      }
      if (composedMoonSunLineRef.current) {
        composedMoonSunLineRef.current.visible = false;
      }
    }

    // Record Live Dynamic Motion Trails
    if (showDynamicTrails && appMode === 'system') {
      earthTrailPositionsRef.current.push(currentEarthWorldPos.clone());
      moonTrailPositionsRef.current.push(currentMoonWorldPos.clone());

      if (earthTrailPositionsRef.current.length > 500) earthTrailPositionsRef.current.shift();
      if (moonTrailPositionsRef.current.length > 500) moonTrailPositionsRef.current.shift();

      if (earthDynamicTrailLineRef.current && earthTrailPositionsRef.current.length > 2) {
        earthDynamicTrailLineRef.current.geometry.setFromPoints(earthTrailPositionsRef.current);
        earthDynamicTrailLineRef.current.visible = true;
      }
      if (moonDynamicTrailLineRef.current && moonTrailPositionsRef.current.length > 2) {
        moonDynamicTrailLineRef.current.geometry.setFromPoints(moonTrailPositionsRef.current);
        moonDynamicTrailLineRef.current.visible = true;
      }
    } else {
      if (earthDynamicTrailLineRef.current) earthDynamicTrailLineRef.current.visible = false;
      if (moonDynamicTrailLineRef.current) moonDynamicTrailLineRef.current.visible = false;
    }

    // Moon Orbit around Earth (purple)
    if (moonOrbitLineRef.current) {
      moonOrbitLineRef.current.visible = showMoonOrbit;
    }

    // Body Rotations
    if (earthMeshRef.current) {
      earthMeshRef.current.rotation.y = ephemeris.earth.rotationAngle;
    }
    if (moonMeshRef.current) {
      moonMeshRef.current.rotation.y = moonAngle;
    }

    if (earthAtmoRef.current) {
      earthAtmoRef.current.visible = showAtmosphereGlow;
    }
    if (lunarSOIMeshRef.current) {
      lunarSOIMeshRef.current.visible = showLunarSOI;
    }

    if (lagrangeGroupRef.current) {
      lagrangeGroupRef.current.visible = showLagrangePoints && appMode === 'system';
      ephemeris.lagrangePoints.forEach((lp) => {
        const marker = lagrangeGroupRef.current?.getObjectByName('lagrange_' + lp.name);
        if (marker) {
          const dir = lp.position;
          const mag = Math.sqrt(dir.x * dir.x + dir.y * dir.y + dir.z * dir.z) || 1;
          const scaledMag = (mag / MOON.semiMajorAxis) * emDistScale;
          marker.position.set(
            currentEarthWorldPos.x + (dir.x / mag) * scaledMag,
            currentEarthWorldPos.y + (dir.y / mag) * scaledMag,
            currentEarthWorldPos.z + (dir.z / mag) * scaledMag
          );
        }
      });
    }

    if (appMode === 'launch') {
      if (rocketGroupRef.current && launchpadMarkerRef.current) {
        rocketGroupRef.current.visible = true;

        // Obtain exact world position of the launchpad on Earth's surface
        const padWorldPos = new THREE.Vector3();
        launchpadMarkerRef.current.getWorldPosition(padWorldPos);

        const earthWorldCenter = new THREE.Vector3();
        if (earthMeshRef.current) {
          earthMeshRef.current.getWorldPosition(earthWorldCenter);
        } else {
          earthWorldCenter.copy(currentEarthWorldPos);
        }

        // Radial outward normal vector from Earth center through the launchpad into the sky
        const upNormal = new THREE.Vector3().subVectors(padWorldPos, earthWorldCenter).normalize();

        // Eastward horizontal flight vector for downrange ascent
        const earthAxis = new THREE.Vector3(0, 1, 0).applyAxisAngle(new THREE.Vector3(0, 0, 1), EARTH.axialTilt);
        const eastTangent = new THREE.Vector3().crossVectors(earthAxis, upNormal).normalize();
        if (eastTangent.lengthSq() < 0.01) {
          eastTangent.set(1, 0, 0);
        }

        const altScale = (rocketTelemetry.altitude / 300000) * 12;
        const downrangeScale = (rocketTelemetry.downrangeDistance / 800000) * 16;

        const currentRocketPos = new THREE.Vector3()
          .copy(padWorldPos)
          .addScaledVector(upNormal, altScale + 0.2)
          .addScaledVector(eastTangent, downrangeScale);

        rocketGroupRef.current.position.copy(currentRocketPos);

        // Attitude orientation
        const pitchRad = (rocketTelemetry.pitchAngle * Math.PI) / 180;
        const flightDir = new THREE.Vector3()
          .addScaledVector(upNormal, Math.sin(pitchRad))
          .addScaledVector(eastTangent, Math.cos(pitchRad))
          .normalize();

        const lookTarget = new THREE.Vector3().copy(currentRocketPos).add(flightDir);
        rocketGroupRef.current.lookAt(lookTarget);
        rocketGroupRef.current.rotateX(Math.PI / 2);

        if (rocketTelemetry.phase !== 'pad') {
          ascentPositionsRef.current.push(currentRocketPos.clone());
          if (ascentPositionsRef.current.length > 300) {
            ascentPositionsRef.current.shift();
          }
          if (ascentTrajectoryLineRef.current) {
            ascentTrajectoryLineRef.current.geometry.setFromPoints(ascentPositionsRef.current);
            ascentTrajectoryLineRef.current.visible = true;
          }
        } else {
          ascentPositionsRef.current = [];
          if (ascentTrajectoryLineRef.current) {
            ascentTrajectoryLineRef.current.visible = false;
          }
        }

        if (exhaustParticlesRef.current) {
          exhaustParticlesRef.current.visible = rocketTelemetry.thrust > 0;
        }
      }

      if (spacecraftMarkerRef.current) {
        spacecraftMarkerRef.current.visible = false;
      }
      if (transferTrajectoryLineRef.current) {
        transferTrajectoryLineRef.current.visible = false;
      }
    } else if (appMode === 'transfer' && activeTrajectory) {
      if (rocketGroupRef.current) {
        rocketGroupRef.current.visible = false;
      }
      if (ascentTrajectoryLineRef.current) {
        ascentTrajectoryLineRef.current.visible = false;
      }

      // Get exact world position of the launch base on Earth's surface
      const padWorldPos = new THREE.Vector3();
      if (launchpadMarkerRef.current) {
        launchpadMarkerRef.current.getWorldPosition(padWorldPos);
      } else {
        padWorldPos.copy(currentEarthWorldPos);
      }

      const rEarthVisual = scales.earthRadius;
      const rMoonVisual = scales.earthMoonDistance;

      const rawSplinePts: THREE.Vector3[] = activeTrajectory.points.map((pt, idx) => {
        if (idx === 0) {
          return padWorldPos.clone();
        }

        const frac = Math.max(0, (pt.distanceToEarth - EARTH.radius) / (MOON.semiMajorAxis - EARTH.radius));
        const scaledDist = rEarthVisual + frac * (rMoonVisual - rEarthVisual);
        const dMag = Math.sqrt(pt.position.x * pt.position.x + pt.position.y * pt.position.y + pt.position.z * pt.position.z) || 1;

        return new THREE.Vector3(
          currentEarthWorldPos.x + (pt.position.x / dMag) * scaledDist,
          currentEarthWorldPos.y + (pt.position.y / dMag) * scaledDist,
          currentEarthWorldPos.z + (pt.position.z / dMag) * scaledDist
        );
      });

      // Generate a smooth Catmull-Rom spline curve to eliminate all angular kinks and cusps
      const curve = new THREE.CatmullRomCurve3(rawSplinePts);
      const ribbonPts = curve.getPoints(250);

      if (transferTrajectoryLineRef.current && ribbonPts.length > 0) {
        transferTrajectoryLineRef.current.geometry.setFromPoints(ribbonPts);
        transferTrajectoryLineRef.current.visible = true;
      }

      if (spacecraftMarkerRef.current && ribbonPts.length > 0) {
        spacecraftMarkerRef.current.visible = true;
        const targetIdx = Math.min(
          ribbonPts.length - 1,
          Math.floor(trajectoryProgress * (ribbonPts.length - 1))
        );
        const scPos = ribbonPts[targetIdx];
        spacecraftMarkerRef.current.position.copy(scPos);

        if (targetIdx < ribbonPts.length - 1) {
          spacecraftMarkerRef.current.lookAt(ribbonPts[targetIdx + 1]);
        }
      }
    } else {
      if (rocketGroupRef.current) rocketGroupRef.current.visible = false;
      if (ascentTrajectoryLineRef.current) ascentTrajectoryLineRef.current.visible = false;
      if (transferTrajectoryLineRef.current) transferTrajectoryLineRef.current.visible = false;
      if (spacecraftMarkerRef.current) spacecraftMarkerRef.current.visible = false;
    }

    if (cameraPreset === 'earth') {
      cameraTargetRef.current.copy(currentEarthWorldPos);
      cameraSphericalRef.current.radius = scales.earthCameraRadius;
    } else if (cameraPreset === 'moon' && moonGroupRef.current) {
      cameraTargetRef.current.copy(currentMoonWorldPos);
      cameraSphericalRef.current.radius = scales.moonCameraRadius;
    } else if (cameraPreset === 'sun') {
      cameraTargetRef.current.set(0, 0, 0);
      cameraSphericalRef.current.radius = scales.sunCameraRadius;
    } else if (cameraPreset === 'spaceport' && launchpadMarkerRef.current) {
      launchpadMarkerRef.current.getWorldPosition(cameraTargetRef.current);
      cameraSphericalRef.current.radius = scales.earthCameraRadius * 0.55;
    } else if (cameraPreset === 'rocket' && rocketGroupRef.current && appMode === 'launch') {
      cameraTargetRef.current.copy(rocketGroupRef.current.position);
      cameraSphericalRef.current.radius = 12;
    } else if (cameraPreset === 'earthrise' && moonGroupRef.current) {
      cameraTargetRef.current.copy(currentMoonWorldPos);
      cameraSphericalRef.current.radius = scales.moonCameraRadius * 0.7;
    }
  }, [
    appMode,
    ephemeris,
    referenceFrame,
    scaleMode,
    showLagrangePoints,
    showEarthOrbit,
    showMoonOrbit,
    showComposedMoonSunOrbit,
    showDynamicTrails,
    showLunarSOI,
    showAtmosphereGlow,
    selectedSpaceport,
    rocketTelemetry,
    activeTrajectory,
    cameraPreset,
    trajectoryProgress,
  ]);

  return (
    <div
      ref={mountRef}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
      className="cursor-grab active:cursor-grabbing select-none overflow-hidden"
    />
  );
};
