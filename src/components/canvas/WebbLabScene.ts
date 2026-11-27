import * as THREE from 'three';
import { WEBB_PATH_MAGNIFICATION, webbEquilibrium, webbSampleIndex, type WebbRun, type WebbSceneState } from '../../physics/webbLab';
import { createPlanetLabelTexture } from './TextureGenerator';
import { ViewportBillboard } from './ViewportBillboard';

const colors = { L1: '#f59e0b', L2: '#f59e0b', L3: '#f59e0b', L4: '#10b981', L5: '#10b981' };
const pointRadius = 0.00031;

export function createWebbLabScene(earthMap: THREE.Texture) {
  const root = new THREE.Group();
  root.name = 'Webb Lagrange lab';
  root.visible = false;
  const group = new THREE.Group();
  const labels = new THREE.Group();
  root.add(group, labels);
  const earth = new THREE.Mesh(new THREE.SphereGeometry(0.00038, 24, 16), new THREE.MeshBasicMaterial({ map: earthMap }));
  earth.position.x = 1;
  group.add(earth);
  const earthLabel = new ViewportBillboard(createPlanetLabelTexture('Earth', '#70aaff'), 20, false);
  earthLabel.center.y = -0.32;
  labels.add(earthLabel);

  const mirror = new THREE.CircleGeometry(pointRadius * 0.28, 6, Math.PI / 6);
  const gold = new THREE.MeshBasicMaterial({ color: '#ffdf83', side: THREE.DoubleSide });
  const shield = new THREE.PlaneGeometry(pointRadius * 1.8, pointRadius * 0.88);
  const silver = new THREE.MeshBasicMaterial({ color: '#afc3d8', side: THREE.DoubleSide });
  let lastRuns: WebbRun[] | undefined;
  let probes: ReturnType<typeof createProbe>[] = [];

  function createProbe(run: WebbRun) {
    const tint = colors[run.point];
    const traceGeometry = new THREE.BufferGeometry().setFromPoints(run.samples.map(sample => new THREE.Vector3(
      run.equilibrium.x + (sample.x - run.equilibrium.x) * WEBB_PATH_MAGNIFICATION,
      run.equilibrium.y + (sample.y - run.equilibrium.y) * WEBB_PATH_MAGNIFICATION,
      0,
    )));
    const trail = new THREE.Line(traceGeometry, new THREE.LineBasicMaterial({ color: tint }));
    trail.name = 'Webb trail ' + run.point;
    const ring = new THREE.Mesh(new THREE.RingGeometry(pointRadius * 1.17, pointRadius * 1.42, 32),
      new THREE.MeshBasicMaterial({ color: tint, side: THREE.DoubleSide }));
    ring.position.set(run.equilibrium.x, run.equilibrium.y, 0);
    const label = new ViewportBillboard(createPlanetLabelTexture(run.point, tint, tint, 'circle'), 25, false);
    label.center.y = -0.72;

    const craft = new THREE.Group();
    craft.name = 'Virtual Webb ' + run.point;
    const panel = new THREE.Mesh(shield, silver);
    panel.rotation.z = Math.PI / 8;
    craft.add(panel);
    for (let i = 0; i < 7; i++) {
      const segment = new THREE.Mesh(mirror, gold);
      const angle = i * Math.PI / 3;
      const radius = i === 6 ? 0 : pointRadius * 0.5;
      segment.position.set(radius * Math.cos(angle), radius * Math.sin(angle), pointRadius * 0.1);
      craft.add(segment);
    }
    group.add(trail, ring, craft);
    labels.add(label);
    return {
      update(day: number, separation: number) {
        label.position.copy(ring.position).multiplyScalar(separation);
        const index = webbSampleIndex(run, day);
        trail.geometry.setDrawRange(0, index + 1);
        craft.position.fromBufferAttribute(trail.geometry.getAttribute('position'), index);
        craft.position.z = pointRadius * 0.1;
      },
      dispose() {
        group.remove(trail, ring, craft);
        labels.remove(label);
        trail.geometry.dispose();
        trail.material.dispose();
        ring.geometry.dispose();
        ring.material.dispose();
        label.material.map?.dispose();
        label.material.dispose();
      },
    };
  }

  const basis = new THREE.Matrix4();
  const radial = new THREE.Vector3();
  const transverse = new THREE.Vector3();
  const pole = new THREE.Vector3();
  return {
    group: root,
    focus: new THREE.Vector3(),
    update(state: WebbSceneState | undefined, sun: THREE.Vector3, earthRelative: THREE.Vector3, velocity: THREE.Vector3) {
      root.visible = !!state;
      if (!state) return;
      const separation = earthRelative.length();
      radial.copy(earthRelative).normalize();
      pole.crossVectors(radial, velocity).normalize();
      transverse.crossVectors(pole, radial);
      group.position.copy(sun);
      group.scale.setScalar(separation);
      group.quaternion.setFromRotationMatrix(basis.makeBasis(radial, transverse, pole));
      labels.position.copy(group.position);
      labels.quaternion.copy(group.quaternion);
      earthLabel.position.set(separation, 0, 0);
      if (lastRuns !== state.runs) {
        probes.forEach(probe => probe.dispose());
        probes = state.runs.map(createProbe);
        lastRuns = state.runs;
      }
      probes.forEach(probe => probe.update(state.day, separation));
      const equilibrium = webbEquilibrium(state.focus);
      const run = state.runs.find(run => run.point === state.focus);
      const sample = run?.samples[webbSampleIndex(run, state.day)];
      const x = equilibrium.x + ((sample?.x ?? equilibrium.x) - equilibrium.x) * WEBB_PATH_MAGNIFICATION / 2;
      const y = equilibrium.y + ((sample?.y ?? equilibrium.y) - equilibrium.y) * WEBB_PATH_MAGNIFICATION / 2;
      this.focus.copy(sun).addScaledVector(radial, x * separation).addScaledVector(transverse, y * separation);
    },
    dispose() {
      probes.forEach(probe => probe.dispose());
      earth.geometry.dispose();
      earth.material.dispose();
      earthLabel.material.map?.dispose();
      earthLabel.material.dispose();
      mirror.dispose();
      gold.dispose();
      shield.dispose();
      silver.dispose();
    },
  };
}
