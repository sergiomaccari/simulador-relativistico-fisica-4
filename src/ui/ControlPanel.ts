import GUI from 'lil-gui';
import type { Simulator } from '../engine/Simulator';

/** β correspondente a um dado γ:  β = sqrt(1 − 1/γ²). */
function betaForGamma(g: number): number {
  return Math.sqrt(1 - 1 / (g * g));
}

/**
 * Painel de controle (lil-gui) ligado ao simulador. Os controles são
 * SENSÍVEIS AO MODO: só aparecem os parâmetros relevantes ao modo atual.
 */
export function createControlPanel(sim: Simulator): GUI {
  const gui = new GUI({ title: 'Controles' });
  const s = sim.state;

  // ── Modo (no topo) ──
  gui
    .add(s, 'mode', {
      'Laboratório (orbital)': 'lab',
      'Olho do observador': 'eye',
      'Primeira pessoa (WASD)': 'firstPerson',
    })
    .name('modo')
    .onChange(() => applyVisibility());

  // ── Velocidade ──
  const fVel = gui.addFolder('Velocidade');
  const cBeta = fVel.add(s, 'betaMag', 0, 0.9999, 0.0001).name('β = v/c');
  const setBeta = (b: number) => {
    s.betaMag = b;
    cBeta.updateDisplay();
  };
  const cP0 = fVel.add({ fn: () => setBeta(0) }, 'fn').name('atalho: β = 0');
  const cP2 = fVel.add({ fn: () => setBeta(betaForGamma(2)) }, 'fn').name('atalho: γ = 2');
  const cP5 = fVel.add({ fn: () => setBeta(betaForGamma(5)) }, 'fn').name('atalho: γ = 5');
  const cP10 = fVel.add({ fn: () => setBeta(betaForGamma(10)) }, 'fn').name('atalho: γ = 10');
  const cAxis = fVel.add(s, 'betaAxis', ['x', 'y', 'z']).name('direção');
  const cWalk = fVel.add(sim.fp, 'walkBeta', 0, 0.99, 0.001).name('velocidade (β)');

  // ── Efeitos relativísticos (todos os modos) ──
  const fFx = gui.addFolder('Efeitos relativísticos');
  fFx.add(s, 'contraction').name('contração de Lorentz');
  fFx.add(s, 'aberration').name('aberração (o que se vê)');
  fFx.add(s, 'doppler').name('Doppler (cor)');
  fFx.add(s, 'beaming').name('beaming (holofote)');

  // ── Mais (avançado, recolhido) ──
  const fMore = gui.addFolder('Mais');
  fMore
    .add(s, 'quality', { Alta: 'alta', Baixa: 'baixa' })
    .name('qualidade (↑FPS)')
    .onChange((v: 'alta' | 'baixa') => sim.setQuality(v));
  const cLook = fMore.add(sim.fp, 'lookSpeed', 0.0005, 0.006, 0.0001).name('sensib. mouse');
  fMore.add(s, 'c', 4, 60, 1).name('c · vel. da luz (unid./s)');
  fMore.add(s, 'animate').name('relógios correndo');
  fMore.add({ fn: () => sim.resetClocks() }, 'fn').name('⟲ zerar relógios');
  fMore.add({ fn: () => sim.resetCamera() }, 'fn').name('⌖ recentralizar câmera');
  fMore.close();

  // ── Visibilidade por modo ──
  const betaGroup = [cBeta, cP0, cP2, cP5, cP10]; // β controlado por slider: lab + olho
  function applyVisibility(): void {
    const showBeta = s.mode === 'lab' || s.mode === 'eye';
    betaGroup.forEach((c) => c.show(showBeta));
    cAxis.show(s.mode === 'lab'); // direção só no laboratório
    cWalk.show(s.mode === 'firstPerson'); // velocidade da 1ª pessoa
    cLook.show(s.mode === 'firstPerson'); // sensib. mouse só na 1ª pessoa
  }

  // refresca os valores exibidos E a visibilidade quando o modo muda por fora
  sim.onStateRefresh = () => {
    gui.controllersRecursive().forEach((c) => c.updateDisplay());
    applyVisibility();
  };
  applyVisibility();

  return gui;
}
