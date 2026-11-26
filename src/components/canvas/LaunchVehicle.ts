import * as THREE from 'three';
import { sampleBoosterReturn, SUPER_HEAVY_PRESET_ID } from '../../physics/boosterReturn';
import { EARTH } from '../../physics/constants.ts';
import type { RocketPreset, RocketTelemetry } from '../../types/rocket';

export const LAUNCH_MODEL_SCALE = 0.25;

const SEPARATION_DURATION = 7;
const UP = new THREE.Vector3(0, 1, 0);
const TUMBLE_AXIS = new THREE.Vector3(0, 0, 1);

interface Section {
  stageIndex: number;
  model: THREE.Group;
  center: THREE.Vector3;
  width: number;
  halfLength: number;
  base: number;
  side: number;
  separationTime?: number;
  separationRotation: THREE.Quaternion;
}

export class LaunchVehicle {
  readonly group = new THREE.Group();
  readonly stand = new THREE.Group();
  readonly exhaustMount = new THREE.Group();
  readonly target = new THREE.Vector3();
  readonly cameraDirection = new THREE.Vector3();
  readonly cameraUp = new THREE.Vector3();
  readonly boosterTarget = new THREE.Vector3();
  boosterFramingRadius = 0;
  framingRadius = 0;
  separationWeight = 0;

  private readonly boosterTrail = new THREE.Line(
    new THREE.BufferGeometry(),
    new THREE.LineBasicMaterial({ color: 0xf4a65b, transparent: true, opacity: 0.8, depthWrite: false }),
  );
  private readonly plumeMaterial = new THREE.MeshBasicMaterial({ color: 0xffb472, transparent: true, opacity: 0.85 });
  private boosterPlume?: THREE.Mesh;
  private readonly sections: Section[] = [];
  private readonly detached = new THREE.Group();
  private readonly hull = new THREE.MeshStandardMaterial({ color: 0xf4f7fb, roughness: 0.62 });
  private readonly trim = new THREE.MeshStandardMaterial({ color: 0x253443, roughness: 0.65 });
  private readonly accent = new THREE.MeshStandardMaterial({ color: 0xbf4f31, roughness: 0.7 });
  private readonly bounds = new THREE.Box3();
  private readonly center = new THREE.Vector3();
  private readonly lateral = new THREE.Vector3();
  private readonly tumble = new THREE.Quaternion();
  private readonly orientation = new THREE.Matrix4();
  private readonly flight = new THREE.Vector3();
  private readonly radial = new THREE.Vector3();
  private readonly alongTrack = new THREE.Vector3();
  private readonly forward = new THREE.Vector3();
  private readonly extent = new THREE.Vector3();
  private readonly corner = new THREE.Vector3();
  private readonly activeCenter = new THREE.Vector3();
  private rocket?: RocketPreset;
  private lastTime = 0;
  private boosterTrailTime = -1;
  private stageIndex = 0;

  constructor() {
    this.group.name = 'Launch vehicle';
    this.stand.scale.setScalar(LAUNCH_MODEL_SCALE);
    this.detached.name = 'Detached launch stages';
    this.group.add(this.exhaustMount);
    this.boosterTrail.name = 'Super Heavy return trail';
    this.boosterTrail.visible = false;
    const deck = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.008, 0.14), this.trim);
    deck.position.y = 0.004;
    this.stand.add(deck);
    const addBeam = (start: THREE.Vector3, end: THREE.Vector3, width: number) => {
      const direction = end.clone().sub(start);
      const beam = new THREE.Mesh(new THREE.BoxGeometry(width, direction.length(), width), this.hull);
      beam.position.copy(start).lerp(end, 0.5);
      beam.quaternion.setFromUnitVectors(UP, direction.normalize());
      this.stand.add(beam);
    };
    const corners = [[-0.012, -0.063], [0.012, -0.063], [0.012, -0.039], [-0.012, -0.039]];
    for (const [index, [x, z]] of corners.entries()) {
      const [nextX, nextZ] = corners[(index + 1) % corners.length];
      addBeam(new THREE.Vector3(x, 0, z), new THREE.Vector3(x, 0.16, z), 0.003);
      for (let level = 0; level < 4; level++) {
        const y = level * 0.04;
        addBeam(new THREE.Vector3(x, y, z), new THREE.Vector3(nextX, y + 0.04, nextZ), 0.002);
        addBeam(new THREE.Vector3(x, y + 0.04, z), new THREE.Vector3(nextX, y + 0.04, nextZ), 0.002);
      }
    }
  }

  addTo(scene: THREE.Scene) {
    scene.add(this.group, this.detached, this.stand, this.boosterTrail);
    this.setVisible(false);
  }

  setVisible(visible: boolean) {
    this.group.visible = visible;
    this.detached.visible = visible;
    this.stand.visible = visible;
    if (!visible) this.boosterTrail.visible = false;
  }

  private clearSections() {
    for (const { model } of this.sections) {
      model.removeFromParent();
      model.traverse(object => {
        if (object instanceof THREE.Mesh) object.geometry.dispose();
      });
    }
    this.sections.length = 0;
    this.boosterPlume = undefined;
  }

  dispose() {
    this.clearSections();
    this.stand.traverse(object => {
      if (object instanceof THREE.Mesh) object.geometry.dispose();
    });
    this.hull.dispose();
    this.trim.dispose();
    this.accent.dispose();
    this.plumeMaterial.dispose();
    this.boosterTrail.geometry.dispose();
    this.boosterTrail.material.dispose();
  }

  private build(rocket: RocketPreset) {
    this.clearSections();
    const pairedBoosters = rocket.id === 'falcon_heavy' || rocket.id === 'sls_block1';
    const inlineStages = pairedBoosters ? rocket.stages.slice(1) : rocket.stages;
    const stackHeight = inlineStages.reduce((height, stage) => height + stage.height, 0);
    const scale = 0.23 * LAUNCH_MODEL_SCALE / Math.max(rocket.height, stackHeight * 1.12);
    let base = 0;

    for (const [stageIndex, stage] of rocket.stages.entries()) {
      const isBooster = pairedBoosters && stageIndex === 0;
      const height = stage.height * scale * (rocket.id === 'sls_block1' && isBooster ? 0.8 : 1);
      const radius = stage.diameter * scale * (rocket.id === 'sls_block1' && isBooster ? 0.23 : 0.5);
      const nose = stageIndex === rocket.stages.length - 1 || isBooster;
      const noseHeight = nose ? height * 0.19 : 0;
      const bodyHeight = height - noseHeight;

      for (const side of isBooster ? [-1, 1] : [0]) {
        const model = new THREE.Group();
        model.name = side ? `${stage.name} (${side < 0 ? 'left' : 'right'})` : stage.name;
        const body = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, bodyHeight, 20), this.hull);
        model.add(body);
        const band = new THREE.Mesh(new THREE.CylinderGeometry(radius * 1.02, radius * 1.02, bodyHeight * 0.12, 20), side ? this.accent : this.trim);
        band.position.y = -bodyHeight * 0.34;
        model.add(band);
        const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.58, radius * 0.78, radius * 0.58, 16), this.trim);
        nozzle.position.y = -bodyHeight / 2;
        model.add(nozzle);
        if (nose) {
          const tip = new THREE.Mesh(new THREE.ConeGeometry(radius, noseHeight, 20), side ? this.hull : this.trim);
          tip.position.y = (bodyHeight + noseHeight) / 2;
          model.add(tip);
        }

        if (rocket.id === SUPER_HEAVY_PRESET_ID && stageIndex === 0) {
          for (let i = 0; i < 4; i++) {
            const mount = new THREE.Group();
            mount.rotation.y = i * Math.PI / 2;
            const fin = new THREE.Mesh(new THREE.BoxGeometry(radius * 0.8, height * 0.045, radius * 0.7), this.trim);
            fin.position.set(radius * 1.33, bodyHeight * 0.38, 0);
            mount.add(fin);
            model.add(mount);
          }
          this.boosterPlume = new THREE.Mesh(new THREE.ConeGeometry(radius * 0.68, height * 0.52, 16), this.plumeMaterial);
          this.boosterPlume.rotation.z = Math.PI;
          this.boosterPlume.position.y = -bodyHeight / 2 - height * 0.24;
          this.boosterPlume.visible = false;
          model.add(this.boosterPlume);
        }

        const coreRadius = rocket.diameter * scale * 0.5;
        const center = new THREE.Vector3(side * (coreRadius + radius * 1.15), base + bodyHeight / 2, 0);
        this.sections.push({
          stageIndex, model, center, width: radius, halfLength: bodyHeight / 2 + noseHeight,
          base, side, separationRotation: new THREE.Quaternion(),
        });
        this.group.add(model);
      }
      if (!isBooster) base += height;
    }
    this.rocket = rocket;
  }

  update(rocket: RocketPreset, telemetry: RocketTelemetry, pad: THREE.Vector3, up: THREE.Vector3, east: THREE.Vector3, earthRadius: number) {
    const reset = this.rocket !== rocket || telemetry.phase === 'pad' || telemetry.time < this.lastTime;
    if (this.rocket !== rocket) this.build(rocket);

    const downrange = telemetry.downrangeDistance / EARTH.radius;
    const radial = this.radial.copy(up).multiplyScalar(Math.cos(downrange)).addScaledVector(east, Math.sin(downrange));
    const alongTrack = this.alongTrack.copy(east).multiplyScalar(Math.cos(downrange)).addScaledVector(up, -Math.sin(downrange));
    const pitch = THREE.MathUtils.degToRad(telemetry.pitchAngle);
    const flight = this.flight.copy(radial).multiplyScalar(Math.sin(pitch)).addScaledVector(alongTrack, Math.cos(pitch));
    const lateral = this.lateral.crossVectors(up, east).normalize();
    this.group.quaternion.setFromRotationMatrix(this.orientation.makeBasis(lateral, flight, this.forward.crossVectors(lateral, flight)));
    this.group.position.copy(pad).addScaledVector(up, -earthRadius)
      .addScaledVector(radial, earthRadius * (1 + telemetry.altitude / EARTH.radius) + 0.009 * LAUNCH_MODEL_SCALE);
    this.stand.position.copy(pad).addScaledVector(up, 0.001 * LAUNCH_MODEL_SCALE);
    this.stand.quaternion.setFromRotationMatrix(this.orientation.makeBasis(lateral, up, east));

    const separation = telemetry.boosterSeparation;
    const booster = separation && sampleBoosterReturn(separation, telemetry.time - separation.time);
    const earthCenter = pad.clone().addScaledVector(up, -earthRadius);
    const placeBooster = (target: THREE.Vector3, altitude: number, downrangeDistance: number) => {
      const angle = downrangeDistance / EARTH.radius;
      const radius = earthRadius * (1 + altitude / EARTH.radius) + 0.009 * LAUNCH_MODEL_SCALE;
      return target.copy(earthCenter)
        .addScaledVector(up, radius * Math.cos(angle)).addScaledVector(east, radius * Math.sin(angle));
    };
    this.boosterTrail.visible = false;
    if (reset) this.boosterTrailTime = -1;
    this.boosterFramingRadius = 0;
    if (this.boosterPlume) this.boosterPlume.visible = booster?.phase === 'Boostback burn';

    this.bounds.makeEmpty();
    this.separationWeight = 0;
    for (const section of this.sections) {
      const { model, stageIndex, center, side, separationRotation } = section;
      if (reset) {
        section.separationTime = undefined;
        if (model.parent !== this.group) this.group.add(model);
      } else if (stageIndex >= this.stageIndex && stageIndex < telemetry.activeStageIndex) {
        section.separationTime = telemetry.time;
        separationRotation.copy(this.group.quaternion);
        this.detached.add(model);
      }

      const age = section.separationTime === undefined ? 0 : telemetry.time - section.separationTime;
      if (separation && booster && stageIndex === 0 && this.boosterPlume) {
        if (model.parent !== this.detached) this.detached.add(model);
        section.separationTime = separation.time;
        const angle = booster.downrangeDistance / EARTH.radius;
        const pitch = THREE.MathUtils.degToRad(booster.pitchAngle) - angle;
        const attitude = this.forward.copy(up).multiplyScalar(Math.sin(pitch)).addScaledVector(east, Math.cos(pitch));
        model.quaternion.setFromRotationMatrix(this.orientation.makeBasis(lateral, attitude, this.corner.crossVectors(lateral, attitude)));
        placeBooster(model.position, booster.altitude, booster.downrangeDistance);
        model.position.addScaledVector(attitude, center.y);
        model.visible = booster.altitude > 0;
        if (model.visible) {
          this.boosterTarget.copy(model.position);
          this.boosterFramingRadius = section.halfLength + section.width;
        }
        this.boosterTrail.visible = booster.elapsed > 0.25;
        if (this.boosterTrail.visible && this.boosterTrailTime !== booster.elapsed) {
          this.boosterTrailTime = booster.elapsed;
          const points = Array.from({ length: 32 }, (_, index) => {
            const point = sampleBoosterReturn(separation, booster.elapsed * index / 31);
            return placeBooster(new THREE.Vector3(), point.altitude, point.downrangeDistance);
          });
          this.boosterTrail.geometry.setFromPoints(points).computeBoundingSphere();
        }
        continue;
      }
      model.visible = stageIndex >= telemetry.activeStageIndex || (section.separationTime !== undefined && age < SEPARATION_DURATION);
      if (!model.visible) continue;

      if (section.separationTime === undefined) {
        model.position.copy(center);
        model.quaternion.identity();
        this.center.copy(center).applyQuaternion(this.group.quaternion).add(this.group.position);
        this.expandBounds(section, this.group.quaternion, 1);
      } else {
        model.position.copy(center).addScaledVector(UP, -age * LAUNCH_MODEL_SCALE * (side ? 0.018 : 0.047));
        model.position.x += age * LAUNCH_MODEL_SCALE * (side ? side * 0.055 : 0.018);
        model.position.applyQuaternion(separationRotation).add(this.group.position);
        this.tumble.setFromAxisAngle(TUMBLE_AXIS, age * (side < 0 ? -0.16 : 0.16));
        model.quaternion.copy(separationRotation).multiply(this.tumble);
      }
    }

    this.bounds.getCenter(this.activeCenter);
    for (const section of this.sections) {
      if (section.separationTime === undefined || !section.model.visible) continue;
      const age = telemetry.time - section.separationTime;
      // Ease the framing back to the active stack as the discarded pieces leave.
      const weight = 1 - THREE.MathUtils.smoothstep(age, 4.5, SEPARATION_DURATION);
      this.separationWeight = Math.max(this.separationWeight, weight);
      this.center.copy(this.activeCenter).lerp(section.model.position, weight);
      this.expandBounds(section, section.model.quaternion, weight);
    }

    this.stageIndex = telemetry.activeStageIndex;
    this.lastTime = telemetry.time;

    const activeCore = this.sections.find(section => !section.side && section.stageIndex >= this.stageIndex);
    this.exhaustMount.position.y = activeCore?.base ?? 0;
    this.bounds.getCenter(this.target);
    this.framingRadius = this.bounds.getSize(this.center).length() * 0.5;

    const climb = THREE.MathUtils.smoothstep(telemetry.altitude, 100, 2500);
    this.cameraDirection.copy(alongTrack).multiplyScalar(-0.65)
      .addScaledVector(lateral, 0.83 * (1 - climb) + 0.53 * climb)
      .addScaledVector(radial, 0.25 + 0.32 * climb)
      .normalize();
    // Keep a stable horizon at liftoff and a stable side view as the rocket pitches.
    this.cameraUp.copy(radial);
  }

  private expandBounds(section: Section, rotation: THREE.Quaternion, weight: number) {
    this.extent.copy(UP).applyQuaternion(rotation).multiplyScalar(section.halfLength);
    this.extent.set(Math.abs(this.extent.x), Math.abs(this.extent.y), Math.abs(this.extent.z))
      .addScalar(section.width).multiplyScalar(weight);
    this.bounds.expandByPoint(this.corner.copy(this.center).add(this.extent));
    this.bounds.expandByPoint(this.corner.copy(this.center).sub(this.extent));
  }
}
