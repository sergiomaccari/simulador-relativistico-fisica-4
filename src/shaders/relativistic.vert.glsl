// ───────────────────────────────────────────────────────────────────────────
//  Simulador Relativístico · Vertex shader
//
//  Recebe a posição de REPOUSO de cada vértice (relativa ao observador) e
//  devolve onde ele APARECE para um observador que se move com β = uBeta.
//    (1) boost de Lorentz   → contração do comprimento          [uContraction]
//    (2) cone de luz passado → aberração + atraso da luz         [uAberration]
//    (3) Doppler + beaming   → COR final calculada AQUI (vColor)
//
//  Otimização de desempenho: a reconstrução espectral da cor (cara, com vários
//  exp()) é feita por VÉRTICE e interpolada, em vez de por pixel. Para malhas
//  bem subdivididas o resultado é praticamente idêntico (sólidos de poucas
//  faces são subdivididos na cena p/ evitar facetação) e roda muito mais leve.
// ───────────────────────────────────────────────────────────────────────────

uniform vec3  uBeta;        // velocidade do OBSERVADOR / c
uniform vec3  uObjectBeta;  // velocidade DESTE objeto / c
uniform vec3  uPlayerPos;   // posição do observador (modo 1ª pessoa)
uniform float uContraction; // 0 = repouso · 1 = contração total
uniform float uAberration;  // 0 = posição instantânea · 1 = posição vista
uniform vec3  uBaseColor;   // cor de repouso do objeto
uniform float uDoppler;     // 0/1 — desvio de cor
uniform float uBeaming;     // 0/1 — efeito holofote

varying vec3 vColor;        // cor final percebida (já com Doppler + beaming)

// Adição relativística de velocidades — espelha velocityAdd() em minkowski.ts
vec3 velocityAdd(vec3 u, vec3 v) {
  float v2 = dot(v, v);
  if (v2 < 1e-10) return u;
  float gv = 1.0 / sqrt(max(1.0 - v2, 1e-10));
  float uv = dot(u, v);
  vec3 uPar  = (uv / v2) * v;
  vec3 uPerp = u - uPar;
  return (uPar + v + uPerp / gv) / (1.0 + uv);
}

// ── Cor: curvas XYZ aproximadas por gaussianas + reconstrução espectral ──
const float xla = 0.39952808, xlb = 444.63157, xlc = 20.095465;
const float xha = 1.13055796, xhb = 593.23109, xhc = 34.446036;
const float ya  = 1.00988748, yb  = 556.03725, yc  = 46.184868;
const float za  = 2.06484005, zb  = 448.45126, zc  = 22.357298;
const float SQRT2PI = 2.50662827;

float lobeX(vec3 p, float shift) {
  float c1 = p.y * shift, w1 = p.z * shift, w1s = w1 * w1;
  float d1 = c1 - xlb;
  float t1 = p.x * xla * exp(-(d1 * d1 / (2.0 * (w1s + xlc * xlc)))) * SQRT2PI;
  float b1 = sqrt(1.0 / w1s + 1.0 / (xlc * xlc));
  float d2 = c1 - xhb;
  float t2 = p.x * xha * exp(-(d2 * d2 / (2.0 * (w1s + xhc * xhc)))) * SQRT2PI;
  float b2 = sqrt(1.0 / w1s + 1.0 / (xhc * xhc));
  return t1 / b1 + t2 / b2;
}
float lobeY(vec3 p, float shift) {
  float c1 = p.y * shift, w1 = p.z * shift, w1s = w1 * w1;
  float d = c1 - yb;
  float t = p.x * ya * exp(-(d * d / (2.0 * (w1s + yc * yc)))) * SQRT2PI;
  return t / sqrt(1.0 / w1s + 1.0 / (yc * yc));
}
float lobeZ(vec3 p, float shift) {
  float c1 = p.y * shift, w1 = p.z * shift, w1s = w1 * w1;
  float d = c1 - zb;
  float t = p.x * za * exp(-(d * d / (2.0 * (w1s + zc * zc)))) * SQRT2PI;
  return t / sqrt(1.0 / w1s + 1.0 / (zc * zc));
}
vec3 rgbToXyz(vec3 c) {
  return vec3(
    0.13514   * c.r + 0.120432  * c.g + 0.057128  * c.b,
    0.0668999 * c.r + 0.232706  * c.g + 0.0293946 * c.b,
                      0.0000218959 * c.g + 0.358278 * c.b);
}
vec3 xyzToRgb(vec3 c) {
  return vec3(
     9.94845    * c.x - 5.1485    * c.y - 1.16389   * c.z,
    -2.86007    * c.x + 5.77745   * c.y - 0.0179627 * c.z,
     0.000174791* c.x - 0.000353084*c.y + 2.79113   * c.z);
}
vec3 lobeWeights(vec3 xyz) {
  return vec3(
     0.0735806   * xyz.x - 0.0380793   * xyz.y - 0.00860837  * xyz.z,
    -0.0665378   * xyz.x + 0.134408    * xyz.y - 0.000417865 * xyz.z,
     0.00000299624*xyz.x - 0.00000605249*xyz.y + 0.0484424   * xyz.z);
}
vec3 constrainRGB(vec3 c) {
  float w = min(0.0, min(c.r, min(c.g, c.b)));
  c -= w;
  float m = max(c.r, max(c.g, c.b));
  if (m > 1.0) c /= m;
  return c;
}
// cor deslocada pelo Doppler (shift = λ_obs/λ_emit)
vec3 dopplerColor(vec3 base, float shift) {
  vec3 w = lobeWeights(rgbToXyz(base));
  vec3 rP = vec3(w.r, 615.0, 8.0);
  vec3 gP = vec3(w.g, 550.0, 4.0);
  vec3 bP = vec3(w.b, 463.0, 5.0);
  float xf = lobeX(rP, shift) + lobeX(gP, shift) + lobeX(bP, shift);
  float yf = lobeY(rP, shift) + lobeY(gP, shift) + lobeY(bP, shift);
  float zf = lobeZ(rP, shift) + lobeZ(gP, shift) + lobeZ(bP, shift);
  vec3 shifted = constrainRGB(xyzToRgb(vec3(xf, yf, zf)));
  float k = clamp(abs(shift - 1.0) * 3.0, 0.0, 1.0);
  return mix(base, shifted, k);
}

void main() {
  // posição de repouso do vértice, relativa ao observador
  vec3 xLab = (modelMatrix * vec4(position, 1.0)).xyz - uPlayerPos;

  float b2 = dot(uBeta, uBeta);
  float g  = (b2 > 1e-10) ? 1.0 / sqrt(max(1.0 - b2, 1e-10)) : 1.0;
  vec3 uObs = velocityAdd(uObjectBeta, -uBeta);

  // (1) posição no instante t=0 do observador → contração de Lorentz
  vec3 r0 = xLab;
  if (b2 > 1e-10) {
    vec3 bhat = uBeta / sqrt(b2);
    float denom = 1.0 - dot(uBeta, uObjectBeta);
    denom = (abs(denom) < 1e-4) ? 1e-4 : denom;
    float Tp = dot(uBeta, xLab) / denom;
    vec3  X  = xLab + uObjectBeta * Tp;
    r0 = X + (g - 1.0) * dot(bhat, X) * bhat - g * uBeta * Tp;
  }
  vec3 rC = mix(xLab, r0, uContraction);

  // (2) cone de luz passado → posição aparente (aberração)
  vec3 pApp = rC;
  if (uAberration > 0.5) {
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
      if (t1 <= 0.0 && t2 <= 0.0)      tau = max(t1, t2);
      else if (t1 <= 0.0)              tau = t1;
      else if (t2 <= 0.0)              tau = t2;
    }
    pApp = rC + uObs * tau;
  }

  // (3) Doppler + beaming → cor final (por vértice)
  float los = length(pApp);
  vec3  n   = (los > 1e-6) ? pApp / los : vec3(0.0, 0.0, 1.0);
  float ub2 = dot(uObs, uObs);
  float gObs = (ub2 < 1.0) ? 1.0 / sqrt(max(1.0 - ub2, 1e-10)) : 1.0;
  float D  = 1.0 / max(gObs * (1.0 + dot(uObs, n)), 1e-4); // f_obs/f_emit
  float shift = 1.0 / D;

  vec3 col = (uDoppler > 0.5) ? dopplerColor(uBaseColor, shift) : uBaseColor;
  if (uBeaming > 0.5) col *= D * D * D; // beaming (searchlight)
  vColor = col;

  gl_Position = projectionMatrix * viewMatrix * vec4(pApp + uPlayerPos, 1.0);
}
