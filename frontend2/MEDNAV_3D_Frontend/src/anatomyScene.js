import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

// The remote GLBs are openly licensed CC BY 4.0. See ATTRIBUTION.md.
// You may instead place downloaded GLBs in public/models and change these URLs.
const MODEL_URLS = {
  male: 'https://cdn.jsdelivr.net/npm/open-anatomy-3d@0.1.0/models/anatomy-male.glb',
  female: 'https://cdn.jsdelivr.net/npm/open-anatomy-3d@0.1.0/models/anatomy-female.glb',
};
const SYSTEMS = ['skin', 'skeleton', 'muscles', 'organs', 'vessels', 'nerves'];
const BASE_COLORS = {
  skin: 0x39cfff, skeleton: 0x75d7ff, muscles: 0xf65e9c,
  organs: 0xf578b6, vessels: 0xf65fb9, nerves: 0x21edff,
};
const MODE_OPACITY = {
  xray: { skin: 0.095, skeleton: 0.71, muscles: 0.26, organs: 0.93, vessels: 0.61, nerves: 0.66 },
  organs: { skin: 0.035, skeleton: 0.095, muscles: 0.075, organs: 1.0, vessels: 0.45, nerves: 0.4 },
  skeleton: { skin: 0.035, skeleton: 1, muscles: 0.055, organs: 0.055, vessels: 0.12, nerves: 0.2 },
  surface: { skin: 0.82, skeleton: 0.11, muscles: 0.08, organs: 0.12, vessels: 0.09, nerves: 0.09 },
};
const humanize = (str) => str.replace(/_/g, ' ').replace(/\b[a-z]/g, (x) => x.toUpperCase());

function surfaceMesh(name, color, geometry, location, size) {
  const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({
    color, metalness: 0.14, roughness: 0.28, transparent: true, opacity: 0.5,
    emissive: color, emissiveIntensity: 0.13, depthWrite: false, side: THREE.DoubleSide,
  }));
  mesh.name = name;
  mesh.position.set(...location);
  if (size) mesh.scale.set(...size);
  return mesh;
}

function fallbackAnatomy() {
  const root = new THREE.Group();
  const groups = Object.fromEntries(SYSTEMS.map((name) => {
    const g = new THREE.Group(); g.name = name; root.add(g); return [name, g];
  }));
  const ball = (system, name, p, s, color) => {
    const mesh = surfaceMesh(name, color, new THREE.SphereGeometry(1, 28, 20), p, s);
    groups[system].add(mesh); return mesh;
  };
  const tube = (system, name, points, radius, color) => {
    const path = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
    const mesh = surfaceMesh(name, color, new THREE.TubeGeometry(path, 28, radius, 8, false), [0, 0, 0]);
    groups[system].add(mesh); return mesh;
  };
  const limb = (system, name, p1, p2, radius, color) => {
    const a = new THREE.Vector3(...p1), b = new THREE.Vector3(...p2);
    const geo = new THREE.CylinderGeometry(radius * 0.72, radius, a.distanceTo(b), 16, 1);
    const mesh = surfaceMesh(name, color, geo, a.clone().add(b).multiplyScalar(0.5).toArray());
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
    groups[system].add(mesh); return mesh;
  };

  // Anatomical silhouette; intentional educational approximation, not a scan.
  const skin = 0x49beff, muscle = 0xed5a91, bone = 0x77d8ff;
  ball('skin', 'head', [0, 3.05, 0], [0.205, 0.29, 0.184], skin);
  ball('skin', 'skin', [0, 2.18, -0.005], [0.375, 0.55, 0.238], skin);
  ball('skin', 'pelvis', [0, 1.63, 0], [0.322, 0.255, 0.22], skin);
  limb('skin', 'skin', [0, 2.81, 0], [0, 2.62, 0], 0.108, skin);
  for (const side of [-1, 1]) {
    const suffix = side < 0 ? 'r' : 'l';
    ball('skin', `shoulder_${suffix}`, [side * 0.41, 2.51, 0], [0.15, 0.155, 0.15], skin);
    limb('skin', `arm_${suffix}`, [side * 0.43, 2.51, 0], [side * 0.61, 2.02, 0.025], 0.137, skin);
    ball('skin', `elbow_${suffix}`, [side * 0.61, 2.02, 0.025], [0.092, 0.091, 0.095], skin);
    limb('skin', `arm_${suffix}`, [side * 0.61, 2.02, 0.025], [side * 0.68, 1.55, 0.09], 0.105, skin);
    ball('skin', `hand_${suffix}`, [side * 0.7, 1.43, 0.09], [0.09, 0.174, 0.071], skin);
    limb('skin', `leg_${suffix}`, [side * 0.195, 1.49, 0], [side * 0.195, 0.89, 0.02], 0.168, skin);
    ball('skin', `knee_${suffix}`, [side * 0.195, 0.87, 0.025], [0.115, 0.12, 0.125], skin);
    limb('skin', `leg_${suffix}`, [side * 0.195, 0.85, 0.02], [side * 0.205, 0.21, 0.0], 0.12, skin);
    ball('skin', `foot_${suffix}`, [side * 0.21, 0.092, 0.11], [0.11, 0.08, 0.234], skin);
  }

  // Floating bones, spinal vertebrae and ribs.
  for (let i = 0; i < 21; i++) {
    const y = 2.65 - i * 0.057;
    ball('skeleton', 'spine', [0, y, -0.025], [0.064, 0.034, 0.073], bone);
  }
  for (let i = 0; i < 9; i++) {
    const y = 2.49 - i * 0.08;
    const spread = 0.245 + Math.sin((i / 9) * Math.PI) * 0.09;
    for (const side of [-1, 1]) {
      tube('skeleton', 'rib_cage', [
        [side * 0.055, y + 0.016, -0.04], [side * spread, y + 0.04, -0.09],
        [side * (spread + 0.045), y - 0.035, 0.095], [side * 0.065, y - 0.075, 0.223],
      ], 0.012, bone);
    }
  }
  tube('skeleton', 'sternum', [[0, 2.52, 0.225], [0, 2.26, 0.253], [0, 1.95, 0.201]], 0.016, bone);
  for (const side of [-1, 1]) {
    const suffix = side < 0 ? 'r' : 'l';
    limb('skeleton', `humerus_${suffix}`, [side * 0.43, 2.52, 0.005], [side * 0.61, 2.02, 0.015], 0.032, bone);
    limb('skeleton', `radius_${suffix}`, [side * 0.61, 2.01, 0.02], [side * 0.69, 1.55, 0.07], 0.022, bone);
    limb('skeleton', `femur_${suffix}`, [side * 0.18, 1.47, 0], [side * 0.19, 0.87, 0.02], 0.048, bone);
    limb('skeleton', `tibia_${suffix}`, [side * 0.19, 0.87, 0], [side * 0.20, 0.18, 0.02], 0.035, bone);
  }
  ball('skeleton', 'skull', [0, 3.07, -0.019], [0.177, 0.248, 0.158], 0x84e8ff);
  ball('skeleton', 'pelvis', [0, 1.55, -0.042], [0.265, 0.114, 0.175], bone);

  // Selected internal organs.
  ball('organs', 'brain', [0, 3.105, 0.031], [0.153, 0.163, 0.132], 0x20d4fa);
  for (let i = 0; i < 12; i++) {
    const theta = i * 1.4;
    const x = Math.sin(theta) * 0.103, z = 0.035 + Math.cos(theta) * 0.091;
    tube('nerves', 'cranial_nerves', [[x * 0.83, 3.22, z], [x * 1.14, 3.14, z * 1.16], [x * 0.98, 3.055, z]], 0.005, 0x1bdbff);
  }
  ball('organs', 'lung_l', [0.168, 2.242, 0.108], [0.162, 0.301, 0.145], 0x15baff);
  ball('organs', 'lung_r', [-0.168, 2.242, 0.108], [0.162, 0.301, 0.145], 0x15baff);
  ball('organs', 'heart', [0.04, 2.22, 0.245], [0.108, 0.133, 0.096], 0xff60ac);
  ball('organs', 'liver', [-0.149, 1.862, 0.137], [0.186, 0.109, 0.134], 0xffbf72);
  ball('organs', 'stomach', [0.143, 1.775, 0.132], [0.092, 0.147, 0.094], 0xff94bf);
  ball('organs', 'kidney_l', [0.176, 1.669, -0.055], [0.082, 0.117, 0.067], 0xff77b0);
  ball('organs', 'kidney_r', [-0.176, 1.669, -0.055], [0.082, 0.117, 0.067], 0xff77b0);
  for (let i = 0; i < 6; i++) {
    tube('organs', 'intestine_small', [
      [-0.19, 1.66 - i * 0.055, 0.12], [0, 1.62 - i * 0.05, 0.19], [0.19, 1.64 - i * 0.052, 0.12],
    ], 0.017, 0xffa0cb);
  }
  tube('vessels', 'aorta', [[0.03, 2.27, 0.25], [0.04, 2.38, 0.1], [0, 2.34, -0.025], [0.025, 1.68, -0.08]], 0.018, 0xff5daf);
  tube('nerves', 'spinal_cord', [[0, 2.79, -0.01], [0, 2.35, -0.085], [0, 1.67, -0.08]], 0.018, 0x15dfff);
  for (const side of [-1, 1]) {
    tube('vessels', 'veins', [[0, 1.68, -0.06], [side * 0.2, 1.43, 0.025], [side * 0.19, 0.8, 0.07], [side * 0.2, 0.2, 0.03]], 0.009, 0xfc6dce);
  }
  for (const side of [-1, 1]) {
    ball('muscles', `chest_muscles_${side < 0 ? 'r' : 'l'}`, [side * 0.195, 2.425, 0.12], [0.185, 0.102, 0.114], muscle);
    ball('muscles', `quadriceps_${side < 0 ? 'r' : 'l'}`, [side * 0.2, 1.16, 0.068], [0.121, 0.286, 0.104], muscle);
  }
  return root;
}

/** Create a responsive, clickable Three.js anatomy stage inside a DOM element. */
export function mountAnatomy(container, { onSelect, onStatus, onHover, initialSex = 'male' }) {
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x071328, 0.045);
  const camera = new THREE.PerspectiveCamera(40, 1, 0.05, 100);
  camera.position.set(0.22, 1.83, 5.35);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.48;
  container.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 1.72, 0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.075;
  controls.enablePan = false;
  controls.minDistance = 2.55;
  controls.maxDistance = 9;
  controls.maxPolarAngle = Math.PI * 0.9;
  controls.minPolarAngle = Math.PI * 0.09;
  controls.rotateSpeed = 0.75;
  controls.update();

  scene.add(new THREE.AmbientLight(0xbedfff, 1.9));
  const key = new THREE.DirectionalLight(0x91e8ff, 3.0); key.position.set(3, 5, 5); scene.add(key);
  const rim = new THREE.PointLight(0xff42b7, 65, 9); rim.position.set(-2.5, 2.7, -2.5); scene.add(rim);
  const bottom = new THREE.PointLight(0x19c8ff, 48, 6); bottom.position.set(0.6, 0.3, 1.8); scene.add(bottom);

  // Scanning platform, rings and holographic particles.
  const platform = new THREE.Group(); scene.add(platform);
  const disk = new THREE.Mesh(new THREE.CylinderGeometry(0.94, 1.07, 0.065, 96),
    new THREE.MeshStandardMaterial({ color: 0x061b38, metalness: 0.83, roughness: 0.2, transparent: true, opacity: 0.86 }));
  disk.position.y = -0.067; platform.add(disk);
  for (const [r, opacity, y] of [[0.99, 0.8, 0], [0.76, 0.8, 0.01], [0.46, 0.46, 0.017]]) {
    const line = new THREE.Mesh(new THREE.TorusGeometry(r, 0.008, 6, 120),
      new THREE.MeshBasicMaterial({ color: 0x25dfff, transparent: true, opacity }));
    line.rotation.x = Math.PI / 2; line.position.y = y; platform.add(line);
  }
  const grid = new THREE.GridHelper(7, 28, 0x0a6586, 0x0c3456);
  grid.material.transparent = true; grid.material.opacity = 0.26; grid.position.y = -0.13; scene.add(grid);
  const particleCount = 150;
  const p = new Float32Array(particleCount * 3);
  for (let i = 0; i < particleCount; i++) {
    const a = Math.random() * Math.PI * 2, r = 0.8 + Math.random() * 2;
    p[i * 3] = Math.cos(a) * r; p[i * 3 + 1] = Math.random() * 3.7; p[i * 3 + 2] = Math.sin(a) * r;
  }
  const pgeo = new THREE.BufferGeometry(); pgeo.setAttribute('position', new THREE.BufferAttribute(p, 3));
  const particles = new THREE.Points(pgeo, new THREE.PointsMaterial({ color: 0x2ad6ff, size: 0.022, transparent: true, opacity: 0.68, depthWrite: false }));
  scene.add(particles);
  const scanRing = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.012, 7, 96),
    new THREE.MeshBasicMaterial({ color: 0x4ce8ff, transparent: true, opacity: 0.36, depthWrite: false }));
  scanRing.rotation.x = Math.PI / 2; scene.add(scanRing);

  let model = null, meshes = [], mode = 'xray', activePart = 'brain', sex = 'male';
  let autoRotate = false, killed = false, loadId = 0, modelType = 'schematic';
  const clock = new THREE.Clock();
  const raycaster = new THREE.Raycaster(); const pointer = new THREE.Vector2();

  const getSystem = (obj) => {
    let n = obj;
    while (n) { if (SYSTEMS.includes(n.name)) return n.name; n = n.parent; }
    return 'organs';
  };
  const getPartName = (obj, system) => {
    let n = obj;
    while (n && n !== model) {
      if (n.name && !SYSTEMS.includes(n.name) && !/^(mesh|object|node|scene|armature|default)/i.test(n.name)) return n.name;
      n = n.parent;
    }
    return system === 'skin' ? 'skin' : 'chest';
  };
  const makeShaderMaterial = (system, origColor) => {
    const baseColor = system === 'organs' && origColor ? origColor : new THREE.Color(BASE_COLORS[system]);
    return new THREE.MeshPhysicalMaterial({
      color: baseColor, emissive: baseColor, emissiveIntensity: system === 'organs' ? 0.39 : 0.22,
      metalness: 0.12, roughness: 0.30, transmission: 0,
      transparent: true, opacity: 0.55, depthWrite: false,
      side: THREE.DoubleSide, clearcoat: 0.5, clearcoatRoughness: 0.13,
    });
  };
  const initializeMesh = (group) => {
    meshes = [];
    group.traverse((obj) => {
      if (!obj.isMesh) return;
      const system = getSystem(obj);
      const name = obj.name && !/^mesh/i.test(obj.name) ? obj.name : getPartName(obj, system);
      const partKey = name.split(/[.]/)[0] || 'skin';
      const old = Array.isArray(obj.material) ? obj.material[0] : obj.material;
      const sourceColor = old?.color?.clone?.();
      // Replace source material with X-ray styling; source geometry is retained.
      obj.material = makeShaderMaterial(system, sourceColor);
      obj.userData = { ...obj.userData, partKey, system, pickable: true };
      meshes.push(obj);
    });
    setMode(mode); setActive(activePart);
  };

  function setMode(next) {
    mode = MODE_OPACITY[next] ? next : 'xray';
    const settings = MODE_OPACITY[mode];
    for (const mesh of meshes) {
      const v = settings[mesh.userData.system] ?? 0.65;
      mesh.material.opacity = v;
      mesh.visible = v > 0.02;
      mesh.userData.pickable = v > 0.20 && !(mesh.userData.system === 'skin' && mode !== 'surface') &&
        !(mesh.userData.system === 'muscles' && mode === 'xray');
    }
    setActive(activePart);
  }
  function setActive(part) {
    activePart = part;
    for (const mesh of meshes) {
      const selected = mesh.userData.partKey === part ||
        (part === 'lungs' && mesh.userData.partKey.startsWith('lung_')) ||
        (part === 'spine' && mesh.userData.partKey.startsWith('spine'));
      mesh.material.emissiveIntensity = selected ? 1.5 : (mesh.userData.system === 'organs' ? 0.39 : 0.22);
      const baseOpacity = MODE_OPACITY[mode][mesh.userData.system] ?? 0.65;
      mesh.material.opacity = selected ? Math.max(baseOpacity, 0.35) : baseOpacity;
    }
  }
  function replaceModel(group, detailed) {
    if (model) scene.remove(model);
    model = group;
    if (detailed) {
      // The source GLB is in metres and 1.7–1.9 m tall. Fit it to our display.
      const bounds = new THREE.Box3().setFromObject(model);
      const size = bounds.getSize(new THREE.Vector3());
      const center = bounds.getCenter(new THREE.Vector3());
      if (size.y > 0.1) {
        const scale = 3.29 / size.y;
        model.scale.setScalar(scale);
        model.position.set(-center.x * scale, -bounds.min.y * scale, -center.z * scale);
      }
    }
    scene.add(model); initializeMesh(model);
    modelType = detailed ? 'detailed' : 'schematic';
    onStatus?.(detailed ? 'detailed' : 'fallback');
  }

  replaceModel(fallbackAnatomy(), false);
  const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);
  async function setSex(nextSex) {
    sex = nextSex === 'female' ? 'female' : 'male';
    const myLoad = ++loadId;
    onStatus?.('loading');
    try {
      const gltf = await loader.loadAsync(MODEL_URLS[sex]);
      if (killed || myLoad !== loadId) return;
      replaceModel(gltf.scene, true);
    } catch (error) {
      if (killed || myLoad !== loadId) return;
      console.warn('MEDNAV anatomical GLB not available, using procedural backup:', error);
      // Do not display a detailed model of the wrong selected sex.
      if (modelType !== 'schematic') replaceModel(fallbackAnatomy(), false);
      else onStatus?.('fallback');
    }
  }
  setSex(initialSex);

  const pick = (event) => {
    const rect = renderer.domElement.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    pointer.set((event.clientX - rect.left) / rect.width * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    const candidates = meshes.filter((obj) => obj.visible && obj.userData.pickable);
    const hits = raycaster.intersectObjects(candidates, false);
    if (!hits.length) return null;
    // Organ priority makes structures behind the translucent rib cage easier to select.
    const organHit = hits.find((h) => h.object.userData.system === 'organs' && h.distance < hits[0].distance + 0.42);
    return (organHit || hits[0]).object.userData.partKey;
  };
  let down = null, hoverTime = 0;
  const onDown = (e) => { down = { x: e.clientX, y: e.clientY }; };
  const onUp = (e) => {
    if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 7) { down = null; return; }
    down = null;
    const key = pick(e);
    if (key) { setActive(key); onSelect?.(key); }
  };
  const onMove = (e) => {
    if (performance.now() - hoverTime < 45) return;
    hoverTime = performance.now();
    const key = pick(e);
    renderer.domElement.style.cursor = key ? 'pointer' : 'grab';
    onHover?.(key ? humanize(key) : '');
  };
  renderer.domElement.addEventListener('pointerdown', onDown);
  renderer.domElement.addEventListener('pointerup', onUp);
  renderer.domElement.addEventListener('pointermove', onMove);
  renderer.domElement.addEventListener('pointerleave', () => onHover?.(''));

  const resize = () => {
    const w = Math.max(container.clientWidth, 1), h = Math.max(container.clientHeight, 1);
    camera.aspect = w / h;
    camera.fov = w < 440 ? 48 : 40;
    camera.updateProjectionMatrix(); renderer.setSize(w, h, false);
  };
  const observer = new ResizeObserver(resize); observer.observe(container); resize();
  let frameId = null;
  function animate() {
    if (killed) return;
    frameId = requestAnimationFrame(animate);
    const t = clock.getElapsedTime();
    controls.autoRotate = autoRotate;
    controls.autoRotateSpeed = 0.47;
    controls.update();
    particles.rotation.y = t * 0.023;
    scanRing.position.y = 1.15 + Math.sin(t * 0.65) * 0.95;
    scanRing.material.opacity = 0.16 + Math.sin(t * 0.65) ** 2 * 0.13;
    platform.rotation.y = Math.sin(t * 0.13) * 0.07;
    renderer.render(scene, camera);
  }
  animate();

  return {
    setMode,
    setActive,
    setSex,
    setAutoRotate: (v) => { autoRotate = Boolean(v); },
    zoom: (factor) => { // factor <1 zoom in
      camera.position.sub(controls.target).multiplyScalar(factor).add(controls.target);
      controls.update();
    },
    reset: () => {
      controls.target.set(0, 1.72, 0); camera.position.set(0.22, 1.83, 5.35);
      controls.update();
    },
    dispose: () => {
      killed = true; loadId++;
      cancelAnimationFrame(frameId); observer.disconnect(); controls.dispose();
      renderer.domElement.removeEventListener('pointerdown', onDown);
      renderer.domElement.removeEventListener('pointerup', onUp);
      renderer.domElement.removeEventListener('pointermove', onMove);
      renderer.dispose();
      if (renderer.domElement.parentNode === container) container.removeChild(renderer.domElement);
    },
  };
}
