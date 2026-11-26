import * as THREE from 'three';
import { EARTH } from '../../physics/constants.ts';
import { calculateHalleyOrbit, getHalleyActivity, HALLEY_PERIOD_SECONDS, HALLEY_PERIHELION_SECONDS } from '../../physics/halley.ts';
import { createPlanetLabelTexture } from './TextureGenerator';
import { ViewportBillboard } from './ViewportBillboard';

function createTail(color: number, width: number, curvature: number) {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const segments = 32;

  // Crossed ribbons keep the tail visible from both sides of the orbital plane.
  for (let plane = 0; plane < 2; plane++) {
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const spread = width * (0.14 + 0.86 * t);
      for (const side of [-1, 1]) {
        positions.push(t, curvature * t * t + (plane === 0 ? side * spread : 0), plane === 1 ? side * spread : 0);
        uvs.push(t, (side + 1) / 2);
      }
      const k = (plane * (segments + 1) + i) * 2;
      if (i < segments) indices.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  return new THREE.Mesh(geometry, new THREE.ShaderMaterial({
    uniforms: { tint: { value: new THREE.Color(color) }, strength: { value: 0 } },
    vertexShader: `
      varying vec2 tailUv;
      void main() {
        tailUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 tint;
      uniform float strength;
      varying vec2 tailUv;
      void main() {
        float edge = 1.0 - smoothstep(0.0, 0.5, abs(tailUv.y - 0.5));
        float fade = pow(1.0 - tailUv.x, 1.45);
        gl_FragColor = vec4(tint, edge * fade * strength);
        #include <colorspace_fragment>
      }
    `,
    side: THREE.DoubleSide,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  }));
}

function createGlowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  const glow = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  glow.addColorStop(0, 'white');
  glow.addColorStop(0.25, 'rgba(255,255,255,0.8)');
  glow.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(canvas);
}

export function createHalleyComet() {
  const group = new THREE.Group();
  group.name = "Halley's Comet";
  group.visible = false;
  const comet = new THREE.Group();
  comet.name = 'Halley nucleus';

  const glow = createGlowTexture();
  const nucleus = new ViewportBillboard(glow, 14);
  nucleus.material.depthWrite = false;
  const label = new ViewportBillboard(createPlanetLabelTexture("Halley's Comet", '#a5f3fc'), 23, false);
  label.center.y = -0.35;

  const coma = new THREE.Sprite(new THREE.SpriteMaterial({
    color: 0x9ef1c8, map: glow, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  const ion = createTail(0x54bcff, 0.045, 0);
  ion.name = 'Ion tail';
  const dust = createTail(0xffd69c, 0.13, 0.24);
  dust.name = 'Dust tail';
  const tails = new THREE.Group();
  tails.add(ion, dust);
  comet.add(tails, coma, nucleus, label);

  // Sample symmetrically around perihelion to resolve the very tight turn.
  const samples = Array.from({ length: 513 }, (_, i) => {
    const phase = (i - 256) / 256;
    const { position } = calculateHalleyOrbit(HALLEY_PERIHELION_SECONDS + phase ** 3 * HALLEY_PERIOD_SECONDS / 2);
    return new THREE.Vector3(position.x, position.y, position.z).divideScalar(EARTH.semiMajorAxis);
  });
  const path = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(samples),
    new THREE.LineBasicMaterial({ color: 0x638d9e, transparent: true, opacity: 0.45, depthWrite: false }),
  );
  group.add(path, comet);

  const radial = new THREE.Vector3();
  const trailing = new THREE.Vector3();
  const normal = new THREE.Vector3();
  const basis = new THREE.Matrix4();

  return {
    group,
    nucleus: comet,
    update(timeSeconds: number, sceneUnitsPerAu: number, showOrbit: boolean, showLabel: boolean) {
      const { position, velocity } = calculateHalleyOrbit(timeSeconds);
      radial.set(position.x, position.y, position.z);
      const distanceAu = radial.length() / EARTH.semiMajorAxis;
      radial.normalize();
      comet.position.copy(radial).multiplyScalar(distanceAu * sceneUnitsPerAu);
      path.scale.setScalar(sceneUnitsPerAu);
      path.visible = showOrbit;
      label.visible = showLabel;

      const activity = getHalleyActivity(distanceAu);
      coma.visible = tails.visible = activity > 0;
      if (!tails.visible) return;

      trailing.set(-velocity.x, -velocity.y, -velocity.z);
      trailing.addScaledVector(radial, -trailing.dot(radial)).normalize();
      normal.crossVectors(radial, trailing);
      tails.quaternion.setFromRotationMatrix(basis.makeBasis(radial, trailing, normal));
      const length = sceneUnitsPerAu * 0.45 * Math.sqrt(activity);
      ion.scale.setScalar(length);
      dust.scale.setScalar(length * 0.68);
      ion.material.uniforms.strength.value = activity * 0.82;
      dust.material.uniforms.strength.value = activity * 0.52;
      coma.scale.setScalar(sceneUnitsPerAu * 0.065 * Math.sqrt(activity));
      coma.material.opacity = activity * 0.65;
    },
    dispose() {
      path.geometry.dispose();
      path.material.dispose();
      for (const tail of [ion, dust]) {
        tail.geometry.dispose();
        tail.material.dispose();
      }
      label.material.map?.dispose();
      label.material.dispose();
      glow.dispose();
      nucleus.material.dispose();
      coma.material.dispose();
    },
  };
}
