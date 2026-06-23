import {
  Group,
  Mesh,
  type BufferGeometry,
  BoxGeometry,
  SphereGeometry,
  PlaneGeometry,
  CylinderGeometry,
  ConeGeometry,
  TorusGeometry,
  TorusKnotGeometry,
  IcosahedronGeometry,
  DodecahedronGeometry,
  OctahedronGeometry,
  TetrahedronGeometry,
  CapsuleGeometry,
  Vector3,
} from 'three';
import { RelativisticWorld } from '../engine/RelativisticWorld';

/**
 * Monta a cena do laboratório. O observador está na ORIGEM; tudo aqui está em
 * repouso no referencial do laboratório, então o que se deforma na tela é
 * efeito relativístico puro.
 *
 *   • grade do piso → contração do espaço
 *   • régua longa   → contração de Lorentz (dramática, ao longo de x)
 *   • colunata      → distâncias entre objetos encurtam
 *   • galeria de sólidos variados (claros) → Doppler em todas as direções
 */
export function buildLabScene(world: RelativisticWorld): Group {
  const group = new Group();

  const add = (
    geo: BufferGeometry,
    color: number,
    pos: [number, number, number],
    rot?: [number, number, number],
  ): Mesh => {
    const mesh = new Mesh(geo, world.createMaterial({ color }));
    mesh.position.set(pos[0], pos[1], pos[2]);
    if (rot) mesh.rotation.set(rot[0], rot[1], rot[2]);
    group.add(mesh);
    return mesh;
  };

  // ── piso: grade wireframe (referência do espaço) ──
  const floorGeo = new PlaneGeometry(96, 96, 64, 64);
  floorGeo.rotateX(-Math.PI / 2);
  const floor = new Mesh(
    floorGeo,
    world.createMaterial({ color: 0x223052, wireframe: true }),
  );
  floor.position.y = -7;
  group.add(floor);

  // ── régua de medição ao longo de x (bem subdividida p/ contrair suave) ──
  add(new BoxGeometry(60, 0.9, 0.9, 60, 1, 1), 0x35e0d0, [0, 6, 0]);
  for (let x = -30; x <= 30; x += 10) {
    add(new BoxGeometry(0.5, 2.2, 0.5, 1, 3, 1), 0xfff2a8, [x, 6, 0]);
  }

  // ── colunata: alterna caixas e cilindros dos dois lados ──
  const pillarColors = [0xff6b6b, 0xffa94d, 0xffd43b, 0x69db7c, 0x4dabf7, 0xb197fc, 0xf783ac];
  for (let i = 0; i < pillarColors.length; i++) {
    const x = -24 + i * 8;
    for (const z of [-14, 14]) {
      const geo =
        i % 2 === 0
          ? new BoxGeometry(1.6, 9, 1.6, 2, 8, 2)
          : new CylinderGeometry(0.9, 0.9, 9, 16, 6);
      add(geo, pillarColors[i], [x, -2.5, z]);
    }
  }

  // ── galeria de formas variadas, em anel ao redor do observador ──
  // claras (branco levemente azulado) para o Doppler ficar bem visível
  const SH = 0xeef1ff;
  // Nota: a cor do Doppler é calculada por VÉRTICE (otimização). Por isso os
  // poliedros de Platão e cone/cilindro são SUBDIVIDIDOS (detail / segments) —
  // senão a cor não-linear facetaria nas faces grandes. Custo desprezível.
  const shapes: Array<{ geo: BufferGeometry; rot?: [number, number, number] }> = [
    { geo: new SphereGeometry(3, 32, 20) },
    { geo: new IcosahedronGeometry(3, 2) },
    { geo: new ConeGeometry(2.6, 6, 28, 8) },
    { geo: new TorusGeometry(2.6, 1.0, 18, 40), rot: [Math.PI / 2, 0, 0] },
    { geo: new CylinderGeometry(2, 2, 5, 28, 6) },
    { geo: new DodecahedronGeometry(3, 2) },
    { geo: new TorusKnotGeometry(2.2, 0.7, 90, 14) },
    { geo: new OctahedronGeometry(3, 3) },
    { geo: new CapsuleGeometry(1.6, 3, 8, 18) },
    { geo: new TetrahedronGeometry(3.4, 3) },
  ];
  const R = 26;
  for (let i = 0; i < shapes.length; i++) {
    const a = (i / shapes.length) * Math.PI * 2;
    add(shapes[i].geo, SH, [Math.cos(a) * R, 0, Math.sin(a) * R], shapes[i].rot);
  }

  return group;
}

/** Direção unitária da velocidade do observador, por eixo. */
export const AXES: Record<'x' | 'y' | 'z', Vector3> = {
  x: new Vector3(1, 0, 0),
  y: new Vector3(0, 1, 0),
  z: new Vector3(0, 0, 1),
};
