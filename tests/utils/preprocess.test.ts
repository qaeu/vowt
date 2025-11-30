import type { TextRegion } from '#types';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { preprocessImageForOCR, drawRegionsOnImage } from '#utils/preprocess';

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

			await expect(
drawRegionsOnImage('preprocessed.png', 'invalid-url')
).rejects.toThrow('Failed to load source image');
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
});
