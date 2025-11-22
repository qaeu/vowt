## Project Overview

VOWT is a client-side OCR application for extracting and managing video game scoreboard data. It's a single-page static app built with **SolidJS** and **Vite**, featuring local OCR processing via **Tesseract.js** and browser-based data persistence.

### Key Architectural Principles

-   **Stateless Hosting**: Deployed as a static site to GitHub Pages with no backend server required.
-   **Browser Storage**: All user data is persisted exclusively in browser storage (localStorage/IndexedDB).
-   **Data Portability**: Users can import/export data as JSON files for backup and sharing.

## Technology Stack

| Layer          | Technology                        |
| -------------- | --------------------------------- |
| **Framework**  | SolidJS                           |
| **Build Tool** | Vite                              |
| **Styling**    | SASS/SCSS                         |
| **OCR Engine** | Tesseract.js                      |
| **Testing**    | Vitest + @solidjs/testing-library |
| **Language**   | TypeScript                        |
| **Hosting**    | GitHub Pages                      |

## Code Organization

```
src/
├── App.tsx                      # Main entry point; layout and debug toggles
├── index.tsx                    # SolidJS app initialization
├── setupTests.ts                # Test configuration
├── types.d.ts                   # Global type definition file
├── data/profiles/
│   ├── index.ts                 # Import bundler for JSON profile data
│   └── *.json                   # Default OCR region profiles
├── styles/
│   ├── _theme.scss              # Reusable theme styling
│   └── *.scss                   # Component specific stylings
├── components/
│   └── *.tsx                    # SolidJS components
└── utils/
    └── *.ts                     # Utility scripts
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

### Code style

-   **Code structure**: TypeScript files follow this ordered structure:
    -   File header
    -   Imports
        -   External packages
        -   Types
        -   Constants
        -   Components
        -   Utils
        -   Stylings
    -   Exported constants
    -   Local types
    -   Local constants
    -   Local functions
    -   Exported functions

### Styling with SASS/SCSS

-   **Module system**: Use `@use` for importing theme variables and mixins.
-   **Theme file**: `src/_theme.scss` contains:
    -   **Color variables**: Organized into logical groups (foreground, background, accent1, accent2, neutral).
    -   **Reusable mixins**: `container`, `card`, `info-box`, `button`, `badge`, `code-block`, `progress-bar-wrapper/fill`, etc.
-   **Component stylesheets**: Each component has a corresponding `.scss` file using mixins from `_theme.scss`.
-   **Class naming**: Use BEM-like convention for nested components (e.g., `.progress-container .progress-bar`).
-   **Selector clarity**: Avoid heavily nested selectors; prefer adding classes or ids if necessary.
-   **No inline styles**: Avoid inline `style` attributes; use CSS classes and mixins instead.

### Browser Storage Patterns

-   **Storage choice**: Use `localStorage` for persistent data (simple, synchronous, ~5-10MB limit).
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
-   **Region extraction**: Regions are used to define OCR focus areas.
-   **Canvas operations**: Be mindful of cross-origin restrictions when loading external images.

## Tests

Run individual test files using:

```bash
npm test -- example.test.ts
```

-   **Maintain test coverage**: Add tests for each new feature, update existing tests when the underlying behaviour has changed.
-   **Test file readability**: Use nested `describe()` blocks to create reasonable sections.

## Security Considerations

-   **No authentication**: This is a public, static site. Do not store secrets or API keys in code.
-   **CORS non-issue**: Since there's no backend, CORS is not a concern. Image loading may have restrictions.
-   **User data privacy**: Reinforce that all processing is client-side. Document this prominently.
-   **Dependency supply chain**: Keep dependencies updated; regularly audit for vulnerabilities.

## Performance Optimization

-   **Code splitting**: Vite automatically splits code; avoid large synchronous bundles.
-   **Lazy loading**: Only load expensive data when needed.
-   **Memoization**: Cache expensive data in signals/memos to avoid recomputation.

## Contributing Tips

-   Keep components focused and composable.
-   Document complex image processing logic with comments.
-   Write tests for critical OCR paths and storage operations.
-   Avoid side effects in render functions; use `createEffect` instead.
-   Test in production build mode (`npm run serve`) before deploying.
