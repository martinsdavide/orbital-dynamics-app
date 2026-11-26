import * as THREE from 'three';
import { getAtmosphericState } from '../../physics/atmosphere';
import type { BoosterReturnSample } from '../../physics/boosterReturn';

const UP = new THREE.Vector3(0, 1, 0);

export class BoosterPlasma {
  readonly group = new THREE.Group();
  private readonly flow = new THREE.Vector3();
  private readonly inverseAttitude = new THREE.Quaternion();
  private readonly radius: number;
  private readonly height: number;

  private readonly material = new THREE.ShaderMaterial({
    uniforms: {
      intensity: { value: 0 },
      elapsed: { value: 0 },
      incoming: { value: new THREE.Vector3() },
    },
    vertexShader: `
      varying vec3 hullPoint;
      varying vec3 viewNormal;
      varying vec3 viewDirection;
      void main() {
        hullPoint = position;
        vec4 viewPoint = modelViewMatrix * vec4(position, 1.0);
        viewNormal = normalize(normalMatrix * normal);
        viewDirection = -viewPoint.xyz;
        gl_Position = projectionMatrix * viewPoint;
      }
    `,
    fragmentShader: `
      uniform float intensity;
      uniform float elapsed;
      uniform vec3 incoming;
      varying vec3 hullPoint;
      varying vec3 viewNormal;
      varying vec3 viewDirection;
      void main() {
        vec3 point = normalize(hullPoint);
        float leading = smoothstep(-0.55, 0.85, dot(point, incoming));
        float rim = pow(1.0 - abs(dot(normalize(viewNormal), normalize(viewDirection))), 1.6);
        float stream = 0.62 + 0.38 * sin(21.0 * point.y + 11.0 * point.x + elapsed * 9.0)
          * sin(17.0 * point.z - elapsed * 7.0);
        vec3 color = mix(vec3(0.93, 0.045, 0.005), vec3(1.0, 0.57, 0.13), leading);
        gl_FragColor = vec4(color, intensity * (0.23 + 0.77 * rim) * (0.36 + 0.64 * leading) * stream);
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  private readonly sheath = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 20), this.material);
  private readonly wake = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 16), this.material.clone());

  constructor(radius: number, height: number) {
    this.radius = radius;
    this.height = height;
    this.group.name = 'Super Heavy reentry plasma';
    this.group.visible = false;
    this.sheath.scale.set(radius * 2.1, height * 0.67, radius * 2.1);
    this.wake.material.uniforms.incoming.value.copy(UP);
    this.group.add(this.sheath, this.wake);
  }

  update(sample: BoosterReturnSample, worldVelocity: THREE.Vector3, attitude: THREE.Quaternion, entryTime: number) {
    const speed = worldVelocity.length();
    const { density, machNumber } = getAtmosphericState(sample.altitude, speed);
    // Use a convective heating proxy to drive the visual intensity.
    const heating = Math.sqrt(density) * speed ** 3;
    const onset = THREE.MathUtils.smoothstep(sample.elapsed - entryTime, 0, 6);
    const intensity = onset * THREE.MathUtils.smoothstep(machNumber, 2.1, 4.6)
      * THREE.MathUtils.smoothstep(heating, 8e6, 155e6);
    this.group.visible = intensity > 0.005;
    if (!this.group.visible) return;

    this.flow.copy(worldVelocity).applyQuaternion(this.inverseAttitude.copy(attitude).invert()).normalize();
    this.material.uniforms.incoming.value.copy(this.flow);
    this.material.uniforms.intensity.value = intensity;
    this.material.uniforms.elapsed.value = sample.elapsed;

    const length = this.height * (0.6 + intensity * 0.56);
    this.wake.position.copy(this.flow).multiplyScalar(-length * 0.55);
    this.wake.quaternion.setFromUnitVectors(UP, this.flow);
    this.wake.scale.set(this.radius * 1.6, length * 0.8, this.radius * 1.6);
    this.wake.material.uniforms.intensity.value = intensity * 0.34;
    this.wake.material.uniforms.elapsed.value = sample.elapsed;
  }

  dispose() {
    this.group.removeFromParent();
    this.sheath.geometry.dispose();
    this.wake.geometry.dispose();
    this.material.dispose();
    this.wake.material.dispose();
  }
}
