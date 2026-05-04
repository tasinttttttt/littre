import { resolve } from 'path';
import { readFileSync, writeFileSync, copyFileSync } from 'fs';
import { defineConfig } from 'vite';

export default defineConfig({
  root: resolve('src'),
  publicDir: resolve('public'),
  build: {
    outDir: resolve('dist'),
    emptyOutDir: true,
    rollupOptions: {
      input: resolve('src/index.html'),
    },
  },
  server: {
    port: 3000,
  },
  plugins: [{
    name: 'process-sw',
    closeBundle() {
      copyFileSync(resolve('src/sw.js'), resolve('dist/sw.js'));

      const html = readFileSync(resolve('dist/index.html'), 'utf-8');
      const jsMatch = html.match(/src="\/assets\/([^"]+\.js)"/);
      const cssMatch = html.match(/href="\/assets\/([^"]+\.css)"/);

      let version = new Date().toISOString().split('T')[0];
      const indexPath = resolve('public/data/index.json');
      try {
        const indexData = JSON.parse(readFileSync(indexPath, 'utf-8'));
        if (indexData.version) version = indexData.version;
      } catch {}

      if (jsMatch && cssMatch) {
        let sw = readFileSync(resolve('dist/sw.js'), 'utf-8');
        sw = sw.replace(
          /const PRECACHE = \[[\s\S]*?\];/,
          `const PRECACHE = [
  '/',
  '/index.html',
  '/assets/${jsMatch[1]}',
  '/assets/${cssMatch[1]}',
  '/data/index.json',
  '/manifest.json',
  '/icons/192.png',
  '/icons/512.png',
];`
        );
        sw = sw.replace(
          /const CACHE_DATA = 'littre-data-v1';/,
          `const CACHE_DATA = 'littre-data-${version}';`
        );
        writeFileSync(resolve('dist/sw.js'), sw);
      }
    },
  }],
  test: {
    environment: 'jsdom',
    globals: true,
  },
});
