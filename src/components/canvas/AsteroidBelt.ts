import { BufferAttribute, BufferGeometry, Points, ShaderMaterial } from 'three';
import { generateMainBelt } from '../../physics/asteroidBelt.ts';

const ASTEROID_COUNT = 2200;

export function createAsteroidBelt(pixelRatio: number, ceresOrbitAu: number, ceresVisualDistance: number) {
  const geometry = new BufferGeometry();
  const elements = new Float32Array(ASTEROID_COUNT * 3);
  const angles = new Float32Array(ASTEROID_COUNT * 3);
  const motion = new Float32Array(ASTEROID_COUNT * 2);
  generateMainBelt(ASTEROID_COUNT).forEach((asteroid, index) => {
    elements.set([asteroid.semiMajorAxisAu, asteroid.eccentricity, asteroid.inclination], index * 3);
    angles.set([asteroid.ascendingNode, asteroid.perihelionAngle, asteroid.meanAnomaly], index * 3);
    motion.set([asteroid.meanMotionPerDay, asteroid.prominence], index * 2);
  });
  // Orbital positions are calculated in the vertex shader from the fixed elements.
  geometry.setAttribute('position', new BufferAttribute(elements, 3));
  geometry.setAttribute('orbitalAngles', new BufferAttribute(angles, 3));
  geometry.setAttribute('motion', new BufferAttribute(motion, 2));

  const material = new ShaderMaterial({
    uniforms: {
      elapsedDays: { value: 0 },
      sceneUnitsPerAu: { value: 320 },
      visualMode: { value: true },
      ceresOrbitAu: { value: ceresOrbitAu },
      ceresVisualDistance: { value: ceresVisualDistance },
      pixelRatio: { value: pixelRatio },
    },
    transparent: true,
    depthWrite: false,
    vertexShader: `
      uniform float elapsedDays;
      uniform float sceneUnitsPerAu;
      uniform bool visualMode;
      uniform float ceresOrbitAu;
      uniform float ceresVisualDistance;
      uniform float pixelRatio;
      attribute vec3 orbitalAngles;
      attribute vec2 motion;
      varying float prominence;
      void main() {
        float axis = position.x;
        float eccentricity = position.y;
        float inclination = position.z;
        float meanAnomaly = mod(orbitalAngles.z + motion.x * elapsedDays, 6.28318530718);
        float anomaly = meanAnomaly;
        for (int step = 0; step < 3; step++) {
          anomaly -= (anomaly - eccentricity * sin(anomaly) - meanAnomaly) / (1.0 - eccentricity * cos(anomaly));
        }
        vec2 point = vec2(cos(anomaly) - eccentricity, sqrt(1.0 - eccentricity * eccentricity) * sin(anomaly));
        float perihelion = orbitalAngles.y;
        vec2 oriented = vec2(
          cos(perihelion) * point.x - sin(perihelion) * point.y,
          sin(perihelion) * point.x + cos(perihelion) * point.y
        );
        float node = orbitalAngles.x;
        float across = oriented.y * cos(inclination);
        vec3 orbitPoint = vec3(
          oriented.x * cos(node) - across * sin(node),
          oriented.y * sin(inclination),
          -oriented.x * sin(node) - across * cos(node)
        );
        float sceneAxis = axis * sceneUnitsPerAu;
        if (visualMode) {
          // Compress the belt between the visual Mars and Jupiter orbits and align it with Ceres.
          sceneAxis = ceresVisualDistance + 106.0 * (axis - ceresOrbitAu);
        }
        gl_Position = projectionMatrix * modelViewMatrix * vec4(orbitPoint * sceneAxis, 1.0);
        prominence = motion.y;
        gl_PointSize = pixelRatio * mix(1.4, 3.6, prominence);
      }
    `,
    fragmentShader: `
      varying float prominence;
      void main() {
        float edge = length(gl_PointCoord - vec2(0.5));
        float alpha = (1.0 - smoothstep(0.16, 0.5, edge)) * mix(0.42, 0.9, prominence);
        if (alpha < 0.01) discard;
        gl_FragColor = vec4(mix(vec3(0.32, 0.26, 0.22), vec3(0.88, 0.69, 0.48), prominence), alpha);
        #include <colorspace_fragment>
      }
    `,
  });
  const belt = new Points(geometry, material);
  belt.name = 'Main asteroid belt';
  belt.visible = false;
  belt.frustumCulled = false;
  return belt;
}
