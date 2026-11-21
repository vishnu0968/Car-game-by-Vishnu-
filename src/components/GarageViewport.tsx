import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
import { buildPlayerCarRig } from '../game/carBuilder';
import { getCarById } from '../game/catalog';
import { CarCustomization, CarId } from '../game/types';
import {
  afterSoftwareDraw,
  applyStudioEnvironment,
  createStudioRenderer,
  detectSoftwareWebGL,
  disposeObject3D,
} from '../game/webglUtils';

interface GarageViewportProps {
  carId: CarId;
  customization: CarCustomization;
}

export const GarageViewport: React.FC<GarageViewportProps> = ({ carId, customization }) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const carPropsRef = useRef({ carId, customization });
  carPropsRef.current = { carId, customization };

  const rebuildCarRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isSoftwareGl = detectSoftwareWebGL();
    const renderer = createStudioRenderer(container, isSoftwareGl);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b0e14);
    scene.fog = new THREE.FogExp2(0x0b0e14, 0.032);
    const envTex = applyStudioEnvironment(renderer, scene);

    const camera = new THREE.PerspectiveCamera(
      42,
      (container.clientWidth || 640) / (container.clientHeight || 400),
      0.1,
      100,
    );
    camera.position.set(4.5, 2.2, 5.2);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enablePan = false;
    controls.minDistance = 3.4;
    controls.maxDistance = 8.5;
    controls.minPolarAngle = 0.25;
    controls.maxPolarAngle = Math.PI / 2 - 0.06;
    controls.target.set(0, 0.7, 0);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.06;
    controls.autoRotate = !isSoftwareGl;
    controls.autoRotateSpeed = 1.1;

    // 3-Point Studio Showroom Lighting + Softbox Strip
    const hemi = new THREE.HemisphereLight(0xdbeafe, 0x1e293b, 0.75);
    scene.add(hemi);

    const keyLight = new THREE.DirectionalLight(0xfff4e0, 1.85);
    keyLight.position.set(5, 8, 5);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.left = -4;
    keyLight.shadow.camera.right = 4;
    keyLight.shadow.camera.top = 4;
    keyLight.shadow.camera.bottom = -4;
    keyLight.shadow.bias = -0.0005;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.9);
    rimLight.position.set(-5, 4, -5);
    scene.add(rimLight);

    if (!isSoftwareGl) {
      RectAreaLightUniformsLib.init();
      const softbox = new THREE.RectAreaLight(0xffffff, 3.2, 4.5, 2.0);
      softbox.position.set(0, 4.4, 0);
      softbox.lookAt(0, 0.6, 0);
      scene.add(softbox);
    }

    // Showroom Floor & Turntable Disc
    const floorGeo = new THREE.PlaneGeometry(60, 60);
    floorGeo.rotateX(-Math.PI / 2);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x0f141e,
      roughness: 0.35,
      metalness: 0.45,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.position.y = -0.04;
    floor.receiveShadow = true;
    scene.add(floor);

    const podiumGeo = new THREE.CylinderGeometry(3.2, 3.35, 0.08, 48);
    const podiumMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.28,
      metalness: 0.65,
    });
    const podium = new THREE.Mesh(podiumGeo, podiumMat);
    podium.position.y = -0.04;
    podium.receiveShadow = true;
    scene.add(podium);

    const ringGeo = new THREE.RingGeometry(3.15, 3.23, 64);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.y = 0.004;
    scene.add(ring);

    const carSlot = new THREE.Group();
    scene.add(carSlot);

    let frameId = 0;
    let disposed = false;
    let renderBusy = false;
    let renderDirty = false;

    const registerTimer = (id: number) => {
      frameId = id;
    };

    const requestRender = () => {
      if (disposed) return;
      if (!isSoftwareGl) return; // Continuous rAF handles GPU mode smoothly
      if (renderBusy) {
        renderDirty = true;
        return;
      }
      renderBusy = true;
      frameId = requestAnimationFrame(() => {
        if (disposed) return;
        renderDirty = false;
        controls.update();
        renderer.render(scene, camera);
        afterSoftwareDraw(
          renderer,
          () => {
            renderBusy = false;
            if (renderDirty) requestRender();
          },
          registerTimer,
        );
      });
    };

    const rebuildCar = () => {
      while (carSlot.children.length > 0) {
        const old = carSlot.children[0];
        carSlot.remove(old);
        disposeObject3D(old);
      }
      const { carId: cid, customization: cust } = carPropsRef.current;
      const carDef = getCarById(cid);
      const rig = buildPlayerCarRig(carDef, cust, isSoftwareGl);
      carSlot.add(rig.root);
      if (isSoftwareGl) {
        requestRender();
      }
    };

    rebuildCarRef.current = rebuildCar;
    rebuildCar();

    controls.addEventListener('change', () => {
      if (isSoftwareGl) requestRender();
    });

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || 640;
      const h = container.clientHeight || 400;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      if (isSoftwareGl) requestRender();
    };
    window.addEventListener('resize', handleResize);

    if (!isSoftwareGl) {
      const tick = () => {
        if (disposed) return;
        controls.update();
        renderer.render(scene, camera);
        frameId = requestAnimationFrame(tick);
      };
      frameId = requestAnimationFrame(tick);
    } else {
      requestRender();
    }

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      window.removeEventListener('resize', handleResize);
      controls.dispose();
      disposeObject3D(carSlot);
      envTex.dispose();
      renderer.dispose();
      if (renderer.domElement.parentElement === container) {
        container.removeChild(renderer.domElement);
      }
      rebuildCarRef.current = null;
    };
  }, []);

  useEffect(() => {
    rebuildCarRef.current?.();
  }, [carId, customization]);

  return (
    <div
      ref={mountRef}
      className="w-full h-full relative bg-[#0b0e14] overflow-hidden cursor-grab active:cursor-grabbing"
      aria-label="3D Garage Showroom"
    />
  );
};
