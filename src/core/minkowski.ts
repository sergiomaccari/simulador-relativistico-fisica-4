import { Vector3 } from 'three';

/**
 * Núcleo de Relatividade Especial.
 *
 * Toda a "física" do laboratório nasce aqui. As mesmas fórmulas estão
 * replicadas no shader GLSL (em `shaders/relativistic.vert.glsl`), porque a
 * GPU precisa recalculá-las por vértice; aqui no lado da CPU elas servem para
 * o HUD (γ, contração, dilatação do tempo) e para validar a matemática.
 *
 * Convenção: trabalhamos sempre com a velocidade adimensional
 *      β = v / c        (vetor),     |β| ∈ [0, 1)
 * Assim a geometria não depende de `c`; o valor de `c` só importa para os
 * relógios em tempo real (ver `Simulator`).
 */

/** Maior |β| permitido — evita γ → ∞ e divisões por zero. */
export const BETA_MAX = 0.9999;

/** Fator de Lorentz γ = 1 / sqrt(1 − β²) a partir do módulo de β. */
export function gamma(beta: number): number {
  const b = Math.min(Math.abs(beta), BETA_MAX);
  return 1 / Math.sqrt(1 - b * b);
}

/** Fator de Lorentz a partir do vetor β. */
export function gammaVec(betaVec: Vector3): number {
  return gamma(betaVec.length());
}

/**
 * Fator de contração de Lorentz: L / L₀ = 1 / γ = sqrt(1 − β²).
 * (Comprimentos na direção do movimento encolhem por este fator.)
 */
export function contraction(beta: number): number {
  const b = Math.min(Math.abs(beta), BETA_MAX);
  return Math.sqrt(1 - b * b);
}

/**
 * Adição relativística de velocidades (composição de boosts).
 *
 * Combina a velocidade `u` (β) com um boost `v` (β), retornando a velocidade
 * resultante (β) no novo referencial. Decompõe `u` em componentes paralela e
 * perpendicular a `v`:
 *
 *      u' = ( u∥ + v + u⊥/γ_v ) / ( 1 + u·v )
 *
 * Para u·v pequeno cai na soma galileana u + v; perto de c satura em |β| < 1.
 */
export function velocityAdd(u: Vector3, v: Vector3, out = new Vector3()): Vector3 {
  const v2 = v.dot(v);
  if (v2 < 1e-12) return out.copy(u); // boost nulo
  const gv = 1 / Math.sqrt(Math.max(1 - v2, 1e-12));
  const uv = u.dot(v);

  // u∥ = (u·v / |v|²) v   ;   u⊥ = u − u∥
  const uPar = v.clone().multiplyScalar(uv / v2);
  const uPerp = u.clone().sub(uPar);

  // (u∥ + v + u⊥/γ) / (1 + u·v)
  return out
    .copy(uPar)
    .add(v)
    .add(uPerp.multiplyScalar(1 / gv))
    .multiplyScalar(1 / (1 + uv));
}

/**
 * Fator Doppler relativístico (razão de frequências observada/emitida).
 *
 *      D = f_obs / f_emit = 1 / [ γ (1 + β·n̂) ]
 *
 * `betaSource` é a velocidade da fonte no referencial do observador (β) e
 * `lineOfSight` (n̂) aponta do observador para a posição aparente da fonte.
 *  - fonte se aproximando  → D > 1  (blueshift)
 *  - fonte se afastando    → D < 1  (redshift)
 */
export function dopplerFactor(betaSource: Vector3, lineOfSight: Vector3): number {
  const n = lineOfSight.clone().normalize();
  const b = betaSource.length();
  const g = gamma(b);
  const denom = g * (1 + betaSource.dot(n));
  return 1 / Math.max(denom, 1e-4);
}

/** Razão de comprimentos de onda λ_obs/λ_emit = 1/D (>1 = redshift). */
export function wavelengthShift(betaSource: Vector3, lineOfSight: Vector3): number {
  return 1 / dopplerFactor(betaSource, lineOfSight);
}

/** Energia cinética relativística em unidades de m c²: (γ − 1). */
export function kineticEnergyOverMc2(beta: number): number {
  return gamma(beta) - 1;
}
