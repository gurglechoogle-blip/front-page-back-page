import { defineConfig } from 'vite';

// Relative asset paths, so the built game works at any address
// (including GitHub Pages at /front-page-back-page/).
export default defineConfig({ base: './' });
