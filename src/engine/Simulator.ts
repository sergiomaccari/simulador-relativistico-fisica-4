import {
  Scene,
  PerspectiveCamera,
  WebGLRenderer,
  Vector3,
  Euler,
  Color,
  ColorManagement,
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RelativisticWorld, type RelEffects } from './RelativisticWorld';
import { FirstPersonController } from './FirstPersonController';
import { buildLabScene, AXES } from '../core/scene-presets';
import { gamma, BETA_MAX } from '../core/minkowski';

export type SimMode = 'lab' | 'eye' | 'firstPerson';

/** Estado mutável controlado pelo painel (lil-gui). */
export interface SimState {
  mode: SimMode;
  // modo laboratório
  betaMag: number; // |β| ∈ [0, BETA_MAX]
  betaAxis: 'x' | 'y' | 'z';
  // velocidade da luz (unidades/s) — usada no modo 1ª pessoa e no readout v = β·c
  c: number;
  // efeitos
  contraction: boolean;
  aberration: boolean;
  doppler: boolean;
  beaming: boolean;
  animate: boolean; // relógios correndo
  quality: 'alta' | 'baixa'; // resolução de render (baixa = mais leve)
}

/** Leituras derivadas, enviadas ao HUD a cada frame. */
export interface SimReadout {
  mode: SimMode;
  beta: number;
  gamma: number;
  contraction: number; // L/L₀ = 1/γ
  speed: number; // |v| (unidades/s)
  c: number;
  fps: number; // quadros por segundo (média) — para medir desempenho
  observerTime: number; // seu tempo próprio (s) — mais devagar quando você se move
  labTime: number; // tempo coordenado do laboratório (s)
}

const FP_START = new Vector3(-46, 2, 0);

export class Simulator {
  readonly state: SimState = {
    mode: 'lab',
    betaMag: 0.6,
    betaAxis: 'x',
    c: 12,
    contraction: true,
    aberration: false,
    doppler: true,
    beaming: true,
    animate: true,
    quality: 'alta',
  };

  readonly readout: SimReadout = {
    mode: 'lab',
    beta: 0,
    gamma: 1,
    contraction: 1,
    speed: 0,
    c: 12,
    fps: 0,
    observerTime: 0,
    labTime: 0,
  };

  readonly fp: FirstPersonController;

  onFrame?: (r: SimReadout, s: SimState) => void;
  /** Chamado quando o modo muda por dentro (p.ex. ESC) — para o painel se refrescar. */
  onStateRefresh?: () => void;

  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly camera: PerspectiveCamera;
  private readonly controls: OrbitControls;
  private readonly world = new RelativisticWorld();
  private readonly beta = new Vector3();
  private readonly playerPos = new Vector3();
  private readonly fpPrompt: HTMLElement | null;
  private lastMode: SimMode = 'lab';
  private lastT = 0;
  private fpsFrames = 0;
  private fpsAccum = 0;

  // modo "olho do observador": girar o olhar parado na origem (arrastar mouse)
  private readonly eyeEuler = new Euler(0, 0, 0, 'YXZ');
  private eyeYaw = -Math.PI / 2; // olhar inicial para +x
  private eyePitch = 0;
  private eyeDragging = false;
  private eyeLastX = 0;
  private eyeLastY = 0;
  private readonly eyeForward = new Vector3();

  constructor(canvas: HTMLCanvasElement) {
    // Cores em espaço de display direto: o shader já devolve a cor percebida.
    ColorManagement.enabled = false;

    this.renderer = new WebGLRenderer({ canvas, antialias: true });
    this.setQuality(this.state.quality);
    this.scene.background = new Color(0x05060a);

    this.camera = new PerspectiveCamera(60, 1, 0.05, 4000);
    this.camera.position.set(38, 26, 52);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.target.set(0, 0, 0);
    this.controls.maxDistance = 240;
    this.controls.minDistance = 6;

    this.fp = new FirstPersonController(this.camera, this.renderer.domElement);
    // Soltar o pointer lock (Esc/alt-tab) PAUSA: o prompt reaparece e o tick
    // congela movimento e relógios enquanto destravado. Clicar retoma.
    this.fp.onLockChange = (locked) => this.updatePrompt(!locked);

    this.fpPrompt = document.getElementById('fp-prompt');

    this.scene.add(buildLabScene(this.world));

    this.resize();
    window.addEventListener('resize', () => this.resize());
    // Em 1ª pessoa: 1º Esc pausa (solta o mouse via pointer lock); estando
    // pausado, um 2º Esc (agora entregue como tecla) sai para o laboratório.
    window.addEventListener('keydown', (e) => {
      if (
        e.code === 'Escape' &&
        this.state.mode === 'firstPerson' &&
        !this.fp.isLocked
      ) {
        this.state.mode = 'lab';
        this.onStateRefresh?.();
      }
    });

    // arrastar para girar o olhar no modo "olho do observador"
    const dom = this.renderer.domElement;
    dom.addEventListener('mousedown', (e) => this.onEyeDown(e));
    window.addEventListener('mousemove', (e) => this.onEyeMove(e));
    window.addEventListener('mouseup', () => this.onEyeUp());
  }

  private onEyeDown(e: MouseEvent): void {
    if (this.state.mode !== 'eye') return;
    this.eyeDragging = true;
    this.eyeLastX = e.clientX;
    this.eyeLastY = e.clientY;
    this.renderer.domElement.style.cursor = 'grabbing';
  }

  private onEyeMove(e: MouseEvent): void {
    if (this.state.mode !== 'eye' || !this.eyeDragging) return;
    const sens = 0.005;
    this.eyeYaw -= (e.clientX - this.eyeLastX) * sens;
    this.eyePitch -= (e.clientY - this.eyeLastY) * sens;
    const lim = Math.PI / 2 - 0.02;
    this.eyePitch = Math.max(-lim, Math.min(lim, this.eyePitch));
    this.eyeLastX = e.clientX;
    this.eyeLastY = e.clientY;
  }

  private onEyeUp(): void {
    if (!this.eyeDragging) return;
    this.eyeDragging = false;
    if (this.state.mode === 'eye') this.renderer.domElement.style.cursor = 'grab';
  }

  resetCamera(): void {
    this.camera.position.set(38, 26, 52);
    this.controls.target.set(0, 0, 0);
  }

  resetClocks(): void {
    this.readout.observerTime = 0;
    this.readout.labTime = 0;
  }

  /** Ajusta a resolução de render: 'baixa' = pixelRatio 1 (mais leve). */
  setQuality(q: 'alta' | 'baixa'): void {
    const dpr = q === 'baixa' ? 1 : Math.min(window.devicePixelRatio, 2);
    this.renderer.setPixelRatio(dpr);
  }

  start(): void {
    this.lastT = performance.now();
    const loop = (t: number) => {
      requestAnimationFrame(loop);
      const raw = (t - this.lastT) / 1000;
      this.lastT = t;
      // FPS: média numa janela de ~0.5 s (usa o delta real, não o limitado)
      this.fpsFrames++;
      this.fpsAccum += raw;
      if (this.fpsAccum >= 0.5) {
        this.readout.fps = this.fpsFrames / this.fpsAccum;
        this.fpsFrames = 0;
        this.fpsAccum = 0;
      }
      this.tick(Math.min(raw, 0.1));
    };
    requestAnimationFrame(loop);
  }

  private applyMode(mode: SimMode): void {
    const dom = this.renderer.domElement;
    if (mode === 'firstPerson') {
      this.controls.enabled = false;
      this.fp.reset(FP_START);
      this.fp.syncCamera();
      this.beta.set(0, 0, 0);
      this.playerPos.copy(FP_START);
      this.fp.enable();
      this.updatePrompt(true);
      dom.style.cursor = '';
    } else if (mode === 'eye') {
      // observador parado na origem; gira-se o olhar arrastando o mouse
      this.fp.disable();
      this.controls.enabled = false;
      this.eyeYaw = -Math.PI / 2;
      this.eyePitch = 0;
      this.eyeDragging = false;
      this.updatePrompt(false);
      dom.style.cursor = 'grab';
    } else {
      // laboratório (orbital)
      this.fp.disable();
      this.controls.enabled = true;
      this.resetCamera();
      this.updatePrompt(false);
      dom.style.cursor = '';
    }
    this.onStateRefresh?.();
  }

  private updatePrompt(show: boolean): void {
    if (!this.fpPrompt) return;
    this.fpPrompt.classList.toggle('hidden', !(show && this.state.mode === 'firstPerson'));
  }

  private resize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  private tick(dt: number): void {
    const s = this.state;

    if (s.mode !== this.lastMode) {
      this.applyMode(s.mode);
      this.lastMode = s.mode;
    }

    // Pausado = 1ª pessoa com o mouse solto (após Esc/alt-tab).
    const paused = s.mode === 'firstPerson' && !this.fp.isLocked;

    let g: number;
    if (s.mode === 'lab') {
      g = gamma(s.betaMag);
      this.beta.copy(AXES[s.betaAxis]).multiplyScalar(Math.min(s.betaMag, BETA_MAX));
      this.playerPos.set(0, 0, 0);
      this.controls.update();
      this.readout.speed = s.betaMag * s.c;
    } else if (s.mode === 'eye') {
      // parado na origem; você "se move" PARA ONDE OLHA (β segue o olhar),
      // então virar o olho gira a direção do movimento e muda de onde vêm as cores
      g = gamma(s.betaMag);
      this.eyeEuler.set(this.eyePitch, this.eyeYaw, 0);
      this.camera.quaternion.setFromEuler(this.eyeEuler);
      this.camera.position.set(0, 0, 0);
      this.camera.getWorldDirection(this.eyeForward);
      this.beta.copy(this.eyeForward).multiplyScalar(Math.min(s.betaMag, BETA_MAX));
      this.playerPos.set(0, 0, 0);
      this.readout.speed = s.betaMag * s.c;
    } else if (!paused) {
      this.fp.update(dt, s.c);
      this.beta.copy(this.fp.beta);
      this.playerPos.copy(this.fp.position);
      g = gamma(this.beta.length());
      this.readout.speed = this.fp.velocity.length();
    } else {
      // congela: mantém β, posição e relógios do último quadro
      g = gamma(this.beta.length());
    }

    const effects: RelEffects = {
      beta: this.beta,
      playerPos: this.playerPos,
      contraction: s.contraction,
      aberration: s.aberration,
      doppler: s.doppler,
      beaming: s.beaming,
    };
    this.world.update(effects);

    // Você se move ⇒ SEU relógio (próprio) anda devagar; o do laboratório
    // (referencial coordenado) marca o tempo "cheio".
    if (s.animate && !paused) {
      this.readout.labTime += dt;
      this.readout.observerTime += dt / g;
    }

    this.readout.mode = s.mode;
    this.readout.beta = this.beta.length();
    this.readout.gamma = g;
    this.readout.contraction = 1 / g;
    this.readout.c = s.c;

    this.renderer.render(this.scene, this.camera);
    this.onFrame?.(this.readout, s);
  }
}
