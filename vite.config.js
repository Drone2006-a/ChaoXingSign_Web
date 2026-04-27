import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/cloud-api': {
        target: 'https://tk.udrone.vip',
        changeOrigin: true,
        secure: true,
        rewrite: () => '/api.php',
      },
      '/chaoxing-passport': {
        target: 'https://passport2.chaoxing.com',
        changeOrigin: true,
        secure: true,
        rewrite: path => path.replace(/^\/chaoxing-passport/, ''),
      },
      '/chaoxing-passport-api': {
        target: 'https://passport2-api.chaoxing.com',
        changeOrigin: true,
        secure: true,
        rewrite: path => path.replace(/^\/chaoxing-passport-api/, ''),
      },
    },
  },
});
