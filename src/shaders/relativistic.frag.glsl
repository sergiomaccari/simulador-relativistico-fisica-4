// ───────────────────────────────────────────────────────────────────────────
//  Simulador Relativístico · Fragment shader
//
//  A cor percebida (Doppler + beaming) já foi calculada por vértice no vertex
//  shader e chega interpolada em vColor. Aqui só aplicamos a opacidade — o
//  caminho por-pixel fica baratíssimo, o que faz rodar bem em GPUs fracas.
// ───────────────────────────────────────────────────────────────────────────

uniform float uOpacity;
varying vec3 vColor;

void main() {
  gl_FragColor = vec4(clamp(vColor, 0.0, 1.0), uOpacity);
}
