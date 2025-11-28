import type { TextRegion } from '#types';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { preprocessImageForOCR, drawRegionsOnImage, dhash, hamDist } from '#utils/preprocess';

// Helper to create ImageData-like objects for testing
// (ImageData constructor isn't available in Node.js test environment)
function createImageData(
	data: Uint8ClampedArray,
	width: number,
	height: number
): ImageData {
	return { data, width, height, colorSpace: 'srgb' } as ImageData;
}

// Mock getActiveProfile to return controlled test regions
vi.mock('#utils/regionProfiles', () => ({
	getActiveProfile: vi.fn(() => {
		// Return test regions
		const baseRegions: TextRegion[] = [
			{
				name: 'test_region_1',
				x: 100,
				y: 100,
				width: 200,
				height: 50,
				charSet: '0123456789',
				isItalic: false,
			},
			{
				name: 'test_region_2',
				x: 100,
				y: 200,
				width: 200,
				height: 50,
				charSet: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
				isItalic: true,
			},
		];
		return baseRegions;
	}),
}));

// Mock canvas context
const mockCanvasContext = {
	drawImage: vi.fn(),
	getImageData: vi.fn(() => ({
		data: new Uint8ClampedArray(100 * 50 * 4),
		width: 100,
		height: 50,
	})),
	putImageData: vi.fn(),
	fillRect: vi.fn(),
	strokeRect: vi.fn(),
	transform: vi.fn(),
	filter: '',
	fillStyle: '',
	strokeStyle: '',
	lineWidth: 1,
};

// Mock canvas element
const mockCanvas = {
	width: 0,
	height: 0,
	getContext: vi.fn(() => mockCanvasContext),
	toDataURL: vi.fn(() => 'data:image/png;base64,mockImageData'),
};

// Store original createElement
const originalCreateElement = document.createElement.bind(document);

describe('preprocess', () => {
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

	describe('preprocessImageForOCR', () => {
		it('should return a data URL for a valid image', async () => {
			// Create a mock image that triggers onload
			const mockImage = {
				onload: null as (() => void) | null,
				onerror: null as (() => void) | null,
				src: '',
				width: 800,
				height: 600,
			};

			vi.spyOn(globalThis, 'Image').mockImplementation(() => {
				setTimeout(() => mockImage.onload?.(), 0);
				return mockImage as unknown as HTMLImageElement;
			});

			const result = await preprocessImageForOCR('test-image.png');

			expect(result).toBe('data:image/png;base64,mockImageData');
		});

		it('should reject when image fails to load', async () => {
			const mockImage = {
				onload: null as (() => void) | null,
				onerror: null as (() => void) | null,
				src: '',
			};

			vi.spyOn(globalThis, 'Image').mockImplementation(() => {
				setTimeout(() => mockImage.onerror?.(), 0);
				return mockImage as unknown as HTMLImageElement;
			});

			await expect(preprocessImageForOCR('invalid-url')).rejects.toThrow(
				'Failed to load image'
			);
		});

		it('should call getActiveProfile with image dimensions', async () => {
			const { getActiveProfile } = await import('#utils/regionProfiles');

			const mockImage = {
				onload: null as (() => void) | null,
				onerror: null as (() => void) | null,
				src: '',
				width: 1920,
				height: 1080,
			};

			vi.spyOn(globalThis, 'Image').mockImplementation(() => {
				setTimeout(() => mockImage.onload?.(), 0);
				return mockImage as unknown as HTMLImageElement;
			});

			await preprocessImageForOCR('test-image.png');

			expect(getActiveProfile).toHaveBeenCalledWith(1920, 1080);
		});

		it('should reject when canvas context is unavailable', async () => {
			const mockImage = {
				onload: null as (() => void) | null,
				onerror: null as (() => void) | null,
				src: '',
				width: 800,
				height: 600,
			};

			vi.spyOn(globalThis, 'Image').mockImplementation(() => {
				setTimeout(() => mockImage.onload?.(), 0);
				return mockImage as unknown as HTMLImageElement;
			});

			// Make getContext return null
			mockCanvas.getContext.mockReturnValueOnce(null as never);

			await expect(preprocessImageForOCR('test-image.png')).rejects.toThrow(
				'Failed to get canvas context'
			);
		});

		it('should process regions from active profile', async () => {
			const mockImage = {
				onload: null as (() => void) | null,
				onerror: null as (() => void) | null,
				src: '',
				width: 800,
				height: 600,
			};

			vi.spyOn(globalThis, 'Image').mockImplementation(() => {
				setTimeout(() => mockImage.onload?.(), 0);
				return mockImage as unknown as HTMLImageElement;
			});

			await preprocessImageForOCR('test-image.png');

			// Should call getImageData for each region
			expect(mockCanvasContext.getImageData).toHaveBeenCalled();
			expect(mockCanvasContext.putImageData).toHaveBeenCalled();
		});
	});

	describe('drawRegionsOnImage', () => {
		it('should return a data URL for valid images', async () => {
			let imageCount = 0;
			const mockImages = [
				{
					onload: null as (() => void) | null,
					onerror: null as (() => void) | null,
					src: '',
					width: 800,
					height: 600,
				},
				{
					onload: null as (() => void) | null,
					onerror: null as (() => void) | null,
					src: '',
					width: 800,
					height: 600,
				},
			];

			vi.spyOn(globalThis, 'Image').mockImplementation(() => {
				const img = mockImages[imageCount++];
				setTimeout(() => img.onload?.(), 0);
				return img as unknown as HTMLImageElement;
			});

			const result = await drawRegionsOnImage('preprocessed.png', 'source.png');

			expect(result).toBe('data:image/png;base64,mockImageData');
		});

		it('should reject when preprocessed image fails to load', async () => {
			const mockImage = {
				onload: null as (() => void) | null,
				onerror: null as (() => void) | null,
				src: '',
			};

			vi.spyOn(globalThis, 'Image').mockImplementation(() => {
				setTimeout(() => mockImage.onerror?.(), 0);
				return mockImage as unknown as HTMLImageElement;
			});

			await expect(drawRegionsOnImage('invalid-url', 'source.png')).rejects.toThrow(
				'Failed to load image'
			);
		});

		it('should reject when source image fails to load', async () => {
			let imageCount = 0;
			const mockImages = [
				{
					onload: null as (() => void) | null,
					onerror: null as (() => void) | null,
					src: '',
					width: 800,
					height: 600,
				},
				{
					onload: null as (() => void) | null,
					onerror: null as (() => void) | null,
					src: '',
				},
			];

			vi.spyOn(globalThis, 'Image').mockImplementation(() => {
				const img = mockImages[imageCount++];
				setTimeout(() => {
					if (imageCount === 1) {
						img.onload?.();
					} else {
						img.onerror?.();
					}
				}, 0);
				return img as unknown as HTMLImageElement;
			});

			await expect(drawRegionsOnImage('preprocessed.png', 'invalid-url')).rejects.toThrow(
				'Failed to load source image'
			);
		});

		it('should call getActiveProfile with image dimensions', async () => {
			const { getActiveProfile } = await import('#utils/regionProfiles');

			let imageCount = 0;
			const mockImages = [
				{
					onload: null as (() => void) | null,
					onerror: null as (() => void) | null,
					src: '',
					width: 1920,
					height: 1080,
				},
				{
					onload: null as (() => void) | null,
					onerror: null as (() => void) | null,
					src: '',
					width: 1920,
					height: 1080,
				},
			];

			vi.spyOn(globalThis, 'Image').mockImplementation(() => {
				const img = mockImages[imageCount++];
				setTimeout(() => img.onload?.(), 0);
				return img as unknown as HTMLImageElement;
			});

			await drawRegionsOnImage('preprocessed.png', 'source.png');

			expect(getActiveProfile).toHaveBeenCalledWith(1920, 1080);
		});

		it('should draw stroke rectangles for each region', async () => {
			let imageCount = 0;
			const mockImages = [
				{
					onload: null as (() => void) | null,
					onerror: null as (() => void) | null,
					src: '',
					width: 800,
					height: 600,
				},
				{
					onload: null as (() => void) | null,
					onerror: null as (() => void) | null,
					src: '',
					width: 800,
					height: 600,
				},
			];

			vi.spyOn(globalThis, 'Image').mockImplementation(() => {
				const img = mockImages[imageCount++];
				setTimeout(() => img.onload?.(), 0);
				return img as unknown as HTMLImageElement;
			});

			await drawRegionsOnImage('preprocessed.png', 'source.png');

			// Should draw stroke rectangles for regions
			expect(mockCanvasContext.strokeRect).toHaveBeenCalled();
		});
	});

	describe('region processing', () => {
		it('should handle images with no regions gracefully', async () => {
			const { getActiveProfile } = await import('#utils/regionProfiles');
			vi.mocked(getActiveProfile).mockReturnValueOnce([]);

			const mockImage = {
				onload: null as (() => void) | null,
				onerror: null as (() => void) | null,
				src: '',
				width: 800,
				height: 600,
			};

			vi.spyOn(globalThis, 'Image').mockImplementation(() => {
				setTimeout(() => mockImage.onload?.(), 0);
				return mockImage as unknown as HTMLImageElement;
			});

			const result = await preprocessImageForOCR('test-image.png');

			expect(result).toBe('data:image/png;base64,mockImageData');
		});

		it('should process multiple regions', async () => {
			const { getActiveProfile } = await import('#utils/regionProfiles');
			const multipleRegions: TextRegion[] = [
				{ name: 'region1', x: 10, y: 10, width: 50, height: 20 },
				{ name: 'region2', x: 70, y: 10, width: 50, height: 20 },
				{ name: 'region3', x: 10, y: 40, width: 50, height: 20 },
				{ name: 'region4', x: 70, y: 40, width: 50, height: 20 },
			];
			vi.mocked(getActiveProfile).mockReturnValueOnce(multipleRegions);

			const mockImage = {
				onload: null as (() => void) | null,
				onerror: null as (() => void) | null,
				src: '',
				width: 200,
				height: 100,
			};

			vi.spyOn(globalThis, 'Image').mockImplementation(() => {
				setTimeout(() => mockImage.onload?.(), 0);
				return mockImage as unknown as HTMLImageElement;
			});

			await preprocessImageForOCR('test-image.png');

			// Should call getImageData for each region (4 times)
			expect(mockCanvasContext.getImageData).toHaveBeenCalledTimes(4);
		});

		it('should handle italic regions for unskewing', async () => {
			const { getActiveProfile } = await import('#utils/regionProfiles');
			const italicRegions: TextRegion[] = [
				{
					name: 'italic_region',
					x: 10,
					y: 10,
					width: 100,
					height: 30,
					isItalic: true,
				},
			];
			vi.mocked(getActiveProfile).mockReturnValueOnce(italicRegions);

			const mockImage = {
				onload: null as (() => void) | null,
				onerror: null as (() => void) | null,
				src: '',
				width: 200,
				height: 100,
			};

			vi.spyOn(globalThis, 'Image').mockImplementation(() => {
				setTimeout(() => mockImage.onload?.(), 0);
				return mockImage as unknown as HTMLImageElement;
			});

			const result = await preprocessImageForOCR('test-image.png');

			expect(result).toBeDefined();
		});
	});

	describe('dhash', () => {
		it('should return a 16-character hex string', () => {
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

		it('should return different hashes for different pixel data', () => {
			// Mock getImageData to return different patterns for consecutive calls
			// First call: all pixels bright on left side (produces 1s in hash)
			const brightLeftData = new Uint8ClampedArray(9 * 8 * 4);
			for (let y = 0; y < 8; y++) {
				for (let x = 0; x < 9; x++) {
					const idx = (y * 9 + x) * 4;
					// Left pixels brighter than right (produces 1s)
					const value = x < 5 ? 255 : 0;
					brightLeftData[idx] = value;
					brightLeftData[idx + 1] = value;
					brightLeftData[idx + 2] = value;
					brightLeftData[idx + 3] = 255;
				}
			}

			// Second call: all pixels bright on right side (produces 0s in hash)
			const brightRightData = new Uint8ClampedArray(9 * 8 * 4);
			for (let y = 0; y < 8; y++) {
				for (let x = 0; x < 9; x++) {
					const idx = (y * 9 + x) * 4;
					// Right pixels brighter than left (produces 0s)
					const value = x >= 4 ? 255 : 0;
					brightRightData[idx] = value;
					brightRightData[idx + 1] = value;
					brightRightData[idx + 2] = value;
					brightRightData[idx + 3] = 255;
				}
			}

			// Mock returns different data for each dhash call
			mockCanvasContext.getImageData
				.mockReturnValueOnce({ data: brightLeftData, width: 9, height: 8 })
				.mockReturnValueOnce({ data: brightRightData, width: 9, height: 8 });

			const imageData = createImageData(new Uint8ClampedArray(100), 10, 10);
			const hash1 = dhash(imageData);
			const hash2 = dhash(imageData);

			expect(hash1).not.toBe(hash2);
		});

		it('should return fallback hash when canvas context unavailable', () => {
			// Temporarily make getContext return null
			mockCanvas.getContext.mockReturnValueOnce(null as never);

			const data = new Uint8ClampedArray(100 * 100 * 4).fill(128);
			const imageData = createImageData(data, 100, 100);

			const hash = dhash(imageData);

			expect(hash).toBe('0000000000000000');
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
});
