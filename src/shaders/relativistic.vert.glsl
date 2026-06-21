// ───────────────────────────────────────────────────────────────────────────
//  Celeritas · Vertex shader relativístico
//
//  Recebe a posição de REPOUSO de cada vértice (no referencial do laboratório,
//  com o observador na origem) e devolve onde esse vértice APARECE para um
//  observador que se move com velocidade β = uBeta pelo laboratório.
//
//  Pipeline:
//    (1) boost de Lorentz   → contração do comprimento          [uContraction]
//    (2) cone de luz passado → aberração + atraso da luz         [uAberration]
//    (3) fator Doppler D e beaming D³  → enviados ao fragment
//
//  Tudo é feito em β (adimensional) e "tempo em unidades de comprimento"
//  (τ = c·t), então a geometria nunca precisa do valor numérico de c.
//
//  As mesmas fórmulas vivem em src/core/minkowski.ts (lado da CPU).
// ───────────────────────────────────────────────────────────────────────────

uniform vec3  uBeta;        // velocidade do OBSERVADOR / c (no laboratório)
uniform vec3  uObjectBeta;  // velocidade DESTE objeto / c (no laboratório)
uniform vec3  uPlayerPos;   // posição do observador no laboratório (modo 1ª pessoa)
uniform float uContraction; // 0 = posição de repouso · 1 = contração total
uniform float uAberration;  // 0 = posição instantânea · 1 = posição vista

varying float vShift;       // λ_obs / λ_emit   (>1 redshift, <1 blueshift)
varying float vBeaming;     // intensidade relativística D³ (efeito holofote)

// Adição relativística de velocidades — idêntica a velocityAdd() em minkowski.ts
vec3 velocityAdd(vec3 u, vec3 v) {
  float v2 = dot(v, v);
  if (v2 < 1e-10) return u;
  float gv = 1.0 / sqrt(max(1.0 - v2, 1e-10));
  float uv = dot(u, v);
  vec3 uPar  = (uv / v2) * v;
  vec3 uPerp = u - uPar;
  return (uPar + v + uPerp / gv) / (1.0 + uv);
}

void main() {
  // posição de repouso do vértice, relativa ao observador (na origem do cálculo)
  vec3 xLab = (modelMatrix * vec4(position, 1.0)).xyz - uPlayerPos;

  float b2 = dot(uBeta, uBeta);
  float g  = (b2 > 1e-10) ? 1.0 / sqrt(max(1.0 - b2, 1e-10)) : 1.0;

  // velocidade do objeto NO REFERENCIAL DO OBSERVADOR
  vec3 uObs = velocityAdd(uObjectBeta, -uBeta);

  // ── (1) posição no instante t=0 do observador  →  contração de Lorentz ──
  vec3 r0 = xLab;
  if (b2 > 1e-10) {
    vec3 bhat = uBeta / sqrt(b2);
    // instante T' (= c·t) em que a linha de mundo do vértice cruza t_obs = 0
    float denom = 1.0 - dot(uBeta, uObjectBeta);
    denom = (abs(denom) < 1e-4) ? 1e-4 : denom;
    float Tp = dot(uBeta, xLab) / denom;           // estático ⇒ Tp = β·x
    vec3  X  = xLab + uObjectBeta * Tp;
    // parte espacial do boost de Lorentz da 4-posição (T', X):
    r0 = X + (g - 1.0) * dot(bhat, X) * bhat - g * uBeta * Tp;
    // (objeto estático ⇒ r0∥ = x∥/γ , r0⊥ = x⊥  →  contração na direção de β)
  }
  vec3 rC = mix(xLab, r0, uContraction);

  // ── (2) cone de luz passado  →  posição APARENTE (aberração + atraso) ──
  vec3 pApp = rC;
  if (uAberration > 0.5) {
    // resolve |rC + uObs·τ| = -τ  para τ ≤ 0  (luz emitida no passado)
    //   (uObs·uObs - 1) τ² + 2 (rC·uObs) τ + rC·rC = 0
    float A = dot(uObs, uObs) - 1.0;
    float B = 2.0 * dot(rC, uObs);
    float C = dot(rC, rC);
    float tau = 0.0;
    if (abs(A) < 1e-6) {
      tau = (abs(B) > 1e-6) ? (-C / B) : 0.0;
    } else {
      float disc = max(B * B - 4.0 * A * C, 0.0);
      float sq = sqrt(disc);
      float t1 = (-B + sq) / (2.0 * A);
      float t2 = (-B - sq) / (2.0 * A);
      // raiz retardada: τ ≤ 0; havendo duas, a mais próxima do "agora"
      if (t1 <= 0.0 && t2 <= 0.0)      tau = max(t1, t2);
      else if (t1 <= 0.0)              tau = t1;
      else if (t2 <= 0.0)              tau = t2;
    }
    pApp = rC + uObs * tau;
  }

  // ── (3) Doppler + beaming (por vértice, interpolado no fragment) ──
  float los = length(pApp);
  vec3  n   = (los > 1e-6) ? pApp / los : vec3(0.0, 0.0, 1.0); // obs → fonte
  float ub2 = dot(uObs, uObs);
  float gObs = (ub2 < 1.0) ? 1.0 / sqrt(max(1.0 - ub2, 1e-10)) : 1.0;
  // D = f_obs/f_emit = 1 / [ γ (1 + β·n̂) ]
  float D  = 1.0 / max(gObs * (1.0 + dot(uObs, n)), 1e-4);
  vShift   = 1.0 / D;   // razão de comprimentos de onda
  vBeaming = D * D * D; // brilho (searchlight) cresce para a frente

  // volta ao mundo (a câmera está em uPlayerPos no modo 1ª pessoa)
  gl_Position = projectionMatrix * viewMatrix * vec4(pApp + uPlayerPos, 1.0);
}
