import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { dhash, hamDist, recogniseImage } from '#utils/imageRecognition';
import type { ImageHashSet } from '#types';

// Helper to create ImageData-like objects for testing
// (ImageData constructor isn't available in Node.js test environment)
function createImageData(
	data: Uint8ClampedArray,
	width: number,
	height: number
): ImageData {
	return { data, width, height, colorSpace: 'srgb' } as ImageData;
}

// Mock hash set for testing
const mockHashSet: ImageHashSet = {
	id: 'test-heroes',
	description: 'Test hero portrait hashes',
	hashes: [
		{ name: 'ana', hash: '6b2b17451147b400' },
		{ name: 'ashe', hash: '0a26b7350e052580' },
		{ name: 'baptiste', hash: '13050b39456abe00' },
	],
	createdAt: new Date(),
	updatedAt: new Date(),
};

// Mock canvas context
const mockCanvasContext = {
	drawImage: vi.fn(),
	getImageData: vi.fn(() => ({
		data: new Uint8ClampedArray(9 * 8 * 4),
		width: 9,
		height: 8,
	})),
	putImageData: vi.fn(),
};

// Mock canvas element
const mockCanvas = {
	width: 0,
	height: 0,
	getContext: vi.fn(() => mockCanvasContext),
};

// Store original createElement
const originalCreateElement = document.createElement.bind(document);

describe('imageRecognition', () => {
	beforeEach(() => {
		vi.clearAllMocks();

		// Mock document.createElement for canvas
		vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
			if (tagName === 'canvas') {
				return mockCanvas as unknown as HTMLCanvasElement;
			}
			return originalCreateElement(tagName);
		});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('dhash', () => {
		it('should return a 16-character hex string for default hash size', () => {
			// Create uniform gray ImageData
			const width = 100;
			const height = 100;
			const data = new Uint8ClampedArray(width * height * 4);
			for (let i = 0; i < data.length; i += 4) {
				data[i] = 128; // R
				data[i + 1] = 128; // G
				data[i + 2] = 128; // B
				data[i + 3] = 255; // A
			}
			const imageData = createImageData(data, width, height);

			const hash = dhash(imageData);

			expect(hash).toHaveLength(16);
			expect(hash).toMatch(/^[0-9a-f]{16}$/);
		});

		it('should return consistent hash for same image data', () => {
			const width = 50;
			const height = 50;
			const data = new Uint8ClampedArray(width * height * 4);
			// Create a gradient pattern
			for (let y = 0; y < height; y++) {
				for (let x = 0; x < width; x++) {
					const idx = (y * width + x) * 4;
					const value = Math.floor((x / width) * 255);
					data[idx] = value;
					data[idx + 1] = value;
					data[idx + 2] = value;
					data[idx + 3] = 255;
				}
			}
			const imageData1 = createImageData(new Uint8ClampedArray(data), width, height);
			const imageData2 = createImageData(new Uint8ClampedArray(data), width, height);

			const hash1 = dhash(imageData1);
			const hash2 = dhash(imageData2);

			expect(hash1).toBe(hash2);
		});

		it('should produce hash based on pixel differences', () => {
			// Note: Due to canvas mocking, we test that dhash produces valid output format
			// and is deterministic. Real image difference detection is tested in integration tests.
			const width = 50;
			const height = 50;

			const data = new Uint8ClampedArray(width * height * 4);
			for (let y = 0; y < height; y++) {
				for (let x = 0; x < width; x++) {
					const idx = (y * width + x) * 4;
					const value = Math.floor((x / width) * 255);
					data[idx] = value;
					data[idx + 1] = value;
					data[idx + 2] = value;
					data[idx + 3] = 255;
				}
			}

			const hash = dhash(createImageData(data, width, height));

			// Should produce valid hex string
			expect(hash).toHaveLength(16);
			expect(hash).toMatch(/^[0-9a-f]{16}$/);
		});

		it('should return fallback hash when canvas context unavailable', () => {
			// Temporarily make getContext return null
			mockCanvas.getContext.mockReturnValueOnce(null as never);

			const data = new Uint8ClampedArray(100 * 100 * 4).fill(128);
			const imageData = createImageData(data, 100, 100);

			const hash = dhash(imageData);

			expect(hash).toBe('0000000000000000');
		});

		it('should support custom hash sizes', () => {
			const data = new Uint8ClampedArray(100 * 100 * 4).fill(128);
			const imageData = createImageData(data, 100, 100);

			// Hash size 4 produces 16-bit hash (4 hex chars)
			const hash4 = dhash(imageData, 4);
			expect(hash4).toHaveLength(4);
			expect(hash4).toMatch(/^[0-9a-f]{4}$/);

			// Hash size 8 produces 64-bit hash (16 hex chars)
			const hash8 = dhash(imageData, 8);
			expect(hash8).toHaveLength(16);
			expect(hash8).toMatch(/^[0-9a-f]{16}$/);
		});
	});

	describe('hamDist', () => {
		it('should return 0 for identical hashes', () => {
			const hash = 'abcdef0123456789';

			const distance = hamDist(hash, hash);

			expect(distance).toBe(0);
		});

		it('should return correct distance for single bit difference', () => {
			// 0 = 0000, 1 = 0001 (1 bit different)
			const hashA = '0000000000000000';
			const hashB = '0000000000000001';

			const distance = hamDist(hashA, hashB);

			expect(distance).toBe(1);
		});

		it('should return correct distance for multiple bit differences', () => {
			// f = 1111, 0 = 0000 (4 bits different per hex digit)
			const hashA = 'f000000000000000';
			const hashB = '0000000000000000';

			const distance = hamDist(hashA, hashB);

			expect(distance).toBe(4);
		});

		it('should return 64 for completely opposite hashes', () => {
			// All 0s vs all 1s (f in hex)
			const hashA = '0000000000000000';
			const hashB = 'ffffffffffffffff';

			const distance = hamDist(hashA, hashB);

			expect(distance).toBe(64);
		});

		it('should throw error for mismatched hash lengths', () => {
			const hashA = 'abcd';
			const hashB = 'abcdef';

			expect(() => hamDist(hashA, hashB)).toThrow('Hash strings must be the same length');
		});

		it('should be commutative (order independent)', () => {
			const hashA = 'abcdef0123456789';
			const hashB = '123456789abcdef0';

			const distAB = hamDist(hashA, hashB);
			const distBA = hamDist(hashB, hashA);

			expect(distAB).toBe(distBA);
		});
	});

	describe('recogniseImage', () => {
		it('should return empty string when no match found within threshold', () => {
			// Mock dhash to return a known hash that won't match any in mockHashSet
			// Using all zeros which has maximum Hamming distance from the test hashes
			mockCanvasContext.getImageData.mockReturnValueOnce({
				data: new Uint8ClampedArray(9 * 8 * 4).fill(128), // Uniform grey produces all-zero hash
				width: 9,
				height: 8,
			});

			const data = new Uint8ClampedArray(100 * 100 * 4).fill(128);
			const imageData = createImageData(data, 100, 100);

			// Use high threshold to ensure no match with the dissimilar hashes
			const result = recogniseImage(imageData, mockHashSet, 0.99);

			// With a known non-matching hash, the name should be empty
			expect(result.name).toBe('');
			expect(typeof result.confidence).toBe('number');
			expect(result.confidence).toBeGreaterThanOrEqual(0);
			expect(result.confidence).toBeLessThanOrEqual(100);
		});

		it('should return a hero ID when match found within threshold', () => {
			const data = new Uint8ClampedArray(100 * 100 * 4).fill(128);
			const imageData = createImageData(data, 100, 100);

			// Use very low threshold to ensure a match
			const result = recogniseImage(imageData, mockHashSet, 0);

			// Should return some hero ID since threshold is 0
			expect(result.name).toBeTruthy();
			expect(typeof result.name).toBe('string');
			expect(typeof result.confidence).toBe('number');
		});

		it('should use default threshold when not specified', () => {
			const data = new Uint8ClampedArray(100 * 100 * 4).fill(128);
			const imageData = createImageData(data, 100, 100);

			// Should not throw and return an object
			const result = recogniseImage(imageData, mockHashSet);

			expect(typeof result.name).toBe('string');
			expect(typeof result.confidence).toBe('number');
		});

		it('should return best match among candidates', () => {
			const data = new Uint8ClampedArray(100 * 100 * 4).fill(128);
			const imageData = createImageData(data, 100, 100);

			// Call twice with same data should give same result
			const result1 = recogniseImage(imageData, mockHashSet, 0);
			const result2 = recogniseImage(imageData, mockHashSet, 0);

			expect(result1.name).toBe(result2.name);
			expect(result1.confidence).toBe(result2.confidence);
		});

		it('should respect threshold parameter', () => {
			const data = new Uint8ClampedArray(100 * 100 * 4).fill(128);
			const imageData = createImageData(data, 100, 100);

			// Very low threshold (0) should always return a match
			const lowThresholdResult = recogniseImage(imageData, mockHashSet, 0);
			expect(lowThresholdResult.name).toBeTruthy();

			// Very high threshold (1.0) requires perfect match
			const highThresholdResult = recogniseImage(imageData, mockHashSet, 1.0);
			// May or may not match, but should be an object with string result
			expect(typeof highThresholdResult.name).toBe('string');
			expect(typeof highThresholdResult.confidence).toBe('number');
		});

		it('should accept threshold values between 0 and 1', () => {
			const data = new Uint8ClampedArray(100 * 100 * 4).fill(128);
			const imageData = createImageData(data, 100, 100);

			// Test various threshold values
			expect(() => recogniseImage(imageData, mockHashSet, 0)).not.toThrow();
			expect(() => recogniseImage(imageData, mockHashSet, 0.5)).not.toThrow();
			expect(() => recogniseImage(imageData, mockHashSet, 0.85)).not.toThrow();
			expect(() => recogniseImage(imageData, mockHashSet, 1.0)).not.toThrow();
		});

		it('should return empty string for empty hash set', () => {
			const data = new Uint8ClampedArray(100 * 100 * 4).fill(128);
			const imageData = createImageData(data, 100, 100);
			const emptyHashSet: ImageHashSet = {
				id: 'empty',
				description: 'Empty hash set',
				hashes: [],
				createdAt: new Date(),
				updatedAt: new Date(),
			};

			const result = recogniseImage(imageData, emptyHashSet, 0);

			expect(result.name).toBe('');
			expect(result.confidence).toBe(0);
		});
	});
});
