import GUI from 'lil-gui';
import type { Simulator } from '../engine/Simulator';

/** β correspondente a um dado γ:  β = sqrt(1 − 1/γ²). */
function betaForGamma(g: number): number {
  return Math.sqrt(1 - 1 / (g * g));
}

/** Cria o painel de controle (lil-gui) ligado ao estado do simulador. */
export function createControlPanel(sim: Simulator): GUI {
  const gui = new GUI({ title: '⚙ Controles' });
  const s = sim.state;

  const refreshAll = () =>
    gui.controllersRecursive().forEach((c) => c.updateDisplay());
  sim.onStateRefresh = refreshAll;

  // ── Modo ──
  gui
    .add(s, 'mode', {
      'Laboratório (orbital)': 'lab',
      'Olho do observador': 'eye',
      'Primeira pessoa (WASD)': 'firstPerson',
    })
    .name('modo');

  // ── Movimento (modo laboratório) ──
  const fMove = gui.addFolder('Laboratório · velocidade');
  const betaCtrl = fMove.add(s, 'betaMag', 0, 0.9999, 0.0001).name('β = v/c');
  fMove.add(s, 'betaAxis', ['x', 'y', 'z']).name('direção');
  const setBeta = (b: number) => {
    s.betaMag = b;
    betaCtrl.updateDisplay();
  };
  const presets = {
    'β = 0 (repouso)': () => setBeta(0),
    'γ = 2': () => setBeta(betaForGamma(2)),
    'γ = 5': () => setBeta(betaForGamma(5)),
    'γ = 10': () => setBeta(betaForGamma(10)),
  };
  for (const [label, fn] of Object.entries(presets)) {
    fMove.add({ fn }, 'fn').name(label);
  }

  // ── Física / 1ª pessoa ──
  const fPhys = gui.addFolder('Física');
  fPhys.add(s, 'c', 4, 60, 1).name('c (unidades/s)');
  fPhys.add(sim.fp, 'walkBeta', 0, 0.99, 0.001).name('velocidade β (1ª p.)');
  fPhys.add(sim.fp, 'lookSpeed', 0.0005, 0.006, 0.0001).name('sensib. mouse');

  // ── Efeitos relativísticos ──
  const fFx = gui.addFolder('Efeitos relativísticos');
  fFx.add(s, 'contraction').name('contração de Lorentz');
  fFx.add(s, 'aberration').name('aberração (o que se vê)');
  fFx.add(s, 'doppler').name('Doppler (cor)');
  fFx.add(s, 'beaming').name('beaming (holofote)');

  // ── Simulação ──
  const fSim = gui.addFolder('Simulação');
  fSim.add(s, 'animate').name('relógios correndo');
  fSim.add({ fn: () => sim.resetClocks() }, 'fn').name('⟲ zerar relógios');
  fSim.add({ fn: () => sim.resetCamera() }, 'fn').name('⌖ recentralizar câmera');

  return gui;
}
