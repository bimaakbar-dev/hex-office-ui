import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  AGENT_PROFILES,
} from '../data/officeData';
import {
  findHexPath,
  HEX_RADIUS,
  hexKey,
  hexToWorld,
} from '../scene/hexMath';
import {
  type AgentRig,
  createAgentModel,
  createHexTileGroup,
  disposeObject3D,
} from '../scene/officeModels';
import { createProceduralTextures, type ProceduralTexturePack } from '../scene/proceduralTextures';
import type {
  AgentActivityState,
  AgentRuntimeState,
  CameraPreset,
  HexCoord,
  HexTile,
  TileType,
  WorkspaceMode,
} from '../types/office';

export interface AgentDirective {
  agentId: string;
  targetType: TileType | 'home';
  activity: AgentActivityState;
  thoughtBubble: string;
  currentTask: string;
  nonce: number;
}

interface HexOfficeCanvasProps {
  tiles: HexTile[];
  selectedAgentId: string | null;
  cameraPreset: CameraPreset;
  cameraPresetTrigger: number;
  simSpeed: number;
  workspaceMode: WorkspaceMode;
  showBubbles: boolean;
  agentStates: Record<string, AgentRuntimeState>;
  pendingDirective: AgentDirective | null;
  onSelectAgent: (agentId: string | null) => void;
  onTileClick: (tile: HexTile) => void;
  onUpdateAgentStates: (updater: (prev: Record<string, AgentRuntimeState>) => Record<string, AgentRuntimeState>) => void;
}

// Pre-allocated math helpers (zero GC inside animation loop)
const _projVec = new THREE.Vector3();
const _targetCamPos = new THREE.Vector3();
const _targetCtrl = new THREE.Vector3();

interface InternalAgentSim {
  id: string;
  coord: HexCoord;
  worldX: number;
  worldZ: number;
  facing: number;
  path: HexCoord[];
  pathIndex: number;
  activity: AgentActivityState;
  energy: number;
  focus: number;
  tasksCompleted: number;
  thoughtBubble: string;
  currentTask: string;
  timer: number;
  rig: AgentRig;
  hitMesh: THREE.Mesh;
}

const ACTIVITY_LABELS: Record<AgentActivityState, string> = {
  working: 'Fokus Bekerja',
  walking: 'Berjalan',
  coffee: 'Istirahat Kopi',
  meeting: 'Sinkronisasi Rapat',
  thinking: 'Memproses Tugas AI',
  idle: 'Siaga',
};

export const HexOfficeCanvas: React.FC<HexOfficeCanvasProps> = ({
  tiles,
  selectedAgentId,
  cameraPreset,
  cameraPresetTrigger,
  simSpeed,
  workspaceMode,
  showBubbles,
  agentStates,
  pendingDirective,
  onSelectAgent,
  onTileClick,
  onUpdateAgentStates,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const bubbleContainerRef = useRef<HTMLDivElement | null>(null);
  const bubbleRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [webglError, setWebglError] = useState<string | null>(null);

  // Refs synced from React props so WebGL scene never tears down on UI state changes
  const tilesRef = useRef<HexTile[]>(tiles);
  const selectedAgentRef = useRef<string | null>(selectedAgentId);
  const simSpeedRef = useRef<number>(simSpeed);
  const workspaceModeRef = useRef<WorkspaceMode>(workspaceMode);
  const showBubblesRef = useRef<boolean>(showBubbles);
  const callbacksRef = useRef({ onSelectAgent, onTileClick, onUpdateAgentStates });

  tilesRef.current = tiles;
  selectedAgentRef.current = selectedAgentId;
  simSpeedRef.current = simSpeed;
  workspaceModeRef.current = workspaceMode;
  showBubblesRef.current = showBubbles;
  callbacksRef.current = { onSelectAgent, onTileClick, onUpdateAgentStates };

  // Scene internal refs for incremental updates
  const sceneCtxRef = useRef<{
    scene: THREE.Scene;
    textures: ProceduralTexturePack;
    tileGroup: THREE.Group;
    tileMeshes: Map<string, { group: THREE.Group; hitMesh: THREE.Mesh }>;
    monitorGlows: THREE.Mesh[];
    agents: Map<string, InternalAgentSim>;
    tilesMap: Map<string, HexTile>;
    applyCameraPreset: (preset: CameraPreset) => void;
    issueDirective: (directive: AgentDirective) => void;
  } | null>(null);

  // Rebuild tiles dynamically when layout changes in Tata Ruang mode
  useEffect(() => {
    const ctx = sceneCtxRef.current;
    if (!ctx) return;

    const newMap = new Map<string, HexTile>();
    tiles.forEach((t) => newMap.set(t.id, t));
    ctx.tilesMap = newMap;

    // Clear previous tile meshes cleanly
    ctx.tileMeshes.forEach(({ group }) => {
      ctx.tileGroup.remove(group);
      disposeObject3D(group);
    });
    ctx.tileMeshes.clear();
    ctx.monitorGlows.length = 0;

    for (const tile of tiles) {
      const { group, hitMesh, monitorGlows } = createHexTileGroup(tile, ctx.textures);
      const world = hexToWorld(tile.q, tile.r);
      group.position.set(world.x, 0, world.z);
      ctx.tileGroup.add(group);
      ctx.tileMeshes.set(tile.id, { group, hitMesh });
      ctx.monitorGlows.push(...monitorGlows);
    }
  }, [tiles]);

  // Apply camera preset transitions smoothly
  useEffect(() => {
    sceneCtxRef.current?.applyCameraPreset(cameraPreset);
  }, [cameraPreset, cameraPresetTrigger]);

  // Apply AI Agent directive when user dispatches a task or triggers team huddle
  useEffect(() => {
    if (!pendingDirective) return;
    sceneCtxRef.current?.issueDirective(pendingDirective);
  }, [pendingDirective]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // Software WebGL probe (reads GPU renderer string, frees probe context)
    const isSoftwareGl = (() => {
      try {
        const probeCanvas = document.createElement('canvas');
        const gl = probeCanvas.getContext('webgl2');
        if (!gl) return true;
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
        const gpu = String(gl.getParameter(param));
        gl.getExtension('WEBGL_lose_context')?.loseContext();
        return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
      } catch {
        return true;
      }
    })();

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        powerPreference: 'high-performance',
      });
    } catch {
      setWebglError('Peramban tidak mendukung konteks WebGL untuk merender kantor 3D.');
      return;
    }

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);

    const handleContextLost = (e: Event) => {
      e.preventDefault();
      setWebglError('Konteks grafis 3D terputus sementara. Memulihkan tampilan...');
    };
    const handleContextRestored = () => {
      setWebglError(null);
    };
    renderer.domElement.addEventListener('webglcontextlost', handleContextLost);
    renderer.domElement.addEventListener('webglcontextrestored', handleContextRestored);

    // Scene & Studio Environment
    const scene = new THREE.Scene();
    const bgHex = 0xebf0f5;
    scene.background = new THREE.Color(bgHex);
    scene.fog = new THREE.FogExp2(bgHex, 0.0145);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    const camera = new THREE.PerspectiveCamera(
      40,
      container.clientWidth / Math.max(container.clientHeight, 1),
      0.1,
      180,
    );
    camera.position.set(13.5, 12.2, 14.5);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.06;
    controls.minDistance = 6.5;
    controls.maxDistance = 30;
    controls.maxPolarAngle = Math.PI / 2 - 0.12;
    controls.minPolarAngle = 0.18;
    controls.target.set(0, 0.4, 0);

    // 3-Point Warm/Cool Studio Lighting
    const hemiLight = new THREE.HemisphereLight(0xdce8f7, 0xb8a996, 0.72);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff4e0, 1.55);
    keyLight.position.set(12, 18, 10);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.width = 2048;
    keyLight.shadow.mapSize.height = 2048;
    keyLight.shadow.camera.near = 2;
    keyLight.shadow.camera.far = 45;
    const d = 14;
    keyLight.shadow.camera.left = -d;
    keyLight.shadow.camera.right = d;
    keyLight.shadow.camera.top = d;
    keyLight.shadow.camera.bottom = -d;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0xcbe2ff, 0.52);
    rimLight.position.set(-14, 9, -12);
    scene.add(rimLight);

    // Architectural studio ground deck under the hex island (so nothing floats in void)
    const deckGeo = new THREE.CylinderGeometry(16.5, 17.5, 0.6, 6);
    const deckMat = new THREE.MeshStandardMaterial({
      color: 0xdce3ec,
      roughness: 0.88,
      metalness: 0.04,
    });
    const deckMesh = new THREE.Mesh(deckGeo, deckMat);
    deckMesh.position.y = -0.56;
    deckMesh.receiveShadow = true;
    scene.add(deckMesh);

    const outerFloor = new THREE.Mesh(
      new THREE.CircleGeometry(65, 48),
      new THREE.MeshStandardMaterial({ color: 0xe3e9f0, roughness: 0.95 }),
    );
    outerFloor.rotation.x = -Math.PI / 2;
    outerFloor.position.y = -0.86;
    outerFloor.receiveShadow = true;
    scene.add(outerFloor);

    const textures = createProceduralTextures(renderer.capabilities.getMaxAnisotropy());

    // Hover cursor hex ring
    const hoverRingGeo = new THREE.RingGeometry(HEX_RADIUS - 0.13, HEX_RADIUS - 0.02, 6);
    hoverRingGeo.rotateX(-Math.PI / 2);
    hoverRingGeo.rotateY(Math.PI / 6);
    const hoverRingMat = new THREE.MeshBasicMaterial({
      color: 0x2563eb,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.78,
    });
    const hoverRing = new THREE.Mesh(hoverRingGeo, hoverRingMat);
    hoverRing.position.y = 0.055;
    hoverRing.visible = false;
    scene.add(hoverRing);

    const tileGroup = new THREE.Group();
    scene.add(tileGroup);

    const tileMeshes = new Map<string, { group: THREE.Group; hitMesh: THREE.Mesh }>();
    const monitorGlows: THREE.Mesh[] = [];
    const tilesMap = new Map<string, HexTile>();

    for (const tile of tilesRef.current) {
      tilesMap.set(tile.id, tile);
      const { group, hitMesh, monitorGlows: glows } = createHexTileGroup(tile, textures);
      const world = hexToWorld(tile.q, tile.r);
      group.position.set(world.x, 0, world.z);
      tileGroup.add(group);
      tileMeshes.set(tile.id, { group, hitMesh });
      monitorGlows.push(...glows);
    }

    const getTileSlotWorld = (coord: HexCoord, agentIndex: number) => {
      const base = hexToWorld(coord.q, coord.r);
      const tile = tilesMap.get(hexKey(coord.q, coord.r));
      const rot = ((tile?.rotationStep ?? 0) * Math.PI) / 3;
      let lx = 0;
      let lz = 0;
      let faceAngle = Math.PI + rot;

      if (tile?.type === 'workstation') {
        lx = 0;
        lz = 0.26;
        faceAngle = Math.PI + rot;
      } else if (tile?.type === 'meeting') {
        const ang = (agentIndex * Math.PI) / 2 + Math.PI / 4;
        lx = Math.cos(ang) * 0.92;
        lz = Math.sin(ang) * 0.92;
        faceAngle = Math.atan2(-lx, -lz);
      } else if (tile?.type === 'lounge') {
        lx = agentIndex % 2 === 0 ? -0.36 : 0.36;
        lz = 0.34;
        faceAngle = Math.PI + rot;
      } else if (tile?.type === 'garden') {
        lx = 0.32;
        lz = 0.44;
        faceAngle = -0.35 + rot;
      } else if (tile?.type === 'server') {
        lx = 0;
        lz = 0.65;
        faceAngle = Math.PI + rot;
      }

      const cosR = Math.cos(rot);
      const sinR = Math.sin(rot);
      return {
        x: base.x + lx * cosR + lz * sinR,
        z: base.z - lx * sinR + lz * cosR,
        facing: faceAngle,
      };
    };

    // Build 4 AI Agent Characters
    const agents = new Map<string, InternalAgentSim>();
    const agentsGroup = new THREE.Group();
    scene.add(agentsGroup);

    AGENT_PROFILES.forEach((profile, agentIdx) => {
      const initial = agentStates[profile.id];
      const coord = initial?.coord ?? profile.homeCoord;
      const slot = getTileSlotWorld(coord, agentIdx);
      const { rig, hitMesh } = createAgentModel(profile, textures);
      rig.root.position.set(slot.x, 0, slot.z);
      rig.bodyGroup.rotation.y = slot.facing;
      agentsGroup.add(rig.root);

      agents.set(profile.id, {
        id: profile.id,
        coord: { ...coord },
        worldX: slot.x,
        worldZ: slot.z,
        facing: slot.facing,
        path: [],
        pathIndex: 0,
        activity: initial?.activity ?? 'working',
        energy: initial?.energy ?? 90,
        focus: initial?.focus ?? 92,
        tasksCompleted: initial?.tasksCompleted ?? 2,
        thoughtBubble: initial?.thoughtBubble ?? 'Siap bekerja',
        currentTask: initial?.currentTask ?? 'Operasional Studio',
        timer: 4 + Math.random() * 5,
        rig,
        hitMesh,
      });
    });

    // Camera transition state
    let camTransitionActive = false;
    const applyCameraPreset = (preset: CameraPreset) => {
      if (preset === 'isometric') {
        _targetCamPos.set(13.5, 12.2, 14.5);
        _targetCtrl.set(0, 0.4, 0);
        camTransitionActive = true;
      } else if (preset === 'top') {
        _targetCamPos.set(0.01, 21.5, 4.5);
        _targetCtrl.set(0, 0, 0);
        camTransitionActive = true;
      } else if (preset === 'focus') {
        const targetId = selectedAgentRef.current ?? AGENT_PROFILES[0]?.id ?? 'raka';
        const ag = agents.get(targetId);
        if (ag) {
          _targetCtrl.set(ag.worldX, 0.85, ag.worldZ);
          _targetCamPos.set(ag.worldX + 4.8, 4.8, ag.worldZ + 5.2);
          camTransitionActive = true;
        }
      }
    };

    const handleControlsStart = () => {
      camTransitionActive = false;
    };
    controls.addEventListener('start', handleControlsStart);

    // Helper: pick random tile of given type
    const findNearestTileOfType = (from: HexCoord, type: TileType): HexTile | null => {
      const candidates = Array.from(ctx.tilesMap.values()).filter((t) => t.type === type);
      if (candidates.length === 0) return null;
      candidates.sort(
        (a, b) =>
          Math.abs(a.q - from.q) + Math.abs(a.r - from.r) - (Math.abs(b.q - from.q) + Math.abs(b.r - from.r)),
      );
      return candidates[0];
    };

    const sendAgentToCoord = (
      ag: InternalAgentSim,
      dest: HexCoord,
      arrivalActivity: AgentActivityState,
      thought: string,
      taskDesc?: string,
    ) => {
      const path = findHexPath(ag.coord, dest, ctx.tilesMap);
      ag.path = path;
      ag.pathIndex = path.length > 1 ? 1 : 0;
      ag.activity = path.length > 1 ? 'walking' : arrivalActivity;
      ag.thoughtBubble = thought;
      if (taskDesc) ag.currentTask = taskDesc;
      ag.timer = arrivalActivity === 'thinking' ? 14 : 6 + Math.random() * 5;
      // Store intended arrival state in userData
      ag.rig.root.userData.nextActivity = arrivalActivity;
    };

    const issueDirective = (directive: AgentDirective) => {
      const ag = agents.get(directive.agentId);
      const profile = AGENT_PROFILES.find((p) => p.id === directive.agentId);
      if (!ag || !profile) return;

      let destCoord = profile.homeCoord;
      if (directive.targetType !== 'home') {
        const found = findNearestTileOfType(ag.coord, directive.targetType);
        if (found) destCoord = { q: found.q, r: found.r };
      }

      sendAgentToCoord(
        ag,
        destCoord,
        directive.activity,
        directive.thoughtBubble,
        directive.currentTask,
      );
      if (directive.activity === 'working') {
        ag.tasksCompleted += 1;
      }
    };

    const ctx = {
      scene,
      textures,
      tileGroup,
      tileMeshes,
      monitorGlows,
      agents,
      tilesMap,
      applyCameraPreset,
      issueDirective,
    };
    sceneCtxRef.current = ctx;

    // Pre-warm shaders on hardware GPUs
    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // Raycasting setup (Layer 1 only!)
    const raycaster = new THREE.Raycaster();
    raycaster.layers.set(1);
    const pointer = new THREE.Vector2();
    let lastHoverTime = 0;
    let pointerDownPos = { x: 0, y: 0 };

    const updatePointer = (e: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    };

    const onPointerDown = (e: PointerEvent) => {
      pointerDownPos = { x: e.clientX, y: e.clientY };
    };

    const onPointerMove = (e: PointerEvent) => {
      const now = performance.now();
      if (now - lastHoverTime < 45) return;
      lastHoverTime = now;

      updatePointer(e);
      raycaster.setFromCamera(pointer, camera);

      const tileHits: THREE.Object3D[] = [];
      ctx.tileMeshes.forEach(({ hitMesh }) => tileHits.push(hitMesh));
      const agentHits: THREE.Object3D[] = [];
      ctx.agents.forEach((a) => agentHits.push(a.hitMesh));

      const targets =
        workspaceModeRef.current === 'layout' ? tileHits : [...agentHits, ...tileHits];
      const intersects = raycaster.intersectObjects(targets, false);

      if (intersects.length > 0) {
        const hit = intersects[0].object;
        if (hit.userData.agentId) {
          renderer.domElement.style.cursor = 'pointer';
          hoverRing.visible = false;
        } else if (hit.userData.tileId) {
          const world = hexToWorld(hit.userData.q, hit.userData.r);
          hoverRing.position.set(world.x, 0.055, world.z);
          hoverRingMat.color.setHex(
            workspaceModeRef.current === 'layout' ? 0xd96b43 : 0x2563eb,
          );
          hoverRing.visible = true;
          renderer.domElement.style.cursor =
            workspaceModeRef.current === 'layout' ? 'crosshair' : 'pointer';
        }
      } else {
        hoverRing.visible = false;
        renderer.domElement.style.cursor = 'grab';
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      const dx = e.clientX - pointerDownPos.x;
      const dy = e.clientY - pointerDownPos.y;
      if (Math.hypot(dx, dy) > 6) return; // Dragging OrbitControls, not clicking

      updatePointer(e);
      raycaster.setFromCamera(pointer, camera);

      const tileHits: THREE.Object3D[] = [];
      ctx.tileMeshes.forEach(({ hitMesh }) => tileHits.push(hitMesh));
      const agentHits: THREE.Object3D[] = [];
      ctx.agents.forEach((a) => agentHits.push(a.hitMesh));

      if (workspaceModeRef.current === 'layout') {
        const hits = raycaster.intersectObjects(tileHits, false);
        if (hits.length > 0) {
          const tile = ctx.tilesMap.get(hits[0].object.userData.tileId);
          if (tile) callbacksRef.current.onTileClick(tile);
        }
        return;
      }

      const agentIntersects = raycaster.intersectObjects(agentHits, false);
      if (agentIntersects.length > 0) {
        const agentId = agentIntersects[0].object.userData.agentId as string;
        callbacksRef.current.onSelectAgent(agentId);
        return;
      }

      const tileIntersects = raycaster.intersectObjects(tileHits, false);
      if (tileIntersects.length > 0) {
        const tile = ctx.tilesMap.get(tileIntersects[0].object.userData.tileId);
        if (tile) {
          callbacksRef.current.onTileClick(tile);
          // If tile has an assigned agent, select them too
          if (tile.assignedAgentId) {
            callbacksRef.current.onSelectAgent(tile.assignedAgentId);
          }
        }
      }
    };

    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('pointerup', onPointerUp);

    const onResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = Math.max(container.clientHeight, 1);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    // Animation loop with software WebGL afterDraw pacing
    const clock = new THREE.Clock();
    let frameId = 0;
    let disposed = false;
    let stateSyncTimer = 0;

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (disposed) {
          if (sync) gl.deleteSync(sync);
          return;
        }
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    function tick() {
      if (disposed) return;
      const rawDelta = Math.min(clock.getDelta(), 0.1);
      const elapsed = clock.elapsedTime;
      const simDelta = rawDelta * simSpeedRef.current;

      // Smooth damped camera preset motion
      if (camTransitionActive) {
        camera.position.x = THREE.MathUtils.damp(camera.position.x, _targetCamPos.x, 5.5, rawDelta);
        camera.position.y = THREE.MathUtils.damp(camera.position.y, _targetCamPos.y, 5.5, rawDelta);
        camera.position.z = THREE.MathUtils.damp(camera.position.z, _targetCamPos.z, 5.5, rawDelta);
        controls.target.x = THREE.MathUtils.damp(controls.target.x, _targetCtrl.x, 5.5, rawDelta);
        controls.target.y = THREE.MathUtils.damp(controls.target.y, _targetCtrl.y, 5.5, rawDelta);
        controls.target.z = THREE.MathUtils.damp(controls.target.z, _targetCtrl.z, 5.5, rawDelta);
        if (camera.position.distanceTo(_targetCamPos) < 0.04) {
          camTransitionActive = false;
        }
      }
      controls.update();

      // Subtle holographic projector & server pulse
      ctx.monitorGlows.forEach((mesh, idx) => {
        if (mesh.geometry.type === 'OctahedronGeometry') {
          mesh.rotation.y = elapsed * 0.9;
          mesh.position.y = 0.96 + Math.sin(elapsed * 2.1 + idx) * 0.04;
        }
      });

      // Update each AI Agent's movement, autonomous office life, and kinematics
      ctx.agents.forEach((ag) => {
        const profile = AGENT_PROFILES.find((p) => p.id === ag.id)!;
        const isSelected = selectedAgentRef.current === ag.id;
        ag.rig.selectionRing.visible = isSelected;

        // Movement along A* path
        const agentIdx = AGENT_PROFILES.findIndex((p) => p.id === ag.id);
        if (ag.activity === 'walking' && ag.path.length > 0 && ag.pathIndex < ag.path.length) {
          const targetCoord = ag.path[ag.pathIndex];
          const isFinalStep = ag.pathIndex === ag.path.length - 1;
          const destWorld = isFinalStep
            ? getTileSlotWorld(targetCoord, Math.max(0, agentIdx))
            : { ...hexToWorld(targetCoord.q, targetCoord.r), facing: ag.facing };
          const dx = destWorld.x - ag.worldX;
          const dz = destWorld.z - ag.worldZ;
          const dist = Math.hypot(dx, dz);
          const walkSpeed = 2.35;

          if (dist < 0.08) {
            ag.coord = { ...targetCoord };
            ag.pathIndex += 1;
            if (ag.pathIndex >= ag.path.length) {
              ag.path = [];
              const nextAct = (ag.rig.root.userData.nextActivity as AgentActivityState) || 'working';
              ag.activity = nextAct;
              ag.facing = destWorld.facing;
            }
          } else if (simDelta > 0) {
            const step = Math.min(dist, walkSpeed * simDelta);
            ag.worldX += (dx / dist) * step;
            ag.worldZ += (dz / dist) * step;
            const targetAngle = Math.atan2(dx, dz);
            // Shortest angle interpolation
            let diff = targetAngle - ag.facing;
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;
            ag.facing += diff * Math.min(1, rawDelta * 10);
          }
        } else if (simDelta > 0) {
          // Autonomous Office Life decision timer
          ag.timer -= simDelta;
          if (ag.activity === 'working') {
            ag.energy = Math.max(25, ag.energy - simDelta * 0.9);
            ag.focus = Math.max(40, ag.focus - simDelta * 0.4);
          } else if (ag.activity === 'coffee') {
            ag.energy = Math.min(100, ag.energy + simDelta * 9);
          } else if (ag.activity === 'meeting') {
            ag.focus = Math.min(100, ag.focus + simDelta * 4);
          }

          if (ag.timer <= 0 && ag.activity !== 'thinking') {
            if (ag.energy < 55) {
              const cafe = findNearestTileOfType(ag.coord, 'lounge');
              if (cafe) {
                sendAgentToCoord(ag, { q: cafe.q, r: cafe.r }, 'coffee', 'Sedang menyeduh espresso...');
              }
            } else if (ag.activity !== 'working') {
              sendAgentToCoord(
                ag,
                profile.homeCoord,
                'working',
                profile.id === 'raka'
                  ? 'Memantau tren Adobe Stock'
                  : profile.id === 'tari'
                    ? 'Menulis skrip & hook Reels'
                    : profile.id === 'bima'
                      ? 'Meracik prompt visual AI'
                      : 'Menyusun 49 keyword aset',
              );
            } else {
              const roll = Math.random();
              if (roll < 0.28) {
                const meeting = findNearestTileOfType(ag.coord, 'meeting');
                if (meeting) {
                  sendAgentToCoord(ag, { q: meeting.q, r: meeting.r }, 'meeting', 'Sinkronisasi singkat di ruang rapat');
                }
              } else if (roll < 0.48) {
                const garden = findNearestTileOfType(ag.coord, 'garden');
                if (garden) {
                  sendAgentToCoord(ag, { q: garden.q, r: garden.r }, 'idle', 'Segarkan pikiran di taman');
                }
              } else {
                ag.timer = 7 + Math.random() * 6;
              }
            }
          }
        }

        // Apply world transform & procedural character animation
        ag.rig.root.position.set(ag.worldX, 0, ag.worldZ);
        ag.rig.bodyGroup.rotation.y = ag.facing;

        if (ag.activity === 'walking' && simSpeedRef.current > 0) {
          const phase = elapsed * 9.5 * Math.max(0.6, simSpeedRef.current * 0.8);
          ag.rig.leftLeg.rotation.x = Math.sin(phase) * 0.55;
          ag.rig.rightLeg.rotation.x = -Math.sin(phase) * 0.55;
          ag.rig.leftArm.rotation.x = -Math.sin(phase) * 0.45;
          ag.rig.rightArm.rotation.x = Math.sin(phase) * 0.45;
          ag.rig.bodyGroup.position.y = 0.036 + Math.abs(Math.sin(phase)) * 0.035;
          ag.rig.statusHalo.visible = false;
        } else if (ag.activity === 'working' || ag.activity === 'thinking') {
          const typeSpeed = ag.activity === 'thinking' ? 13 : 7;
          ag.rig.leftLeg.rotation.x = THREE.MathUtils.damp(ag.rig.leftLeg.rotation.x, 0, 8, rawDelta);
          ag.rig.rightLeg.rotation.x = THREE.MathUtils.damp(ag.rig.rightLeg.rotation.x, 0, 8, rawDelta);
          ag.rig.leftArm.rotation.x = -0.85 + Math.sin(elapsed * typeSpeed) * 0.14;
          ag.rig.rightArm.rotation.x = -0.85 + Math.cos(elapsed * typeSpeed) * 0.14;
          ag.rig.bodyGroup.position.y = 0.036;
          ag.rig.headGroup.rotation.y = Math.sin(elapsed * 1.4 + ag.worldX) * 0.12;
          ag.rig.statusHalo.visible = ag.activity === 'thinking';
          if (ag.activity === 'thinking') {
            ag.rig.statusHalo.rotation.y = elapsed * 2.4;
            ag.rig.statusHalo.position.y = 1.38 + Math.sin(elapsed * 3.5) * 0.05;
          }
        } else {
          // Coffee / meeting / idle gentle breathing
          ag.rig.leftLeg.rotation.x = THREE.MathUtils.damp(ag.rig.leftLeg.rotation.x, 0, 8, rawDelta);
          ag.rig.rightLeg.rotation.x = THREE.MathUtils.damp(ag.rig.rightLeg.rotation.x, 0, 8, rawDelta);
          ag.rig.leftArm.rotation.x = THREE.MathUtils.damp(ag.rig.leftArm.rotation.x, 0, 8, rawDelta);
          ag.rig.rightArm.rotation.x =
            ag.activity === 'coffee'
              ? -0.65 + Math.sin(elapsed * 2.4) * 0.12
              : THREE.MathUtils.damp(ag.rig.rightArm.rotation.x, 0, 8, rawDelta);
          ag.rig.bodyGroup.position.y = 0.036 + Math.sin(elapsed * 2 + ag.worldZ) * 0.012;
          ag.rig.headGroup.rotation.y = Math.sin(elapsed * 0.9) * 0.16;
          ag.rig.statusHalo.visible = false;
        }

        // Project 3D head position to 2D DOM bubble overlay (zero React re-renders!)
        const bubbleEl = bubbleRefs.current[ag.id];
        const mountEl = mountRef.current;
        if (bubbleEl && mountEl) {
          if (!showBubblesRef.current) {
            bubbleEl.style.opacity = '0';
          } else {
            _projVec.set(ag.worldX, 1.56, ag.worldZ);
            _projVec.project(camera);
            if (_projVec.z > 1) {
              bubbleEl.style.opacity = '0';
            } else {
              const sx = ((_projVec.x + 1) / 2) * mountEl.clientWidth;
              const sy = ((-_projVec.y + 1) / 2) * mountEl.clientHeight;
              bubbleEl.style.opacity = '1';
              bubbleEl.style.transform = `translate3d(${sx}px, ${sy}px, 0) translate(-50%, -100%)`;
            }
          }
        }
      });

      // Periodically sync simulation telemetry back to React state (~2x/sec)
      stateSyncTimer += rawDelta;
      if (stateSyncTimer >= 0.5) {
        stateSyncTimer = 0;
        callbacksRef.current.onUpdateAgentStates((prev) => {
          const next = { ...prev };
          let changed = false;
          ctx.agents.forEach((ag, id) => {
            const p = prev[id];
            if (
              !p ||
              p.activity !== ag.activity ||
              Math.round(p.energy) !== Math.round(ag.energy) ||
              Math.round(p.focus) !== Math.round(ag.focus) ||
              p.thoughtBubble !== ag.thoughtBubble
            ) {
              changed = true;
              next[id] = {
                id,
                coord: { ...ag.coord },
                worldX: ag.worldX,
                worldZ: ag.worldZ,
                activity: ag.activity,
                energy: Math.round(ag.energy),
                focus: Math.round(ag.focus),
                tasksCompleted: ag.tasksCompleted,
                thoughtBubble: ag.thoughtBubble,
                currentTask: ag.currentTask,
              };
            }
          });
          return changed ? next : prev;
        });
      }

      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    }

    tick();

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      window.removeEventListener('resize', onResize);
      controls.removeEventListener('start', handleControlsStart);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      renderer.domElement.removeEventListener('webglcontextlost', handleContextLost);
      renderer.domElement.removeEventListener('webglcontextrestored', handleContextRestored);

      controls.dispose();
      textures.dispose();
      ctx.tileMeshes.forEach(({ group }) => disposeObject3D(group));
      ctx.agents.forEach((a) => disposeObject3D(a.rig.root));
      scene.environment?.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
      sceneCtxRef.current = null;
    };
  }, []);

  if (webglError) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-[#EBF0F5] p-6">
        <div className="max-w-md bg-white border border-slate-200 rounded-xl p-6 text-center shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Tampilan 3D Tidak Tersedia</h2>
          <p className="mt-2 text-sm text-slate-600">{webglError}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full overflow-hidden">
      {/* Isolated WebGL mount node */}
      <div ref={mountRef} className="w-full h-full" />

      {/* Projected 2D DOM agent badges & thought bubbles (zero canvas text baking) */}
      <div
        ref={bubbleContainerRef}
        className="pointer-events-none absolute inset-0 overflow-hidden z-10"
      >
        {AGENT_PROFILES.map((profile) => {
          const runtime = agentStates[profile.id];
          const isSelected = selectedAgentId === profile.id;
          return (
            <div
              key={profile.id}
              ref={(el) => {
                bubbleRefs.current[profile.id] = el;
              }}
              style={{
                opacity: 0,
                transition: 'opacity 150ms ease',
              }}
              className="absolute top-0 left-0 will-change-transform"
            >
              <button
                type="button"
                onClick={() => onSelectAgent(profile.id)}
                className={`pointer-events-auto group flex flex-col items-center text-left transition-transform duration-150 ${
                  isSelected ? 'scale-105' : 'hover:scale-105'
                }`}
              >
                <div
                  className={`px-2.5 py-1.5 rounded-lg border shadow-sm max-w-[190px] ${
                    isSelected
                      ? 'bg-slate-900 text-white border-slate-800'
                      : 'bg-white/95 text-slate-800 border-slate-200/90'
                  }`}
                >
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold leading-tight">
                    <span
                      className="inline-block w-2 h-2 rounded-xs shrink-0"
                      style={{ backgroundColor: profile.accentHex }}
                    />
                    <span className="truncate">{profile.name}</span>
                    <span
                      className={`font-normal ${
                        isSelected ? 'text-slate-300' : 'text-slate-400'
                      }`}
                    >
                      · {ACTIVITY_LABELS[runtime?.activity ?? 'working']}
                    </span>
                  </div>
                  <p
                    className={`mt-0.5 text-[11px] leading-snug line-clamp-1 ${
                      isSelected ? 'text-slate-200' : 'text-slate-600'
                    }`}
                  >
                    {runtime?.thoughtBubble ?? 'Siap bekerja'}
                  </p>
                </div>
                <div
                  className={`w-2 h-2 rotate-45 -mt-1 border-r border-b ${
                    isSelected
                      ? 'bg-slate-900 border-slate-800'
                      : 'bg-white/95 border-slate-200/90'
                  }`}
                />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
