import { Vector3, Euler, type PerspectiveCamera } from 'three';
import { BETA_MAX } from '../core/minkowski';

/**
 * Controlador em primeira pessoa com movimento a VELOCIDADE CONSTANTE.
 *
 * O jogador anda pelo laboratório com WASD (+ Espaço/Shift para subir/descer)
 * e olha com o mouse (pointer lock). Não há aceleração: enquanto uma tecla de
 * movimento está pressionada, você se desloca num referencial inercial a um
 * β fixo (`walkBeta`, fração de c); ao soltar, volta ao repouso (β = 0). Cada
 * instante é, portanto, um referencial inercial — a relatividade "simples".
 * A velocidade da luz `c` (unidades/s) é ajustável e fixa a escala de travessia.
 */
export class FirstPersonController {
  readonly position = new Vector3(-46, 2, 0);
  readonly velocity = new Vector3(); // unidades/s, no referencial do laboratório
  readonly beta = new Vector3(); // velocity / c

  walkBeta = 0.5; // velocidade constante, em fração de c (sem aceleração)
  lookSpeed = 0.0022; // sensibilidade do mouse

  onLockChange?: (locked: boolean) => void;

  private yaw = -Math.PI / 2; // olhar inicial para +x
  private pitch = 0;
  private locked = false;
  private readonly keys = new Set<string>();
  private readonly euler = new Euler(0, 0, 0, 'YXZ');
  private readonly fwd = new Vector3();
  private readonly right = new Vector3();
  private readonly dir = new Vector3();

  constructor(
    private readonly camera: PerspectiveCamera,
    private readonly dom: HTMLElement,
  ) {}

  get isLocked(): boolean {
    return this.locked;
  }

  enable(): void {
    this.keys.clear();
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    this.dom.addEventListener('click', this.onClick);
    document.addEventListener('mousemove', this.onMouseMove);
    document.addEventListener('pointerlockchange', this.onPointerLock);
  }

  disable(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    this.dom.removeEventListener('click', this.onClick);
    document.removeEventListener('mousemove', this.onMouseMove);
    document.removeEventListener('pointerlockchange', this.onPointerLock);
    if (document.pointerLockElement === this.dom) document.exitPointerLock();
    this.keys.clear();
    this.locked = false;
  }

  reset(pos?: Vector3): void {
    if (pos) this.position.copy(pos);
    this.velocity.set(0, 0, 0);
    this.beta.set(0, 0, 0);
    this.yaw = -Math.PI / 2;
    this.pitch = 0;
  }

  /** Posiciona a câmera no jogador sem mover (usado ao entrar/pausar). */
  syncCamera(): void {
    this.euler.set(this.pitch, this.yaw, 0);
    this.camera.quaternion.setFromEuler(this.euler);
    this.camera.position.copy(this.position);
  }

  /** Atualiza orientação, velocidade (relativística) e posição; devolve β. */
  update(dt: number, c: number): Vector3 {
    // orientação da câmera a partir de yaw/pitch
    this.euler.set(this.pitch, this.yaw, 0);
    this.camera.quaternion.setFromEuler(this.euler);

    // base de movimento horizontal a partir do yaw (fwd = +x quando yaw=-π/2)
    this.fwd.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    this.right.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw)); // = fwd × up

    // direção desejada do input
    this.dir.set(0, 0, 0);
    const k = this.keys;
    if (k.has('KeyW')) this.dir.add(this.fwd);
    if (k.has('KeyS')) this.dir.sub(this.fwd);
    if (k.has('KeyD')) this.dir.add(this.right);
    if (k.has('KeyA')) this.dir.sub(this.right);
    if (k.has('Space')) this.dir.y += 1;
    if (k.has('ShiftLeft') || k.has('ControlLeft') || k.has('KeyC')) this.dir.y -= 1;

    const moving = this.locked && this.dir.lengthSq() > 1e-6;
    if (moving) {
      this.dir.normalize();
      // velocidade CONSTANTE: você está num referencial inercial a β = walkBeta.
      // Soltar as teclas ⇒ repouso (β = 0, mundo sem distorção).
      this.beta.copy(this.dir).multiplyScalar(Math.min(this.walkBeta, BETA_MAX));
    } else {
      this.beta.set(0, 0, 0);
    }
    this.velocity.copy(this.beta).multiplyScalar(c);

    // integra a posição (velocidade coordenada no laboratório)
    this.position.addScaledVector(this.velocity, dt);
    this.camera.position.copy(this.position);

    return this.beta;
  }

  // ── handlers (arrow fields p/ manter o `this`) ──
  private onKeyDown = (e: KeyboardEvent) => {
    this.keys.add(e.code);
    if (e.code === 'Space') e.preventDefault();
  };
  private onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
  };
  private onClick = () => {
    if (!this.locked) this.dom.requestPointerLock();
  };
  private onMouseMove = (e: MouseEvent) => {
    if (!this.locked) return;
    this.yaw -= e.movementX * this.lookSpeed;
    this.pitch -= e.movementY * this.lookSpeed;
    const lim = Math.PI / 2 - 0.02;
    this.pitch = Math.max(-lim, Math.min(lim, this.pitch));
  };
  private onPointerLock = () => {
    this.locked = document.pointerLockElement === this.dom;
    // ao perder o lock (Esc/alt-tab/blur) não chega 'keyup': limpa o estado
    // das teclas para não ficarem "presas" e mover sozinho ao re-travar.
    if (!this.locked) this.keys.clear();
    this.onLockChange?.(this.locked);
  };
}
