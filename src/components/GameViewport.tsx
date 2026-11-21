import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { soundEngine } from '../game/audio';
import { buildNpcCarMesh, buildPlayerCarRig, CarRig } from '../game/carBuilder';
import { getCarById } from '../game/catalog';
import { getLevelById } from '../game/levels';
import {
  distanceOBBApprox,
  evaluateParkingBay,
  OBB,
  testOBBCollision,
} from '../game/physics';
import {
  CameraMode,
  CarCustomization,
  CarId,
  GearMode,
  HudTelemetry,
  LevelDefinition,
} from '../game/types';
import {
  afterSoftwareDraw,
  applyStudioEnvironment,
  createAsphaltBumpTexture,
  createAsphaltTexture,
  createChainLinkTexture,
  createConcreteTexture,
  createContainerBumpTexture,
  createContainerTexture,
  createHazardStripeTexture,
  createParkingBayTexture,
  createPlatformDeckTexture,
  createRoadArrowTexture,
  createSkyDomeTexture,
  createSpeedBumpTexture,
  createSteelRampTexture,
  createStudioRenderer,
  detectSoftwareWebGL,
  disposeObject3D,
} from '../game/webglUtils';

export interface DrivingInputState {
  gas: boolean;
  brake: boolean;
  steerTarget: number;
  gear: GearMode;
  paused: boolean;
}

interface GameViewportProps {
  levelId: number;
  carId: CarId;
  customization: CarCustomization;
  cameraMode: CameraMode;
  sensorEnabled: boolean;
  restartNonce: number;
  inputRef: React.MutableRefObject<DrivingInputState>;
  onTelemetry: (telemetry: HudTelemetry) => void;
  onLevelComplete: (stats: { time: number; hits: number; bonusCoins: number }) => void;
  onCrash: () => void;
  onContextError?: () => void;
}

const _camDesiredPos = new THREE.Vector3();
const _camDesiredLook = new THREE.Vector3();
const _camLookCurrent = new THREE.Vector3();

interface RuntimeCone {
  mesh: THREE.Group;
  x: number;
  z: number;
  knocked: boolean;
  fallProgress: number;
  fallDirX: number;
  fallDirZ: number;
}

interface RuntimeBump {
  x: number;
  z: number;
  halfW: number;
  halfL: number;
}

interface RuntimeMovingObstacle {
  mesh: THREE.Object3D;
  baseX: number;
  baseZ: number;
  axis: 'x' | 'z';
  range: number;
  speed: number;
  phase: number;
  width: number;
  length: number;
  rotation: number;
  curX: number;
  curZ: number;
}

interface RuntimeCoin {
  mesh: THREE.Group;
  x: number;
  z: number;
  value: number;
  collected: boolean;
}

interface RuntimeArrow {
  mat: THREE.MeshBasicMaterial;
  index: number;
}

export const GameViewport: React.FC<GameViewportProps> = ({
  levelId,
  carId,
  customization,
  cameraMode,
  sensorEnabled,
  restartNonce,
  inputRef,
  onTelemetry,
  onLevelComplete,
  onCrash,
  onContextError,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const cameraModeRef = useRef<CameraMode>(cameraMode);
  cameraModeRef.current = cameraMode;

  const sensorEnabledRef = useRef<boolean>(sensorEnabled);
  sensorEnabledRef.current = sensorEnabled;

  const callbacksRef = useRef({ onTelemetry, onLevelComplete, onCrash, onContextError });
  callbacksRef.current = { onTelemetry, onLevelComplete, onCrash, onContextError };

  const activeConfigRef = useRef({ levelId, carId, customization, restartNonce });
  activeConfigRef.current = { levelId, carId, customization, restartNonce };

  const rebuildFnRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isSoftwareGl = detectSoftwareWebGL();
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = createStudioRenderer(container, isSoftwareGl);
    } catch {
      callbacksRef.current.onContextError?.();
      return;
    }

    renderer.domElement.style.touchAction = 'none';

    const scene = new THREE.Scene();
    const envTex = applyStudioEnvironment(renderer, scene);

    const camera = new THREE.PerspectiveCamera(
      54,
      (container.clientWidth || window.innerWidth) / (container.clientHeight || window.innerHeight),
      0.2,
      290,
    );

    const hemiLight = new THREE.HemisphereLight(0xdbeafe, 0x475569, 0.96);
    scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(0xfff7e6, 1.85);
    sunLight.position.set(18, 36, 20);
    sunLight.castShadow = !isSoftwareGl;
    sunLight.shadow.mapSize.width = isSoftwareGl ? 1024 : 2048;
    sunLight.shadow.mapSize.height = isSoftwareGl ? 1024 : 2048;
    sunLight.shadow.camera.near = 2;
    sunLight.shadow.camera.far = 115;
    sunLight.shadow.camera.left = -28;
    sunLight.shadow.camera.right = 28;
    sunLight.shadow.camera.top = 28;
    sunLight.shadow.camera.bottom = -28;
    sunLight.shadow.bias = -0.0004;
    sunLight.shadow.normalBias = 0.02;
    scene.add(sunLight);
    scene.add(sunLight.target);

    const rimLight = new THREE.DirectionalLight(0xbae6fd, 0.5);
    rimLight.position.set(-18, 16, -18);
    scene.add(rimLight);

    const worldGroup = new THREE.Group();
    scene.add(worldGroup);

    let level: LevelDefinition = getLevelById(activeConfigRef.current.levelId);
    let carDef = getCarById(activeConfigRef.current.carId);
    let carRig: CarRig | null = null;

    let carX = 0;
    let carY = 0;
    let carZ = 0;
    let carYaw = 0;
    let carSpeed = 0;
    let steerAngle = 0;
    let wheelSpinAngle = 0;
    let health = 3;
    let hitsTaken = 0;
    let invulnTimer = 0;
    let elapsedTime = 0;
    let parkHoldTimer = 0;
    let coinsCollectedInRun = 0;
    let runEnded = false;
    let shakeIntensity = 0;

    let glanceYawOffset = 0;
    let glancePitchOffset = 0;
    let freeOrbitYaw = 0.45;
    let freeOrbitPitch = 0.42;
    let freeOrbitDistance = 7.2;
    let prevCameraMode: CameraMode = cameraModeRef.current;
    let isPointerLooking = false;
    let activeLookPointerId: number | null = null;
    let prevLookX = 0;
    let prevLookY = 0;
    let glanceHoldTimer = 0;

    let staticBoxes: OBB[] = [];
    let cones: RuntimeCone[] = [];
    let speedBumps: RuntimeBump[] = [];
    let movingObstacles: RuntimeMovingObstacle[] = [];
    let coins: RuntimeCoin[] = [];
    let pathArrows: RuntimeArrow[] = [];
    let bayRingMat: THREE.MeshBasicMaterial | null = null;

    const buildLevelAndCar = () => {
      while (worldGroup.children.length > 0) {
        const child = worldGroup.children[0];
        worldGroup.remove(child);
        disposeObject3D(child);
      }

      const cfg = activeConfigRef.current;
      level = getLevelById(cfg.levelId);
      carDef = getCarById(cfg.carId);

      if (level.theme === 'sunset') {
        scene.background = new THREE.Color(0x47334c);
        scene.fog = new THREE.FogExp2(0x47334c, 0.007);
        sunLight.color.setHex(0xffc088);
        sunLight.intensity = 1.8;
        hemiLight.color.setHex(0xfed7aa);
        hemiLight.groundColor.setHex(0x334155);
        hemiLight.intensity = 0.85;
      } else if (level.theme === 'basement') {
        scene.background = new THREE.Color(0x1e2430);
        scene.fog = new THREE.FogExp2(0x1e2430, 0.011);
        sunLight.color.setHex(0xe2e8f0);
        sunLight.intensity = 1.35;
        hemiLight.color.setHex(0xcbd5e1);
        hemiLight.groundColor.setHex(0x334155);
        hemiLight.intensity = 1.08;
      } else if (level.theme === 'rooftop') {
        scene.background = new THREE.Color(0x3b6ea5);
        scene.fog = new THREE.FogExp2(0x3b6ea5, 0.0052);
        sunLight.color.setHex(0xfef3c7);
        sunLight.intensity = 1.8;
        hemiLight.color.setHex(0x93c5fd);
        hemiLight.groundColor.setHex(0x475569);
        hemiLight.intensity = 0.94;
      } else {
        scene.background = new THREE.Color(0x8bb6e2);
        scene.fog = new THREE.FogExp2(0x8bb6e2, 0.0046);
        sunLight.color.setHex(0xfff9eb);
        sunLight.intensity = 1.9;
        hemiLight.color.setHex(0xe0f2fe);
        hemiLight.groundColor.setHex(0x64748b);
        hemiLight.intensity = 0.98;
      }

      // 0. Procedural Cloud & Sun-Halo Sky Dome
      const skyTex = createSkyDomeTexture(level.theme);
      const skyDome = new THREE.Mesh(
        new THREE.SphereGeometry(195, 28, 18),
        new THREE.MeshBasicMaterial({
          map: skyTex,
          side: THREE.BackSide,
          fog: false,
          depthWrite: false,
        }),
      );
      worldGroup.add(skyDome);

      // 1. Surrounding Sidewalks, Light Poles, Trees & Detailed Skyline
      const outerGeo = new THREE.PlaneGeometry(300, 300);
      outerGeo.rotateX(-Math.PI / 2);
      const outerMat = new THREE.MeshStandardMaterial({
        color: level.theme === 'basement' ? 0x262c36 : 0x8f96a3,
        roughness: 0.92,
      });
      const outerGround = new THREE.Mesh(outerGeo, outerMat);
      outerGround.position.y = -0.04;
      outerGround.receiveShadow = true;
      worldGroup.add(outerGround);

      if (level.theme !== 'basement') {
        const sidewalkMat = new THREE.MeshStandardMaterial({ color: 0xb9c0ca, roughness: 0.85 });
        const curbTrimMat = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.78 });

        const swEast = new THREE.Mesh(
          new THREE.BoxGeometry(5.5, 0.14, level.arenaLength + 16),
          sidewalkMat,
        );
        swEast.position.set(level.arenaWidth / 2 + 3.0, 0.03, 0);
        swEast.receiveShadow = true;
        worldGroup.add(swEast);

        const swWest = new THREE.Mesh(
          new THREE.BoxGeometry(5.5, 0.14, level.arenaLength + 16),
          curbTrimMat,
        );
        swWest.position.set(-level.arenaWidth / 2 - 3.0, 0.03, 0);
        swWest.receiveShadow = true;
        worldGroup.add(swWest);

        const benchMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.75 });
        const binMat = new THREE.MeshStandardMaterial({ color: 0x1e3a8a, roughness: 0.5 });
        const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.9 });
        const leafMat = new THREE.MeshStandardMaterial({ color: 0x2e7d32, roughness: 0.78 });
        const poleMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.75, roughness: 0.35 });
        const lampGlowMat = new THREE.MeshBasicMaterial({ color: 0xfef3c7 });

        for (let z = -level.arenaLength / 2 + 4; z <= level.arenaLength / 2 - 4; z += 9.5) {
          const bench = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.45, 1.8), benchMat);
          bench.position.set(level.arenaWidth / 2 + 2.5, 0.32, z);
          bench.castShadow = !isSoftwareGl;
          worldGroup.add(bench);

          const bin = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.22, 0.65, 10), binMat);
          bin.position.set(level.arenaWidth / 2 + 1.6, 0.42, z + 2.4);
          worldGroup.add(bin);

          // Multi-cluster realistic roadside tree
          const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.23, 1.9, 8), trunkMat);
          trunk.position.set(-level.arenaWidth / 2 - 3.0, 0.95, z);
          const crownMain = new THREE.Mesh(new THREE.DodecahedronGeometry(1.15, 1), leafMat);
          crownMain.position.set(-level.arenaWidth / 2 - 3.0, 2.4, z);
          crownMain.castShadow = !isSoftwareGl;
          const crownTop = new THREE.Mesh(new THREE.DodecahedronGeometry(0.75, 1), leafMat);
          crownTop.position.set(-level.arenaWidth / 2 - 3.2, 3.15, z + 0.3);
          worldGroup.add(trunk, crownMain, crownTop);

          // Yard Floodlight Mast along East Sidewalk
          const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 5.4, 8), poleMat);
          mast.position.set(level.arenaWidth / 2 + 1.4, 2.7, z - 2.2);
          const arm = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.08, 0.1), poleMat);
          arm.position.set(level.arenaWidth / 2 + 0.95, 5.35, z - 2.2);
          const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.08, 0.26), lampGlowMat);
          lamp.position.set(level.arenaWidth / 2 + 0.65, 5.29, z - 2.2);
          worldGroup.add(mast, arm, lamp);
        }

        // Architectural Multi-Tier City Buildings
        const bldgPalette =
          level.theme === 'sunset'
            ? [0x4b435f, 0x3b3352, 0x5c4b68]
            : [0x64748b, 0x475569, 0x71717a];
        const winMat = new THREE.MeshStandardMaterial({
          color: 0xbae6fd,
          emissive: level.theme === 'sunset' ? 0xfdba74 : 0xe0f2fe,
          emissiveIntensity: level.theme === 'sunset' ? 0.45 : 0.22,
          roughness: 0.15,
          metalness: 0.65,
        });
        const halfW = level.arenaWidth / 2;
        const halfL = level.arenaLength / 2;
        for (let i = 0; i < 20; i++) {
          const a = (i / 20) * Math.PI * 2;
          const dist = Math.max(halfW, halfL) + 16 + (i % 3) * 6;
          const bx = Math.cos(a) * dist;
          const bz = Math.sin(a) * dist;
          const bw = 6.5 + (i % 3) * 2.5;
          const bh = 11 + ((i * 5) % 18);
          const bMat = new THREE.MeshStandardMaterial({
            color: bldgPalette[i % bldgPalette.length],
            roughness: 0.78,
          });
          const b = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bw), bMat);
          b.position.set(bx, bh / 2 - 0.04, bz);
          worldGroup.add(b);

          // Window tiers & rooftop penthouse box
          for (let wy = 3.5; wy < bh - 1.5; wy += 3.2) {
            const band = new THREE.Mesh(new THREE.BoxGeometry(bw + 0.08, 0.9, bw + 0.08), winMat);
            band.position.set(bx, wy, bz);
            worldGroup.add(band);
          }
          const roofBox = new THREE.Mesh(new THREE.BoxGeometry(bw * 0.45, 1.4, bw * 0.45), bMat);
          roofBox.position.set(bx, bh + 0.66, bz);
          worldGroup.add(roofBox);
        }
      } else {
        const stripGeo = new THREE.BoxGeometry(0.4, 0.12, 5.0);
        const stripMat = new THREE.MeshBasicMaterial({ color: 0xe0f2fe });
        for (let x = -10; x <= 10; x += 10) {
          for (let z = -16; z <= 16; z += 8) {
            const s = new THREE.Mesh(stripGeo, stripMat);
            s.position.set(x, 4.2, z);
            worldGroup.add(s);
          }
        }
      }

      // 2. Playable Daylight Asphalt Pad with PBR Bump Depth
      const repX = Math.round(level.arenaWidth / 2.4);
      const repY = Math.round(level.arenaLength / 2.4);
      const asphaltTex = createAsphaltTexture(
        renderer,
        level.theme === 'basement' ? '#414957' : '#747b86',
        repX,
        repY,
      );
      const asphaltBump = createAsphaltBumpTexture(renderer, repX, repY);
      const lotGeo = new THREE.PlaneGeometry(level.arenaWidth, level.arenaLength);
      lotGeo.rotateX(-Math.PI / 2);
      const lotMat = new THREE.MeshStandardMaterial({
        map: asphaltTex,
        bumpMap: asphaltBump,
        bumpScale: 0.016,
        roughness: 0.88,
        metalness: 0.05,
      });
      const lotMesh = new THREE.Mesh(lotGeo, lotMat);
      lotMesh.position.y = 0;
      lotMesh.receiveShadow = true;
      worldGroup.add(lotMesh);

      // Perimeter crisp white parking-yard edge lines
      const lineMat = new THREE.MeshBasicMaterial({
        color: 0xf1f5f9,
        transparent: true,
        opacity: 0.72,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
      });
      const lineLenNS = level.arenaWidth - 1.4;
      const lineLenEW = level.arenaLength - 1.4;
      for (const lz of [-level.arenaLength / 2 + 0.7, level.arenaLength / 2 - 0.7]) {
        const l = new THREE.Mesh(new THREE.PlaneGeometry(lineLenNS, 0.14), lineMat);
        l.rotation.x = -Math.PI / 2;
        l.position.set(0, 0.015, lz);
        worldGroup.add(l);
      }
      for (const lx of [-level.arenaWidth / 2 + 0.7, level.arenaWidth / 2 - 0.7]) {
        const l = new THREE.Mesh(new THREE.PlaneGeometry(0.14, lineLenEW), lineMat);
        l.rotation.x = -Math.PI / 2;
        l.position.set(lx, 0.015, 0);
        worldGroup.add(l);
      }

      // 2b. Directional Road Arrows along every route
      pathArrows = [];
      const arrowTex = createRoadArrowTexture(renderer);
      const arrowGeo = new THREE.PlaneGeometry(2.0, 2.5);
      arrowGeo.rotateX(-Math.PI / 2);
      level.pathArrows.forEach((arr, idx) => {
        const arrowMat = new THREE.MeshBasicMaterial({
          map: arrowTex,
          transparent: true,
          opacity: 0.85,
          depthWrite: false,
          polygonOffset: true,
          polygonOffsetFactor: -1,
          polygonOffsetUnits: -1,
        });
        const arrowMesh = new THREE.Mesh(arrowGeo, arrowMat);
        arrowMesh.position.set(arr.x, 0.025, arr.z);
        arrowMesh.rotation.y = arr.rotation;
        worldGroup.add(arrowMesh);
        pathArrows.push({ mat: arrowMat, index: idx });
      });

      // 3. Chain-Link Fences along perimeter jersey barriers
      const chainTex = createChainLinkTexture(renderer);
      const fenceMat = new THREE.MeshStandardMaterial({
        map: chainTex,
        transparent: true,
        alphaTest: 0.2,
        side: THREE.DoubleSide,
        roughness: 0.4,
        metalness: 0.7,
      });
      const postMat = new THREE.MeshStandardMaterial({
        color: 0x94a3b8,
        roughness: 0.35,
        metalness: 0.75,
      });
      const addFenceRun = (x1: number, z1: number, x2: number, z2: number) => {
        const dx = x2 - x1;
        const dz = z2 - z1;
        const len = Math.hypot(dx, dz);
        const angle = Math.atan2(dx, dz);
        const panelTex = chainTex.clone();
        panelTex.needsUpdate = true;
        panelTex.repeat.set(Math.max(1, Math.round(len * 1.4)), 2);

        const panelMat = fenceMat.clone();
        panelMat.map = panelTex;

        const panel = new THREE.Mesh(new THREE.PlaneGeometry(len, 1.05), panelMat);
        panel.position.set((x1 + x2) / 2, 1.25, (z1 + z2) / 2);
        panel.rotation.y = angle + Math.PI / 2;
        worldGroup.add(panel);

        const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, len, 8), postMat);
        rail.rotation.z = Math.PI / 2;
        rail.rotation.y = -angle + Math.PI / 2;
        rail.position.set((x1 + x2) / 2, 1.76, (z1 + z2) / 2);
        worldGroup.add(rail);

        const postCount = Math.max(2, Math.floor(len / 3.0) + 1);
        const postGeo = new THREE.CylinderGeometry(0.04, 0.04, 1.12, 8);
        for (let i = 0; i < postCount; i++) {
          const t = i / (postCount - 1);
          const post = new THREE.Mesh(postGeo, postMat);
          post.position.set(x1 + dx * t, 1.24, z1 + dz * t);
          worldGroup.add(post);
        }
      };

      if (level.theme !== 'basement') {
        const hw = level.arenaWidth / 2 + 0.35;
        const hl = level.arenaLength / 2 + 0.35;
        addFenceRun(-hw, -hl, hw, -hl);
        addFenceRun(-hw, hl, hw, hl);
        addFenceRun(-hw, -hl, -hw, hl);
        addFenceRun(hw, -hl, hw, hl);
      }

      // 4. Optional Elevated Parking Platform + Twin Steel Ramps
      if (level.platform) {
        const p = level.platform;
        const deckTex = createPlatformDeckTexture(renderer);
        const deckMat = new THREE.MeshStandardMaterial({
          map: deckTex,
          roughness: 0.65,
          metalness: 0.22,
        });
        const legMat = new THREE.MeshStandardMaterial({
          color: 0x475569,
          roughness: 0.45,
          metalness: 0.72,
        });

        const deckSlab = new THREE.Mesh(
          new THREE.BoxGeometry(p.width, 0.16, p.length),
          deckMat,
        );
        deckSlab.position.set(p.x, p.height - 0.08, p.z);
        deckSlab.receiveShadow = true;
        deckSlab.castShadow = !isSoftwareGl;
        worldGroup.add(deckSlab);

        const legGeo = new THREE.BoxGeometry(0.22, p.height, 0.22);
        for (const lx of [-p.width / 2 + 0.22, p.width / 2 - 0.22]) {
          for (const lz of [-p.length / 2 + 0.22, p.length / 2 - 0.22]) {
            const leg = new THREE.Mesh(legGeo, legMat);
            leg.position.set(p.x + lx, p.height / 2 - 0.04, p.z + lz);
            worldGroup.add(leg);
          }
        }

        const rampTex = createSteelRampTexture(renderer);
        const rampMat = new THREE.MeshStandardMaterial({
          map: rampTex,
          roughness: 0.4,
          metalness: 0.7,
        });
        const rampSlopeLen = Math.hypot(p.rampLength, p.height);
        const rampAngle = Math.atan2(p.height, p.rampLength);
        const rampSouthZ = p.z + p.length / 2 + p.rampLength / 2;

        for (const rx of [-0.72, 0.72]) {
          const rampMesh = new THREE.Mesh(
            new THREE.BoxGeometry(0.68, 0.09, rampSlopeLen),
            rampMat,
          );
          rampMesh.position.set(p.x + rx, p.height / 2 - 0.03, rampSouthZ);
          rampMesh.rotation.x = rampAngle;
          rampMesh.receiveShadow = true;
          rampMesh.castShadow = !isSoftwareGl;
          worldGroup.add(rampMesh);
        }
      }

      // 5. Target Parking Bay Pad & Glowing Frame
      const bayY = level.bay.y ?? 0;
      const bayTex = createParkingBayTexture(renderer, level.bay.requiredDirection);
      const bayGeo = new THREE.PlaneGeometry(level.bay.width, level.bay.length);
      bayGeo.rotateX(-Math.PI / 2);
      const bayMat = new THREE.MeshBasicMaterial({
        map: bayTex,
        transparent: true,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      });
      const bayMesh = new THREE.Mesh(bayGeo, bayMat);
      bayMesh.position.set(level.bay.x, bayY + 0.028, level.bay.z);
      bayMesh.rotation.y = level.bay.rotation;
      worldGroup.add(bayMesh);

      const frameGeo = new THREE.EdgesGeometry(
        new THREE.BoxGeometry(level.bay.width + 0.12, 0.08, level.bay.length + 0.12),
      );
      bayRingMat = new THREE.MeshBasicMaterial({
        color: 0xfacc15,
        transparent: true,
        opacity: 0.85,
      });
      const bayFrame = new THREE.LineSegments(frameGeo, bayRingMat);
      bayFrame.position.set(level.bay.x, bayY + 0.06, level.bay.z);
      bayFrame.rotation.y = level.bay.rotation;
      worldGroup.add(bayFrame);

      // 6. Static Obstacles: Shipping Containers, Cones, Parked Cars, Speed Bumps, Precast Jersey Barriers
      staticBoxes = [];
      cones = [];
      speedBumps = [];

      const hazardTex = createHazardStripeTexture(renderer);
      const bumpTex = createSpeedBumpTexture(renderer);
      const concreteTex = createConcreteTexture(renderer, 10);
      const containerBumpTex = createContainerBumpTexture(renderer);
      const wallMat = new THREE.MeshStandardMaterial({
        map: concreteTex,
        roughness: 0.84,
        metalness: 0.06,
      });
      const curbMat = new THREE.MeshStandardMaterial({ map: hazardTex, roughness: 0.72 });
      const pillarMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.75 });
      const bumpMat = new THREE.MeshStandardMaterial({ map: bumpTex, roughness: 0.55 });
      const containerSteelMat = new THREE.MeshStandardMaterial({
        color: 0x1e293b,
        roughness: 0.42,
        metalness: 0.78,
      });

      const coneBaseGeo = new THREE.BoxGeometry(0.54, 0.06, 0.54);
      const coneBodyGeo = new THREE.ConeGeometry(0.21, 0.65, 12);
      const coneStripeGeo = new THREE.CylinderGeometry(0.1, 0.145, 0.17, 12);
      const coneOrangeMat = new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.36 });
      const coneWhiteMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.25 });

      for (const obs of level.staticObstacles) {
        if (obs.kind === 'cone') {
          const coneGroup = new THREE.Group();
          const base = new THREE.Mesh(
            coneBaseGeo,
            new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.7 }),
          );
          base.position.y = 0.03;
          const body = new THREE.Mesh(coneBodyGeo, coneOrangeMat);
          body.position.y = 0.35;
          body.castShadow = !isSoftwareGl;
          const stripe = new THREE.Mesh(coneStripeGeo, coneWhiteMat);
          stripe.position.y = 0.36;
          coneGroup.add(base, body, stripe);
          coneGroup.position.set(obs.x, 0, obs.z);
          worldGroup.add(coneGroup);
          cones.push({
            mesh: coneGroup,
            x: obs.x,
            z: obs.z,
            knocked: false,
            fallProgress: 0,
            fallDirX: 1,
            fallDirZ: 0,
          });
        } else if (obs.kind === 'speed-bump') {
          const bumpGeo = new THREE.CylinderGeometry(0.14, 0.19, obs.width, 12, 1, false, 0, Math.PI);
          bumpGeo.rotateZ(Math.PI / 2);
          bumpGeo.rotateX(-Math.PI / 2);
          const bumpMesh = new THREE.Mesh(bumpGeo, bumpMat);
          bumpMesh.position.set(obs.x, 0.01, obs.z);
          bumpMesh.rotation.y = obs.rotation;
          bumpMesh.receiveShadow = true;
          worldGroup.add(bumpMesh);
          speedBumps.push({
            x: obs.x,
            z: obs.z,
            halfW: obs.width / 2,
            halfL: obs.length / 2,
          });
        } else if (obs.kind === 'parked-car' || obs.kind === 'parked-mpv') {
          const npc = buildNpcCarMesh(
            obs.width,
            obs.length,
            obs.color || '#cbd5e1',
            isSoftwareGl,
            obs.kind === 'parked-mpv' ? 'mpv' : 'sedan',
          );
          npc.position.set(obs.x, 0, obs.z);
          npc.rotation.y = obs.rotation;
          worldGroup.add(npc);
          staticBoxes.push({
            x: obs.x,
            z: obs.z,
            halfW: obs.width / 2,
            halfL: obs.length / 2,
            rotation: obs.rotation,
          });
        } else if (obs.kind === 'container') {
          const h = obs.height ?? 2.6;
          const cGroup = new THREE.Group();
          const cTex = createContainerTexture(renderer, obs.color || '#b91c1c');
          const cMat = new THREE.MeshStandardMaterial({
            map: cTex,
            bumpMap: containerBumpTex,
            bumpScale: 0.045,
            roughness: 0.52,
            metalness: 0.36,
          });
          const box = new THREE.Mesh(new THREE.BoxGeometry(obs.width, h, obs.length), cMat);
          box.position.y = h / 2;
          box.castShadow = !isSoftwareGl;
          box.receiveShadow = true;
          cGroup.add(box);

          const railGeoX = new THREE.BoxGeometry(obs.width + 0.04, 0.1, 0.12);
          const railGeoZ = new THREE.BoxGeometry(0.12, 0.1, obs.length + 0.04);
          for (const ry of [0.06, h - 0.05]) {
            for (const rz of [-obs.length / 2, obs.length / 2]) {
              const r = new THREE.Mesh(railGeoX, containerSteelMat);
              r.position.set(0, ry, rz);
              cGroup.add(r);
            }
            for (const rx of [-obs.width / 2, obs.width / 2]) {
              const r = new THREE.Mesh(railGeoZ, containerSteelMat);
              r.position.set(rx, ry, 0);
              cGroup.add(r);
            }
          }

          const lockSideZ = obs.length >= obs.width ? obs.length / 2 + 0.025 : 0;
          if (lockSideZ > 0) {
            const barGeo = new THREE.CylinderGeometry(0.025, 0.025, h - 0.22, 8);
            for (const bx of [-0.35, 0.35]) {
              const bar = new THREE.Mesh(barGeo, containerSteelMat);
              bar.position.set(bx, h / 2, lockSideZ);
              cGroup.add(bar);
            }
          }

          cGroup.position.set(obs.x, 0, obs.z);
          cGroup.rotation.y = obs.rotation;
          worldGroup.add(cGroup);

          staticBoxes.push({
            x: obs.x,
            z: obs.z,
            halfW: obs.width / 2,
            halfL: obs.length / 2,
            rotation: obs.rotation,
          });
        } else if (obs.kind === 'wall') {
          // Two-step tapered precast concrete Jersey barrier!
          const h = obs.height ?? 0.75;
          const wallGroup = new THREE.Group();
          const base = new THREE.Mesh(
            new THREE.BoxGeometry(obs.width, h * 0.36, obs.length),
            wallMat,
          );
          base.position.y = h * 0.18;
          base.receiveShadow = true;
          const upper = new THREE.Mesh(
            new THREE.BoxGeometry(
              obs.width > 1.5 ? obs.width : obs.width * 0.65,
              h * 0.66,
              obs.length > 1.5 ? obs.length : obs.length * 0.65,
            ),
            wallMat,
          );
          upper.position.y = h * 0.67;
          upper.castShadow = !isSoftwareGl;
          upper.receiveShadow = true;
          wallGroup.add(base, upper);
          wallGroup.position.set(obs.x, 0, obs.z);
          wallGroup.rotation.y = obs.rotation;
          worldGroup.add(wallGroup);

          staticBoxes.push({
            x: obs.x,
            z: obs.z,
            halfW: obs.width / 2,
            halfL: obs.length / 2,
            rotation: obs.rotation,
          });
        } else {
          const h = obs.height ?? (obs.kind === 'curb' ? 0.45 : 3.4);
          const geo = new THREE.BoxGeometry(obs.width, h, obs.length);
          const mat = obs.kind === 'curb' ? curbMat : pillarMat;
          const mesh = new THREE.Mesh(geo, mat);
          mesh.position.set(obs.x, h / 2, obs.z);
          mesh.rotation.y = obs.rotation;
          mesh.castShadow = !isSoftwareGl;
          mesh.receiveShadow = true;
          worldGroup.add(mesh);

          if (obs.kind === 'pillar') {
            const band = new THREE.Mesh(
              new THREE.BoxGeometry(obs.width + 0.05, 0.36, obs.length + 0.05),
              curbMat,
            );
            band.position.set(obs.x, 0.85, obs.z);
            worldGroup.add(band);
          }

          staticBoxes.push({
            x: obs.x,
            z: obs.z,
            halfW: obs.width / 2,
            halfL: obs.length / 2,
            rotation: obs.rotation,
          });
        }
      }

      // 7. Moving Obstacles
      movingObstacles = [];
      const gateMat = new THREE.MeshStandardMaterial({ map: hazardTex, roughness: 0.5 });
      for (const m of level.movingObstacles) {
        let mesh: THREE.Object3D;
        if (m.kind === 'patrol-car') {
          mesh = buildNpcCarMesh(m.width, m.length, m.color || '#eab308', isSoftwareGl, 'sedan');
        } else {
          const h = m.height || 1.1;
          const gateGroup = new THREE.Group();
          const bar = new THREE.Mesh(new THREE.BoxGeometry(m.width, 0.32, m.length), gateMat);
          bar.position.y = h * 0.72;
          bar.castShadow = !isSoftwareGl;
          const postL = new THREE.Mesh(new THREE.BoxGeometry(0.3, h, 0.4), wallMat);
          postL.position.set(-m.width / 2 + 0.2, h / 2, 0);
          const postR = postL.clone();
          postR.position.x = m.width / 2 - 0.2;
          gateGroup.add(bar, postL, postR);
          mesh = gateGroup;
        }
        mesh.position.set(m.x, 0, m.z);
        mesh.rotation.y = m.rotation;
        worldGroup.add(mesh);
        movingObstacles.push({
          mesh,
          baseX: m.x,
          baseZ: m.z,
          axis: m.axis,
          range: m.range,
          speed: m.speed,
          phase: m.phase || 0,
          width: m.width,
          length: m.length,
          rotation: m.rotation,
          curX: m.x,
          curZ: m.z,
        });
      }

      // 8. Golden Coin Pickups
      coins = [];
      const coinGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.1, 20);
      coinGeo.rotateX(Math.PI / 2);
      const coinMat = new THREE.MeshStandardMaterial({
        color: 0xfbbf24,
        emissive: 0xd97706,
        emissiveIntensity: 0.4,
        metalness: 0.88,
        roughness: 0.18,
      });
      for (const c of level.coins) {
        const g = new THREE.Group();
        const disc = new THREE.Mesh(coinGeo, coinMat);
        disc.position.y = 0.75;
        g.add(disc);
        g.position.set(c.x, 0, c.z);
        worldGroup.add(g);
        coins.push({ mesh: g, x: c.x, z: c.z, value: c.value, collected: false });
      }

      // 9. Build Player Car Rig
      carRig = buildPlayerCarRig(carDef, cfg.customization, isSoftwareGl);
      carX = level.spawn.x;
      carY = 0;
      carZ = level.spawn.z;
      carYaw = level.spawn.rotation;
      carSpeed = 0;
      steerAngle = 0;
      wheelSpinAngle = 0;
      health = carDef.durability;
      hitsTaken = 0;
      invulnTimer = 0;
      elapsedTime = 0;
      parkHoldTimer = 0;
      coinsCollectedInRun = 0;
      runEnded = false;
      shakeIntensity = 0;

      glanceYawOffset = 0;
      glancePitchOffset = 0;
      freeOrbitYaw = carYaw + 0.45;
      freeOrbitPitch = 0.42;
      freeOrbitDistance = 7.2;

      carRig.setInteriorView(cameraModeRef.current === 'interior');
      carRig.root.position.set(carX, 0, carZ);
      carRig.root.rotation.y = carYaw;
      worldGroup.add(carRig.root);

      sunLight.position.set(carX + 18, 36, carZ + 20);
      sunLight.target.position.set(carX, 0, carZ);
      sunLight.target.updateMatrixWorld();

      const bx = Math.sin(carYaw);
      const bz = Math.cos(carYaw);
      camera.position.set(carX + bx * 5.6, 3.6, carZ + bz * 5.6);
      _camLookCurrent.set(carX - bx * 4.5, 0.6, carZ - bz * 4.5);
      camera.lookAt(_camLookCurrent);

      if (!isSoftwareGl) {
        renderer.compile(scene, camera);
      }
    };

    rebuildFnRef.current = buildLevelAndCar;
    buildLevelAndCar();

    const dom = renderer.domElement;
    const onCanvasPointerDown = (e: PointerEvent) => {
      if (inputRef.current.paused) return;
      soundEngine.unlock();
      isPointerLooking = true;
      activeLookPointerId = e.pointerId;
      prevLookX = e.clientX;
      prevLookY = e.clientY;
      glanceHoldTimer = 1.1;
      dom.setPointerCapture(e.pointerId);
    };

    const onCanvasPointerMove = (e: PointerEvent) => {
      if (!isPointerLooking || activeLookPointerId !== e.pointerId) return;
      const dx = e.clientX - prevLookX;
      const dy = e.clientY - prevLookY;
      prevLookX = e.clientX;
      prevLookY = e.clientY;
      glanceHoldTimer = 1.1;

      if (cameraModeRef.current === 'free') {
        freeOrbitYaw -= dx * 0.0085;
        freeOrbitPitch = THREE.MathUtils.clamp(freeOrbitPitch + dy * 0.0065, 0.1, 1.32);
      } else if (cameraModeRef.current === 'interior') {
        glanceYawOffset = THREE.MathUtils.clamp(glanceYawOffset - dx * 0.0065, -1.65, 1.65);
        glancePitchOffset = THREE.MathUtils.clamp(glancePitchOffset - dy * 0.004, -0.42, 0.48);
      } else {
        glanceYawOffset = THREE.MathUtils.clamp(glanceYawOffset - dx * 0.007, -1.9, 1.9);
        glancePitchOffset = THREE.MathUtils.clamp(glancePitchOffset + dy * 0.0045, -0.35, 0.75);
      }
    };

    const onCanvasPointerUp = (e: PointerEvent) => {
      if (activeLookPointerId !== e.pointerId) return;
      isPointerLooking = false;
      activeLookPointerId = null;
    };

    const onCanvasWheel = (e: WheelEvent) => {
      if (cameraModeRef.current === 'free') {
        e.preventDefault();
        freeOrbitDistance = THREE.MathUtils.clamp(freeOrbitDistance + e.deltaY * 0.006, 3.8, 15.0);
      }
    };

    dom.addEventListener('pointerdown', onCanvasPointerDown);
    dom.addEventListener('pointermove', onCanvasPointerMove);
    dom.addEventListener('pointerup', onCanvasPointerUp);
    dom.addEventListener('pointercancel', onCanvasPointerUp);
    dom.addEventListener('wheel', onCanvasWheel, { passive: false });

    const onLost = (e: Event) => {
      e.preventDefault();
      callbacksRef.current.onContextError?.();
    };
    dom.addEventListener('webglcontextlost', onLost);

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    let frameId = 0;
    let disposed = false;
    let lastTimeMs = performance.now();
    let hudEmitTimer = 0;

    const registerTimer = (id: number) => {
      frameId = id;
    };

    const stepSimulation = (dt: number, nowSec: number) => {
      if (!carRig) return;
      const input = inputRef.current;

      for (const coin of coins) {
        if (!coin.collected) {
          coin.mesh.rotation.y += dt * 2.6;
          coin.mesh.position.y = Math.sin(nowSec * 3.2 + coin.x) * 0.1;
        }
      }
      if (bayRingMat) {
        bayRingMat.opacity = 0.65 + Math.sin(nowSec * 3.5) * 0.25;
      }
      for (const arr of pathArrows) {
        arr.mat.opacity = 0.58 + 0.34 * Math.max(0, Math.sin(nowSec * 3.6 - arr.index * 0.85));
      }

      if (input.paused || runEnded) {
        soundEngine.updateEngine(0, false);
        return;
      }

      elapsedTime += dt;
      if (invulnTimer > 0) invulnTimer = Math.max(0, invulnTimer - dt);
      if (shakeIntensity > 0) shakeIntensity = Math.max(0, shakeIntensity - dt * 3.5);

      for (const m of movingObstacles) {
        const offset = Math.sin(nowSec * m.speed + m.phase) * m.range;
        m.curX = m.baseX + (m.axis === 'x' ? offset : 0);
        m.curZ = m.baseZ + (m.axis === 'z' ? offset : 0);
        m.mesh.position.set(m.curX, 0, m.curZ);
      }

      for (const c of cones) {
        if (c.knocked && c.fallProgress < 1) {
          c.fallProgress = Math.min(1, c.fallProgress + dt * 5.2);
          c.mesh.rotation.z = -c.fallDirX * c.fallProgress * (Math.PI / 2.1);
          c.mesh.rotation.x = c.fallDirZ * c.fallProgress * (Math.PI / 2.1);
        }
      }

      const cust = activeConfigRef.current.customization;
      const topSpeed = carDef.maxSpeed * (1 + (cust.speedLevel - 1) * 0.1);
      const accel = carDef.acceleration * (1 + (cust.speedLevel - 1) * 0.14);
      const maxSteer = carDef.maxSteerAngle * (1 + (cust.handlingLevel - 1) * 0.08);
      const steerRate = carDef.turnSpeed * (1 + (cust.handlingLevel - 1) * 0.18);

      const targetSteer = input.steerTarget * maxSteer;
      steerAngle = THREE.MathUtils.damp(steerAngle, targetSteer, steerRate * 4.5, dt);

      const reverseMax = topSpeed * 0.52;
      if (input.gear === 'P') {
        const parkDecel = accel * 2.8 * dt;
        if (Math.abs(carSpeed) <= parkDecel) carSpeed = 0;
        else carSpeed -= Math.sign(carSpeed) * parkDecel;
      } else if (input.brake) {
        if (Math.abs(carSpeed) < 0.25) {
          carSpeed = 0;
        } else {
          const decel = accel * 1.95 * dt;
          carSpeed -= Math.sign(carSpeed) * Math.min(Math.abs(carSpeed), decel);
        }
      } else if (input.gas && input.gear !== 'N') {
        if (input.gear === 'D') {
          if (carSpeed < 0) carSpeed = Math.min(0, carSpeed + accel * 2.1 * dt);
          else carSpeed = Math.min(topSpeed, carSpeed + accel * dt);
        } else if (input.gear === 'R') {
          if (carSpeed > 0) carSpeed = Math.max(0, carSpeed - accel * 2.1 * dt);
          else carSpeed = Math.max(-reverseMax, carSpeed - accel * 0.82 * dt);
        }
      } else {
        const drag = input.gear === 'N' ? 1.6 * dt : 3.0 * dt;
        if (Math.abs(carSpeed) <= drag) carSpeed = 0;
        else carSpeed -= Math.sign(carSpeed) * drag;
      }

      if (Math.abs(carSpeed) > 0.03) {
        const angularVel = -(carSpeed / carDef.wheelbase) * Math.tan(steerAngle);
        carYaw += angularVel * dt;
      }

      const fwdX = -Math.sin(carYaw);
      const fwdZ = -Math.cos(carYaw);
      carX += fwdX * carSpeed * dt;
      carZ += fwdZ * carSpeed * dt;

      const limitX = level.arenaWidth / 2 - 0.5;
      const limitZ = level.arenaLength / 2 - 0.5;
      carX = Math.max(-limitX, Math.min(limitX, carX));
      carZ = Math.max(-limitZ, Math.min(limitZ, carZ));

      let targetSurfaceY = 0;
      let targetSlopePitch = 0;
      if (level.platform) {
        const p = level.platform;
        const deckN = p.z - p.length / 2;
        const deckS = p.z + p.length / 2;
        const rampEnd = deckS + p.rampLength;
        const withinW = Math.abs(carX - p.x) <= p.width / 2 + 0.25;

        if (withinW && carZ >= deckN - 0.4 && carZ <= deckS) {
          targetSurfaceY = p.height;
          const sideLimit = p.width / 2 - carDef.width / 2 + 0.15;
          if (Math.abs(carX - p.x) > sideLimit) {
            carX = p.x + Math.sign(carX - p.x) * sideLimit;
          }
        } else if (withinW && carZ > deckS && carZ <= rampEnd) {
          const t = 1 - (carZ - deckS) / p.rampLength;
          targetSurfaceY = Math.max(0, Math.min(p.height, t * p.height));
          targetSlopePitch = Math.atan2(p.height, p.rampLength) * Math.cos(carYaw);
        }
      }

      let bumpLift = 0;
      for (const b of speedBumps) {
        if (Math.abs(carX - b.x) < b.halfW && Math.abs(carZ - b.z) < b.halfL + 0.35) {
          const d = Math.abs(carZ - b.z) / (b.halfL + 0.35);
          bumpLift = Math.max(bumpLift, (1 - d) * 0.14);
        }
      }

      carY = THREE.MathUtils.damp(carY, targetSurfaceY + bumpLift, 14, dt);

      const carObb: OBB = {
        x: carX,
        z: carZ,
        halfW: carDef.width / 2 - 0.06,
        halfL: carDef.length / 2 - 0.06,
        rotation: carYaw,
      };

      for (const cone of cones) {
        if (cone.knocked) continue;
        const dx = cone.x - carX;
        const dz = cone.z - carZ;
        if (dx * dx + dz * dz < 4.5) {
          const res = testOBBCollision(carObb, {
            x: cone.x,
            z: cone.z,
            halfW: 0.24,
            halfL: 0.24,
            rotation: 0,
          });
          if (res.collided) {
            cone.knocked = true;
            const len = Math.hypot(dx, dz) || 1;
            cone.fallDirX = dx / len;
            cone.fallDirZ = dz / len;
            carSpeed *= 0.72;
            soundEngine.playConeBump();
          }
        }
      }

      let minSensorDist = 99;
      let sensorRL = 99;
      let sensorRR = 99;
      let sensorFL = 99;
      let sensorFR = 99;
      let collidedHard = false;
      let pushX = 0;
      let pushZ = 0;

      const cosY = Math.cos(carYaw);
      const sinY = Math.sin(carYaw);
      const hw = carDef.width * 0.42;
      const hl = carDef.length * 0.48;

      const rlProbe: OBB = {
        x: carX - hw * cosY + hl * sinY,
        z: carZ + hw * sinY + hl * cosY,
        halfW: 0.15,
        halfL: 0.15,
        rotation: 0,
      };
      const rrProbe: OBB = {
        x: carX + hw * cosY + hl * sinY,
        z: carZ - hw * sinY + hl * cosY,
        halfW: 0.15,
        halfL: 0.15,
        rotation: 0,
      };
      const flProbe: OBB = {
        x: carX - hw * cosY - hl * sinY,
        z: carZ + hw * sinY - hl * cosY,
        halfW: 0.15,
        halfL: 0.15,
        rotation: 0,
      };
      const frProbe: OBB = {
        x: carX + hw * cosY - hl * sinY,
        z: carZ - hw * sinY - hl * cosY,
        halfW: 0.15,
        halfL: 0.15,
        rotation: 0,
      };

      const checkAgainstBox = (box: OBB) => {
        const dAll = distanceOBBApprox(carObb, box);
        if (dAll < minSensorDist) minSensorDist = dAll;

        sensorRL = Math.min(sensorRL, distanceOBBApprox(rlProbe, box));
        sensorRR = Math.min(sensorRR, distanceOBBApprox(rrProbe, box));
        sensorFL = Math.min(sensorFL, distanceOBBApprox(flProbe, box));
        sensorFR = Math.min(sensorFR, distanceOBBApprox(frProbe, box));

        const res = testOBBCollision(carObb, box);
        if (res.collided) {
          collidedHard = true;
          pushX += res.mtvX;
          pushZ += res.mtvZ;
        }
      };

      for (const box of staticBoxes) checkAgainstBox(box);
      for (const m of movingObstacles) {
        checkAgainstBox({
          x: m.curX,
          z: m.curZ,
          halfW: m.width / 2,
          halfL: m.length / 2,
          rotation: m.rotation,
        });
      }

      if (collidedHard) {
        carX += pushX * 1.06;
        carZ += pushZ * 1.06;
        carSpeed = -Math.sign(carSpeed || 1) * Math.min(2.2, Math.abs(carSpeed) * 0.4 + 0.8);
        shakeIntensity = 0.25;

        if (invulnTimer <= 0) {
          invulnTimer = 0.85;
          health = Math.max(0, health - 1);
          hitsTaken += 1;
          soundEngine.playCrash();
          if (health <= 0) {
            runEnded = true;
            soundEngine.stopEngine();
            callbacksRef.current.onCrash();
          }
        }
      }

      for (const coin of coins) {
        if (coin.collected) continue;
        const dx = carX - coin.x;
        const dz = carZ - coin.z;
        if (dx * dx + dz * dz < 2.2) {
          coin.collected = true;
          coin.mesh.visible = false;
          coinsCollectedInRun += coin.value;
          soundEngine.playCoin();
        }
      }

      // Visual Car Rig + Live Cockpit Gauge Needle Updates
      carRig.root.position.set(carX, carY, carZ);
      carRig.root.rotation.y = carYaw;
      carRig.frontLeftPivot.rotation.y = -steerAngle;
      carRig.frontRightPivot.rotation.y = -steerAngle;
      carRig.cockpitWheel.rotation.z = -steerAngle * 4.5;
      const speedRatio = Math.min(1, Math.abs(carSpeed) / topSpeed);
      carRig.cockpitSpeedNeedle.rotation.z = THREE.MathUtils.lerp(2.15, -2.1, speedRatio);

      wheelSpinAngle -= (carSpeed * dt) / 0.34;
      for (const w of carRig.wheelsSpin) {
        w.rotation.x = wheelSpinAngle;
      }

      const targetRoll = (steerAngle / maxSteer) * (carSpeed / topSpeed) * 0.045;
      const targetPitch =
        targetSlopePitch +
        (input.brake && Math.abs(carSpeed) > 0.5 ? -0.025 : input.gas ? 0.018 : 0) +
        bumpLift * 0.25;
      carRig.bodyTiltGroup.rotation.z = THREE.MathUtils.damp(carRig.bodyTiltGroup.rotation.z, targetRoll, 9, dt);
      carRig.bodyTiltGroup.rotation.x = THREE.MathUtils.damp(carRig.bodyTiltGroup.rotation.x, targetPitch, 10, dt);

      carRig.brakeMat.emissiveIntensity =
        input.brake || input.gear === 'P' || Math.abs(carSpeed) < 0.2 ? 1.8 : 0.45;
      carRig.reverseMat.emissiveIntensity = input.gear === 'R' ? 1.8 : 0.0;

      sunLight.position.set(carX + 18, 36, carZ + 20);
      sunLight.target.position.set(carX, 0, carZ);
      sunLight.target.updateMatrixWorld();

      soundEngine.updateEngine(speedRatio, !runEnded && input.gear !== 'P');
      if (sensorEnabledRef.current) {
        soundEngine.updateParkingSensor(minSensorDist, Math.abs(carSpeed) > 0.15 && !runEnded);
      }

      carObb.x = carX;
      carObb.z = carZ;
      carObb.rotation = carYaw;
      const bayRes = evaluateParkingBay(carObb, level.bay);

      let parkStatus: HudTelemetry['parkStatus'] = 'driving';
      const holdRequired = input.gear === 'P' ? 0.35 : 1.0;
      if (bayRes.inside && Math.abs(carSpeed) < 0.48) {
        parkStatus = 'hold-steady';
        parkHoldTimer += dt;
        if (parkHoldTimer >= holdRequired && !runEnded) {
          parkStatus = 'parked';
          runEnded = true;
          soundEngine.stopEngine();
          soundEngine.playLevelWin();
          callbacksRef.current.onLevelComplete({
            time: elapsedTime,
            hits: hitsTaken,
            bonusCoins: coinsCollectedInRun,
          });
        }
      } else {
        parkHoldTimer = Math.max(0, parkHoldTimer - dt * 1.8);
        if (!bayRes.directionValid) {
          parkStatus = 'wrong-direction';
        } else if (bayRes.progress > 0.25) {
          parkStatus = 'aligning';
        }
      }

      const mode = cameraModeRef.current;
      if (mode !== prevCameraMode) {
        carRig.setInteriorView(mode === 'interior');
        glanceYawOffset = 0;
        glancePitchOffset = 0;
        if (mode === 'free') {
          freeOrbitYaw = carYaw + 0.45;
          freeOrbitPitch = 0.42;
        }
        const desiredNear = mode === 'interior' ? 0.08 : 0.2;
        if (camera.near !== desiredNear) {
          camera.near = desiredNear;
          camera.updateProjectionMatrix();
        }
        prevCameraMode = mode;
      }

      if (!isPointerLooking && mode !== 'free') {
        if (glanceHoldTimer > 0) {
          glanceHoldTimer = Math.max(0, glanceHoldTimer - dt);
        } else {
          glanceYawOffset = THREE.MathUtils.damp(glanceYawOffset, 0, 4.5, dt);
          glancePitchOffset = THREE.MathUtils.damp(glancePitchOffset, 0, 4.5, dt);
        }
      }

      const bx = Math.sin(carYaw);
      const bz = Math.cos(carYaw);

      if (mode === 'interior') {
        const localEyeX = -0.36;
        const localEyeZ = 0.14;
        const eyeX = carX + localEyeX * cosY + localEyeZ * sinY;
        const eyeZ = carZ - localEyeX * sinY + localEyeZ * cosY;
        const eyeY = carY + carDef.height * 0.77 + targetSlopePitch * 0.1;

        const lookYaw = carYaw + glanceYawOffset;
        const lookFwdX = -Math.sin(lookYaw);
        const lookFwdZ = -Math.cos(lookYaw);

        _camDesiredPos.set(eyeX, eyeY, eyeZ);
        _camDesiredLook.set(
          eyeX + lookFwdX * 8.0,
          eyeY - 0.15 + glancePitchOffset * 5.0,
          eyeZ + lookFwdZ * 8.0,
        );
      } else if (mode === 'free') {
        const horiz = freeOrbitDistance * Math.cos(freeOrbitPitch);
        _camDesiredPos.set(
          carX + Math.sin(freeOrbitYaw) * horiz,
          carY + 0.9 + Math.sin(freeOrbitPitch) * freeOrbitDistance,
          carZ + Math.cos(freeOrbitYaw) * horiz,
        );
        _camDesiredLook.set(carX, carY + 0.85, carZ);
      } else if (mode === 'cam2') {
        const yaw = carYaw + glanceYawOffset;
        _camDesiredPos.set(
          carX + Math.sin(yaw) * 3.2,
          15.8 + glancePitchOffset * 4.0,
          carZ + Math.cos(yaw) * 3.2,
        );
        _camDesiredLook.set(carX, carY, carZ);
      } else {
        const isRev = mode === 'auto' && input.gear === 'R';
        const distBack = isRev ? 6.6 : 5.6;
        const heightUp = (isRev ? 4.4 : 3.55) + glancePitchOffset * 2.2;
        const chaseYaw = carYaw + glanceYawOffset;
        _camDesiredPos.set(
          carX + Math.sin(chaseYaw) * distBack,
          carY + Math.max(1.3, heightUp),
          carZ + Math.cos(chaseYaw) * distBack,
        );
        _camDesiredLook.set(carX - bx * 3.6, carY + 0.65, carZ - bz * 3.6);
      }

      if (shakeIntensity > 0.01) {
        _camDesiredPos.x += (Math.random() - 0.5) * shakeIntensity;
        _camDesiredPos.y += (Math.random() - 0.5) * shakeIntensity * 0.6;
      }

      if (mode === 'interior') {
        camera.position.copy(_camDesiredPos);
        _camLookCurrent.copy(_camDesiredLook);
        camera.lookAt(_camLookCurrent);
      } else {
        const camLambda = mode === 'free' ? 14 : 7.8;
        camera.position.x = THREE.MathUtils.damp(camera.position.x, _camDesiredPos.x, camLambda, dt);
        camera.position.y = THREE.MathUtils.damp(camera.position.y, _camDesiredPos.y, camLambda, dt);
        camera.position.z = THREE.MathUtils.damp(camera.position.z, _camDesiredPos.z, camLambda, dt);

        _camLookCurrent.x = THREE.MathUtils.damp(_camLookCurrent.x, _camDesiredLook.x, camLambda + 2, dt);
        _camLookCurrent.y = THREE.MathUtils.damp(_camLookCurrent.y, _camDesiredLook.y, camLambda + 2, dt);
        _camLookCurrent.z = THREE.MathUtils.damp(_camLookCurrent.z, _camDesiredLook.z, camLambda + 2, dt);
        camera.lookAt(_camLookCurrent);
      }

      hudEmitTimer += dt;
      if (hudEmitTimer >= 0.065 || runEnded) {
        hudEmitTimer = 0;
        callbacksRef.current.onTelemetry({
          speedKmh: Math.round(Math.abs(carSpeed) * 6.5),
          gear: input.gear,
          steerNorm: steerAngle / maxSteer,
          elapsedTime,
          health,
          maxHealth: carDef.durability,
          parkProgress:
            parkStatus === 'hold-steady' || parkStatus === 'parked'
              ? Math.min(1, parkHoldTimer / holdRequired)
              : bayRes.progress,
          parkStatus,
          sensorDistance: minSensorDist,
          sensorRearLeft: sensorRL,
          sensorRearRight: sensorRR,
          sensorFrontLeft: sensorFL,
          sensorFrontRight: sensorFR,
          coinsCollectedInRun,
        });
      }
    };

    const tick = () => {
      if (disposed) return;
      const nowMs = performance.now();
      const dt = Math.min(0.05, Math.max(0.001, (nowMs - lastTimeMs) / 1000));
      lastTimeMs = nowMs;

      if (!inputRef.current.paused) {
        stepSimulation(dt, nowMs / 1000);
        renderer.render(scene, camera);
      } else {
        soundEngine.updateEngine(0, false);
      }

      if (isSoftwareGl) {
        afterSoftwareDraw(renderer, tick, registerTimer);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    };

    if (isSoftwareGl) {
      renderer.render(scene, camera);
      afterSoftwareDraw(renderer, tick, registerTimer);
    } else {
      frameId = requestAnimationFrame(tick);
    }

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      soundEngine.stopEngine();
      window.removeEventListener('resize', handleResize);
      dom.removeEventListener('pointerdown', onCanvasPointerDown);
      dom.removeEventListener('pointermove', onCanvasPointerMove);
      dom.removeEventListener('pointerup', onCanvasPointerUp);
      dom.removeEventListener('pointercancel', onCanvasPointerUp);
      dom.removeEventListener('wheel', onCanvasWheel);
      dom.removeEventListener('webglcontextlost', onLost);
      disposeObject3D(worldGroup);
      envTex.dispose();
      renderer.dispose();
      if (dom.parentElement === container) {
        container.removeChild(dom);
      }
      rebuildFnRef.current = null;
    };
  }, []);

  useEffect(() => {
    rebuildFnRef.current?.();
  }, [levelId, carId, customization, restartNonce]);

  return (
    <div
      ref={mountRef}
      className="w-full h-full relative bg-[#8bb6e2] overflow-hidden"
      aria-label="3D Car Parking Arena"
    />
  );
};
