# Testing Documentation

## Overview

This project uses [Vitest](https://vitest.dev/) as the testing framework along with [@solidjs/testing-library](https://github.com/solidjs/solid-testing-library) for component testing.

## Running Tests

```bash
# Run tests once
npm test -- --run

# Run tests in watch mode
npm test

# Run tests with UI
npm run test:ui

# Run tests with coverage
npm run test:coverage
```

## Test Structure

### Unit Tests

#### `imagePreprocessing.test.ts`

Tests for the image preprocessing utilities including:

- **Scoreboard Table Format Parsing**: Tests for extracting player stats from OCR text
- **Team Assignment**: Verifies correct blue/red team detection
- **Player Stats Parsing**: Validates individual player stat extraction
- **Match Information**: Tests extraction of game result, score, date, and mode
- **Edge Cases**: Handles malformed input, empty data, and various text formats
- **Numeric Parsing**: Ensures correct number conversion
- **Case Insensitivity**: Tests for uppercase/lowercase handling
- **Whitespace Handling**: Validates trimming and parsing with extra spaces

**Test Coverage:**
- ✅ 19 test cases
- ✅ Multiple scenarios for data extraction
- ✅ Edge case handling
- ✅ Error scenarios

#### `ScoreboardOCR.test.tsx`

Component tests for the ScoreboardOCR component:

- **Component Rendering**: Verifies the component loads correctly
- **UI Elements**: Tests for presence of all expected sections
- **Processing Flow**: Validates the image processing workflow
- **Data Display**: Ensures extracted data is displayed correctly
- **Image Sources**: Validates correct image paths

**Test Coverage:**
- ✅ 9 test cases
- ✅ Component integration tests
- ✅ Async processing validation
- ✅ UI element verification

## Test Files Location

```
src/
├── components/
│   ├── ScoreboardOCR.tsx
│   └── ScoreboardOCR.test.tsx
├── utils/
│   ├── imagePreprocessing.ts
│   └── imagePreprocessing.test.ts
└── setupTests.ts
```

## Configuration

### vitest.config.ts

The Vitest configuration includes:
- JSDOM environment for DOM testing
- Global test APIs
- SolidJS plugin integration
- Setup files for test initialization

### setupTests.ts

Setup file that:
- Imports test utilities
- Configures cleanup after each test
- Sets up testing library defaults

## Writing New Tests

### For Utility Functions

```typescript
import { describe, it, expect } from 'vitest';
import { yourFunction } from './yourModule';

describe('yourFunction', () => {
  it('should do something', () => {
    const result = yourFunction(input);
    expect(result).toBe(expected);
  });
});
```

### For Components

```typescript
import { render, screen, waitFor } from '@solidjs/testing-library';
import YourComponent from './YourComponent';

describe('YourComponent', () => {
  it('should render', () => {
    render(() => <YourComponent />);
    expect(screen.getByText('Expected Text')).toBeDefined();
  });
});
```

## Continuous Integration

Tests can be integrated into CI/CD pipelines:

```yaml
# Example GitHub Actions workflow
- name: Run Tests
  run: npm test -- --run
```

## Code Coverage

To generate code coverage reports:

```bash
npm run test:coverage
```

This will generate a coverage report showing which lines of code are tested.

## Mocking

The tests use Vitest's mocking capabilities:

```typescript
vi.mock('../utils/imagePreprocessing', () => ({
  preprocessImageForOCR: vi.fn().mockResolvedValue('data:image/png;base64,mockdata'),
  extractGameStats: vi.fn().mockReturnValue({ /* mock data */ }),
}));
```

## Best Practices

1. **Descriptive Test Names**: Use clear, descriptive names for test cases
2. **Arrange-Act-Assert**: Follow the AAA pattern in tests
3. **Test Isolation**: Each test should be independent
4. **Mock External Dependencies**: Use mocks for API calls, file operations, etc.
5. **Test Edge Cases**: Include tests for error conditions and edge cases
6. **Keep Tests Simple**: Each test should verify one specific behavior

## Future Enhancements

- [ ] Add integration tests for the full OCR workflow
- [ ] Add visual regression testing for UI components
- [ ] Increase code coverage to >90%
- [ ] Add performance benchmarking tests
- [ ] Add E2E tests using Playwright or Cypress
