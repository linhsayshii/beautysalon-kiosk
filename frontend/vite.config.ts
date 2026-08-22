import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

const phosphorWoff2Only = () => ({
  name: 'phosphor-woff2-only',
  enforce: 'pre' as const,
  transform(source: string, id: string) {
    if (!id.includes('@phosphor-icons/web/src/regular/style.css')) return null;
    return source.replace(
      /src:\s*url\("\.\/Phosphor\.woff2"\) format\("woff2"\),[\s\S]*?url\("\.\/Phosphor\.svg#Phosphor"\) format\("svg"\);/,
      'src: url("./Phosphor.woff2") format("woff2");',
    );
  },
});

export default defineConfig({
  plugins: [phosphorWoff2Only(), react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        ws: true,
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
  },
});
