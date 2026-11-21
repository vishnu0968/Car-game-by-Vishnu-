import * as THREE from 'three';
import { TINT_LEVELS } from './catalog';
import { CarCustomization, CarDefinition, CarId } from './types';
import {
  createClusterTexture,
  createContactShadowTexture,
  createHeadlightTexture,
  createInfotainmentTexture,
  createTaillightTexture,
  createTireTreadTexture,
} from './webglUtils';

export interface CarRig {
  root: THREE.Group;
  bodyTiltGroup: THREE.Group;
  frontLeftPivot: THREE.Group;
  frontRightPivot: THREE.Group;
  wheelsSpin: THREE.Group[];
  brakeMat: THREE.MeshStandardMaterial;
  reverseMat: THREE.MeshStandardMaterial;
  cockpitWheel: THREE.Group;
  cockpitSpeedNeedle: THREE.Group;
  setInteriorView: (active: boolean) => void;
}

interface CrossSection {
  zNorm: number;
  ySill: number;
  xSill: number;
  yBelt: number;
  xBelt: number;
  yTop: number;
  xTop: number;
  crown: number;
  isCabin?: boolean;
}

function getCarSections(archetype: CarId | 'mpv'): CrossSection[] {
  if (archetype === 'mpv') {
    return [
      { zNorm: -0.50, ySill: 0.24, xSill: 0.68, yBelt: 0.40, xBelt: 0.78, yTop: 0.46, xTop: 0.68, crown: 0.02 },
      { zNorm: -0.46, ySill: 0.22, xSill: 0.86, yBelt: 0.48, xBelt: 0.95, yTop: 0.54, xTop: 0.83, crown: 0.03 },
      { zNorm: -0.36, ySill: 0.22, xSill: 0.92, yBelt: 0.54, xBelt: 1.00, yTop: 0.61, xTop: 0.87, crown: 0.03 },
      { zNorm: -0.24, ySill: 0.22, xSill: 0.94, yBelt: 0.58, xBelt: 1.00, yTop: 0.78, xTop: 0.82, crown: 0.03, isCabin: true },
      { zNorm: -0.10, ySill: 0.22, xSill: 0.94, yBelt: 0.58, xBelt: 1.00, yTop: 0.98, xTop: 0.77, crown: 0.04, isCabin: true },
      { zNorm: 0.10, ySill: 0.22, xSill: 0.94, yBelt: 0.58, xBelt: 1.00, yTop: 0.99, xTop: 0.76, crown: 0.04, isCabin: true },
      { zNorm: 0.34, ySill: 0.22, xSill: 0.92, yBelt: 0.60, xBelt: 0.98, yTop: 0.96, xTop: 0.75, crown: 0.03, isCabin: true },
      { zNorm: 0.45, ySill: 0.24, xSill: 0.87, yBelt: 0.58, xBelt: 0.93, yTop: 0.67, xTop: 0.83, crown: 0.02 },
      { zNorm: 0.50, ySill: 0.27, xSill: 0.72, yBelt: 0.52, xBelt: 0.80, yTop: 0.58, xTop: 0.70, crown: 0.01 },
    ];
  }

  if (archetype === 'hatch') {
    return [
      { zNorm: -0.50, ySill: 0.25, xSill: 0.72, yBelt: 0.43, xBelt: 0.82, yTop: 0.50, xTop: 0.74, crown: 0.02 },
      { zNorm: -0.46, ySill: 0.24, xSill: 0.89, yBelt: 0.52, xBelt: 0.97, yTop: 0.58, xTop: 0.85, crown: 0.03 },
      { zNorm: -0.30, ySill: 0.24, xSill: 0.94, yBelt: 0.56, xBelt: 1.00, yTop: 0.63, xTop: 0.88, crown: 0.03 },
      { zNorm: -0.18, ySill: 0.24, xSill: 0.94, yBelt: 0.58, xBelt: 1.00, yTop: 0.76, xTop: 0.83, crown: 0.03, isCabin: true },
      { zNorm: -0.05, ySill: 0.24, xSill: 0.94, yBelt: 0.60, xBelt: 1.00, yTop: 0.98, xTop: 0.76, crown: 0.04, isCabin: true },
      { zNorm: 0.18, ySill: 0.24, xSill: 0.94, yBelt: 0.61, xBelt: 1.00, yTop: 0.98, xTop: 0.75, crown: 0.04, isCabin: true },
      { zNorm: 0.35, ySill: 0.25, xSill: 0.92, yBelt: 0.62, xBelt: 0.98, yTop: 0.92, xTop: 0.73, crown: 0.03, isCabin: true },
      { zNorm: 0.45, ySill: 0.27, xSill: 0.86, yBelt: 0.60, xBelt: 0.92, yTop: 0.67, xTop: 0.82, crown: 0.02 },
      { zNorm: 0.50, ySill: 0.30, xSill: 0.74, yBelt: 0.54, xBelt: 0.82, yTop: 0.59, xTop: 0.72, crown: 0.01 },
    ];
  }

  if (archetype === 'suv') {
    return [
      { zNorm: -0.50, ySill: 0.29, xSill: 0.76, yBelt: 0.47, xBelt: 0.87, yTop: 0.54, xTop: 0.78, crown: 0.02 },
      { zNorm: -0.46, ySill: 0.27, xSill: 0.90, yBelt: 0.54, xBelt: 0.98, yTop: 0.61, xTop: 0.88, crown: 0.03 },
      { zNorm: -0.32, ySill: 0.27, xSill: 0.95, yBelt: 0.57, xBelt: 1.00, yTop: 0.64, xTop: 0.90, crown: 0.03 },
      { zNorm: -0.18, ySill: 0.27, xSill: 0.95, yBelt: 0.58, xBelt: 1.00, yTop: 0.76, xTop: 0.85, crown: 0.03, isCabin: true },
      { zNorm: -0.05, ySill: 0.27, xSill: 0.95, yBelt: 0.59, xBelt: 1.00, yTop: 0.99, xTop: 0.79, crown: 0.03, isCabin: true },
      { zNorm: 0.22, ySill: 0.27, xSill: 0.95, yBelt: 0.60, xBelt: 1.00, yTop: 0.99, xTop: 0.79, crown: 0.03, isCabin: true },
      { zNorm: 0.40, ySill: 0.29, xSill: 0.91, yBelt: 0.60, xBelt: 0.96, yTop: 0.94, xTop: 0.77, crown: 0.02, isCabin: true },
      { zNorm: 0.47, ySill: 0.31, xSill: 0.85, yBelt: 0.58, xBelt: 0.91, yTop: 0.66, xTop: 0.84, crown: 0.02 },
      { zNorm: 0.50, ySill: 0.33, xSill: 0.74, yBelt: 0.52, xBelt: 0.82, yTop: 0.58, xTop: 0.74, crown: 0.01 },
    ];
  }

  if (archetype === 'coupe' || archetype === 'supercar') {
    const low = archetype === 'supercar' ? 0.15 : 0.19;
    return [
      { zNorm: -0.50, ySill: low, xSill: 0.66, yBelt: 0.35, xBelt: 0.78, yTop: 0.41, xTop: 0.68, crown: 0.02 },
      { zNorm: -0.45, ySill: low, xSill: 0.89, yBelt: 0.46, xBelt: 0.98, yTop: 0.54, xTop: 0.85, crown: 0.03 },
      { zNorm: -0.26, ySill: low, xSill: 0.94, yBelt: 0.55, xBelt: 1.00, yTop: 0.61, xTop: 0.88, crown: 0.04 },
      { zNorm: -0.13, ySill: low, xSill: 0.95, yBelt: 0.57, xBelt: 1.00, yTop: 0.78, xTop: 0.80, crown: 0.04, isCabin: true },
      { zNorm: 0.00, ySill: low, xSill: 0.95, yBelt: 0.58, xBelt: 1.00, yTop: 0.99, xTop: 0.72, crown: 0.04, isCabin: true },
      { zNorm: 0.16, ySill: low, xSill: 0.95, yBelt: 0.59, xBelt: 1.00, yTop: 0.97, xTop: 0.71, crown: 0.04, isCabin: true },
      { zNorm: 0.32, ySill: low + 0.02, xSill: 0.92, yBelt: 0.62, xBelt: 0.98, yTop: 0.74, xTop: 0.80, crown: 0.02 },
      { zNorm: 0.46, ySill: low + 0.04, xSill: 0.86, yBelt: 0.60, xBelt: 0.92, yTop: 0.66, xTop: 0.82, crown: 0.02 },
      { zNorm: 0.50, ySill: low + 0.08, xSill: 0.72, yBelt: 0.52, xBelt: 0.80, yTop: 0.58, xTop: 0.72, crown: 0.01 },
    ];
  }

  // Sculpted Executive Sedan
  return [
    { zNorm: -0.50, ySill: 0.21, xSill: 0.68, yBelt: 0.39, xBelt: 0.79, yTop: 0.45, xTop: 0.69, crown: 0.02 },
    { zNorm: -0.45, ySill: 0.20, xSill: 0.88, yBelt: 0.49, xBelt: 0.97, yTop: 0.55, xTop: 0.85, crown: 0.03 },
    { zNorm: -0.26, ySill: 0.20, xSill: 0.93, yBelt: 0.54, xBelt: 1.00, yTop: 0.59, xTop: 0.88, crown: 0.03 },
    { zNorm: -0.14, ySill: 0.20, xSill: 0.94, yBelt: 0.55, xBelt: 1.00, yTop: 0.78, xTop: 0.80, crown: 0.03, isCabin: true },
    { zNorm: -0.02, ySill: 0.20, xSill: 0.94, yBelt: 0.56, xBelt: 1.00, yTop: 0.99, xTop: 0.74, crown: 0.04, isCabin: true },
    { zNorm: 0.17, ySill: 0.20, xSill: 0.94, yBelt: 0.57, xBelt: 1.00, yTop: 0.98, xTop: 0.74, crown: 0.04, isCabin: true },
    { zNorm: 0.32, ySill: 0.21, xSill: 0.92, yBelt: 0.58, xBelt: 0.97, yTop: 0.65, xTop: 0.84, crown: 0.02 },
    { zNorm: 0.46, ySill: 0.22, xSill: 0.86, yBelt: 0.56, xBelt: 0.91, yTop: 0.61, xTop: 0.81, crown: 0.02 },
    { zNorm: 0.50, ySill: 0.25, xSill: 0.72, yBelt: 0.50, xBelt: 0.80, yTop: 0.55, xTop: 0.70, crown: 0.01 },
  ];
}

function buildLoftedShell(
  sections: CrossSection[],
  width: number,
  length: number,
  height: number,
  mode: 'lower-body' | 'glass-greenhouse',
): THREE.BufferGeometry {
  const halfW = width / 2;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const ringPts = 9;

  const getStationRing = (s: CrossSection): [number, number, number][] => {
    const z = s.zNorm * length;
    const ySill = s.ySill;
    const yBelt = s.yBelt * height;
    const yTop =
      mode === 'lower-body' && s.isCabin
        ? yBelt + (s.yTop * height - yBelt) * 0.12
        : s.yTop * height;

    const xSill = s.xSill * halfW;
    const xBelt = s.xBelt * halfW;
    const xTop = mode === 'lower-body' && s.isCabin ? xBelt * 0.95 : s.xTop * halfW;

    if (mode === 'glass-greenhouse') {
      const gxBelt = s.xBelt * halfW * 0.955;
      const gxTop = s.xTop * halfW * 0.935;
      const gyBelt = yBelt + 0.015;
      const gyTop = s.yTop * height;
      return [
        [gxBelt, gyBelt, z],
        [gxBelt * 0.995, gyBelt + (gyTop - gyBelt) * 0.34, z],
        [gxTop + (gxBelt - gxTop) * 0.38, gyBelt + (gyTop - gyBelt) * 0.76, z],
        [gxTop * 0.65, gyTop + s.crown * 0.6, z],
        [0, gyTop + s.crown, z],
        [-gxTop * 0.65, gyTop + s.crown * 0.6, z],
        [-gxTop - (gxBelt - gxTop) * 0.38, gyBelt + (gyTop - gyBelt) * 0.76, z],
        [-gxBelt * 0.995, gyBelt + (gyTop - gyBelt) * 0.34, z],
        [-gxBelt, gyBelt, z],
      ];
    }

    const xMidDoor = xBelt * 1.01;
    const yMidDoor = ySill + (yBelt - ySill) * 0.56;
    const yShoulder = yBelt + (yTop - yBelt) * 0.55;
    const xShoulder = xBelt - (xBelt - xTop) * 0.35;
    return [
      [xSill, ySill, z],
      [xMidDoor, yMidDoor, z],
      [xBelt * 0.985, yBelt, z],
      [xShoulder, yShoulder + s.crown * 0.25, z],
      [0, yTop + s.crown, z],
      [-xShoulder, yShoulder + s.crown * 0.25, z],
      [-xBelt * 0.985, yBelt, z],
      [-xMidDoor, yMidDoor, z],
      [-xSill, ySill, z],
    ];
  };

  const activeSections =
    mode === 'glass-greenhouse'
      ? sections.filter((s, idx) => {
          const prev = sections[idx - 1];
          const next = sections[idx + 1];
          return s.isCabin || prev?.isCabin || next?.isCabin;
        })
      : sections;

  for (let i = 0; i < activeSections.length; i++) {
    const ring = getStationRing(activeSections[i]);
    const v = i / Math.max(1, activeSections.length - 1);
    for (let j = 0; j < ring.length; j++) {
      const pt = ring[j];
      positions.push(pt[0], pt[1], pt[2]);
      uvs.push(j / (ringPts - 1), v);
    }
  }

  for (let i = 0; i < activeSections.length - 1; i++) {
    for (let j = 0; j < ringPts - 1; j++) {
      const a = i * ringPts + j;
      const b = a + 1;
      const c = (i + 1) * ringPts + j;
      const d = c + 1;
      indices.push(a, b, d);
      indices.push(a, d, c);
    }
  }

  const addCap = (stationIdx: number, flip: boolean) => {
    const base = stationIdx * ringPts;
    const centerIdx = positions.length / 3;
    const midY = (positions[base * 3 + 1] + positions[(base + 4) * 3 + 1]) * 0.5;
    const z = positions[base * 3 + 2];
    positions.push(0, midY, z);
    uvs.push(0.5, stationIdx === 0 ? 0 : 1);
    for (let j = 0; j < ringPts - 1; j++) {
      if (flip) indices.push(centerIdx, base + j + 1, base + j);
      else indices.push(centerIdx, base + j, base + j + 1);
    }
  };

  addCap(0, true);
  addCap(activeSections.length - 1, false);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function buildRoofCapGeometry(
  sections: CrossSection[],
  width: number,
  length: number,
  height: number,
): THREE.BufferGeometry | null {
  const cabinStations = sections.filter((s) => s.isCabin);
  if (cabinStations.length < 2) return null;
  const halfW = width / 2;
  const positions: number[] = [];
  const indices: number[] = [];

  for (const s of cabinStations) {
    const z = s.zNorm * length;
    const yEdge = s.yTop * height + 0.008;
    const yMid = yEdge + s.crown + 0.016;
    const xEdge = s.xTop * halfW * 0.91;
    positions.push(xEdge, yEdge, z, 0, yMid, z, -xEdge, yEdge, z);
  }

  for (let i = 0; i < cabinStations.length - 1; i++) {
    const a = i * 3;
    const b = a + 3;
    indices.push(a, a + 1, b + 1, a, b + 1, b);
    indices.push(a + 1, a + 2, b + 2, a + 1, b + 2, b + 1);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function addWheelWellsAndFenders(
  parent: THREE.Group,
  width: number,
  wheelbase: number,
  wheelRadius: number,
  paintMat: THREE.Material,
): void {
  const archMat = new THREE.MeshStandardMaterial({
    color: 0x0b0d12,
    roughness: 0.92,
  });
  const wellGeo = new THREE.CylinderGeometry(
    wheelRadius + 0.075,
    wheelRadius + 0.075,
    0.28,
    24,
    1,
    false,
    0,
    Math.PI,
  );
  wellGeo.rotateZ(Math.PI / 2);

  const flareGeo = new THREE.TorusGeometry(wheelRadius + 0.068, 0.042, 10, 24, Math.PI);
  flareGeo.rotateY(Math.PI / 2);

  const trackHalf = width / 2 - 0.09;
  for (const wz of [-wheelbase / 2, wheelbase / 2]) {
    for (const side of [-1, 1]) {
      const well = new THREE.Mesh(wellGeo, archMat);
      well.position.set(side * trackHalf, wheelRadius - 0.02, wz);
      parent.add(well);

      const flare = new THREE.Mesh(flareGeo, paintMat);
      flare.position.set(side * (width / 2 - 0.02), wheelRadius + 0.01, wz);
      parent.add(flare);
    }
  }
}

function createWheelMesh(
  radius: number,
  width: number,
  rimStyle: CarCustomization['rimStyle'],
  rimColor: string,
  isLeft: boolean,
  tireTex: THREE.Texture,
): THREE.Group {
  const wheelGroup = new THREE.Group();

  // Tread-mapped 32-segment radial tire + contoured rubber sidewalls
  const tireGeo = new THREE.CylinderGeometry(radius, radius, width, 32);
  tireGeo.rotateZ(Math.PI / 2);
  const tireMat = new THREE.MeshStandardMaterial({
    map: tireTex,
    roughness: 0.85,
    metalness: 0.06,
  });
  const tire = new THREE.Mesh(tireGeo, tireMat);
  tire.castShadow = true;
  wheelGroup.add(tire);

  const sidewallGeo = new THREE.TorusGeometry(radius * 0.84, radius * 0.14, 10, 28);
  sidewallGeo.rotateY(Math.PI / 2);
  const sidewallMat = new THREE.MeshStandardMaterial({ color: 0x15171c, roughness: 0.78 });
  const sideSign = isLeft ? -1 : 1;
  const sidewall = new THREE.Mesh(sidewallGeo, sidewallMat);
  sidewall.position.x = sideSign * (width * 0.42);
  wheelGroup.add(sidewall);

  const rimRadius = radius * 0.67;
  const barrelGeo = new THREE.CylinderGeometry(rimRadius, rimRadius, width + 0.015, 24);
  barrelGeo.rotateZ(Math.PI / 2);
  const barrelMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.4,
    metalness: 0.75,
  });
  wheelGroup.add(new THREE.Mesh(barrelGeo, barrelMat));

  // Cross-drilled metallic brake rotor
  const discGeo = new THREE.CylinderGeometry(rimRadius * 0.76, rimRadius * 0.76, width + 0.024, 20);
  discGeo.rotateZ(Math.PI / 2);
  const discMat = new THREE.MeshStandardMaterial({
    color: 0xb8c4d4,
    roughness: 0.24,
    metalness: 0.92,
  });
  wheelGroup.add(new THREE.Mesh(discGeo, discMat));

  // Painted Sport Brake Caliper
  const caliper = new THREE.Mesh(
    new THREE.BoxGeometry(width + 0.014, rimRadius * 0.36, rimRadius * 0.28),
    new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.28, metalness: 0.25 }),
  );
  caliper.position.set(0, rimRadius * 0.28, rimRadius * 0.38);
  wheelGroup.add(caliper);

  const faceX = sideSign * (width / 2 + 0.014);
  const rimMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(rimColor),
    roughness: 0.18,
    metalness: 0.92,
  });

  const lipGeo = new THREE.TorusGeometry(rimRadius * 0.95, 0.024, 10, 28);
  lipGeo.rotateY(Math.PI / 2);
  const lip = new THREE.Mesh(lipGeo, rimMat);
  lip.position.x = faceX;
  wheelGroup.add(lip);

  const hubGeo = new THREE.CylinderGeometry(rimRadius * 0.23, rimRadius * 0.23, 0.032, 16);
  hubGeo.rotateZ(Math.PI / 2);
  const hub = new THREE.Mesh(hubGeo, rimMat);
  hub.position.x = faceX;
  wheelGroup.add(hub);

  // 5 Chrome Lug Nuts around center cap
  const lugGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.036, 6);
  lugGeo.rotateZ(Math.PI / 2);
  const lugMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, metalness: 0.95, roughness: 0.1 });
  for (let l = 0; l < 5; l++) {
    const la = (l / 5) * Math.PI * 2;
    const lug = new THREE.Mesh(lugGeo, lugMat);
    lug.position.set(faceX, Math.cos(la) * rimRadius * 0.13, Math.sin(la) * rimRadius * 0.13);
    wheelGroup.add(lug);
  }

  const spokeCount =
    rimStyle === 'five-spoke' ? 5 : rimStyle === 'mesh' ? 10 : rimStyle === 'turbine' ? 8 : 6;
  const spokeThick = rimStyle === 'deep-dish' ? 0.04 : rimStyle === 'mesh' ? 0.019 : 0.027;

  for (let i = 0; i < spokeCount; i++) {
    const angle = (i / spokeCount) * Math.PI * 2;
    const spokeGeo = new THREE.BoxGeometry(0.026, rimRadius * 0.84, spokeThick);
    const spoke = new THREE.Mesh(spokeGeo, rimMat);
    const rMid = rimRadius * 0.46;
    spoke.position.set(faceX, Math.cos(angle) * rMid, Math.sin(angle) * rMid);
    spoke.rotation.x = angle + (rimStyle === 'turbine' ? 0.34 : 0);
    wheelGroup.add(spoke);
  }

  return wheelGroup;
}

function buildCockpitInterior(car: CarDefinition): {
  cockpitGroup: THREE.Group;
  cockpitWheel: THREE.Group;
  cockpitSpeedNeedle: THREE.Group;
} {
  const cockpitGroup = new THREE.Group();
  const dashMat = new THREE.MeshStandardMaterial({ color: 0x151821, roughness: 0.7, metalness: 0.12 });
  const dashTopMat = new THREE.MeshStandardMaterial({ color: 0x0f1218, roughness: 0.78 });
  const trimMat = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.22, metalness: 0.88 });
  const seatMat = new THREE.MeshStandardMaterial({ color: 0x222633, roughness: 0.82 });

  const dashY = car.height * 0.56;
  const dashZ = -car.length * 0.17;
  const dashW = car.width - 0.26;

  // Sculpted upper & lower leather-look dashboard
  const dashBody = new THREE.Mesh(new THREE.BoxGeometry(dashW, 0.22, 0.38), dashMat);
  dashBody.position.set(0, dashY, dashZ);
  cockpitGroup.add(dashBody);

  const dashUpperPad = new THREE.Mesh(new THREE.BoxGeometry(dashW, 0.055, 0.42), dashTopMat);
  dashUpperPad.position.set(0, dashY + 0.12, dashZ - 0.01);
  cockpitGroup.add(dashUpperPad);

  const dashCowl = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.14, 0.28), dashTopMat);
  dashCowl.position.set(-0.36, dashY + 0.16, dashZ - 0.01);
  cockpitGroup.add(dashCowl);

  // Brushed aluminum horizontal dash trim + AC air vents
  const accentBar = new THREE.Mesh(new THREE.BoxGeometry(dashW - 0.08, 0.025, 0.045), trimMat);
  accentBar.position.set(0, dashY + 0.04, dashZ + 0.18);
  cockpitGroup.add(accentBar);

  const ventGeo = new THREE.BoxGeometry(0.11, 0.055, 0.04);
  for (const vx of [-0.66, -0.14, 0.14, 0.66]) {
    const vent = new THREE.Mesh(ventGeo, dashTopMat);
    vent.position.set(vx, dashY + 0.085, dashZ + 0.185);
    cockpitGroup.add(vent);
  }

  // High-detail glowing Digital Instrument Cluster + Live Moving Speedometer Needle
  const clusterTex = createClusterTexture();
  const clusterScreen = new THREE.Mesh(
    new THREE.PlaneGeometry(0.39, 0.13),
    new THREE.MeshBasicMaterial({ map: clusterTex }),
  );
  clusterScreen.position.set(-0.36, dashY + 0.14, dashZ + 0.132);
  cockpitGroup.add(clusterScreen);

  const cockpitSpeedNeedle = new THREE.Group();
  cockpitSpeedNeedle.position.set(-0.265, dashY + 0.132, dashZ + 0.138);
  const needleBlade = new THREE.Mesh(
    new THREE.BoxGeometry(0.006, 0.038, 0.004),
    new THREE.MeshBasicMaterial({ color: 0xf43f5e }),
  );
  needleBlade.position.y = 0.016;
  cockpitSpeedNeedle.add(needleBlade);
  cockpitSpeedNeedle.rotation.z = 2.15; // Resting at 0 km/h
  cockpitGroup.add(cockpitSpeedNeedle);

  // Center Infotainment Navigation Display
  const navBezel = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.17, 0.03), dashTopMat);
  navBezel.position.set(0, dashY + 0.14, dashZ + 0.155);
  cockpitGroup.add(navBezel);

  const navTex = createInfotainmentTexture();
  const navScreen = new THREE.Mesh(
    new THREE.PlaneGeometry(0.25, 0.145),
    new THREE.MeshBasicMaterial({ map: navTex }),
  );
  navScreen.position.set(0, dashY + 0.14, dashZ + 0.173);
  cockpitGroup.add(navScreen);

  // Center Console + Shift Gaiter + Chrome Gear Knob
  const consoleBox = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.22, 0.9), dashMat);
  consoleBox.position.set(0, dashY - 0.14, dashZ + 0.56);
  cockpitGroup.add(consoleBox);

  const shiftBoot = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.055, 0.08, 12), dashTopMat);
  shiftBoot.position.set(0, dashY - 0.01, dashZ + 0.34);
  cockpitGroup.add(shiftBoot);

  const gearKnob = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.025, 0.075, 16), trimMat);
  gearKnob.position.set(0, dashY + 0.05, dashZ + 0.34);
  cockpitGroup.add(gearKnob);

  // Sculpted Side Door Panels + Armrests + Chrome Door Handles
  const doorGeo = new THREE.BoxGeometry(0.075, 0.34, 1.0);
  const armrestGeo = new THREE.BoxGeometry(0.09, 0.05, 0.45);
  for (const sx of [-1, 1]) {
    const door = new THREE.Mesh(doorGeo, dashMat);
    door.position.set(sx * (dashW / 2), dashY - 0.04, dashZ + 0.42);
    cockpitGroup.add(door);

    const armrest = new THREE.Mesh(armrestGeo, seatMat);
    armrest.position.set(sx * (dashW / 2 - 0.02), dashY - 0.04, dashZ + 0.46);
    cockpitGroup.add(armrest);
  }

  // Sport Bucket Seats (Driver behind eye + Passenger)
  for (const sx of [-0.36, 0.38]) {
    const backrest = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.54, 0.18), seatMat);
    backrest.position.set(sx, dashY + 0.08, dashZ + 0.72);
    cockpitGroup.add(backrest);

    const headrest = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.18, 0.12), seatMat);
    headrest.position.set(sx, dashY + 0.42, dashZ + 0.74);
    cockpitGroup.add(headrest);
  }

  // Top-Center Rearview Mirror + Sun Visors
  const mirrorHousing = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.065, 0.04), dashTopMat);
  mirrorHousing.position.set(0, car.height - 0.14, dashZ + 0.05);
  cockpitGroup.add(mirrorHousing);
  const mirrorGlass = new THREE.Mesh(
    new THREE.PlaneGeometry(0.21, 0.048),
    new THREE.MeshStandardMaterial({ color: 0xcbd5e1, metalness: 0.96, roughness: 0.04 }),
  );
  mirrorGlass.position.set(0, car.height - 0.14, dashZ + 0.072);
  cockpitGroup.add(mirrorGlass);

  const visorGeo = new THREE.BoxGeometry(0.38, 0.09, 0.025);
  for (const vx of [-0.36, 0.36]) {
    const visor = new THREE.Mesh(visorGeo, seatMat);
    visor.position.set(vx, car.height - 0.09, dashZ + 0.04);
    visor.rotation.x = 0.35;
    cockpitGroup.add(visor);
  }

  // 3D Live-Rotating Sport Steering Wheel with Paddle Shifters & Top Marker
  const steerMount = new THREE.Group();
  steerMount.position.set(-0.36, dashY + 0.08, dashZ + 0.25);
  steerMount.rotation.x = 0.36;
  cockpitGroup.add(steerMount);

  const column = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.046, 0.18, 12), dashTopMat);
  column.rotation.x = Math.PI / 2;
  column.position.z = -0.09;
  steerMount.add(column);

  const cockpitWheel = new THREE.Group();
  steerMount.add(cockpitWheel);

  const wheelRimMat = new THREE.MeshStandardMaterial({
    color: 0x18181b,
    roughness: 0.52,
    metalness: 0.18,
  });
  const wheelRim = new THREE.Mesh(new THREE.TorusGeometry(0.165, 0.023, 14, 32), wheelRimMat);
  cockpitWheel.add(wheelRim);

  // Top 12-o'clock amber racing stripe
  const topMarker = new THREE.Mesh(
    new THREE.BoxGeometry(0.024, 0.048, 0.05),
    new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.25 }),
  );
  topMarker.position.set(0, 0.165, 0);
  cockpitWheel.add(topMarker);

  // Horizontal & Bottom Spokes + Silver Paddle Shifters
  const spokeH = new THREE.Mesh(new THREE.BoxGeometry(0.31, 0.038, 0.024), wheelRimMat);
  cockpitWheel.add(spokeH);

  const spokeV = new THREE.Mesh(new THREE.BoxGeometry(0.046, 0.15, 0.025), trimMat);
  spokeV.position.set(0, -0.08, 0);
  cockpitWheel.add(spokeV);

  for (const px of [-0.11, 0.11]) {
    const paddle = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.095, 0.012), trimMat);
    paddle.position.set(px, 0.02, -0.028);
    cockpitWheel.add(paddle);
  }

  const hornPad = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.058, 0.04, 18), wheelRimMat);
  hornPad.rotation.x = Math.PI / 2;
  cockpitWheel.add(hornPad);

  const emblem = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.014, 0.046), trimMat);
  cockpitWheel.add(emblem);

  cockpitGroup.visible = false;
  return { cockpitGroup, cockpitWheel, cockpitSpeedNeedle };
}

export function buildPlayerCarRig(
  car: CarDefinition,
  custom: CarCustomization,
  isSoftwareGl: boolean,
): CarRig {
  const root = new THREE.Group();
  const bodyTiltGroup = new THREE.Group();
  root.add(bodyTiltGroup);

  const shadowTex = createContactShadowTexture('0,0,0');
  const shadowGeo = new THREE.PlaneGeometry(car.width + 0.72, car.length + 0.85);
  shadowGeo.rotateX(-Math.PI / 2);
  const shadowMat = new THREE.MeshBasicMaterial({
    map: shadowTex,
    transparent: true,
    opacity: 0.68,
    depthWrite: false,
  });
  const contactShadow = new THREE.Mesh(shadowGeo, shadowMat);
  contactShadow.position.y = 0.015;
  root.add(contactShadow);

  if (custom.underglowColor) {
    const rgb = new THREE.Color(custom.underglowColor);
    const glowTex = createContactShadowTexture(
      `${Math.round(rgb.r * 255)},${Math.round(rgb.g * 255)},${Math.round(rgb.b * 255)}`,
    );
    const glowGeo = new THREE.PlaneGeometry(car.width + 1.0, car.length + 1.0);
    glowGeo.rotateX(-Math.PI / 2);
    const glowMat = new THREE.MeshBasicMaterial({
      map: glowTex,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const glowMesh = new THREE.Mesh(glowGeo, glowMat);
    glowMesh.position.y = 0.022;
    root.add(glowMesh);
  }

  const paintMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(custom.bodyColor),
    metalness: custom.paintFinish === 'metallic' ? 0.82 : custom.paintFinish === 'matte' ? 0.14 : 0.35,
    roughness: custom.paintFinish === 'matte' ? 0.68 : custom.paintFinish === 'metallic' ? 0.2 : 0.12,
    clearcoat: custom.paintFinish === 'matte' ? 0.06 : 1.0,
    clearcoatRoughness: custom.paintFinish === 'matte' ? 0.55 : 0.05,
  });

  const sections = getCarSections(car.id);

  const bodyGeo = buildLoftedShell(sections, car.width, car.length, car.height, 'lower-body');
  const bodyMesh = new THREE.Mesh(bodyGeo, paintMat);
  bodyMesh.castShadow = !isSoftwareGl;
  bodyMesh.receiveShadow = true;
  bodyTiltGroup.add(bodyMesh);

  const tintCfg = TINT_LEVELS.find((t) => t.id === custom.tint) || TINT_LEVELS[1];
  const exteriorGlassOpacity = Math.max(0.84, tintCfg.opacity);
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x0a111f,
    roughness: 0.05,
    metalness: 0.28,
    clearcoat: 1.0,
    transparent: true,
    opacity: exteriorGlassOpacity,
    side: THREE.DoubleSide,
  });
  const glassGeo = buildLoftedShell(sections, car.width, car.length, car.height, 'glass-greenhouse');
  const glassMesh = new THREE.Mesh(glassGeo, glassMat);
  glassMesh.castShadow = !isSoftwareGl;
  bodyTiltGroup.add(glassMesh);

  const roofGeo = buildRoofCapGeometry(sections, car.width, car.length, car.height);
  if (roofGeo) {
    const roofMesh = new THREE.Mesh(roofGeo, paintMat);
    roofMesh.castShadow = !isSoftwareGl;
    roofMesh.receiveShadow = true;
    bodyTiltGroup.add(roofMesh);
  }

  // Sculpted Black/Body Pillars (A, B, C Pillars)
  const trimMat = new THREE.MeshStandardMaterial({
    color: 0x11151d,
    roughness: 0.52,
    metalness: 0.3,
  });
  const chromeMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    metalness: 0.94,
    roughness: 0.12,
  });

  const pillarGeo = new THREE.BoxGeometry(0.065, car.height * 0.44, 0.08);
  const bPillarGeo = new THREE.BoxGeometry(0.05, car.height * 0.39, 0.11);
  for (const side of [-1, 1]) {
    const aPillar = new THREE.Mesh(pillarGeo, paintMat);
    aPillar.position.set(side * (car.width * 0.4), car.height * 0.77, -car.length * 0.16);
    aPillar.rotation.x = 0.62;
    aPillar.rotation.z = side * 0.24;
    bodyTiltGroup.add(aPillar);

    const bPillar = new THREE.Mesh(bPillarGeo, trimMat);
    bPillar.position.set(side * (car.width * 0.43), car.height * 0.77, car.length * 0.05);
    bPillar.rotation.z = side * 0.22;
    bodyTiltGroup.add(bPillar);

    const cPillar = new THREE.Mesh(pillarGeo, paintMat);
    cPillar.position.set(side * (car.width * 0.39), car.height * 0.76, car.length * 0.35);
    cPillar.rotation.x = -0.58;
    cPillar.rotation.z = side * 0.22;
    bodyTiltGroup.add(cPillar);

    // Lower Aero Side Skirt
    const skirt = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.075, car.wheelbase * 0.76), trimMat);
    skirt.position.set(side * (car.width * 0.475), 0.23, 0);
    bodyTiltGroup.add(skirt);
  }

  const wheelRadius = car.id === 'suv' || car.id === 'hatch' ? 0.36 : 0.33;
  addWheelWellsAndFenders(bodyTiltGroup, car.width, car.wheelbase, wheelRadius, paintMat);

  // Shark-fin roof antenna
  const fin = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.12, 4), trimMat);
  fin.position.set(0, car.height + 0.04, car.length * 0.22);
  fin.rotation.x = -0.35;
  bodyTiltGroup.add(fin);

  if (car.id === 'hatch' || car.id === 'suv') {
    const railGeo = new THREE.BoxGeometry(0.05, 0.04, car.length * 0.44);
    for (const sx of [-car.width * 0.32, car.width * 0.32]) {
      const rail = new THREE.Mesh(railGeo, car.id === 'hatch' ? trimMat : chromeMat);
      rail.position.set(sx, car.height + 0.02, 0.14);
      bodyTiltGroup.add(rail);
    }
  }

  // Front Grille + Chrome Surround + Lower Aero Splitter + Side Intakes
  const grille = new THREE.Mesh(new THREE.BoxGeometry(car.width * 0.48, 0.19, 0.08), trimMat);
  grille.position.set(0, 0.55, -car.length / 2 + 0.02);
  bodyTiltGroup.add(grille);

  const grilleFrame = new THREE.Mesh(new THREE.BoxGeometry(car.width * 0.52, 0.22, 0.05), chromeMat);
  grilleFrame.position.set(0, 0.55, -car.length / 2 + 0.01);
  bodyTiltGroup.add(grilleFrame);

  const lowerValance = new THREE.Mesh(new THREE.BoxGeometry(car.width * 0.82, 0.11, 0.15), trimMat);
  lowerValance.position.set(0, 0.28, -car.length / 2 + 0.03);
  bodyTiltGroup.add(lowerValance);

  // Front & Rear License Plates
  const plateGeo = new THREE.BoxGeometry(0.44, 0.11, 0.03);
  const plateMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.32 });
  const frontPlate = new THREE.Mesh(plateGeo, plateMat);
  frontPlate.position.set(0, 0.38, -car.length / 2 - 0.005);
  bodyTiltGroup.add(frontPlate);

  const rearPlate = new THREE.Mesh(plateGeo, plateMat);
  rearPlate.position.set(0, 0.54, car.length / 2 + 0.012);
  bodyTiltGroup.add(rearPlate);

  // Rear Diffuser + Twin Metallic Exhaust Tips
  const rearDiffuser = new THREE.Mesh(new THREE.BoxGeometry(car.width * 0.78, 0.14, 0.12), trimMat);
  rearDiffuser.position.set(0, 0.32, car.length / 2 - 0.04);
  bodyTiltGroup.add(rearDiffuser);

  const exhaustGeo = new THREE.CylinderGeometry(0.052, 0.052, 0.12, 14);
  exhaustGeo.rotateX(Math.PI / 2);
  for (const ex of [-0.46, 0.46]) {
    const pipe = new THREE.Mesh(exhaustGeo, chromeMat);
    pipe.position.set(ex, 0.26, car.length / 2 - 0.005);
    bodyTiltGroup.add(pipe);
  }

  // Two-tone Side Wing Mirrors (painted cap + reflective mirror glass)
  const mirrorHousingGeo = new THREE.BoxGeometry(0.19, 0.105, 0.13);
  const mirrorFaceGeo = new THREE.PlaneGeometry(0.15, 0.08);
  for (const side of [-1, 1]) {
    const mirror = new THREE.Mesh(mirrorHousingGeo, paintMat);
    mirror.position.set(side * (car.width / 2 + 0.065), car.height * 0.62, -car.length * 0.14);
    mirror.rotation.y = side * -0.18;
    bodyTiltGroup.add(mirror);

    const glassFace = new THREE.Mesh(mirrorFaceGeo, chromeMat);
    glassFace.position.set(side * (car.width / 2 + 0.065), car.height * 0.62, -car.length * 0.14 + 0.068);
    glassFace.rotation.y = side * -0.18;
    bodyTiltGroup.add(glassFace);
  }

  const handleGeo = new THREE.BoxGeometry(0.032, 0.035, 0.16);
  for (const side of [-1, 1]) {
    for (const hz of [-0.2, 0.55]) {
      const h = new THREE.Mesh(handleGeo, chromeMat);
      h.position.set(side * (car.width / 2 - 0.01), car.height * 0.54, hz);
      bodyTiltGroup.add(h);
    }
  }

  if (custom.stripes) {
    const stripeMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(custom.stripeColor),
      roughness: 0.22,
      metalness: 0.25,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    for (const sx of [-0.18, 0.18]) {
      const hoodStripe = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.02, car.length * 0.28), stripeMat);
      hoodStripe.position.set(sx, car.height * 0.62, -car.length * 0.32);
      hoodStripe.rotation.x = 0.12;
      bodyTiltGroup.add(hoodStripe);

      const roofStripe = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.02, car.length * 0.36), stripeMat);
      roofStripe.position.set(sx, car.height + 0.03, 0.12);
      bodyTiltGroup.add(roofStripe);
    }
  }

  // Multi-element LED DRL Projector Headlights
  const headTex = createHeadlightTexture();
  const headMat = new THREE.MeshStandardMaterial({
    map: headTex,
    emissiveMap: headTex,
    emissive: 0xffffff,
    emissiveIntensity: 1.4,
    roughness: 0.08,
  });
  const headGeo = new THREE.BoxGeometry(0.35, 0.12, 0.08);
  for (const side of [-1, 1]) {
    const hl = new THREE.Mesh(headGeo, headMat);
    hl.position.set(side * (car.width * 0.32), car.height * 0.44, -car.length / 2 + 0.05);
    hl.rotation.y = side * -0.22;
    bodyTiltGroup.add(hl);
  }

  // Detailed LED Taillights + Active Brake & Reverse Lamps + Third High Brake Bar
  const tailTex = createTaillightTexture();
  const brakeMat = new THREE.MeshStandardMaterial({
    map: tailTex,
    color: 0xffffff,
    emissive: 0xef4444,
    emissiveIntensity: 0.55,
    roughness: 0.15,
  });
  const reverseMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    emissive: 0xffffff,
    emissiveIntensity: 0.0,
    roughness: 0.2,
  });
  const tailGeo = new THREE.BoxGeometry(0.35, 0.105, 0.08);
  const revGeo = new THREE.BoxGeometry(0.14, 0.065, 0.085);
  for (const side of [-1, 1]) {
    const tl = new THREE.Mesh(tailGeo, brakeMat);
    tl.position.set(side * (car.width * 0.31), car.height * 0.53, car.length / 2 - 0.02);
    tl.rotation.y = side * 0.16;
    bodyTiltGroup.add(tl);

    const rl = new THREE.Mesh(revGeo, reverseMat);
    rl.position.set(side * (car.width * 0.15), car.height * 0.53, car.length / 2 - 0.015);
    bodyTiltGroup.add(rl);
  }
  const highBrakeBar = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.032, 0.04), brakeMat);
  highBrakeBar.position.set(0, car.height * 0.9, car.length * 0.4);
  bodyTiltGroup.add(highBrakeBar);

  if (custom.spoiler) {
    const wingGeo = new THREE.BoxGeometry(car.width * 0.86, 0.045, 0.24);
    const wing = new THREE.Mesh(wingGeo, trimMat);
    const wingY = car.id === 'hatch' || car.id === 'suv' ? car.height + 0.06 : car.height * 0.72;
    const wingZ = car.length / 2 - 0.18;
    wing.position.set(0, wingY, wingZ);
    wing.rotation.x = 0.1;
    bodyTiltGroup.add(wing);

    const strutGeo = new THREE.BoxGeometry(0.045, 0.14, 0.12);
    for (const sx of [-0.42, 0.42]) {
      const strut = new THREE.Mesh(strutGeo, trimMat);
      strut.position.set(sx, wingY - 0.07, wingZ);
      bodyTiltGroup.add(strut);
    }
  }

  // Detailed 3D Interior Cockpit (visible in INSIDE camera mode)
  const { cockpitGroup, cockpitWheel, cockpitSpeedNeedle } = buildCockpitInterior(car);
  bodyTiltGroup.add(cockpitGroup);

  const setInteriorView = (active: boolean) => {
    cockpitGroup.visible = active;
    glassMat.opacity = active ? 0.12 : exteriorGlassOpacity;
  };

  // Four Articulated Treaded Wheels
  const tireTex = createTireTreadTexture();
  const wheelWidth = car.id === 'supercar' ? 0.28 : 0.24;
  const trackHalf = car.width / 2 - 0.08;
  const frontZ = -car.wheelbase / 2;
  const rearZ = car.wheelbase / 2;

  const frontLeftPivot = new THREE.Group();
  frontLeftPivot.position.set(-trackHalf, wheelRadius, frontZ);
  const flWheel = createWheelMesh(wheelRadius, wheelWidth, custom.rimStyle, custom.rimColor, true, tireTex);
  frontLeftPivot.add(flWheel);
  root.add(frontLeftPivot);

  const frontRightPivot = new THREE.Group();
  frontRightPivot.position.set(trackHalf, wheelRadius, frontZ);
  const frWheel = createWheelMesh(wheelRadius, wheelWidth, custom.rimStyle, custom.rimColor, false, tireTex);
  frontRightPivot.add(frWheel);
  root.add(frontRightPivot);

  const rlWheel = createWheelMesh(wheelRadius, wheelWidth, custom.rimStyle, custom.rimColor, true, tireTex);
  rlWheel.position.set(-trackHalf, wheelRadius, rearZ);
  root.add(rlWheel);

  const rrWheel = createWheelMesh(wheelRadius, wheelWidth, custom.rimStyle, custom.rimColor, false, tireTex);
  rrWheel.position.set(trackHalf, wheelRadius, rearZ);
  root.add(rrWheel);

  return {
    root,
    bodyTiltGroup,
    frontLeftPivot,
    frontRightPivot,
    wheelsSpin: [flWheel, frWheel, rlWheel, rrWheel],
    brakeMat,
    reverseMat,
    cockpitWheel,
    cockpitSpeedNeedle,
    setInteriorView,
  };
}

export function buildNpcCarMesh(
  width: number,
  length: number,
  colorHex: string,
  isSoftwareGl: boolean,
  variant: 'sedan' | 'mpv' = 'sedan',
): THREE.Group {
  const group = new THREE.Group();
  const height = variant === 'mpv' ? 1.62 : 1.4;
  const wheelbase = length * 0.62;

  const shadowTex = createContactShadowTexture('0,0,0');
  const shadowGeo = new THREE.PlaneGeometry(width + 0.6, length + 0.62);
  shadowGeo.rotateX(-Math.PI / 2);
  const shadow = new THREE.Mesh(
    shadowGeo,
    new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, opacity: 0.64, depthWrite: false }),
  );
  shadow.position.y = 0.014;
  group.add(shadow);

  const bodyMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(colorHex),
    roughness: 0.14,
    metalness: 0.34,
    clearcoat: 1.0,
    clearcoatRoughness: 0.06,
  });
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x0b1220,
    roughness: 0.05,
    metalness: 0.28,
    clearcoat: 1.0,
  });

  const sections = getCarSections(variant);
  const bodyMesh = new THREE.Mesh(
    buildLoftedShell(sections, width, length, height, 'lower-body'),
    bodyMat,
  );
  bodyMesh.castShadow = !isSoftwareGl;
  bodyMesh.receiveShadow = true;
  group.add(bodyMesh);

  const glassMesh = new THREE.Mesh(
    buildLoftedShell(sections, width, length, height, 'glass-greenhouse'),
    glassMat,
  );
  glassMesh.castShadow = !isSoftwareGl;
  group.add(glassMesh);

  addWheelWellsAndFenders(group, width, wheelbase, 0.32, bodyMat);

  const trimMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.55 });
  const bPillarGeo = new THREE.BoxGeometry(0.05, height * 0.38, 0.1);
  for (const sx of [-1, 1]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.095, 0.12), bodyMat);
    m.position.set(sx * (width / 2 + 0.055), height * 0.6, -length * 0.14);
    group.add(m);

    const bp = new THREE.Mesh(bPillarGeo, trimMat);
    bp.position.set(sx * (width * 0.42), height * 0.77, length * 0.05);
    bp.rotation.z = sx * 0.2;
    group.add(bp);
  }

  const headTex = createHeadlightTexture();
  const headMat = new THREE.MeshStandardMaterial({
    map: headTex,
    emissiveMap: headTex,
    emissive: 0xffffff,
    emissiveIntensity: 0.85,
  });
  for (const sx of [-1, 1]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.11, 0.06), headMat);
    hl.position.set(sx * (width * 0.32), height * 0.44, -length / 2 + 0.04);
    hl.rotation.y = sx * -0.2;
    group.add(hl);
  }

  const grille = new THREE.Mesh(new THREE.BoxGeometry(width * 0.4, 0.16, 0.07), trimMat);
  grille.position.set(0, height * 0.38, -length / 2 + 0.02);
  group.add(grille);

  const tailTex = createTaillightTexture();
  const tailMat = new THREE.MeshStandardMaterial({
    map: tailTex,
    emissive: 0xdc2626,
    emissiveIntensity: 0.55,
  });
  for (const sx of [-1, 1]) {
    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.095, 0.06), tailMat);
    tl.position.set(sx * (width * 0.31), height * 0.52, length / 2 - 0.02);
    group.add(tl);
  }

  const plate = new THREE.Mesh(
    new THREE.BoxGeometry(0.4, 0.1, 0.03),
    new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.35 }),
  );
  plate.position.set(0, height * 0.38, length / 2 + 0.01);
  group.add(plate);

  const tireTex = createTireTreadTexture();
  const wx = width / 2 - 0.07;
  const wz = wheelbase / 2;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const w = createWheelMesh(0.32, 0.22, 'five-spoke', '#cbd5e1', sx < 0, tireTex);
      w.position.set(sx * wx, 0.32, sz * wz);
      group.add(w);
    }
  }

  return group;
}
