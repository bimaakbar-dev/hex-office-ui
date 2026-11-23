import * as THREE from 'three';
import type { AgentProfile, HexTile } from '../types/office';
import { HEX_RADIUS } from './hexMath';
import type { ProceduralTexturePack } from './proceduralTextures';

const TILE_HEIGHT = 0.24;

function createHexShape(radius: number): THREE.Shape {
  const shape = new THREE.Shape();
  for (let i = 0; i < 6; i++) {
    // Pointy-top hexagon angles: 30, 90, 150, 210, 270, 330 deg
    const angle = (Math.PI / 180) * (60 * i + 30);
    const x = radius * Math.cos(angle);
    const y = radius * Math.sin(angle);
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  return shape;
}

const HEX_BASE_GEO = (() => {
  const shape = createHexShape(HEX_RADIUS - 0.04);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: TILE_HEIGHT,
    bevelEnabled: true,
    bevelThickness: 0.035,
    bevelSize: 0.035,
    bevelSegments: 2,
  });
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, -TILE_HEIGHT, 0);
  geo.computeVertexNormals();
  return geo;
})();

const HEX_INLAY_GEO = (() => {
  const shape = createHexShape(HEX_RADIUS - 0.16);
  const hole = createHexShape(HEX_RADIUS - 0.21);
  shape.holes.push(hole);
  const geo = new THREE.ShapeGeometry(shape);
  geo.rotateX(-Math.PI / 2);
  return geo;
})();

export interface AgentRig {
  root: THREE.Group;
  bodyGroup: THREE.Group;
  headGroup: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  statusHalo: THREE.Mesh;
  selectionRing: THREE.Mesh;
}

export function createHexTileGroup(
  tile: HexTile,
  textures: ProceduralTexturePack,
): { group: THREE.Group; hitMesh: THREE.Mesh; monitorGlows: THREE.Mesh[] } {
  const group = new THREE.Group();
  const monitorGlows: THREE.Mesh[] = [];

  // Tile surface color & material properties
  const surfaceConfig: Record<
    HexTile['type'],
    { color: number; roughness: number; metalness: number; useTerrazzo?: boolean; rimColor: number }
  > = {
    walkway: { color: 0xf4f0e8, roughness: 0.78, metalness: 0.04, useTerrazzo: true, rimColor: 0xc8b89a },
    workstation: { color: 0xebe4d8, roughness: 0.72, metalness: 0.05, rimColor: 0x94a3b8 },
    meeting: { color: 0xe3e9f0, roughness: 0.65, metalness: 0.08, rimColor: 0x64748b },
    lounge: { color: 0xf0e4d8, roughness: 0.75, metalness: 0.05, rimColor: 0xd98a6c },
    garden: { color: 0xe4ece2, roughness: 0.85, metalness: 0.02, rimColor: 0x6e9b77 },
    server: { color: 0xdbe2ea, roughness: 0.55, metalness: 0.18, rimColor: 0x475569 },
  };

  const cfg = surfaceConfig[tile.type];
  const baseMat = new THREE.MeshStandardMaterial({
    color: cfg.color,
    map: cfg.useTerrazzo ? textures.terrazzo : null,
    roughness: cfg.roughness,
    metalness: cfg.metalness,
  });

  const baseMesh = new THREE.Mesh(HEX_BASE_GEO, baseMat);
  baseMesh.castShadow = false;
  baseMesh.receiveShadow = true;
  baseMesh.name = 'tile-base';
  group.add(baseMesh);

  // Thin metallic/architectural inlay ring on top surface (offset +0.024 above bevel)
  const inlayMat = new THREE.MeshStandardMaterial({
    color: cfg.rimColor,
    roughness: 0.35,
    metalness: 0.45,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const inlayMesh = new THREE.Mesh(HEX_INLAY_GEO, inlayMat);
  inlayMesh.position.y = 0.036;
  inlayMesh.receiveShadow = true;
  group.add(inlayMesh);

  // Invisible hit proxy on layer 1 for fast raycasting
  const hitGeo = new THREE.CylinderGeometry(HEX_RADIUS - 0.02, HEX_RADIUS - 0.02, 0.35, 6);
  const hitMat = new THREE.MeshBasicMaterial({ visible: false });
  const hitMesh = new THREE.Mesh(hitGeo, hitMat);
  hitMesh.position.y = 0.1;
  hitMesh.layers.set(1);
  hitMesh.userData = { tileId: tile.id, q: tile.q, r: tile.r };
  group.add(hitMesh);

  // Props group rotated cleanly by tile.rotationStep
  const props = new THREE.Group();
  props.position.y = 0.036;
  props.rotation.y = ((tile.rotationStep ?? 0) * Math.PI) / 3;

  const woodMat = new THREE.MeshStandardMaterial({
    map: textures.oakWood,
    roughness: 0.62,
    metalness: 0.05,
  });
  const darkMetalMat = new THREE.MeshStandardMaterial({
    color: 0x262f3b,
    roughness: 0.28,
    metalness: 0.85,
  });
  const brushedSteelMat = new THREE.MeshStandardMaterial({
    color: 0xcbd5e1,
    roughness: 0.24,
    metalness: 0.88,
  });
  const brassMat = new THREE.MeshStandardMaterial({
    color: 0xc89b54,
    roughness: 0.25,
    metalness: 0.86,
  });

  if (tile.type === 'workstation') {
    // Grounding shadow under desk
    const shadowPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(1.9, 1.4),
      new THREE.MeshBasicMaterial({
        map: textures.contactShadow,
        transparent: true,
        depthWrite: false,
        opacity: 0.35,
      }),
    );
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.position.set(0, 0.005, -0.15);
    props.add(shadowPlane);

    // Desk top (oak)
    const deskTop = new THREE.Mesh(new THREE.BoxGeometry(1.52, 0.07, 0.78), woodMat);
    deskTop.position.set(0, 0.72, -0.35);
    deskTop.castShadow = true;
    deskTop.receiveShadow = true;
    props.add(deskTop);

    // 4 steel legs
    const legGeo = new THREE.CylinderGeometry(0.03, 0.025, 0.7, 8);
    const legPositions = [
      [-0.66, 0.35, -0.66],
      [0.66, 0.35, -0.66],
      [-0.66, 0.35, -0.04],
      [0.66, 0.35, -0.04],
    ];
    for (const [lx, ly, lz] of legPositions) {
      const leg = new THREE.Mesh(legGeo, darkMetalMat);
      leg.position.set(lx, ly, lz);
      leg.castShadow = true;
      props.add(leg);
    }

    // Monitor stand + dual curved monitors
    const standPost = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.038, 0.32, 10), brushedSteelMat);
    standPost.position.set(0, 0.9, -0.56);
    props.add(standPost);

    const screenMap =
      tile.assignedAgentId === 'raka'
        ? textures.screenChart
        : tile.assignedAgentId === 'bima'
          ? textures.screenDesign
          : tile.assignedAgentId === 'sora'
            ? textures.screenQa
            : textures.screenCode;

    const screenMat = new THREE.MeshStandardMaterial({
      map: screenMap,
      emissive: 0xffffff,
      emissiveMap: screenMap,
      emissiveIntensity: 0.48,
      roughness: 0.18,
      metalness: 0.1,
    });

    for (const side of [-1, 1]) {
      const monitorGroup = new THREE.Group();
      monitorGroup.position.set(side * 0.32, 1.06, -0.5);
      monitorGroup.rotation.y = side * -0.18;

      const bezel = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.36, 0.03), darkMetalMat);
      bezel.castShadow = true;
      monitorGroup.add(bezel);

      const display = new THREE.Mesh(new THREE.PlaneGeometry(0.53, 0.31), screenMat);
      display.position.z = 0.017;
      monitorGlows.push(display);
      monitorGroup.add(display);

      props.add(monitorGroup);
    }

    // Desk Lamp (3 parts: base, arm, shade)
    const lampBase = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 0.03, 12), brassMat);
    lampBase.position.set(-0.56, 0.77, -0.52);
    props.add(lampBase);
    const lampStem = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.34, 8), brassMat);
    lampStem.position.set(-0.56, 0.94, -0.52);
    props.add(lampStem);
    const lampShade = new THREE.Mesh(
      new THREE.ConeGeometry(0.11, 0.12, 12),
      new THREE.MeshStandardMaterial({ color: 0xd96b43, roughness: 0.45, metalness: 0.2 }),
    );
    lampShade.position.set(-0.5, 1.08, -0.48);
    lampShade.rotation.z = -0.35;
    props.add(lampShade);

    // Ceramic Coffee Mug
    const mug = new THREE.Mesh(
      new THREE.CylinderGeometry(0.042, 0.038, 0.09, 10),
      new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.2, metalness: 0.05 }),
    );
    mug.position.set(0.52, 0.8, -0.22);
    props.add(mug);

    // Ergonomic Chair
    const chairGroup = new THREE.Group();
    chairGroup.position.set(0, 0, 0.32);
    const chairBase = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 0.05, 5), darkMetalMat);
    chairBase.position.y = 0.04;
    chairGroup.add(chairBase);
    const chairStem = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.36, 8), brushedSteelMat);
    chairStem.position.y = 0.22;
    chairGroup.add(chairStem);
    const chairSeat = new THREE.Mesh(
      new THREE.BoxGeometry(0.46, 0.08, 0.44),
      new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.85, metalness: 0.02 }),
    );
    chairSeat.position.y = 0.42;
    chairSeat.castShadow = true;
    chairGroup.add(chairSeat);
    const chairBack = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.46, 0.07),
      new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.85, metalness: 0.02 }),
    );
    chairBack.position.set(0, 0.67, 0.19);
    chairBack.castShadow = true;
    chairGroup.add(chairBack);
    props.add(chairGroup);
  } else if (tile.type === 'meeting') {
    const shadowPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(2.1, 2.1),
      new THREE.MeshBasicMaterial({
        map: textures.contactShadow,
        transparent: true,
        depthWrite: false,
        opacity: 0.35,
      }),
    );
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.position.y = 0.005;
    props.add(shadowPlane);

    // Round walnut/oak conference table
    const tablePedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.38, 0.68, 16), brushedSteelMat);
    tablePedestal.position.y = 0.34;
    tablePedestal.castShadow = true;
    props.add(tablePedestal);

    const tableTop = new THREE.Mesh(new THREE.CylinderGeometry(0.86, 0.86, 0.07, 24), woodMat);
    tableTop.position.y = 0.7;
    tableTop.castShadow = true;
    tableTop.receiveShadow = true;
    props.add(tableTop);

    // Central holographic projector pad + glowing core
    const padBase = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, 0.04, 6), darkMetalMat);
    padBase.position.y = 0.75;
    props.add(padBase);

    const holoPrism = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.13, 0),
      new THREE.MeshStandardMaterial({
        color: 0x60a5fa,
        emissive: 0x2563eb,
        emissiveIntensity: 0.75,
        roughness: 0.15,
        metalness: 0.2,
        transparent: true,
        opacity: 0.88,
      }),
    );
    holoPrism.position.y = 0.96;
    monitorGlows.push(holoPrism);
    props.add(holoPrism);

    // 4 Minimalist conference chairs
    const chairMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.78, metalness: 0.05 });
    for (let i = 0; i < 4; i++) {
      const ang = (i * Math.PI) / 2 + Math.PI / 4;
      const cx = Math.cos(ang) * 1.05;
      const cz = Math.sin(ang) * 1.05;
      const cGroup = new THREE.Group();
      cGroup.position.set(cx, 0, cz);
      cGroup.rotation.y = -ang + Math.PI / 2;
      const seat = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.18, 0.07, 12), chairMat);
      seat.position.y = 0.42;
      seat.castShadow = true;
      cGroup.add(seat);
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.14, 0.4, 8), brushedSteelMat);
      leg.position.y = 0.2;
      cGroup.add(leg);
      const back = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.28, 0.05), chairMat);
      back.position.set(0, 0.58, 0.16);
      cGroup.add(back);
      props.add(cGroup);
    }
  } else if (tile.type === 'server') {
    const rackMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.35, metalness: 0.78 });
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x93c5fd,
      roughness: 0.12,
      metalness: 0.2,
      transparent: true,
      opacity: 0.32,
    });

    for (const offset of [-0.42, 0.42]) {
      const rack = new THREE.Group();
      rack.position.set(offset, 0, -0.1);

      const cabinet = new THREE.Mesh(new THREE.BoxGeometry(0.68, 1.56, 0.72), rackMat);
      cabinet.position.y = 0.78;
      cabinet.castShadow = true;
      cabinet.receiveShadow = true;
      rack.add(cabinet);

      const glassDoor = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 1.38), glassMat);
      glassDoor.position.set(0, 0.78, 0.365);
      rack.add(glassDoor);

      // Blade trays + LED strips
      for (let b = 0; b < 5; b++) {
        const blade = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.12, 0.05), brushedSteelMat);
        blade.position.set(0, 0.28 + b * 0.25, 0.34);
        rack.add(blade);

        const led = new THREE.Mesh(
          new THREE.BoxGeometry(0.12, 0.025, 0.02),
          new THREE.MeshStandardMaterial({
            color: b % 2 === 0 ? 0x38bdf8 : 0x34d399,
            emissive: b % 2 === 0 ? 0x0284c7 : 0x059669,
            emissiveIntensity: 0.9,
          }),
        );
        led.position.set(0.16, 0.28 + b * 0.25, 0.37);
        monitorGlows.push(led);
        rack.add(led);
      }

      props.add(rack);
    }
  } else if (tile.type === 'lounge') {
    // Espresso bar counter + coffee machine + 2 bar stools
    const counterBase = new THREE.Mesh(
      new THREE.BoxGeometry(1.45, 0.86, 0.56),
      new THREE.MeshStandardMaterial({ color: 0xd97757, roughness: 0.7, metalness: 0.06 }),
    );
    counterBase.position.set(0, 0.43, -0.35);
    counterBase.castShadow = true;
    counterBase.receiveShadow = true;
    props.add(counterBase);

    const counterTop = new THREE.Mesh(new THREE.BoxGeometry(1.54, 0.06, 0.64), woodMat);
    counterTop.position.set(0, 0.89, -0.35);
    counterTop.castShadow = true;
    props.add(counterTop);

    // Espresso machine body (brass + chrome)
    const machineBody = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.34, 0.34), brushedSteelMat);
    machineBody.position.set(-0.26, 1.09, -0.38);
    machineBody.castShadow = true;
    props.add(machineBody);

    const machineTrim = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.06, 0.36), brassMat);
    machineTrim.position.set(-0.26, 1.25, -0.38);
    props.add(machineTrim);

    // Pastry dome jar
    const jarBase = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.03, 14), woodMat);
    jarBase.position.set(0.36, 0.93, -0.34);
    props.add(jarBase);
    const jarDome = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.1, transparent: true, opacity: 0.45 }),
    );
    jarDome.position.set(0.36, 0.94, -0.34);
    props.add(jarDome);

    // 2 Bar Stools
    for (const sx of [-0.36, 0.36]) {
      const stoolStem = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.14, 0.62, 10), darkMetalMat);
      stoolStem.position.set(sx, 0.31, 0.34);
      props.add(stoolStem);
      const stoolSeat = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.17, 0.06, 14), woodMat);
      stoolSeat.position.set(sx, 0.63, 0.34);
      stoolSeat.castShadow = true;
      props.add(stoolSeat);
    }
  } else if (tile.type === 'garden') {
    // Terracotta planter + rich soil + 3-tiered indoor ficus tree + slatted bench
    const planterMat = new THREE.MeshStandardMaterial({ color: 0xc26d4e, roughness: 0.82, metalness: 0.02 });
    const planter = new THREE.Mesh(new THREE.CylinderGeometry(0.56, 0.46, 0.42, 8), planterMat);
    planter.position.set(-0.25, 0.21, -0.2);
    planter.castShadow = true;
    planter.receiveShadow = true;
    props.add(planter);

    const soil = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5, 0.5, 0.05, 8),
      new THREE.MeshStandardMaterial({ color: 0x3f2e21, roughness: 0.95 }),
    );
    soil.position.set(-0.25, 0.4, -0.2);
    props.add(soil);

    // Trunk
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.09, 0.68, 7),
      new THREE.MeshStandardMaterial({ color: 0x6b4c35, roughness: 0.9 }),
    );
    trunk.position.set(-0.25, 0.74, -0.2);
    trunk.castShadow = true;
    props.add(trunk);

    // 3 foliage canopies
    const leafColors = [0x4c7c57, 0x5c9166, 0x6ea678];
    const canopyDefs = [
      { pos: [-0.25, 1.16, -0.2], r: 0.36 },
      { pos: [-0.06, 1.0, -0.05], r: 0.24 },
      { pos: [-0.44, 1.05, -0.32], r: 0.26 },
    ];
    canopyDefs.forEach((c, idx) => {
      const canopy = new THREE.Mesh(
        new THREE.DodecahedronGeometry(c.r, 1),
        new THREE.MeshStandardMaterial({ color: leafColors[idx], roughness: 0.82, metalness: 0.02 }),
      );
      canopy.position.set(c.pos[0], c.pos[1], c.pos[2]);
      canopy.castShadow = true;
      props.add(canopy);
    });

    // Small slatted wooden bench beside the planter
    const benchTop = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.06, 0.34), woodMat);
    benchTop.position.set(0.32, 0.36, 0.44);
    benchTop.rotation.y = -0.35;
    benchTop.castShadow = true;
    props.add(benchTop);
    const benchLegs = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.34, 0.26), darkMetalMat);
    benchLegs.position.set(0.32, 0.17, 0.44);
    benchLegs.rotation.y = -0.35;
    props.add(benchLegs);
  }

  group.add(props);
  return { group, hitMesh, monitorGlows };
}

export function createAgentModel(
  profile: AgentProfile,
  textures: ProceduralTexturePack,
): { rig: AgentRig; hitMesh: THREE.Mesh } {
  const root = new THREE.Group();

  // Ground contact shadow
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(0.82, 0.82),
    new THREE.MeshBasicMaterial({
      map: textures.contactShadow,
      transparent: true,
      depthWrite: false,
      opacity: 0.4,
    }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.042;
  root.add(shadow);

  // Selection ring on floor
  const selectionRing = new THREE.Mesh(
    new THREE.RingGeometry(0.36, 0.44, 24),
    new THREE.MeshBasicMaterial({
      color: new THREE.Color(profile.accentHex),
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
    }),
  );
  selectionRing.rotation.x = -Math.PI / 2;
  selectionRing.position.y = 0.048;
  selectionRing.visible = false;
  root.add(selectionRing);

  // Articulated body container sitting cleanly at tile top (y = 0.036)
  const bodyGroup = new THREE.Group();
  bodyGroup.position.y = 0.036;
  root.add(bodyGroup);

  const jacketMat = new THREE.MeshStandardMaterial({
    color: profile.jacketColor,
    roughness: 0.68,
    metalness: 0.06,
  });
  const trouserMat = new THREE.MeshStandardMaterial({
    color: 0x283241,
    roughness: 0.78,
    metalness: 0.04,
  });
  const shoeMat = new THREE.MeshStandardMaterial({
    color: 0xf1f5f9,
    roughness: 0.4,
    metalness: 0.1,
  });
  const skinMat = new THREE.MeshStandardMaterial({
    color: 0xf2c9ac,
    roughness: 0.62,
    metalness: 0.02,
  });
  const shirtMat = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    roughness: 0.75,
    metalness: 0.02,
  });
  const hairMat = new THREE.MeshStandardMaterial({
    color: profile.hairColor,
    roughness: 0.85,
    metalness: 0.05,
  });

  // Left & Right Legs (hip pivot at y = 0.34)
  const makeLeg = (xOffset: number) => {
    const legPivot = new THREE.Group();
    legPivot.position.set(xOffset, 0.34, 0);
    const legMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.052, 0.28, 10), trouserMat);
    legMesh.position.y = -0.15;
    legMesh.castShadow = true;
    legPivot.add(legMesh);
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.07, 0.16), shoeMat);
    shoe.position.set(0, -0.305, 0.025);
    shoe.castShadow = true;
    legPivot.add(shoe);
    return legPivot;
  };
  const leftLeg = makeLeg(-0.09);
  const rightLeg = makeLeg(0.09);
  bodyGroup.add(leftLeg, rightLeg);

  // Torso jacket + inner collar
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.19, 0.4, 12), jacketMat);
  torso.position.y = 0.54;
  torso.castShadow = true;
  bodyGroup.add(torso);

  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.12, 0.08, 10), shirtMat);
  collar.position.y = 0.73;
  bodyGroup.add(collar);

  // Left & Right Arms (shoulder pivot at y = 0.68)
  const makeArm = (xOffset: number) => {
    const armPivot = new THREE.Group();
    armPivot.position.set(xOffset, 0.68, 0);
    const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.044, 0.25, 10), jacketMat);
    sleeve.position.y = -0.12;
    sleeve.castShadow = true;
    armPivot.add(sleeve);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.044, 10, 10), skinMat);
    hand.position.y = -0.26;
    armPivot.add(hand);
    return armPivot;
  };
  const leftArm = makeArm(-0.22);
  const rightArm = makeArm(0.22);
  bodyGroup.add(leftArm, rightArm);

  // Head + Hair + Role Accessory
  const headGroup = new THREE.Group();
  headGroup.position.y = 0.89;
  bodyGroup.add(headGroup);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.155, 16, 14), skinMat);
  head.castShadow = true;
  headGroup.add(head);

  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.2 });
  for (const ex of [-0.055, 0.055]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 8), eyeMat);
    eye.position.set(ex, 0.015, 0.14);
    headGroup.add(eye);
  }

  // Stylized hair dome
  const hairCap = new THREE.Mesh(
    new THREE.SphereGeometry(0.163, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.56),
    hairMat,
  );
  hairCap.rotation.x = -0.22;
  hairCap.position.y = 0.02;
  headGroup.add(hairCap);

  const accessoryMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.25,
    metalness: 0.8,
  });

  if (profile.accessory === 'headset') {
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.016, 8, 18, Math.PI), accessoryMat);
    band.position.y = 0.03;
    headGroup.add(band);
    for (const sx of [-0.17, 0.17]) {
      const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.03, 10), accessoryMat);
      cup.rotation.z = Math.PI / 2;
      cup.position.set(sx, 0.01, 0);
      headGroup.add(cup);
    }
  } else if (profile.accessory === 'glasses') {
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.035, 0.02), accessoryMat);
    frame.position.set(0, 0.02, 0.152);
    headGroup.add(frame);
  } else if (profile.accessory === 'beret') {
    const beret = new THREE.Mesh(
      new THREE.CylinderGeometry(0.17, 0.14, 0.06, 16),
      new THREE.MeshStandardMaterial({ color: 0x357a62, roughness: 0.78 }),
    );
    beret.position.set(0.02, 0.145, -0.01);
    beret.rotation.z = -0.18;
    headGroup.add(beret);
  } else if (profile.accessory === 'visor') {
    const visor = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 0.045, 0.06),
      new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        emissive: 0x0284c7,
        emissiveIntensity: 0.5,
        roughness: 0.12,
        metalness: 0.4,
      }),
    );
    visor.position.set(0, 0.02, 0.14);
    headGroup.add(visor);
  }

  // Subtle floating geometric diamond above head (shown when thinking / collaborating)
  const statusHalo = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.09, 0),
    new THREE.MeshStandardMaterial({
      color: new THREE.Color(profile.accentHex),
      emissive: new THREE.Color(profile.accentHex),
      emissiveIntensity: 0.65,
      roughness: 0.2,
      metalness: 0.3,
    }),
  );
  statusHalo.position.y = 1.38;
  statusHalo.visible = false;
  bodyGroup.add(statusHalo);

  // Invisible raycast proxy on layer 1 for effortless agent clicking
  const hitMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.32, 0.32, 1.35, 8),
    new THREE.MeshBasicMaterial({ visible: false }),
  );
  hitMesh.position.y = 0.68;
  hitMesh.layers.set(1);
  hitMesh.userData = { agentId: profile.id };
  root.add(hitMesh);

  return {
    rig: {
      root,
      bodyGroup,
      headGroup,
      leftArm,
      rightArm,
      leftLeg,
      rightLeg,
      statusHalo,
      selectionRing,
    },
    hitMesh,
  };
}

export function disposeObject3D(object: THREE.Object3D): void {
  object.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      if (child.geometry !== HEX_BASE_GEO && child.geometry !== HEX_INLAY_GEO) {
        child.geometry.dispose();
      }
      if (Array.isArray(child.material)) {
        child.material.forEach((m) => m.dispose());
      } else if (child.material) {
        child.material.dispose();
      }
    }
  });
}
