import {
  Group,
  Mesh,
  BoxGeometry,
  SphereGeometry,
  PlaneGeometry,
  Vector3,
} from 'three';
import { RelativisticWorld } from '../engine/RelativisticWorld';

/**
 * Monta a cena do laboratório. O observador está na ORIGEM e (no painel) se
 * move ao longo de um eixo; tudo aqui está em repouso no referencial do
 * laboratório, então o que se deforma na tela é puramente efeito relativístico.
 *
 * Elementos pensados para evidenciar cada efeito:
 *   • grade do piso  → contração do espaço
 *   • régua longa    → contração de Lorentz (dramática, ao longo de x)
 *   • colunata       → distâncias entre objetos encurtam
 *   • esferas brancas→ Doppler (frente azul / trás vermelho) + beaming
 */
export function buildLabScene(world: RelativisticWorld): Group {
  const group = new Group();

  // ── piso: grade wireframe (referência do espaço do laboratório) ──
  const floorGeo = new PlaneGeometry(96, 96, 48, 48);
  floorGeo.rotateX(-Math.PI / 2);
  const floor = new Mesh(
    floorGeo,
    world.createMaterial({ color: 0x223052, wireframe: true }),
  );
  floor.position.y = -7;
  group.add(floor);

  // ── régua de medição: barra longa ao longo de x, bem subdividida ──
  const rulerGeo = new BoxGeometry(60, 0.9, 0.9, 80, 1, 1);
  const ruler = new Mesh(
    rulerGeo,
    world.createMaterial({ color: 0x35e0d0 }),
  );
  ruler.position.set(0, 6, 0);
  group.add(ruler);

  // marcas a cada 10 unidades, para "ver" a régua encolher
  for (let x = -30; x <= 30; x += 10) {
    const tick = new Mesh(
      new BoxGeometry(0.5, 2.2, 0.5, 1, 4, 1),
      world.createMaterial({ color: 0xfff2a8 }),
    );
    tick.position.set(x, 6, 0);
    group.add(tick);
  }

  // ── colunata: pilares ao longo de x, dos dois lados ──
  const pillarColors = [0xff6b6b, 0xffa94d, 0xffd43b, 0x69db7c, 0x4dabf7, 0xb197fc, 0xf783ac];
  for (let i = 0; i < pillarColors.length; i++) {
    const x = -24 + i * 8;
    for (const z of [-13, 13]) {
      const pillar = new Mesh(
        new BoxGeometry(1.6, 9, 1.6, 2, 10, 2),
        world.createMaterial({ color: pillarColors[i] }),
      );
      pillar.position.set(x, -2.5, z);
      group.add(pillar);
    }
  }

  // ── esferas brancas para o Doppler (frente, trás, laterais) ──
  const sphereGeo = new SphereGeometry(3.2, 44, 30);
  const sphereSpots: Array<[number, number, number]> = [
    [26, 0, 0], // à frente (+x): azul + brilho ao mover-se em +x
    [-26, 0, 0], // atrás (−x): vermelho + escuro
    [0, 0, 22], // lateral: Doppler transversal
    [0, 0, -22],
  ];
  for (const [x, y, z] of sphereSpots) {
    const sphere = new Mesh(
      sphereGeo,
      world.createMaterial({ color: 0xf2f4ff }),
    );
    sphere.position.set(x, y, z);
    group.add(sphere);
  }

  return group;
}

/** Direção unitária da velocidade do observador, por eixo. */
export const AXES: Record<'x' | 'y' | 'z', Vector3> = {
  x: new Vector3(1, 0, 0),
  y: new Vector3(0, 1, 0),
  z: new Vector3(0, 0, 1),
};
