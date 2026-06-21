import { defineConfig } from 'vite';

// Configuração mínima do Vite.
// `base: './'` gera caminhos relativos no build, então o `dist/` roda
// tanto no GitHub Pages quanto abrindo o index.html direto do disco.
export default defineConfig({
  base: './',
  server: {
    host: true, // expõe na rede local (útil no WSL para o navegador do Windows)
    open: false,
  },
  build: {
    target: 'es2022',
    outDir: 'dist',
  },
});
