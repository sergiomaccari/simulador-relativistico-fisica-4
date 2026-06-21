# ⚡ Simulador Relativístico · Física 4

Simulador interativo dos efeitos visuais de viajar perto da velocidade da luz,
feito em **TypeScript + Three.js (WebGL)**.

> **Demo ao vivo:** https://sergiomaccari.github.io/simulador-relativistico-fisica-4/

## O que ele demonstra

- **Contração de Lorentz** — comprimentos encolhem na direção do movimento (L = L₀/γ)
- **Dilatação do tempo** — o relógio que se move atrasa (dois relógios no HUD)
- **Efeito Doppler relativístico** — cores deslocam para o azul à frente e o vermelho atrás
- **Beaming (efeito holofote)** — o brilho se concentra na direção do movimento
- **Aberração relativística** — as posições aparentes se curvam para a frente (opcional)

Toda a física está em GLSL: a contração e a posição aparente (cone de luz) no
*vertex shader*, e o Doppler/beaming no *fragment shader*. O núcleo de Minkowski
(γ, adição de velocidades) está em `src/core/minkowski.ts`.

## Modos

| Modo | O que faz |
|------|-----------|
| **Laboratório (orbital)** | orbita por fora e inspeciona a cena deformada |
| **Olho do observador** | parado no centro, arraste para girar o olhar (β no painel) |
| **Primeira pessoa (WASD)** | anda pela cena a velocidade constante · `ESC` pausa |

## Rodar localmente

```bash
npm install
npm run dev      # abre em http://localhost:5173
```

Build de produção (gera `dist/`):

```bash
npm run build
npm run preview
```

## Stack

TypeScript · Three.js · Vite · lil-gui · GLSL (WebGL)

## Créditos

Reimplementação independente, do zero, inspirada no
[OpenRelativity](https://github.com/MITGameLab/OpenRelativity) do MIT Game Lab
(originalmente em Unity/C#). A física é a Relatividade Especial padrão; as
constantes das curvas de resposta de cor (CIE) seguem o modelo de *A Slower
Speed of Light*.
