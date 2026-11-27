import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import earthTextureUrl from '../../assets/earth-surface.jpg';
import type { sampleSatellite, sampleSatellitePaths } from '../../physics/satellites';

type SatelliteState = ReturnType<typeof sampleSatellite>;
type Paths = ReturnType<typeof sampleSatellitePaths>;

interface SatelliteGlobeProps {
  sample: SatelliteState;
  paths: Paths;
  points: Float32Array;
  overviewDistance: number;
  follow: boolean;
  showOrbit: boolean;
  showGroundTrack: boolean;
}

export function SatelliteGlobe({ sample, paths, points, overviewDistance, follow, showOrbit, showGroundTrack }: SatelliteGlobeProps) {
  const mount = useRef<HTMLDivElement>(null);
  const sceneObjects = useRef<{
    updateCloud: (points: Float32Array) => void;
    animate: (follow: boolean, sample: SatelliteState) => void;
    orbit: THREE.Line<THREE.BufferGeometry, THREE.LineBasicMaterial>;
    ground: THREE.Line<THREE.BufferGeometry, THREE.LineBasicMaterial>;
  } | null>(null);

  useEffect(() => {
    const element = mount.current;
    if (!element) return;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#060c18');
    const camera = new THREE.PerspectiveCamera(39, 1, 0.01, 50);
    camera.position.set(0.9, 0.54, 4.2).setLength(overviewDistance);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    element.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.enablePan = false;
    controls.minDistance = 1.5;
    controls.maxDistance = 40;

    const map = new THREE.TextureLoader().load(earthTextureUrl);
    map.colorSpace = THREE.SRGBColorSpace;
    const earth = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 64), new THREE.MeshBasicMaterial({ map }));
    const orbit = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: '#55cbff' }));
    const ground = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: '#f8ba5c' }));
    orbit.name = 'Selected satellite orbit';
    ground.name = 'Selected satellite ground track';
    const marker = new THREE.Mesh(new THREE.SphereGeometry(0.022, 16, 12), new THREE.MeshBasicMaterial({ color: '#fff3b1' }));
    marker.name = 'Selected satellite marker';
    const cloud = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({
      color: '#71c5f5', size: 2.5, sizeAttenuation: false, transparent: true, opacity: 0.65,
    }));
    cloud.name = 'Satellite constellation';
    cloud.frustumCulled = false;
    scene.add(earth, cloud, orbit, ground, marker);

    const position = new THREE.Vector3();
    const observer = new ResizeObserver(() => {
      const { clientWidth: width, clientHeight: height } = element;
      if (!width || !height) return;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    });
    observer.observe(element);
    sceneObjects.current = {
      orbit, ground,
      updateCloud(points) {
        const position = cloud.geometry.getAttribute('position');
        if (!position || position.array.length < points.length) {
          cloud.geometry.dispose();
          cloud.geometry = new THREE.BufferGeometry();
          cloud.geometry.setAttribute('position', new THREE.BufferAttribute(points.slice(), 3).setUsage(THREE.DynamicDrawUsage));
        } else {
          position.array.set(points);
          position.needsUpdate = true;
        }
        cloud.geometry.setDrawRange(0, points.length / 3);
      },
      animate(followSatellite, next) {
        marker.visible = !!next;
        if (!next) return;
        marker.position.set(...next.point);
        const radius = marker.position.length();
        marker.scale.setScalar(Math.max(1, radius / 2));
        if (followSatellite) camera.position.copy(position.copy(marker.position).setLength(Math.max(4.15, radius * 2.7)));
      },
    };

    renderer.setAnimationLoop(() => {
      controls.update();
      renderer.render(scene, camera);
    });

    return () => {
      renderer.setAnimationLoop(null);
      observer.disconnect();
      controls.dispose();
      for (const object of [earth, orbit, ground, marker, cloud]) {
        object.geometry.dispose();
        object.material.dispose();
      }
      map.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      sceneObjects.current = null;
    };
  }, [overviewDistance]);

  useEffect(() => {
    sceneObjects.current?.animate(follow, sample);
  }, [follow, sample]);

  useEffect(() => {
    const objects = sceneObjects.current;
    if (!objects) return;
    for (const [line, path] of [[objects.orbit, paths.orbit], [objects.ground, paths.ground]] as const) {
      line.geometry.dispose();
      line.geometry = new THREE.BufferGeometry().setFromPoints(path.map(point => new THREE.Vector3(...point)));
    }
  }, [paths]);

  useEffect(() => {
    sceneObjects.current?.updateCloud(points);
  }, [points]);

  useEffect(() => {
    const objects = sceneObjects.current;
    if (!objects) return;
    objects.orbit.visible = showOrbit;
    objects.ground.visible = showGroundTrack;
  }, [showOrbit, showGroundTrack]);

  return <div ref={mount} className="absolute inset-0 h-full w-full" aria-label="Interactive Earth globe with satellite orbits and ground tracks" />;
}
