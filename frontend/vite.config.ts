import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],
	server: {
		host: true,
		proxy: {
			'/api': {
				target: 'http://ixy:8080',
				changeOrigin: true,
				secure: false,
				rewrite: (path) => path.replace(/^\/api/, '')
			}
		}
	}
});
