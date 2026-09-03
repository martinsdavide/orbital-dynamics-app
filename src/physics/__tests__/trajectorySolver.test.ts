import test from 'node:test';
import assert from 'node:assert/strict';
import { solveEarthMoonTrajectory, calculateLaunchWindows } from '../trajectorySolver.ts';
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
