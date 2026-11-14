import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const apiEndpoint = process.env.services__api__http__0;

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    proxy: apiEndpoint
      ? {
          '/api': {
            target: apiEndpoint,
            changeOrigin: true,
          },
        }
      : undefined,
  },
});
