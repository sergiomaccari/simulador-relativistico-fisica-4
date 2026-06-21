// ───────────────────────────────────────────────────────────────────────────
//  Celeritas · Fragment shader relativístico
//
//  Aplica a COR percebida: desvio Doppler do espectro + beaming (holofote).
//
//  O espectro de emissão do objeto é aproximado por 3 lóbulos gaussianos
//  (R≈615nm, G≈550nm, B≈463nm). O fator Doppler (vShift) desloca esses
//  lóbulos; eles são reintegrados contra as curvas de resposta XYZ do olho
//  (aproximação gaussiana, "A Slower Speed of Light" / MIT Game Lab) e
//  reconvertidos em RGB. As constantes são dados ópticos do olho humano,
//  reorganizadas aqui num pipeline próprio.
// ───────────────────────────────────────────────────────────────────────────

uniform vec3  uBaseColor; // cor de repouso do objeto (referencial próprio)
uniform float uDoppler;   // 0/1 — liga o desvio de cor
uniform float uBeaming;   // 0/1 — liga o efeito holofote
uniform float uOpacity;

varying float vShift;      // λ_obs / λ_emit
varying float vBeaming;    // D³

// Curvas XYZ aproximadas por gaussianas (centros em nm, larguras em nm)
const float xla = 0.39952808, xlb = 444.63157, xlc = 20.095465;
const float xha = 1.13055796, xhb = 593.23109, xhc = 34.446036;
const float ya  = 1.00988748, yb  = 556.03725, yc  = 46.184868;
const float za  = 2.06484005, zb  = 448.45126, zc  = 22.357298;
const float SQRT2PI = 2.50662827;

// Sobreposição (analítica) de um lóbulo gaussiano p=(amplitude, centro, σ),
// já deslocado por `shift`, com cada gaussiana das curvas X/Y/Z.
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
// pesos dos lóbulos R/G/B a partir do XYZ da cor base
vec3 lobeWeights(vec3 xyz) {
  return vec3(
     0.0735806   * xyz.x - 0.0380793   * xyz.y - 0.00860837  * xyz.z,
    -0.0665378   * xyz.x + 0.134408    * xyz.y - 0.000417865 * xyz.z,
     0.00000299624*xyz.x - 0.00000605249*xyz.y + 0.0484424   * xyz.z);
}
vec3 constrainRGB(vec3 c) {
  float w = min(0.0, min(c.r, min(c.g, c.b)));
  c -= w;                          // levanta para ≥ 0
  float m = max(c.r, max(c.g, c.b));
  if (m > 1.0) c /= m;             // normaliza se estourar
  return c;
}

void main() {
  vec3 color = uBaseColor;

  if (uDoppler > 0.5) {
    float shift = vShift;
    vec3 xyz = rgbToXyz(uBaseColor);
    vec3 w   = lobeWeights(xyz);
    // lóbulos: (peso, centro[nm], largura[nm])
    vec3 rP = vec3(w.r, 615.0, 8.0);
    vec3 gP = vec3(w.g, 550.0, 4.0);
    vec3 bP = vec3(w.b, 463.0, 5.0);
    float xf = lobeX(rP, shift) + lobeX(gP, shift) + lobeX(bP, shift);
    float yf = lobeY(rP, shift) + lobeY(gP, shift) + lobeY(bP, shift);
    float zf = lobeZ(rP, shift) + lobeZ(gP, shift) + lobeZ(bP, shift);
    vec3 shifted = constrainRGB(xyzToRgb(vec3(xf, yf, zf)));

    // Mistura: em repouso (shift≈1) mantém a cor base; sob movimento revela o
    // desvio espectral. Evita que imprecisões do round-trip apareçam em β=0.
    float k = clamp(abs(shift - 1.0) * 3.0, 0.0, 1.0);
    color = mix(uBaseColor, shifted, k);
  }

  // efeito holofote: brilho aumenta para a frente, escurece para trás
  float intensity = (uBeaming > 0.5) ? vBeaming : 1.0;
  color *= intensity;

  gl_FragColor = vec4(clamp(color, 0.0, 1.0), uOpacity);
}
