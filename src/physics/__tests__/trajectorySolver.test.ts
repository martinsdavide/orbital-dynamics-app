import test from 'node:test';
import assert from 'node:assert/strict';
import { solveEarthMoonTrajectory, calculateLaunchWindows, solveTargetedTLI } from '../trajectorySolver.ts';
import { computeGravitationalAcceleration, getMoonEphemeris, getSunEphemeris } from '../nBodyIntegrator.ts';
import { EARTH, MOON } from '../constants.ts';
import { SPACEPORTS } from '../../data/spaceports.ts';

test('Trajectory Solver - Physical Velocity Vectors & Non-Zero State on all points', () => {
  const ksc = SPACEPORTS.find(s => s.id === 'ksc')!;
  const trajectory = solveEarthMoonTrajectory('free_return', ksc, 200000, 72, 0, 0);

  assert.ok(trajectory.points.length > 50, 'Trajectory must contain numerically propagated points');

  for (let i = 0; i < trajectory.points.length; i++) {
    const pt = trajectory.points[i];
    const vMag = Math.sqrt(pt.velocity.x * pt.velocity.x + pt.velocity.y * pt.velocity.y + pt.velocity.z * pt.velocity.z);
    
    // Velocity vector magnitude must match the reported speed
    assert.ok(vMag > 0, `Point ${i} at t=${pt.t} must have non-zero velocity vector`);
    assert.ok(Math.abs(vMag - pt.speed) < 5, `Point ${i} velocity vector magnitude ${vMag} should match scalar speed ${pt.speed}`);
    
    // Physical bounds: speeds between 0 and 12 km/s
    assert.ok(pt.speed >= 0 && pt.speed <= 12000, `Point ${i} speed ${pt.speed} m/s is within physical bounds`);
  }
});

test('Trajectory Solver - Southern Hemisphere Plane Change Penalty Calculation', () => {
  const northPort = {
    id: 'test_north',
    name: 'North Test Port',
    shortName: 'NTP',
    country: 'Test',
    operator: 'Test',
    latitude: 45.0, // Above Moon inclination (28.58°)
    longitude: 0.0,
    elevation: 0,
    minLaunchAzimuth: 35,
    maxLaunchAzimuth: 120,
    equatorialBoostVelocity: 320,
    minOrbitalInclination: 45,
    flag: '🇺🇸',
    description: 'Test',
    historicMissions: [],
    advantages: [],
  };

  const southPort = {
    id: 'test_south',
    name: 'South Test Port',
    shortName: 'STP',
    country: 'Test',
    operator: 'Test',
    latitude: -45.0, // Southern hemisphere: |-45| = 45 > 28.58°
    longitude: 0.0,
    elevation: 0,
    minLaunchAzimuth: 35,
    maxLaunchAzimuth: 120,
    equatorialBoostVelocity: 320,
    minOrbitalInclination: 45,
    flag: '🇦🇺',
    description: 'Test',
    historicMissions: [],
    advantages: [],
  };

  const trajNorth = solveEarthMoonTrajectory('direct_loi', northPort, 200000, 72, 0, 0);
  const trajSouth = solveEarthMoonTrajectory('direct_loi', southPort, 200000, 72, 0, 0);

  assert.ok(trajNorth.planeChangeDeltaV > 0, 'Northern latitude > 28.58° must incur plane change penalty');
  assert.ok(trajSouth.planeChangeDeltaV > 0, 'Southern latitude -45° must incur same plane change penalty');
  assert.equal(
    trajNorth.planeChangeDeltaV,
    trajSouth.planeChangeDeltaV,
    'Symmetric latitudes (+45° and -45°) must yield identical plane change delta-V'
  );

  const windowsNorth = calculateLaunchWindows(northPort, 0);
  const windowsSouth = calculateLaunchWindows(southPort, 0);
  assert.equal(
    windowsNorth[0].planeChangePenaltyDV,
    windowsSouth[0].planeChangePenaltyDV,
    'Launch windows must report identical plane change penalties for symmetric latitudes'
  );
});

test('Trajectory Solver - Free Return Perilune and Re-entry Consistency', () => {
  const ksc = SPACEPORTS.find(s => s.id === 'ksc')!;
  const traj = solveEarthMoonTrajectory('free_return', ksc, 200000, 72, 0, 0);

  assert.ok(traj.periapsisMoonAltitude > 0, 'Free return must have valid perilune altitude');
  assert.ok(traj.returnEarthPerigeeAltitude >= 30 && traj.returnEarthPerigeeAltitude <= 80, `Re-entry perigee (${traj.returnEarthPerigeeAltitude} km) must be inside upper atmosphere (30-80 km)`);
  assert.equal(traj.loiDeltaV, 0, 'Free return does not require LOI burn');
});

test('Trajectory Solver - Direct LOI Capture delta-V Consistency', () => {
  const ksc = SPACEPORTS.find(s => s.id === 'ksc')!;
  const traj = solveEarthMoonTrajectory('direct_loi', ksc, 200000, 72, 0, 0);

  assert.ok(traj.loiDeltaV >= 600 && traj.loiDeltaV <= 1100, `LOI delta-V (${traj.loiDeltaV} m/s) must be in realistic lunar capture range`);
  assert.ok(traj.totalMissionDeltaV > traj.tliDeltaV, 'Total mission delta-V must include TLI and LOI');
});

test('Trajectory Solver - Launch Window Selection influences Departure Epoch', () => {
  const ksc = SPACEPORTS.find(s => s.id === 'ksc')!;
  const trajWin0 = solveEarthMoonTrajectory('free_return', ksc, 200000, 72, 0, 0);
  const trajWin1 = solveEarthMoonTrajectory('free_return', ksc, 200000, 72, 0, 1);

  const t0 = trajWin0.points[0].t;
  const t1 = trajWin1.points[0].t;

  assert.notEqual(t0, t1, 'Different launch windows must have different departure epochs');
  assert.ok(t1 > t0, 'Window 1 should depart after Window 0');
});

test('Trajectory Solver - Infographic Mission Milestones (1 to 8) Verification', () => {
  const ksc = SPACEPORTS.find(s => s.id === 'ksc')!;
  const archetypes = ['free_return', 'direct_loi', 'lunar_flyby'] as const;

  for (const type of archetypes) {
    const traj = solveEarthMoonTrajectory(type, ksc, 200000, 72, 0, 0);
    assert.ok(traj.milestones, `${type} must contain milestones array`);
    assert.equal(traj.milestones.length, 8, `${type} must contain exactly 8 milestone events`);

    for (let i = 0; i < 8; i++) {
      const m = traj.milestones[i];
      assert.equal(m.id, i + 1, `Milestone index ${i} must have id ${i + 1}`);
      assert.ok(m.label.length > 0, `Milestone ${m.id} must have a non-empty label`);
      assert.ok(m.tFraction >= 0 && m.tFraction <= 1.0, `Milestone ${m.id} tFraction ${m.tFraction} must be in [0, 1]`);
      assert.ok(m.timeHours >= 0 && m.timeHours <= 72, `Milestone ${m.id} timeHours ${m.timeHours} must be valid`);
      if (i > 0) {
        assert.ok(
          m.tFraction >= traj.milestones[i - 1].tFraction,
          `Milestone ${m.id} fraction must be monotonic`
        );
      }
    }
  }
});

test('Trajectory Solver - Mathematical Continuity & Zero-Jump Regression across all archetypes', () => {
  const ksc = SPACEPORTS.find(s => s.id === 'ksc')!;
  const archetypes = ['free_return', 'direct_loi', 'lunar_flyby'] as const;

  for (const type of archetypes) {
    const traj = solveEarthMoonTrajectory(type, ksc, 200000, 72, 0, 0);
    const pts = traj.points;
    assert.ok(pts.length >= 720, `${type} must contain at least 720 points for high-fidelity representation`);

    let maxDelta = 0;
    let worstStep = 0;

    for (let i = 1; i < pts.length; i++) {
      const p1 = pts[i - 1].position;
      const p2 = pts[i].position;
      const delta = Math.hypot(p2.x - p1.x, p2.y - p1.y, p2.z - p1.z);
      if (delta > maxDelta) {
        maxDelta = delta;
        worstStep = i;
      }
      // Regression check: no adjacent points may jump by > 5,000 km (catches the previous 499,000 km and 18,000 km bugs)
      assert.ok(
        delta < 5000000,
        `Discontinuity detected in ${type} at step ${i}/${pts.length} (fraction ${(i / pts.length).toFixed(3)}): step jump was ${(delta / 1000).toFixed(1)} km`
      );
    }

    // Maximum step delta across the entire 72-hour mission must be within normal physical travel (< 4,000 km per step)
    assert.ok(
      maxDelta < 4000000,
      `${type} maximum step delta (${(maxDelta / 1000).toFixed(1)} km at step ${worstStep}) must be < 4,000 km`
    );
  }
});

test('Trajectory Solver - Finite-Difference Velocity & Tangent Continuity', () => {
  const ksc = SPACEPORTS.find(s => s.id === 'ksc')!;
  const archetypes = ['free_return', 'direct_loi', 'lunar_flyby'] as const;

  function normalize(v: { x: number; y: number; z: number }) {
    const m = Math.hypot(v.x, v.y, v.z);
    return { x: v.x / m, y: v.y / m, z: v.z / m };
  }

  for (const type of archetypes) {
    const traj = solveEarthMoonTrajectory(type, ksc, 200000, 72, 0, 0);
    const pts = traj.points;

    // 1. Stored velocity vectors must match centered finite differences:
    //    v_i = (r_{i+1} - r_{i-1}) / (t_{i+1} - t_{i-1}) to < 0.001 m/s (1 mm/s)
    for (let i = 1; i < pts.length - 1; i++) {
      const dt = pts[i + 1].t - pts[i - 1].t;
      const numVx = (pts[i + 1].position.x - pts[i - 1].position.x) / dt;
      const numVy = (pts[i + 1].position.y - pts[i - 1].position.y) / dt;
      const numVz = (pts[i + 1].position.z - pts[i - 1].position.z) / dt;

      const diff = Math.hypot(numVx - pts[i].velocity.x, numVy - pts[i].velocity.y, numVz - pts[i].velocity.z);
      assert.ok(
        diff < 0.001,
        `Finite-difference velocity mismatch at point ${i} in ${type}: diff was ${diff} m/s`
      );
    }

    // 2. Tangent continuity across unpowered phase boundaries:
    //    dot(normalize(r_b - r_{b-1}), normalize(r_{b+1} - r_b)) > 0.999
    for (let i = 1; i < pts.length - 1; i++) {
      if (pts[i].phase !== pts[i + 1].phase) {
        const isPowered =
          pts[i].phase.includes('Burn') ||
          pts[i + 1].phase.includes('Burn') ||
          pts[i].phase.includes('Ascent') ||
          pts[i + 1].phase.includes('Ascent') ||
          pts[i + 1].phase.includes('Ignition') ||
          pts[i].phase.includes('Liftoff');
        if (!isPowered) {
          const inc = normalize({
            x: pts[i].position.x - pts[i - 1].position.x,
            y: pts[i].position.y - pts[i - 1].position.y,
            z: pts[i].position.z - pts[i - 1].position.z,
          });
          const out = normalize({
            x: pts[i + 1].position.x - pts[i].position.x,
            y: pts[i + 1].position.y - pts[i].position.y,
            z: pts[i + 1].position.z - pts[i].position.z,
          });
          const dot = inc.x * out.x + inc.y * out.y + inc.z * out.z;
          assert.ok(
            dot > 0.999,
            `Unpowered phase boundary tangent cusp in ${type} at step ${i} ("${pts[i].phase}" -> "${pts[i + 1].phase}"): dot was ${dot.toFixed(5)}`
          );
        }
      }
    }
  }
});

test('Trajectory Solver - Moon-Relative Distance & Encounter Smoothness', () => {
  const ksc = SPACEPORTS.find(s => s.id === 'ksc')!;
  const flybyTraj = solveEarthMoonTrajectory('lunar_flyby', ksc, 200000, 72, 0, 0);

  // During flyby, distance to Moon must not jump abruptly between consecutive steps
  let maxMoonDistDelta = 0;
  for (let i = 1; i < flybyTraj.points.length; i++) {
    const dDistM = Math.abs(flybyTraj.points[i].distanceToMoon - flybyTraj.points[i - 1].distanceToMoon);
    if (dDistM > maxMoonDistDelta) {
      maxMoonDistDelta = dDistM;
    }
  }
  // Step-to-step Moon distance change must be smoothly bounded (< 3,500 km per step)
  assert.ok(
    maxMoonDistDelta < 3500000,
    `Step-to-step Moon distance delta in lunar_flyby (${(maxMoonDistDelta / 1000).toFixed(1)} km) is smooth and continuous`
  );
});

test('Physics Engine - Geocentric Accelerating Frame Zero-Gravity Invariance at Origin', () => {
  const earthOrigin = { x: 0, y: 0, z: 0 };
  const moonPos = getMoonEphemeris(100000).position;
  const sunPos = getSunEphemeris(100000).position;

  const aOrigin = computeGravitationalAcceleration(earthOrigin, earthOrigin, moonPos, sunPos, true);
  // Differential acceleration of Moon and Sun on Earth's center relative to Earth's accelerating frame must be 0
  assert.equal(aOrigin.x, 0, 'Differential third-body acceleration X at Earth origin must be identically 0');
  assert.equal(aOrigin.y, 0, 'Differential third-body acceleration Y at Earth origin must be identically 0');
  assert.equal(aOrigin.z, 0, 'Differential third-body acceleration Z at Earth origin must be identically 0');
});

test('Trajectory Solver - Translunar Excursion Boundary (< 450,000 km)', () => {
  const ksc = SPACEPORTS.find(s => s.id === 'ksc')!;
  const archetypes = ['free_return', 'direct_loi'] as const;

  for (const type of archetypes) {
    const traj = solveEarthMoonTrajectory(type, ksc, 200000, 72, 0, 0);
    for (let i = 0; i < traj.points.length; i++) {
      const dE = traj.points[i].distanceToEarth;
      // Catches unconstrained Hermite overshoot into deep space
      assert.ok(
        dE <= 450000000,
        `${type} exceeded maximum excursion limit at step ${i}: distance was ${(dE / 1000).toFixed(1)} km`
      );
    }
  }
});

test('Trajectory Solver - Monotonic Lunar Approach in Translunar Window', () => {
  const ksc = SPACEPORTS.find(s => s.id === 'ksc')!;
  const traj = solveEarthMoonTrajectory('lunar_flyby', ksc, 200000, 72, 0, 0);
  const pts = traj.points;

  // Approach window: from 12 hours after TLI up to perilune encounter
  const tTLI = pts[0].t + 0.16 * (pts[pts.length - 1].t - pts[0].t);
  let minMoonDist = Infinity;
  let minIdx = 0;
  for (let i = 0; i < pts.length; i++) {
    if (pts[i].distanceToMoon < minMoonDist) {
      minMoonDist = pts[i].distanceToMoon;
      minIdx = i;
    }
  }

  let prevDist = Infinity;
  for (let i = 0; i < minIdx; i++) {
    const pt = pts[i];
    if (pt.t >= tTLI + 12 * 3600) {
      assert.ok(
        pt.distanceToMoon <= prevDist + 1000,
        `Distance to Moon must decrease monotonically during approach: step ${i} (${(pt.distanceToMoon/1000).toFixed(1)} km) > prev (${(prevDist/1000).toFixed(1)} km)`
      );
      prevDist = pt.distanceToMoon;
    }
  }
});

test('Trajectory Solver - Vector LOI Burn Zero Radial Velocity & Moon Capture', () => {
  const ksc = SPACEPORTS.find(s => s.id === 'ksc')!;
  const traj = solveEarthMoonTrajectory('direct_loi', ksc, 200000, 72, 0, 0);
  const pts = traj.points;

  // Find step where LOI burn occurs
  const loiIdx = pts.findIndex(p => p.phase.includes('LOI Capture Braking Burn'));
  assert.ok(loiIdx > 0, 'Direct LOI must execute LOI capture burn');

  const ptPost = pts[loiIdx + 1];
  const moon = getMoonEphemeris(ptPost.t);
  const relRx = ptPost.position.x - moon.position.x;
  const relRy = ptPost.position.y - moon.position.y;
  const relRz = ptPost.position.z - moon.position.z;
  const dM = Math.hypot(relRx, relRy, relRz);
  const ur = { x: relRx / dM, y: relRy / dM, z: relRz / dM };

  const relVx = ptPost.velocity.x - moon.velocity.x;
  const relVy = ptPost.velocity.y - moon.velocity.y;
  const relVz = ptPost.velocity.z - moon.velocity.z;

  const vRadial = Math.abs(relVx * ur.x + relVy * ur.y + relVz * ur.z);
  // Post-LOI radial velocity relative to Moon must be virtually 0 (< 10 mm/s)
  assert.ok(vRadial < 0.01, `Post-LOI relative radial velocity (${vRadial.toFixed(4)} m/s) must be < 0.01 m/s`);
});

test('Trajectory Solver - Shooting Solver Performance Benchmark (< 25 ms)', () => {
  const t0 = performance.now();
  const solved = solveTargetedTLI(100, 0, 68);
  const elapsed = performance.now() - t0;

  assert.ok(elapsed < 25, `Shooting solver execution time (${elapsed.toFixed(1)} ms) must be < 25 ms`);
  assert.ok(Math.abs(solved.achievedAltKm - 100) < 2.0, `Achieved altitude (${solved.achievedAltKm.toFixed(1)} km) matches 100 km target within 2 km`);
});

test('Trajectory Solver - Time-Normalized Turn Rate during Unpowered Flight', () => {
  const ksc = SPACEPORTS.find(s => s.id === 'ksc')!;
  const traj = solveEarthMoonTrajectory('lunar_flyby', ksc, 200000, 72, 0, 0);
  const pts = traj.points;

  for (let i = 1; i < pts.length - 1; i++) {
    if (!pts[i].phase.includes('Burn') && !pts[i].phase.includes('Ascent')) {
      const dt = pts[i + 1].t - pts[i].t;
      const v1 = pts[i].velocity;
      const v2 = pts[i + 1].velocity;
      const m1 = Math.hypot(v1.x, v1.y, v1.z);
      const m2 = Math.hypot(v2.x, v2.y, v2.z);
      const dot = (v1.x * v2.x + v1.y * v2.y + v1.z * v2.z) / (m1 * m2);
      const angle = Math.acos(Math.max(-1, Math.min(1, dot)));
      const turnRate = angle / dt;

      assert.ok(
        turnRate < 0.005,
        `Unpowered turn rate (${turnRate.toFixed(5)} rad/s at step ${i}) must be < 0.005 rad/s`
      );
    }
  }
});

test('Trajectory Solver - Surface Collision Avoidance', () => {
  const ksc = SPACEPORTS.find(s => s.id === 'ksc')!;
  const traj = solveEarthMoonTrajectory('lunar_flyby', ksc, 200000, 72, 0, 0);

  for (let i = 10; i < traj.points.length; i++) {
    const pt = traj.points[i];
    assert.ok(pt.distanceToEarth >= EARTH.radius, `Spacecraft must not intersect Earth: step ${i} dist was ${pt.distanceToEarth} m`);
    assert.ok(pt.distanceToMoon >= MOON.radius, `Spacecraft must not intersect Moon: step ${i} dist was ${pt.distanceToMoon} m`);
  }
});
