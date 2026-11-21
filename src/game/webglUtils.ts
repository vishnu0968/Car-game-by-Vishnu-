import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { EnvironmentTheme } from './types';

export function detectSoftwareWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

export function createStudioRenderer(
  container: HTMLElement,
  isSoftwareGl: boolean,
): THREE.WebGLRenderer {
  const renderer = new THREE.WebGLRenderer({
    antialias: !isSoftwareGl,
    powerPreference: 'high-performance',
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(
    container.clientWidth || window.innerWidth,
    container.clientHeight || window.innerHeight,
  );
  renderer.shadowMap.enabled = !isSoftwareGl;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.style.display = 'block';
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '100%';
  container.appendChild(renderer.domElement);
  return renderer;
}

export function applyStudioEnvironment(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
): THREE.Texture {
  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  const envTex = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envTex;
  scene.environmentIntensity = 1.25;
  pmremGenerator.dispose();
  return envTex;
}

export function afterSoftwareDraw(
  renderer: THREE.WebGLRenderer,
  cb: () => void,
  registerTimer: (id: number) => void,
): void {
  const gl = renderer.getContext() as WebGL2RenderingContext | null;
  if (!gl || typeof gl.fenceSync !== 'function') {
    const id = window.setTimeout(cb, 80);
    registerTimer(id);
    return;
  }
  const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
  gl.flush();
  const poll = () => {
    const state = sync ? gl.getSyncParameter(sync, gl.SYNC_STATUS) : gl.SIGNALED;
    if (state === gl.UNSIGNALED) {
      const id = window.setTimeout(poll, 5);
      registerTimer(id);
    } else {
      if (sync) gl.deleteSync(sync);
      const id = window.setTimeout(cb, 80);
      registerTimer(id);
    }
  };
  const id = window.setTimeout(poll, 5);
  registerTimer(id);
}

export function createSkyDomeTexture(theme: EnvironmentTheme): THREE.CanvasTexture {
  const w = 1024;
  const h = 512;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createLinearGradient(0, 0, 0, h);

  if (theme === 'sunset') {
    grad.addColorStop(0, '#17153b');
    grad.addColorStop(0.36, '#5b21b6');
    grad.addColorStop(0.62, '#ea580c');
    grad.addColorStop(0.84, '#fdba74');
    grad.addColorStop(1, '#fed7aa');
  } else if (theme === 'rooftop') {
    grad.addColorStop(0, '#0c2461');
    grad.addColorStop(0.45, '#1e6bb8');
    grad.addColorStop(0.78, '#74b9ff');
    grad.addColorStop(1, '#dff9fb');
  } else if (theme === 'basement') {
    grad.addColorStop(0, '#0f172a');
    grad.addColorStop(1, '#1e293b');
  } else {
    grad.addColorStop(0, '#1d5fa7');
    grad.addColorStop(0.38, '#4e94db');
    grad.addColorStop(0.72, '#9ec9f2');
    grad.addColorStop(0.92, '#dcecf9');
    grad.addColorStop(1, '#eef6fc');
  }

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  if (theme !== 'basement') {
    // Solar halo glow
    const sunX = w * 0.28;
    const sunY = theme === 'sunset' ? h * 0.62 : h * 0.34;
    const sunGlow = ctx.createRadialGradient(sunX, sunY, 6, sunX, sunY, 170);
    sunGlow.addColorStop(0, 'rgba(255, 252, 235, 0.95)');
    sunGlow.addColorStop(0.18, 'rgba(255, 240, 200, 0.45)');
    sunGlow.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = sunGlow;
    ctx.fillRect(0, 0, w, h);

    // Soft layered cumulus cloud wisps
    for (let c = 0; c < 26; c++) {
      const cx = (c * 137 + 40) % w;
      const cy = h * (0.28 + ((c * 29) % 28) * 0.01);
      const rx = 50 + (c % 4) * 32;
      const ry = 14 + (c % 3) * 8;
      const cloudGrad = ctx.createRadialGradient(cx, cy, 4, cx, cy, rx);
      const alpha = theme === 'sunset' ? 0.24 : 0.34;
      cloudGrad.addColorStop(0, `rgba(255, 255, 255, ${alpha})`);
      cloudGrad.addColorStop(0.55, `rgba(255, 255, 255, ${alpha * 0.45})`);
      cloudGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(1, ry / rx);
      ctx.translate(-cx, -cy);
      ctx.fillStyle = cloudGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, rx, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createAsphaltTexture(
  renderer: THREE.WebGLRenderer,
  baseHex = '#727882',
  repeatX = 12,
  repeatY = 12,
): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, size, size);

  // Subtle multi-scale mineral aggregate grain
  for (let i = 0; i < 28000; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const light = Math.random() > 0.48;
    const sz = Math.random() > 0.88 ? 2.5 : 1.5;
    const a = light ? 0.07 + Math.random() * 0.11 : 0.08 + Math.random() * 0.12;
    ctx.fillStyle = light ? `rgba(255,255,255,${a})` : `rgba(10,14,20,${a})`;
    ctx.fillRect(x, y, sz, sz);
  }

  // Subtle asphalt expansion seam & wear patches
  ctx.strokeStyle = 'rgba(15, 23, 42, 0.18)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, size * 0.5);
  ctx.bezierCurveTo(size * 0.3, size * 0.48, size * 0.7, size * 0.52, size, size * 0.5);
  ctx.stroke();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return tex;
}

export function createAsphaltBumpTexture(
  renderer: THREE.WebGLRenderer,
  repeatX = 12,
  repeatY = 12,
): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 12000; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const v = Math.floor(80 + Math.random() * 115);
    ctx.fillStyle = `rgb(${v},${v},${v})`;
    ctx.fillRect(x, y, 2, 2);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return tex;
}

export function createConcreteTexture(
  renderer: THREE.WebGLRenderer,
  repeatX = 6,
): THREE.CanvasTexture {
  const w = 256;
  const h = 128;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#a3aab5';
  ctx.fillRect(0, 0, w, h);

  for (let i = 0; i < 5500; i++) {
    const x = Math.random() * w;
    const y = Math.random() * h;
    ctx.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,0.09)' : 'rgba(15,23,42,0.1)';
    ctx.fillRect(x, y, 2, 2);
  }

  // Precast jersey barrier panel seams
  ctx.strokeStyle = 'rgba(30, 41, 59, 0.35)';
  ctx.lineWidth = 3;
  ctx.strokeRect(1.5, 1.5, w - 3, h - 3);
  ctx.beginPath();
  ctx.moveTo(w / 2, 0);
  ctx.lineTo(w / 2, h);
  ctx.stroke();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.repeat.set(repeatX, 1);
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return tex;
}

export function createContainerTexture(
  renderer: THREE.WebGLRenderer,
  baseHex: string,
): THREE.CanvasTexture {
  const w = 512;
  const h = 256;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, w, h);

  // Corrugated vertical steel ribs with specular/shadow edge shading
  const ribW = 16;
  for (let x = 26; x < w - 26; x += ribW) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.26)';
    ctx.fillRect(x, 16, 6, h - 32);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
    ctx.fillRect(x + 6, 16, 4, h - 32);
  }

  // Subtle industrial weathering speckles
  for (let i = 0; i < 1800; i++) {
    ctx.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.05)';
    ctx.fillRect(Math.random() * w, Math.random() * h, 3, 2);
  }

  // Heavy top & bottom structural steel rails + corner posts
  ctx.fillStyle = 'rgba(0, 0, 0, 0.38)';
  ctx.fillRect(0, 0, w, 15);
  ctx.fillRect(0, h - 15, w, 15);
  ctx.fillRect(0, 0, 22, h);
  ctx.fillRect(w - 22, 0, 22, h);

  // Caution stripe + Stenciled cargo ID plate
  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.fillRect(38, 28, 180, 30);
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 17px "JetBrains Mono", monospace';
  ctx.fillText('APEX-45G1 CARGO', 46, 49);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return tex;
}

export function createContainerBumpTexture(renderer: THREE.WebGLRenderer): THREE.CanvasTexture {
  const w = 512;
  const h = 64;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#707070';
  ctx.fillRect(0, 0, w, h);
  for (let x = 26; x < w - 26; x += 16) {
    ctx.fillStyle = '#252525';
    ctx.fillRect(x, 0, 7, h);
    ctx.fillStyle = '#e5e5e5';
    ctx.fillRect(x + 7, 0, 6, h);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return tex;
}

export function createTireTreadTexture(): THREE.CanvasTexture {
  const w = 256;
  const h = 64;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#181a1f';
  ctx.fillRect(0, 0, w, h);

  // V-chevron rubber tread blocks
  ctx.strokeStyle = '#0b0c0e';
  ctx.lineWidth = 4;
  for (let x = 0; x < w; x += 16) {
    ctx.beginPath();
    ctx.moveTo(x, 4);
    ctx.lineTo(x + 8, h / 2);
    ctx.lineTo(x, h - 4);
    ctx.stroke();
  }
  // Longitudinal water channels
  ctx.fillStyle = '#090a0c';
  ctx.fillRect(0, h * 0.34, w, 4);
  ctx.fillRect(0, h * 0.62, w, 4);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.repeat.set(3, 1);
  return tex;
}

export function createHeadlightTexture(): THREE.CanvasTexture {
  const w = 256;
  const h = 128;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, w, h);

  // Chrome reflector housing border
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 6;
  ctx.strokeRect(4, 4, w - 8, h - 8);

  // Twin glowing LED projector lenses
  for (const cx of [w * 0.34, w * 0.72]) {
    const g = ctx.createRadialGradient(cx, h * 0.48, 4, cx, h * 0.48, 34);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.45, '#e0f2fe');
    g.addColorStop(0.75, '#60a5fa');
    g.addColorStop(1, '#1e293b');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, h * 0.48, 32, 0, Math.PI * 2);
    ctx.fill();
  }

  // Swept L-shape DRL LED strip along bottom
  ctx.strokeStyle = '#f8fafc';
  ctx.lineWidth = 10;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(18, h - 22);
  ctx.lineTo(w - 24, h - 22);
  ctx.lineTo(w - 16, 26);
  ctx.stroke();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createTaillightTexture(): THREE.CanvasTexture {
  const w = 256;
  const h = 128;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#450a0a';
  ctx.fillRect(0, 0, w, h);

  // Outer red LED light signature
  ctx.strokeStyle = '#ff3b30';
  ctx.lineWidth = 16;
  ctx.strokeRect(14, 16, w - 28, h - 32);

  // Segmented brake LEDs
  ctx.fillStyle = '#ef4444';
  for (let x = 34; x < w - 50; x += 28) {
    ctx.fillRect(x, 38, 18, 52);
  }

  // Amber turn signal bar
  ctx.fillStyle = '#f59e0b';
  ctx.fillRect(28, h - 26, w - 56, 10);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createClusterTexture(): THREE.CanvasTexture {
  const w = 512;
  const h = 192;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#070b14';
  ctx.fillRect(0, 0, w, h);

  // Left Tachometer & Right Speedometer dials
  for (const [cx, label, accent] of [
    [130, 'RPM x1000', '#38bdf8'],
    [382, 'KM / H', '#22d3ee'],
  ] as const) {
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.arc(cx, 102, 70, Math.PI * 0.78, Math.PI * 2.22);
    ctx.stroke();

    ctx.strokeStyle = accent;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(cx, 102, 70, Math.PI * 0.78, Math.PI * 1.9);
    ctx.stroke();

    for (let i = 0; i <= 8; i++) {
      const a = Math.PI * 0.8 + (i / 8) * Math.PI * 1.4;
      ctx.strokeStyle = i >= 7 ? '#ef4444' : '#e2e8f0';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * 52, 102 + Math.sin(a) * 52);
      ctx.lineTo(cx + Math.cos(a) * 64, 102 + Math.sin(a) * 64);
      ctx.stroke();
    }

    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 14px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(label, cx, 148);
  }

  // Center digital car telemetry card
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(214, 34, 84, 124);
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 2;
  ctx.strokeRect(214, 34, 84, 124);
  ctx.fillStyle = '#4ade80';
  ctx.font = 'bold 16px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillText('PARK', 256, 72);
  ctx.fillStyle = '#e2e8f0';
  ctx.font = 'bold 14px "JetBrains Mono", monospace';
  ctx.fillText('ASSIST', 256, 94);
  ctx.fillStyle = '#38bdf8';
  ctx.fillText('READY', 256, 126);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createInfotainmentTexture(): THREE.CanvasTexture {
  const w = 256;
  const h = 160;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, w, h);

  // Stylized parking lot map & sonar grid
  ctx.strokeStyle = '#1e3a8a';
  ctx.lineWidth = 1;
  for (let x = 16; x < w; x += 24) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  for (let y = 16; y < h; y += 24) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }

  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(68, 140);
  ctx.lineTo(68, 56);
  ctx.lineTo(186, 56);
  ctx.stroke();

  ctx.fillStyle = '#facc15';
  ctx.fillRect(174, 38, 28, 36);
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 20px "Chakra Petch", sans-serif';
  ctx.fillText('P', 182, 63);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createRoadArrowTexture(renderer: THREE.WebGLRenderer): THREE.CanvasTexture {
  const w = 256;
  const h = 256;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  ctx.clearRect(0, 0, w, h);

  ctx.fillStyle = 'rgba(250, 204, 21, 0.94)';
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.lineWidth = 6;

  ctx.beginPath();
  ctx.moveTo(w / 2, 26);
  ctx.lineTo(w - 38, 126);
  ctx.lineTo(w - 72, 126);
  ctx.lineTo(w / 2, 68);
  ctx.lineTo(72, 126);
  ctx.lineTo(38, 126);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(w / 2, 124);
  ctx.lineTo(w - 38, 224);
  ctx.lineTo(w - 72, 224);
  ctx.lineTo(w / 2, 166);
  ctx.lineTo(72, 224);
  ctx.lineTo(38, 224);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return tex;
}

export function createChainLinkTexture(renderer: THREE.WebGLRenderer): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.clearRect(0, 0, size, size);
  ctx.strokeStyle = 'rgba(226, 232, 240, 0.8)';
  ctx.lineWidth = 3;

  const step = 16;
  for (let i = -size; i < size * 2; i += step) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + size, size);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(i + size, 0);
    ctx.lineTo(i, size);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return tex;
}

export function createSpeedBumpTexture(renderer: THREE.WebGLRenderer): THREE.CanvasTexture {
  const w = 512;
  const h = 64;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  const segs = 12;
  const segW = w / segs;
  for (let i = 0; i < segs; i++) {
    ctx.fillStyle = i % 2 === 0 ? '#18181b' : '#facc15';
    ctx.fillRect(i * segW, 0, segW + 1, h);
  }
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(0, h * 0.28, w, h * 0.22);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return tex;
}

export function createSteelRampTexture(renderer: THREE.WebGLRenderer): THREE.CanvasTexture {
  const w = 128;
  const h = 256;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#94a3b8';
  ctx.fillRect(0, 0, w, h);

  for (let y = 0; y < h; y += 14) {
    ctx.fillStyle = '#64748b';
    ctx.fillRect(8, y, w - 16, 6);
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(8, y + 6, w - 16, 3);
  }

  ctx.fillStyle = '#475569';
  ctx.fillRect(0, 0, 10, h);
  ctx.fillRect(w - 10, 0, 10, h);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return tex;
}

export function createPlatformDeckTexture(renderer: THREE.WebGLRenderer): THREE.CanvasTexture {
  const w = 512;
  const h = 768;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#cbd5e1';
  ctx.fillRect(0, 0, w, h);

  for (let i = 0; i < 4500; i++) {
    const x = Math.random() * w;
    const y = Math.random() * h;
    ctx.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,0.14)' : 'rgba(15,23,42,0.08)';
    ctx.fillRect(x, y, 2, 2);
  }

  ctx.strokeStyle = '#facc15';
  ctx.lineWidth = 34;
  ctx.strokeRect(17, 17, w - 34, h - 34);

  ctx.fillStyle = 'rgba(15, 23, 42, 0.25)';
  ctx.font = 'bold 180px "Chakra Petch", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('P', w / 2, h / 2);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return tex;
}

export function createHazardStripeTexture(
  renderer: THREE.WebGLRenderer,
  colorA = '#facc15',
  colorB = '#18181b',
): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = colorB;
  ctx.fillRect(0, 0, size, size);

  ctx.fillStyle = colorA;
  const stripeW = 32;
  for (let i = -size; i < size * 2; i += stripeW * 2) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + stripeW, 0);
    ctx.lineTo(i + stripeW - size, size);
    ctx.lineTo(i - size, size);
    ctx.closePath();
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 1);
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return tex;
}

export function createParkingBayTexture(
  renderer: THREE.WebGLRenderer,
  direction: 'any' | 'forward' | 'reverse',
): THREE.CanvasTexture {
  const w = 512;
  const h = 768;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  ctx.clearRect(0, 0, w, h);

  ctx.fillStyle = 'rgba(250, 204, 21, 0.16)';
  ctx.fillRect(16, 16, w - 32, h - 32);

  ctx.strokeStyle = '#facc15';
  ctx.lineWidth = 22;
  ctx.strokeRect(24, 24, w - 48, h - 48);

  ctx.setLineDash([28, 20]);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.72)';
  ctx.lineWidth = 6;
  ctx.strokeRect(56, 56, w - 112, h - 112);
  ctx.setLineDash([]);

  ctx.fillStyle = 'rgba(250, 204, 21, 0.92)';
  ctx.font = 'bold 180px "Chakra Petch", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('P', w / 2, h / 2);

  if (direction !== 'any') {
    const label = direction === 'reverse' ? 'REVERSE IN' : 'FRONT IN';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 42px "Chakra Petch", sans-serif';
    ctx.fillText(label, w / 2, h - 115);

    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 14;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    if (direction === 'forward') {
      ctx.moveTo(w / 2 - 55, 175);
      ctx.lineTo(w / 2, 115);
      ctx.lineTo(w / 2 + 55, 175);
    } else {
      ctx.moveTo(w / 2 - 55, 115);
      ctx.lineTo(w / 2, 175);
      ctx.lineTo(w / 2 + 55, 115);
    }
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return tex;
}

export function createContactShadowTexture(colorHex = '0,0,0'): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createRadialGradient(
    size / 2,
    size / 2,
    size * 0.08,
    size / 2,
    size / 2,
    size * 0.48,
  );
  grad.addColorStop(0, `rgba(${colorHex}, 0.85)`);
  grad.addColorStop(0.65, `rgba(${colorHex}, 0.4)`);
  grad.addColorStop(1, `rgba(${colorHex}, 0.0)`);

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function disposeObject3D(root: THREE.Object3D): void {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.geometry) {
      mesh.geometry.dispose();
    }
    if (mesh.material) {
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const m of mats) {
        const std = m as THREE.MeshStandardMaterial;
        if (std.map) std.map.dispose();
        if (std.emissiveMap) std.emissiveMap.dispose();
        if (std.bumpMap) std.bumpMap.dispose();
        if (std.roughnessMap) std.roughnessMap.dispose();
        if (std.normalMap) std.normalMap.dispose();
        m.dispose();
      }
    }
  });
}
