# CLAUDE.md

This file guides Claude Code when working in this repository.

## Project Overview

VOWT is a client-side OCR app for extracting and managing video game scoreboard data. It is a single-page static app built with **SolidJS** and **Vite**, running OCR locally with **Tesseract.js** and persisting data in the browser.

- **Stateless hosting**: Deployed as a static site to GitHub Pages; there is no backend.
- **Browser storage**: All user data lives in browser storage (localStorage).
- **Data portability**: Users import/export data as JSON files for backup and sharing.

| Layer      | Technology                        |
| ---------- | --------------------------------- |
| Language   | TypeScript (strict)               |
| Framework  | SolidJS (+ Ark UI, lucide-solid)  |
| Build tool | Vite                              |
| Testing    | Vitest + @solidjs/testing-library |
| Styling    | SASS/SCSS (+ Radix colors)        |
| OCR engine | Tesseract.js                      |
| Hosting    | GitHub Pages                      |

## Commands

```bash
npm run dev                  # Start the Vite dev server
npm run build                # Production build
npm test                     # Run all tests once
npm test -- storage.test.ts  # Run a single test file
npm run test:coverage        # Run tests with coverage
```

## Code Organization

```
src/
├── App.tsx              # Main entry point; layout and debug toggles
├── index.tsx            # SolidJS app initialization
├── setupTests.ts        # Test configuration
├── types.d.ts           # Global type definitions (imported as '#types')
├── components/          # SolidJS components; shared primitives in ui/
├── data/
│   ├── profiles/        # Default OCR region profiles (JSON) + index.ts bundler
│   └── hashSets/        # Precomputed image hash sets
├── styles/
│   ├── _theme.scss      # Theme colors and reusable mixins
│   └── *.scss           # Component-specific styles
└── utils/               # OCR, pre/post-processing, storage, API clients
tests/                   # Mirrors src/ (components/, utils/)
```

Use the import aliases from `package.json`: `#*` → `src/*`, `#c/*` → `src/components/*`, `#styles/*` → `src/styles/*.scss`.

## Code Style

Formatting is enforced by Prettier (tabs, single quotes, 90-column width) and ESLint with `eslint-plugin-solid`.

TypeScript files follow this order:

1. File header comment
2. Imports, grouped: external packages, types, constants, components, utils, styles
3. Exported constants
4. Local types
5. Local constants
6. Local functions
7. Exported functions

### TypeScript

- Avoid `any`; use union types and generics.
- Type components explicitly (`Component<Props>`).
- Prefer `interface` for object shapes; use `type` only when required.

### SolidJS

- Use fine-grained reactivity (`createSignal`, `createMemo`, `createEffect`) rather than broad re-renders.
- Avoid refs unless necessary; prefer signal-based state.
- Keep render functions free of side effects; put them in `createEffect`.
- Clean up timers, workers, and event listeners with `onCleanup`.
- Keep components focused and composable.

### SCSS

- Import theme variables and mixins with `@use`.
- `src/styles/_theme.scss` holds color groups (foreground, background, accent1, accent2, neutral) and mixins such as `container`, `card`, `info-box`, `button`, `badge`, `code-block`, `progress-bar-wrapper/fill`.
- Each component has a matching `.scss` file built from theme mixins.
- Use BEM-like class names (e.g. `.progress-container .progress-bar`) and avoid deep nesting; add classes or ids instead.
- No inline `style` attributes.

## Domain Guidelines

### Browser Storage

- Use `localStorage` (see `src/utils/storage.ts`).
- Wrap all JSON serialize/deserialize in try/catch.
- Include a `schemaVersion` field in stored JSON for migrations.
- Exports are `.json` files with ISO timestamps.

### OCR

- Create Tesseract workers once, reuse them, and terminate them on unload.
- Always set `tessedit_char_whitelist` for the region being read.
- Choose `tessedit_pageseg_mode` to fit the region (region reads currently use `PSM.SINGLE_LINE`).
- Regions are defined in absolute pixel coordinates in `src/utils/textRegions.ts` and the profiles under `src/data/profiles/`.
- Process images in batches and show progress during long OCR runs.
- Handle OCR failures gracefully with user-friendly error messages.

### Image Processing

- Use only the Canvas API and native browser functions; no external image APIs.
- Apply contrast enhancement, thresholding, or grayscale conversion as needed for accuracy.
- Watch for cross-origin restrictions when loading external images onto a canvas.

## Testing

- Add tests for every new feature; update existing tests when behaviour changes.
- Cover edge cases.
- Organize test files with nested `describe()` blocks.

## Tools

- Use context7 to look up library documentation and examples.
