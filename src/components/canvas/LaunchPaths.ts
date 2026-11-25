import * as THREE from 'three';
import { EARTH } from '../../physics/constants.ts';
import type { RocketTelemetry } from '../../types/rocket';
import { createPlanetLabelTexture } from './TextureGenerator';

const ISS_ALTITUDE = 420_000;
const ISS_RADIUS_RATIO = 1 + ISS_ALTITUDE / EARTH.radius;
const ISS_INCLINATION = THREE.MathUtils.degToRad(51.6);
const ISS_PERIOD = 2 * Math.PI * Math.sqrt(Math.pow(EARTH.radius + ISS_ALTITUDE, 3) / EARTH.mu);
const TRAIL_CAPACITY = 4096;
const ORIGIN = new THREE.Vector3();
const TILT_AXIS = new THREE.Vector3(0, 0, 1);

function issOrbitPoint(angle: number) {
  return new THREE.Vector3(Math.cos(angle), Math.sin(angle) * Math.sin(ISS_INCLINATION), -Math.sin(angle) * Math.cos(ISS_INCLINATION))
    .applyAxisAngle(TILT_AXIS, EARTH.axialTilt)
    .multiplyScalar(ISS_RADIUS_RATIO);
}

const ISS_ASCENDING_NODE = issOrbitPoint(0);
const ISS_QUARTER_ORBIT = issOrbitPoint(Math.PI / 2);

export class LaunchPaths {
  readonly group = new THREE.Group();
  private readonly orbit = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(Array.from({ length: 257 }, (_, i) => issOrbitPoint(i / 256 * 2 * Math.PI))),
    new THREE.LineBasicMaterial({ color: 0x67bcff, transparent: true, opacity: 0.8 }),
  );
  private readonly station = new THREE.Group();
  private readonly chassis = new THREE.Group();
  private readonly trail = new THREE.Line(
    new THREE.BufferGeometry(),
    new THREE.LineBasicMaterial({ color: 0xffc86c, toneMapped: false }),
  );
  private readonly points = new THREE.BufferAttribute(new Float32Array(TRAIL_CAPACITY * 3), 3).setUsage(THREE.DynamicDrawUsage);
  private readonly lastPoint = new THREE.Vector3();
  private count = 0;
  private sampleInterval = 0.75;
  private lastSample = 0;
  private lastTime = -1;
  private earthRadius = 0;
  private stationStartAngle = 0;
  private readonly orientation = new THREE.Matrix4();
  extent = 0;

  constructor(scene: THREE.Scene) {
    this.group.name = 'Launch orbit overlays';
    this.group.visible = false;
    this.orbit.name = 'ISS low Earth orbit';
    this.station.name = 'International Space Station';
    this.trail.name = 'Recorded rocket trail';
    this.trail.geometry.setAttribute('position', this.points);
    this.trail.geometry.setDrawRange(0, 0);
    this.trail.frustumCulled = false;

    const moduleMaterial = new THREE.MeshBasicMaterial({ color: 0xe8f3fb });
    const solarMaterial = new THREE.MeshBasicMaterial({ color: 0x357ac7 });
    const truss = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.012, 0.014), moduleMaterial);
    const modules = new THREE.Mesh(new THREE.BoxGeometry(0.047, 0.025, 0.079), moduleMaterial);
    this.chassis.add(truss, modules);
    for (const side of [-1, 1]) {
      for (const row of [-1, 1]) {
        const panel = new THREE.Mesh(new THREE.BoxGeometry(0.044, 0.004, 0.066), solarMaterial);
        panel.position.set(side * 0.066, 0, row * 0.038);
        this.chassis.add(panel);
      }
    }
    const label = new THREE.Sprite(new THREE.SpriteMaterial({
      map: createPlanetLabelTexture('ISS', '#67bcff'),
      transparent: true,
    }));
    label.position.y = 0.16;
    label.scale.set(0.76, 0.19, 1);
    this.station.add(this.chassis, label);
    this.group.add(this.orbit, this.station, this.trail);
    scene.add(this.group);
  }

  update(center: THREE.Vector3, radius: number, telemetry: RocketTelemetry, rocketPosition: THREE.Vector3, launchUp: THREE.Vector3) {
    this.group.position.copy(center);
    this.earthRadius = radius;
    this.orbit.scale.setScalar(radius);
    if (telemetry.phase === 'pad') {
      // Start this illustrative orbit at the point nearest the launch site.
      this.stationStartAngle = Math.atan2(launchUp.dot(ISS_QUARTER_ORBIT), launchUp.dot(ISS_ASCENDING_NODE));
    }
    const angle = this.stationStartAngle + telemetry.time * 2 * Math.PI / ISS_PERIOD;
    this.station.position.copy(issOrbitPoint(angle)).multiplyScalar(radius);
    const tangent = issOrbitPoint(angle + 0.001).multiplyScalar(radius).sub(this.station.position);
    this.chassis.up.copy(this.station.position).normalize();
    this.chassis.quaternion.setFromRotationMatrix(this.orientation.lookAt(
      ORIGIN, tangent, this.chassis.up,
    ));

    if (telemetry.phase === 'pad' || telemetry.time < this.lastTime) {
      this.count = 0;
      this.sampleInterval = 0.75;
      this.lastSample = 0;
      this.extent = 0;
      this.trail.geometry.setDrawRange(0, 0);
      this.lastTime = -1;
    }
    if (telemetry.phase === 'pad' || telemetry.time <= this.lastTime) return;
    this.lastTime = telemetry.time;

    this.lastPoint.subVectors(rocketPosition, center);
    this.extent = Math.max(this.extent, this.lastPoint.length());
    if (this.count === 0 || telemetry.time - this.lastSample >= this.sampleInterval) {
      if (this.count >= TRAIL_CAPACITY - 1) {
        // Retain the start of the flight and sample the older trail less densely.
        for (let i = 0; i < this.count; i += 2) {
          this.points.setXYZ(i / 2, this.points.getX(i), this.points.getY(i), this.points.getZ(i));
        }
        this.count = Math.ceil(this.count / 2);
        this.sampleInterval *= 2;
      }
      this.points.setXYZ(this.count++, this.lastPoint.x, this.lastPoint.y, this.lastPoint.z);
      this.lastSample = telemetry.time;
    }
    this.points.setXYZ(this.count, this.lastPoint.x, this.lastPoint.y, this.lastPoint.z);
    this.points.needsUpdate = true;
    this.trail.geometry.setDrawRange(0, this.count + 1);
  }

  get overviewRadius() {
    return Math.max(this.earthRadius * ISS_RADIUS_RATIO + 0.4, this.extent);
  }

  dispose() {
    const materials = new Set<THREE.Material>();
    this.group.traverse(object => {
      if (object instanceof THREE.Mesh || object instanceof THREE.Line) {
        object.geometry.dispose();
        materials.add(object.material as THREE.Material);
      } else if (object instanceof THREE.Sprite) {
        object.material.map?.dispose();
        materials.add(object.material);
      }
    });
    for (const material of materials) material.dispose();
    this.group.removeFromParent();
  }
}
