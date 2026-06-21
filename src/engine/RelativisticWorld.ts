import {
  ShaderMaterial,
  Vector3,
  Color,
  DoubleSide,
  type Side,
  type ColorRepresentation,
} from 'three';
import vertexShader from '../shaders/relativistic.vert.glsl?raw';
import fragmentShader from '../shaders/relativistic.frag.glsl?raw';

/** Estado dos efeitos relativísticos, aplicado aos uniforms globais a cada frame. */
export interface RelEffects {
  beta: Vector3; // velocidade do observador / c (no laboratório)
  playerPos: Vector3; // posição do observador no laboratório (0 no modo laboratório)
  contraction: boolean; // contração de Lorentz
  aberration: boolean; // posição aparente (cone de luz)
  doppler: boolean; // desvio de cor
  beaming: boolean; // efeito holofote
}

export interface RelMaterialOptions {
  color: ColorRepresentation;
  objectBeta?: Vector3; // velocidade do objeto / c (lab); default = repouso
  opacity?: number;
  wireframe?: boolean;
  side?: Side;
}

/**
 * Mantém os uniforms GLOBAIS (compartilhados por referência entre todos os
 * materiais) e fabrica materiais relativísticos.
 *
 * Atualizar um uniform global afeta todos os objetos de uma vez — o mesmo
 * papel que o `GameState` do OpenRelativity cumpria com `Shader.SetGlobal*`,
 * mas aqui sem estado global escondido: a referência é explícita.
 */
export class RelativisticWorld {
  /** Uniforms partilhados por TODOS os materiais (mesma referência de objeto). */
  readonly globals = {
    uBeta: { value: new Vector3() },
    uPlayerPos: { value: new Vector3() },
    uContraction: { value: 1 },
    uAberration: { value: 0 },
    uDoppler: { value: 1 },
    uBeaming: { value: 1 },
  };

  private materials: ShaderMaterial[] = [];

  createMaterial(opts: RelMaterialOptions): ShaderMaterial {
    const opacity = opts.opacity ?? 1;
    const material = new ShaderMaterial({
      uniforms: {
        // globais (mesma referência ⇒ um update atinge todo mundo)
        uBeta: this.globals.uBeta,
        uPlayerPos: this.globals.uPlayerPos,
        uContraction: this.globals.uContraction,
        uAberration: this.globals.uAberration,
        uDoppler: this.globals.uDoppler,
        uBeaming: this.globals.uBeaming,
        // por objeto
        uObjectBeta: { value: (opts.objectBeta ?? new Vector3()).clone() },
        uBaseColor: { value: new Color(opts.color) },
        uOpacity: { value: opacity },
      },
      vertexShader,
      fragmentShader,
      transparent: opacity < 1,
      wireframe: opts.wireframe ?? false,
      side: opts.side ?? DoubleSide,
    });
    this.materials.push(material);
    return material;
  }

  /** Aplica o estado atual aos uniforms globais (1×/frame). */
  update(e: RelEffects): void {
    this.globals.uBeta.value.copy(e.beta);
    this.globals.uPlayerPos.value.copy(e.playerPos);
    this.globals.uContraction.value = e.contraction ? 1 : 0;
    this.globals.uAberration.value = e.aberration ? 1 : 0;
    this.globals.uDoppler.value = e.doppler ? 1 : 0;
    this.globals.uBeaming.value = e.beaming ? 1 : 0;
  }

  dispose(): void {
    for (const m of this.materials) m.dispose();
    this.materials.length = 0;
  }
}
