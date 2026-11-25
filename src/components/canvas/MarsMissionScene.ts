import * as THREE from 'three';
import earthSurfaceUrl from '../../assets/earth-surface.jpg';
import { AU_METERS, getMarsMissionPlanetPosition, type MarsTransfer } from '../../physics/marsTransfer.ts';
import { createMarsTexture, createPlanetLabelTexture, createSunTexture } from './TextureGenerator';
import { ViewportBillboard } from './ViewportBillboard';

const SCENE_UNITS_PER_AU = 100;
const SCALE = SCENE_UNITS_PER_AU / AU_METERS;

export class MarsMissionScene {
  readonly scene = new THREE.Scene();
  private readonly earth: THREE.Group;
  private readonly mars: THREE.Group;
  private readonly spacecraft: THREE.Group;
  private readonly earthOrbit = this.addLine(0x3897e3, 0.5);
  private readonly marsOrbit = this.addLine(0xda644f, 0.5);
  private readonly trajectory = this.addLine(0xffce78, 1);
  private mission?: MarsTransfer;
  private frameRadius = 175;

  constructor() {
    this.scene.background = new THREE.Color(0x02040b);
    this.scene.add(new THREE.AmbientLight(0xffffff, 1.35));
    this.scene.add(new THREE.PointLight(0xfff1d9, 3, 0, 0));

    const earthMap = new THREE.TextureLoader().load(earthSurfaceUrl);
    const sun = this.addBody('Sun', '#f7b552', 5, createSunTexture(), true);
    sun.position.set(0, 0, 0);
    this.earth = this.addBody('Earth', '#4dabff', 3.5, earthMap);
    this.mars = this.addBody('Mars', '#f28766', 2.7, createMarsTexture());
    this.spacecraft = this.addBody('Spacecraft', '#ffce78', 1.25);

    const stars = new Float32Array(1800 * 3);
    for (let i = 0; i < stars.length; i += 3) {
      const y = 2 * Math.random() - 1;
      const angle = 2 * Math.PI * Math.random();
      const planeRadius = Math.sqrt(1 - y * y);
      stars[i] = 3800 * planeRadius * Math.cos(angle);
      stars[i + 1] = 3800 * y;
      stars[i + 2] = 3800 * planeRadius * Math.sin(angle);
    }
    const starGeometry = new THREE.BufferGeometry();
    starGeometry.setAttribute('position', new THREE.BufferAttribute(stars, 3));
    this.scene.add(new THREE.Points(starGeometry, new THREE.PointsMaterial({ color: 0xa5b8d2, size: 1.4, sizeAttenuation: false })));
  }

  private addBody(name: string, color: string, radius: number, map?: THREE.Texture, unlit = false) {
    const group = new THREE.Group();
    group.name = 'Mars mission ' + name;
    if (map) map.colorSpace = THREE.SRGBColorSpace;
    const geometry = map ? new THREE.SphereGeometry(radius, 48, 32) : new THREE.OctahedronGeometry(radius);
    const material = map && !unlit
      ? new THREE.MeshStandardMaterial({ map, roughness: 0.9 })
      : new THREE.MeshBasicMaterial({ map, color: map ? 0xffffff : color });
    const label = new ViewportBillboard(createPlanetLabelTexture(name, color), 92, 23, false);
    label.position.y = radius;
    label.center.y = -0.16;
    group.add(new THREE.Mesh(geometry, material), label);
    this.scene.add(group);
    return group;
  }

  private addLine(color: number, opacity: number) {
    const line = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({
      color, opacity, transparent: opacity < 1, depthWrite: opacity === 1, toneMapped: false,
    }));
    this.scene.add(line);
    return line;
  }

  update(mission: MarsTransfer, progress: number) {
    const changed = this.mission !== mission;
    if (changed) {
      const positions = mission.samples.map(sample => sample.spacecraft.clone().multiplyScalar(SCALE));
      this.trajectory.geometry.setFromPoints(positions).computeBoundingSphere();
      this.frameRadius = Math.max(175, ...positions.map(position => position.length()));
      for (const [body, line, periodDays] of [['earth', this.earthOrbit, 365.26], ['mars', this.marsOrbit, 686.98]] as const) {
        const points = Array.from({ length: 257 }, (_, index) =>
          getMarsMissionPlanetPosition(body, mission.departureEpoch + index / 256 * periodDays * 86_400_000)
            .multiplyScalar(SCALE)
        );
        line.geometry.setFromPoints(points).computeBoundingSphere();
      }
      this.mission = mission;
    }

    const sampleIndex = THREE.MathUtils.clamp(progress, 0, 1) * (mission.samples.length - 1);
    const start = mission.samples[Math.floor(sampleIndex)];
    const end = mission.samples[Math.ceil(sampleIndex)];
    const fraction = sampleIndex % 1;
    this.earth.position.copy(start.earth).lerp(end.earth, fraction).multiplyScalar(SCALE);
    this.mars.position.copy(start.mars).lerp(end.mars, fraction).multiplyScalar(SCALE);
    this.spacecraft.position.copy(start.spacecraft).lerp(end.spacecraft, fraction).multiplyScalar(SCALE);
    this.spacecraft.visible = this.spacecraft.position.distanceTo(this.earth.position) > 8 &&
      this.spacecraft.position.distanceTo(this.mars.position) > 8;
    return changed;
  }

  cameraDistance(camera: THREE.PerspectiveCamera) {
    const verticalHalfFov = THREE.MathUtils.degToRad(camera.fov / 2);
    const limitingHalfFov = Math.min(verticalHalfFov, Math.atan(camera.aspect * Math.tan(verticalHalfFov)));
    return this.frameRadius * 1.08 / Math.sin(limitingHalfFov);
  }

  dispose() {
    this.scene.traverse(object => {
      if (object instanceof THREE.Sprite) {
        object.material.map?.dispose();
        object.material.dispose();
      } else if (object instanceof THREE.Mesh || object instanceof THREE.Line || object instanceof THREE.Points) {
        object.geometry.dispose();
        const material = object.material as THREE.MeshStandardMaterial;
        material.map?.dispose();
        material.dispose();
      }
    });
  }
}
