import { defineConfig } from 'vitest/config';
import solidPlugin from 'vite-plugin-solid';

export default defineConfig({
    plugins: [solidPlugin()],
    test: {
        environment: 'jsdom',
        globals: true,
        setupFiles: ['./src/setupTests.ts'],
    },
    resolve: {
        conditions: ['development', 'browser'],
        extensions: ['.ts', '.tsx', '.js', '.jsx', '.scss'],
        alias: {
            '#': '/src/',
            '#c': '/src/components/',
        },
    },
});
