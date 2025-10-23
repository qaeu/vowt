# Copilot Instructions for VOWT

## Project Overview

VOWT is a client-side OCR application for extracting and managing video game scoreboard data. It's a single-page static app built with **SolidJS** and **Vite**, featuring local OCR processing via **Tesseract.js** and browser-based data persistence.

### Key Architectural Principles

-   **Stateless Hosting**: Deployed as a static site to GitHub Pages with no backend server required.
-   **Browser Storage**: All user data is persisted exclusively in browser storage (localStorage/IndexedDB).
-   **Data Portability**: Users can import/export data as JSON files for backup and sharing.

## Technology Stack

| Layer          | Technology                        | Notes                                                   |
| -------------- | --------------------------------- | ------------------------------------------------------- |
| **Framework**  | SolidJS 1.9+                      | Fine-grained reactivity, minimal overhead               |
| **Build Tool** | Vite 7.1+                         | Lightning-fast development, optimized production builds |
| **Styling**    | SASS/SCSS                         | Module-based with theme variables and mixins            |
| **OCR Engine** | Tesseract.js 6.0.1                | Client-side text recognition; no API calls              |
| **Testing**    | Vitest + @solidjs/testing-library | Unit and component testing                              |
| **Language**   | TypeScript 5.7+                   | Strict type safety across codebase                      |
| **Hosting**    | GitHub Pages                      | Static site deployment only                             |

## Code Organization

```
src/
├── App.tsx                      # Main entry point; layout and debug toggles
├── index.tsx                    # SolidJS app initialization
├── setupTests.ts                # Test configuration
├── styles/
│   ├── _theme.scss              # Color variables, typography, and reusable mixins
│   ├── App.scss                 # App navigation styling
│   ├── ScoreboardOCR.scss       # OCR component styling
│   ├── RegionDebugger.scss      # Region debugger styling
│   ├── GameRecordsTable.scss    # Records table styling
│   └── EditableGameData.scss    # Editable game data styling
├── components/
│   ├── ScoreboardOCR.tsx        # Primary OCR processing logic
│   ├── RegionDebugger.tsx       # Development tool for region visualization
│   ├── GameRecordsTable.tsx     # Game records display and management
│   └── EditableGameData.tsx     # Inline editing interface for game records
└── utils/
    ├── preprocess.ts            # Image preprocessing and enhancement
    ├── postprocess.ts           # OCR result post-processing and validation
    ├── textRegions.ts           # Region definitions and OCR area management
    ├── regionEditor.ts          # Region coordinate management and editing
    └── gameStorage.ts           # Game record persistence (localStorage)
```

## Development Guidelines

### SolidJS Best Practices

-   **Use fine-grained reactivity**: Prefer `createSignal`, `createMemo`, and `createEffect` over broad re-renders.
-   **Avoid unnecessary components**: Extract components only when reusability or logic separation is needed.
-   **Lazy evaluation**: Use `createMemo` for expensive computations and selector functions.
-   **Avoid refs unless necessary**: SolidJS generally doesn't need refs; use signal-based state instead.
-   **Resource management**: Always clean up timers, workers, and event listeners in cleanup functions.

### TypeScript Standards

-   **Strict mode**: All code uses `strict: true` in `tsconfig.json`.
-   **Explicit types**: Avoid `any`; use union types and generics instead.
-   **Component types**: Always specify `Component` return type or generic interface for SolidJS components.
-   **Interface over type**: Prefer `interface` for object shapes; use `type` only for unions or primitives.

### Styling with SASS/SCSS

-   **Module system**: Use `@use` for importing theme variables and mixins.
-   **Theme file**: `src/_theme.scss` contains:
    -   **Color variables**: Organized into logical groups (foreground, background, accent1, accent2, neutral).
    -   **Reusable mixins**: `container`, `card`, `info-box`, `button`, `badge`, `code-block`, `progress-bar-wrapper/fill`, etc.
-   **Component stylesheets**: Each component has a corresponding `.scss` file using mixins from `_theme.scss`.
-   **Class naming**: Use BEM-like convention for nested components (e.g., `.progress-container .progress-bar`).
-   **No inline styles**: Avoid inline `style` attributes; use CSS classes and mixins instead.

### Browser Storage Patterns

-   **Storage choice**: Use `localStorage` for JSON data (simple, synchronous, ~5-10MB limit).
-   **Structured data**: Always serialize/deserialize JSON with try-catch error handling.
-   **Versioning**: Include a schema version field in stored JSON for future migrations.
-   **Export format**: When exporting, use `.json` with ISO timestamps for auditability.

### OCR Processing Guidelines

-   **Tesseract.js worker management**:
    -   Create workers once and reuse; destroy when app unloads.
    -   Always set character whitelist (`tessedit_char_whitelist`) to optimize recognition speed.
    -   Use `Tesseract.PSM` (page segmentation mode) appropriately:
        -   `SINGLE_WORD` for scoreboard numbers
        -   Default for general text
-   **Region-based processing**: Define regions in `utils/imagePreprocessing.ts` using absolute pixel coordinates.
-   **Performance**: Process images in batches; show progress updates during long OCR tasks.
-   **Error handling**: Gracefully handle OCR failures; provide user-friendly error messages.

### Image Processing

-   **No external APIs**: All image processing uses Canvas API and browser native functions.
-   **Preprocessing**: Apply contrast enhancement, thresholding, or grayscale conversion as needed for OCR accuracy.
-   **Region extraction**: Use `getScoreboardRegions()` and `getMatchInfoRegions()` to define OCR focus areas.
-   **Canvas operations**: Be mindful of cross-origin restrictions when loading external images.

## Testing

### Test Structure

-   **Unit tests**: Place in `*.test.ts` files alongside source files.
-   **Component tests**: Use `@solidjs/testing-library` for integration testing with `render()`.
-   **Test configuration**: See `vitest.config.ts` for test setup; JSDOM environment enabled.

### Running Tests

```bash
npm test -- --run        # Run all tests once
```

## Build & Deployment

### Development Server

```bash
npm start      # Start Vite dev server on port 3000
```

### Production Build

```bash
npm run build  # Output to dist/ folder
npm run serve  # Preview production build locally
```

### GitHub Pages Deployment

-   Build output goes to `dist/` folder.
-   Configure GitHub Pages to deploy from `dist/` or via Actions workflow.
-   Vite automatically optimizes:
    -   Code splitting for faster loads
    -   Asset hashing for cache busting
    -   Minification and dead code elimination

## Security Considerations

-   **No authentication**: This is a public, static site. Do not store secrets or API keys in code.
-   **CORS non-issue**: Since there's no backend, CORS is not a concern. Image loading may have restrictions.
-   **User data privacy**: Reinforce that all processing is client-side. Document this prominently.
-   **Dependency supply chain**: Keep dependencies updated; regularly audit for vulnerabilities.

## Performance Optimization

-   **Code splitting**: Vite automatically splits code; avoid large synchronous bundles.
-   **Asset optimization**: Images should be compressed; consider WebP for supported browsers.
-   **Lazy loading**: Only load Tesseract.js when OCR is needed.
-   **Memoization**: Cache region definitions and preprocessed images in signals/memos to avoid recomputation.
-   **Worker pooling**: Consider reusing a single Tesseract worker across multiple recognitions.

## Debugging & Development Tools

-   **RegionDebugger component**: Toggle via button in App.tsx to visualize OCR regions on images.
-   **Browser DevTools**: Use Chrome/Firefox DevTools to inspect:
    -   Network (should see no external API calls)
    -   Local Storage (verify data is stored correctly)
    -   Performance (profile OCR processing bottlenecks)
-   **SolidJS DevTools**: Vite config includes `solid-devtools` for reactive graph debugging.
-   **Test UI**: Run `npm run test:ui` for interactive test runner with time-travel debugging.

## Contributing Tips

-   Keep components focused and composable.
-   Document complex image processing logic with comments.
-   Write tests for critical OCR paths and storage operations.
-   Avoid side effects in render functions; use `createEffect` instead.
-   Test in production build mode (`npm run serve`) before deploying.
