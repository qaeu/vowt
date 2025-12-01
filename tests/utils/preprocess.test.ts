import type { TextRegion } from '#types';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
	preprocessImageForOCR,
	preprocessRegionsForOCR,
	drawRegionsOnImage,
	groupRegionsByCharSet,
	partitionRegionGroups,
	getRegionImageData,
	getRegionDataURLs,
} from '#utils/preprocess';

const SCHEDULER_JOBS_MIN = 3;

// Test regions used throughout tests
const testRegions: TextRegion[] = [
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

// Mock ImageData for test regions
const mockImageData = {
	data: new Uint8ClampedArray(200 * 50 * 4),
	width: 200,
	height: 50,
} as ImageData;

const testRegionImageDataMap = new Map<string, ImageData>([
	['test_region_1', mockImageData],
	['test_region_2', mockImageData],
]);

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

			const result = await preprocessImageForOCR(
				'test-image.png',
				testRegions,
				testRegionImageDataMap
			);

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

			await expect(
				preprocessImageForOCR('invalid-url', testRegions, testRegionImageDataMap)
			).rejects.toThrow('Failed to load image');
		});

		it('should process provided regions', async () => {
			// Clear any previous mock calls
			mockCanvasContext.putImageData.mockClear();

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

			await preprocessImageForOCR('test-image.png', testRegions, testRegionImageDataMap);

			// Should call putImageData for each region (uses pre-extracted ImageData)
			expect(mockCanvasContext.putImageData).toHaveBeenCalled();
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

			await expect(
				preprocessImageForOCR('test-image.png', testRegions, testRegionImageDataMap)
			).rejects.toThrow('Failed to get canvas context');
		});

		it('should process regions and apply image data', async () => {
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

			await preprocessImageForOCR('test-image.png', testRegions, testRegionImageDataMap);

			// Should call putImageData for each region
			expect(mockCanvasContext.putImageData).toHaveBeenCalled();
		});
	});

	describe('getRegionImageData', () => {
		it('should extract ImageData for multiple regions from an image', async () => {
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

			const regions: TextRegion[] = [
				{
					name: 'test_region_1',
					x: 100,
					y: 50,
					width: 200,
					height: 100,
				},
				{
					name: 'test_region_2',
					x: 300,
					y: 150,
					width: 150,
					height: 75,
				},
			];

			const result = await getRegionImageData('test-image.png', regions);

			expect(result).toBeInstanceOf(Map);
			expect(result.size).toBe(2);
			expect(result.has('test_region_1')).toBe(true);
			expect(result.has('test_region_2')).toBe(true);
			expect(mockCanvasContext.drawImage).toHaveBeenCalled();
			expect(mockCanvasContext.getImageData).toHaveBeenCalledTimes(2);
			expect(mockCanvasContext.getImageData).toHaveBeenCalledWith(100, 50, 200, 100);
			expect(mockCanvasContext.getImageData).toHaveBeenCalledWith(300, 150, 150, 75);
		});

		it('should return empty Map for empty regions array', async () => {
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

			const result = await getRegionImageData('test-image.png', []);

			expect(result).toBeInstanceOf(Map);
			expect(result.size).toBe(0);
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

			const regions: TextRegion[] = [
				{
					name: 'test_region',
					x: 100,
					y: 50,
					width: 200,
					height: 100,
				},
			];

			await expect(getRegionImageData('invalid-url', regions)).rejects.toThrow(
				'Failed to load image'
			);
		});

		it('should reject when canvas context fails', async () => {
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

			const regions: TextRegion[] = [
				{
					name: 'test_region',
					x: 100,
					y: 50,
					width: 200,
					height: 100,
				},
			];

			await expect(getRegionImageData('test-image.png', regions)).rejects.toThrow(
				'Failed to get canvas context'
			);
		});
	});

	describe('getRegionDataURLs', () => {
		it('should return a Map of region name to data URL for valid regions', async () => {
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

			const regions: TextRegion[] = [
				{
					name: 'test_region_1',
					x: 100,
					y: 50,
					width: 200,
					height: 100,
				},
				{
					name: 'test_region_2',
					x: 300,
					y: 150,
					width: 150,
					height: 75,
				},
			];

			const result = await getRegionDataURLs('test-image.png', regions);

			expect(result).toBeInstanceOf(Map);
			expect(result.size).toBe(2);
			expect(result.has('test_region_1')).toBe(true);
			expect(result.has('test_region_2')).toBe(true);
			expect(result.get('test_region_1')).toBe('data:image/png;base64,mockImageData');
			expect(result.get('test_region_2')).toBe('data:image/png;base64,mockImageData');
			expect(mockCanvasContext.drawImage).toHaveBeenCalled();
			expect(mockCanvas.toDataURL).toHaveBeenCalledTimes(2);
		});

		it('should return empty Map for empty regions array', async () => {
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

			const result = await getRegionDataURLs('test-image.png', []);

			expect(result).toBeInstanceOf(Map);
			expect(result.size).toBe(0);
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

			const regions: TextRegion[] = [
				{
					name: 'test_region',
					x: 100,
					y: 50,
					width: 200,
					height: 100,
				},
			];

			await expect(getRegionDataURLs('invalid-url', regions)).rejects.toThrow(
				'Failed to load image'
			);
		});

		it('should reject when canvas context fails', async () => {
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

			const regions: TextRegion[] = [
				{
					name: 'test_region',
					x: 100,
					y: 50,
					width: 200,
					height: 100,
				},
			];

			await expect(getRegionDataURLs('test-image.png', regions)).rejects.toThrow(
				'Failed to get canvas context'
			);
		});
	});

	describe('drawRegionsOnImage', () => {
		it('should return a data URL for valid image', async () => {
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

			const result = await drawRegionsOnImage('preprocessed.png', testRegions);

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

			await expect(drawRegionsOnImage('invalid-url', testRegions)).rejects.toThrow(
				'Failed to load image'
			);
		});

		it('should draw stroke rectangles for each region', async () => {
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

			await drawRegionsOnImage('preprocessed.png', testRegions);

			// Should draw stroke rectangles for regions
			expect(mockCanvasContext.strokeRect).toHaveBeenCalledTimes(testRegions.length);
		});
	});

	describe('region processing', () => {
		it('should handle images with no regions gracefully', async () => {
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

			const result = await preprocessImageForOCR('test-image.png', [], new Map());

			expect(result).toBe('data:image/png;base64,mockImageData');
		});

		it('should process multiple regions', async () => {
			const multipleRegions: TextRegion[] = [
				{ name: 'region1', x: 10, y: 10, width: 50, height: 20 },
				{ name: 'region2', x: 70, y: 10, width: 50, height: 20 },
				{ name: 'region3', x: 10, y: 40, width: 50, height: 20 },
				{ name: 'region4', x: 70, y: 40, width: 50, height: 20 },
			];

			const multipleRegionsImageDataMap = new Map<string, ImageData>(
				multipleRegions.map((r) => [r.name, mockImageData])
			);

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

			// Clear to count putImageData calls
			mockCanvasContext.putImageData.mockClear();

			await preprocessImageForOCR(
				'test-image.png',
				multipleRegions,
				multipleRegionsImageDataMap
			);

			// Should call putImageData for each region (4 times)
			expect(mockCanvasContext.putImageData).toHaveBeenCalledTimes(4);
		});

		it('should handle italic regions for unskewing', async () => {
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

			const italicRegionsImageDataMap = new Map<string, ImageData>([
				['italic_region', mockImageData],
			]);

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

			const result = await preprocessImageForOCR(
				'test-image.png',
				italicRegions,
				italicRegionsImageDataMap
			);

			expect(result).toBeDefined();
		});
	});

	describe('preprocessRegionsForOCR', () => {
		it('returns a Map with preprocessed ImageData for each region', () => {
			const regions: TextRegion[] = [
				{ name: 'region1', x: 0, y: 0, width: 100, height: 50, charSet: '0123456789' },
				{ name: 'region2', x: 0, y: 50, width: 100, height: 50, charSet: 'ABC' },
			];

			const inputMap = new Map<string, ImageData>([
				['region1', mockImageData],
				['region2', mockImageData],
			]);

			const result = preprocessRegionsForOCR(inputMap, regions);

			expect(result).toBeInstanceOf(Map);
			expect(result.size).toBe(2);
			expect(result.has('region1')).toBe(true);
			expect(result.has('region2')).toBe(true);
		});

		it('skips regions without matching ImageData in the input map', () => {
			const regions: TextRegion[] = [
				{ name: 'region1', x: 0, y: 0, width: 100, height: 50, charSet: '0123456789' },
				{ name: 'region2', x: 0, y: 50, width: 100, height: 50, charSet: 'ABC' },
			];

			const inputMap = new Map<string, ImageData>([
				['region1', mockImageData],
				// region2 is missing from input map
			]);

			const result = preprocessRegionsForOCR(inputMap, regions);

			expect(result.size).toBe(1);
			expect(result.has('region1')).toBe(true);
			expect(result.has('region2')).toBe(false);
		});

		it('returns empty Map when input map is empty', () => {
			const regions: TextRegion[] = [
				{ name: 'region1', x: 0, y: 0, width: 100, height: 50, charSet: '0123456789' },
			];

			const inputMap = new Map<string, ImageData>();

			const result = preprocessRegionsForOCR(inputMap, regions);

			expect(result.size).toBe(0);
		});

		it('returns empty Map when regions array is empty', () => {
			const regions: TextRegion[] = [];

			const inputMap = new Map<string, ImageData>([['region1', mockImageData]]);

			const result = preprocessRegionsForOCR(inputMap, regions);

			expect(result.size).toBe(0);
		});

		it('processes italic regions correctly', () => {
			const italicRegions: TextRegion[] = [
				{
					name: 'italic_region',
					x: 0,
					y: 0,
					width: 100,
					height: 50,
					charSet: 'ABC',
					isItalic: true,
				},
			];

			const inputMap = new Map<string, ImageData>([['italic_region', mockImageData]]);

			const result = preprocessRegionsForOCR(inputMap, italicRegions);

			expect(result.size).toBe(1);
			expect(result.has('italic_region')).toBe(true);
		});
	});

	describe('groupRegionsByCharSet', () => {
		it('groups regions by their charSet value', () => {
			const regions: TextRegion[] = [
				{ name: 'region1', x: 0, y: 0, width: 100, height: 50, charSet: '0123456789' },
				{ name: 'region2', x: 0, y: 50, width: 100, height: 50, charSet: 'ABC' },
				{ name: 'region3', x: 0, y: 100, width: 100, height: 50, charSet: '0123456789' },
			];

			const result = groupRegionsByCharSet(regions);

			expect(result.size).toBe(2);
			expect(result.get('0123456789')).toHaveLength(2);
			expect(result.get('ABC')).toHaveLength(1);
		});

		it('groups regions without charSet under empty string key', () => {
			const regions: TextRegion[] = [
				{ name: 'region1', x: 0, y: 0, width: 100, height: 50 },
				{ name: 'region2', x: 0, y: 50, width: 100, height: 50, charSet: 'ABC' },
				{ name: 'region3', x: 0, y: 100, width: 100, height: 50 },
			];

			const result = groupRegionsByCharSet(regions);

			expect(result.size).toBe(2);
			expect(result.get('')).toHaveLength(2);
			expect(result.get('ABC')).toHaveLength(1);
		});

		it('returns empty map for empty regions array', () => {
			const result = groupRegionsByCharSet([]);
			expect(result.size).toBe(0);
		});
	});

	describe('loadImageDimensions', () => {
		// Note: These tests are skipped because jsdom doesn't properly support
		// Image loading. The function is tested indirectly via integration tests.
		it.todo('returns dimensions for a valid image');
		it.todo('rejects for invalid image source');
	});

	describe('partitionRegionGroups', () => {
		it('partitions groups into large and small based on SCHEDULER_JOBS_MIN', () => {
			const charSetGroups = new Map<string, TextRegion[]>();

			// Large group (more than SCHEDULER_JOBS_MIN)
			const largeGroup: TextRegion[] = [];
			for (let i = 0; i < SCHEDULER_JOBS_MIN + 2; i++) {
				largeGroup.push({
					name: `region${i}`,
					x: 0,
					y: i * 50,
					width: 100,
					height: 50,
				});
			}
			charSetGroups.set('0123456789', largeGroup);

			// Small group (SCHEDULER_JOBS_MIN or fewer)
			const smallGroup: TextRegion[] = [
				{ name: 'regionA', x: 0, y: 0, width: 100, height: 50 },
				{ name: 'regionB', x: 0, y: 50, width: 100, height: 50 },
			];
			charSetGroups.set('ABC', smallGroup);

			const result = partitionRegionGroups(charSetGroups);

			expect(result.largeGroups).toHaveLength(1);
			expect(result.smallGroups).toHaveLength(1);
			expect(result.largeGroups[0].charSet).toBe('0123456789');
			expect(result.smallGroups[0].charSet).toBe('ABC');
		});

		it('returns empty arrays for empty input', () => {
			const result = partitionRegionGroups(new Map());

			expect(result.largeGroups).toHaveLength(0);
			expect(result.smallGroups).toHaveLength(0);
		});

		it('groups with exactly SCHEDULER_JOBS_MIN regions are considered small', () => {
			const charSetGroups = new Map<string, TextRegion[]>();

			const exactGroup: TextRegion[] = [];
			for (let i = 0; i < SCHEDULER_JOBS_MIN; i++) {
				exactGroup.push({
					name: `region${i}`,
					x: 0,
					y: i * 50,
					width: 100,
					height: 50,
				});
			}
			charSetGroups.set('0123456789', exactGroup);

			const result = partitionRegionGroups(charSetGroups);

			expect(result.largeGroups).toHaveLength(0);
			expect(result.smallGroups).toHaveLength(1);
		});
	});
});
