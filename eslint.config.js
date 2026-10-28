import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import solid from 'eslint-plugin-solid/configs/recommended';
import { defineConfig } from 'eslint/config';

export default defineConfig([
    js.configs.recommended,
    tseslint.configs.recommended,
    {
        ...solid,
        files: ['**/*.{js,mjs,cjs,ts,tsx,mts,cts}'],
        languageOptions: {
            globals: globals.browser,
            parserOptions: { project: 'tsconfig.json' },
        },
        rules: {
            ...solid.rules,
            // Solid assigns `let el; <div ref={el} />` at compile time, which this rule can't see
            'no-unassigned-vars': 'off',
        },
    },
]);
