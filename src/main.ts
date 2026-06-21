import './style.css';
import { Simulator } from './engine/Simulator';
import { createControlPanel } from './ui/ControlPanel';
import { Hud } from './ui/Hud';

const canvas = document.getElementById('scene') as HTMLCanvasElement;
const sim = new Simulator(canvas);
const hud = new Hud();
createControlPanel(sim);

sim.onFrame = (readout, state) => hud.update(readout, state);
sim.start();
