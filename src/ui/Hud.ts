import type { SimReadout, SimState } from '../engine/Simulator';

/** Período do ponteiro dos relógios: 1 volta a cada CLOCK_PERIOD segundos. */
const CLOCK_PERIOD = 5;

/**
 * Painel de leitura (canto superior esquerdo): números relativísticos +
 * dois relógios analógicos que tornam a dilatação do tempo visível — o SEU
 * relógio (tempo próprio) atrasa em relação ao tempo coordenado do
 * laboratório: você é o "gêmeo viajante" e acumula menos tempo (dτ = dt/γ).
 */
export class Hud {
  private elBeta: HTMLElement;
  private elGamma: HTMLElement;
  private elContraction: HTMLElement;
  private elDilation: HTMLElement;
  private elSpeed: HTMLElement;
  private elObsTime: HTMLElement;
  private elLabTime: HTMLElement;
  private obsCtx: CanvasRenderingContext2D;
  private labCtx: CanvasRenderingContext2D;

  constructor() {
    const root = document.getElementById('hud');
    if (!root) throw new Error('Elemento #hud não encontrado');

    root.innerHTML = `
      <div class="hud-row"><span class="hud-label">β = v/c</span><span class="hud-value accent" id="hud-beta">0</span></div>
      <div class="hud-row"><span class="hud-label">γ (Lorentz)</span><span class="hud-value" id="hud-gamma">1</span></div>
      <div class="hud-row"><span class="hud-label">comprimento L/L₀</span><span class="hud-value" id="hud-contraction">100%</span></div>
      <div class="hud-row"><span class="hud-label">dilatação do tempo</span><span class="hud-value" id="hud-dilation">×1</span></div>
      <div class="hud-row"><span class="hud-label">velocidade v</span><span class="hud-value" id="hud-speed">0</span></div>
      <div class="hud-sep"></div>
      <div class="hud-clocks">
        <div class="clock">
          <canvas id="clock-obs" width="68" height="68"></canvas>
          <div class="clock-name">você</div>
          <div class="hud-value accent" id="hud-obstime">0.0 s</div>
        </div>
        <div class="clock">
          <canvas id="clock-lab" width="68" height="68"></canvas>
          <div class="clock-name">laboratório</div>
          <div class="hud-value" id="hud-labtime">0.0 s</div>
        </div>
      </div>
    `;

    this.elBeta = this.byId('hud-beta');
    this.elGamma = this.byId('hud-gamma');
    this.elContraction = this.byId('hud-contraction');
    this.elDilation = this.byId('hud-dilation');
    this.elSpeed = this.byId('hud-speed');
    this.elObsTime = this.byId('hud-obstime');
    this.elLabTime = this.byId('hud-labtime');
    this.obsCtx = this.ctx('clock-obs');
    this.labCtx = this.ctx('clock-lab');
  }

  update(r: SimReadout, _s: SimState): void {
    this.elBeta.textContent = r.beta.toFixed(4);
    this.elGamma.textContent = r.gamma.toFixed(3);
    this.elContraction.textContent = `${(r.contraction * 100).toFixed(1)}%`;
    this.elDilation.textContent = `×${r.gamma.toFixed(3)}`;
    this.elSpeed.textContent = `${r.speed.toFixed(1)} / ${r.c.toFixed(0)} u/s`;
    this.elObsTime.textContent = `${r.observerTime.toFixed(1)} s`;
    this.elLabTime.textContent = `${r.labTime.toFixed(1)} s`;
    this.drawClock(this.obsCtx, r.observerTime, '#5ad1ff');
    this.drawClock(this.labCtx, r.labTime, '#ff7a5a');
  }

  private drawClock(
    ctx: CanvasRenderingContext2D,
    seconds: number,
    color: string,
  ): void {
    const w = ctx.canvas.width;
    const r = w / 2;
    ctx.clearRect(0, 0, w, w);

    // mostrador
    ctx.beginPath();
    ctx.arc(r, r, r - 4, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(120,140,180,0.35)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // marcas das horas
    ctx.strokeStyle = 'rgba(120,140,180,0.5)';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const c = Math.cos(a);
      const sn = Math.sin(a);
      ctx.beginPath();
      ctx.moveTo(r + c * (r - 8), r + sn * (r - 8));
      ctx.lineTo(r + c * (r - 5), r + sn * (r - 5));
      ctx.stroke();
    }

    // ponteiro
    const frac = (seconds % CLOCK_PERIOD) / CLOCK_PERIOD;
    const ang = frac * Math.PI * 2 - Math.PI / 2;
    ctx.beginPath();
    ctx.moveTo(r, r);
    ctx.lineTo(r + Math.cos(ang) * (r - 12), r + Math.sin(ang) * (r - 12));
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.stroke();

    // pino central
    ctx.beginPath();
    ctx.arc(r, r, 2.6, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  }

  private byId(id: string): HTMLElement {
    const el = document.getElementById(id);
    if (!el) throw new Error(`Elemento #${id} não encontrado`);
    return el;
  }

  private ctx(id: string): CanvasRenderingContext2D {
    const canvas = document.getElementById(id) as HTMLCanvasElement | null;
    const c = canvas?.getContext('2d');
    if (!c) throw new Error(`Contexto 2D de #${id} indisponível`);
    return c;
  }
}
