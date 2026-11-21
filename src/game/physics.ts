import { ParkingBay } from './types';

export interface OBB {
  x: number;
  z: number;
  halfW: number;
  halfL: number;
  rotation: number; // radians around Y
}

interface Vec2 {
  x: number;
  z: number;
}

export interface SatResult {
  collided: boolean;
  mtvX: number;
  mtvZ: number;
  overlap: number;
}

const _axesA: [Vec2, Vec2] = [
  { x: 1, z: 0 },
  { x: 0, z: 1 },
];
const _axesB: [Vec2, Vec2] = [
  { x: 1, z: 0 },
  { x: 0, z: 1 },
];
const _cornersA: [Vec2, Vec2, Vec2, Vec2] = [
  { x: 0, z: 0 },
  { x: 0, z: 0 },
  { x: 0, z: 0 },
  { x: 0, z: 0 },
];
const _cornersB: [Vec2, Vec2, Vec2, Vec2] = [
  { x: 0, z: 0 },
  { x: 0, z: 0 },
  { x: 0, z: 0 },
  { x: 0, z: 0 },
];

function fillObbAxesAndCorners(
  obb: OBB,
  axes: [Vec2, Vec2],
  corners: [Vec2, Vec2, Vec2, Vec2],
): void {
  // Forward in Three.js when rotation=0 faces -Z:
  // Local +X rotated by Y=rot -> (cos(rot), -sin(rot))
  // Local +Z rotated by Y=rot -> (sin(rot), cos(rot))
  const c = Math.cos(obb.rotation);
  const s = Math.sin(obb.rotation);

  axes[0].x = c;
  axes[0].z = -s;
  axes[1].x = s;
  axes[1].z = c;

  const wx = axes[0].x * obb.halfW;
  const wz = axes[0].z * obb.halfW;
  const lx = axes[1].x * obb.halfL;
  const lz = axes[1].z * obb.halfL;

  corners[0].x = obb.x + wx + lx;
  corners[0].z = obb.z + wz + lz;
  corners[1].x = obb.x - wx + lx;
  corners[1].z = obb.z - wz + lz;
  corners[2].x = obb.x - wx - lx;
  corners[2].z = obb.z - wz - lz;
  corners[3].x = obb.x + wx - lx;
  corners[3].z = obb.z + wz - lz;
}

function projectCorners(corners: [Vec2, Vec2, Vec2, Vec2], axis: Vec2): [number, number] {
  let min = corners[0].x * axis.x + corners[0].z * axis.z;
  let max = min;
  for (let i = 1; i < 4; i++) {
    const p = corners[i].x * axis.x + corners[i].z * axis.z;
    if (p < min) min = p;
    if (p > max) max = p;
  }
  return [min, max];
}

export function testOBBCollision(a: OBB, b: OBB): SatResult {
  fillObbAxesAndCorners(a, _axesA, _cornersA);
  fillObbAxesAndCorners(b, _axesB, _cornersB);

  let minOverlap = Infinity;
  let bestAxisX = 0;
  let bestAxisZ = 0;

  const allAxes = [_axesA[0], _axesA[1], _axesB[0], _axesB[1]];

  for (let i = 0; i < 4; i++) {
    const axis = allAxes[i];
    const [minA, maxA] = projectCorners(_cornersA, axis);
    const [minB, maxB] = projectCorners(_cornersB, axis);

    const overlap = Math.min(maxA, maxB) - Math.max(minA, minB);
    if (overlap <= 0) {
      return { collided: false, mtvX: 0, mtvZ: 0, overlap: 0 };
    }
    if (overlap < minOverlap) {
      minOverlap = overlap;
      bestAxisX = axis.x;
      bestAxisZ = axis.z;
    }
  }

  // Ensure MTV points from B toward A (pushes A out of B)
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  if (dx * bestAxisX + dz * bestAxisZ < 0) {
    bestAxisX = -bestAxisX;
    bestAxisZ = -bestAxisZ;
  }

  return {
    collided: true,
    mtvX: bestAxisX * minOverlap,
    mtvZ: bestAxisZ * minOverlap,
    overlap: minOverlap,
  };
}

export function distanceOBBApprox(a: OBB, b: OBB): number {
  // Approximate center-to-box surface distance in B's local frame for parking sensor
  const c = Math.cos(b.rotation);
  const s = Math.sin(b.rotation);
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  const localX = dx * c - dz * s;
  const localZ = dx * s + dz * c;

  const clampedX = Math.max(-b.halfW, Math.min(b.halfW, localX));
  const clampedZ = Math.max(-b.halfL, Math.min(b.halfL, localZ));

  const distToB = Math.hypot(localX - clampedX, localZ - clampedZ);
  return Math.max(0, distToB - Math.min(a.halfW, a.halfL));
}

export function normalizeAngle(angle: number): number {
  let a = angle % (Math.PI * 2);
  if (a > Math.PI) a -= Math.PI * 2;
  if (a < -Math.PI) a += Math.PI * 2;
  return a;
}

export interface BayCheckResult {
  inside: boolean;
  directionValid: boolean;
  progress: number; // 0..1 spatial alignment
}

export function evaluateParkingBay(
  car: OBB,
  bay: ParkingBay,
): BayCheckResult {
  // Transform car center and corners into bay local space
  const c = Math.cos(bay.rotation);
  const s = Math.sin(bay.rotation);
  const dx = car.x - bay.x;
  const dz = car.z - bay.z;

  // Inverse rotate by bay.rotation
  const localCarX = dx * c - dz * s;
  const localCarZ = dx * s + dz * c;

  const bayHalfW = bay.width / 2;
  const bayHalfL = bay.length / 2;

  // Check distance score
  const distNorm = Math.hypot(localCarX / bayHalfW, localCarZ / bayHalfL);
  if (distNorm > 2.2) {
    return { inside: false, directionValid: true, progress: 0 };
  }

  // Relative angle between car and bay
  const relAngle = normalizeAngle(car.rotation - bay.rotation);
  const absAngle = Math.abs(relAngle);
  const alignedForward = absAngle < 0.28; // ~16 deg
  const alignedReverse = Math.abs(absAngle - Math.PI) < 0.28;

  let directionValid = true;
  let angleAligned = alignedForward || alignedReverse;

  if (bay.requiredDirection === 'forward') {
    directionValid = alignedForward;
    angleAligned = alignedForward;
  } else if (bay.requiredDirection === 'reverse') {
    directionValid = alignedReverse;
    angleAligned = alignedReverse;
  }

  // Check all 4 car corners inside bay bounds (with tiny 0.08m grace tolerance)
  const carC = Math.cos(relAngle);
  const carS = Math.sin(relAngle);
  let allCornersInside = true;
  let maxOut = 0;

  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const cx = localCarX + sx * car.halfW * carC + sz * car.halfL * carS;
      const cz = localCarZ - sx * car.halfW * carS + sz * car.halfL * carC;
      const ox = Math.max(0, Math.abs(cx) - (bayHalfW + 0.08));
      const oz = Math.max(0, Math.abs(cz) - (bayHalfL + 0.08));
      if (ox > 0 || oz > 0) {
        allCornersInside = false;
        maxOut = Math.max(maxOut, ox, oz);
      }
    }
  }

  const posScore = Math.max(0, Math.min(1, 1 - maxOut / 1.4));
  const rawAngleErr =
    bay.requiredDirection === 'forward'
      ? absAngle
      : bay.requiredDirection === 'reverse'
        ? Math.abs(absAngle - Math.PI)
        : Math.min(absAngle, Math.abs(absAngle - Math.PI));
  const angleScore = Math.max(0, Math.min(1, 1 - rawAngleErr / 0.8));

  const progress = Math.max(0, Math.min(1, posScore * 0.7 + angleScore * 0.3));

  return {
    inside: allCornersInside && angleAligned,
    directionValid: angleAligned ? directionValid : Math.abs(localCarX) < bayHalfW && Math.abs(localCarZ) < bayHalfL ? directionValid : true,
    progress,
  };
}
