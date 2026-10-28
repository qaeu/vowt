import type { AlignmentGroup, GrayImage, RowBands, TextRegion } from '#types';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
	ALIGN_SCALE,
	toGrayscale,
	downsample,
	encodeTemplate,
	decodeTemplate,
	createAnchor,
	findAnchorOffset,
	detectRowTops,
	alignRegions,
	alignRegionsToImage,
} from '#utils/regionAlignment';

const BACKGROUND = 40;

/** Creates a flat grayscale image */
const makeImage = (width: number, height: number, fill = BACKGROUND): GrayImage => ({
	width,
	height,
	data: new Uint8ClampedArray(width * height).fill(fill),
});

const fillRect = (
	image: GrayImage,
	x: number,
	y: number,
	width: number,
	height: number,
	value: number
) => {
	for (let yy = y; yy < y + height; yy++) {
		for (let xx = x; xx < x + width; xx++) {
			image.data[yy * image.width + xx] = value;
		}
	}
};

/** Draws a deterministic pseudo-random pattern so template matching has features */
const drawLandmark = (image: GrayImage, x: number, y: number, size: number) => {
	let seed = 12345;
	for (let yy = 0; yy < size; yy += 4) {
		for (let xx = 0; xx < size; xx += 4) {
			seed = (seed * 1103515245 + 12345) % 2147483648;
			fillRect(image, x + xx, y + yy, 4, 4, 60 + (seed % 180));
		}
	}
};

const BAND = 100;
const SEPARATOR = 75;
const TEXT = 230;

/**
 * Draws a table of rows with the given heights; each row starts with a 2px separator
 * (except the first) and contains a bright text line in its middle
 */
const drawTable = (
	image: GrayImage,
	top: number,
	heights: number[],
	options: { highlightRow?: number; separators?: boolean } = {}
): number[] => {
	const tops: number[] = [];
	let y = top;

	heights.forEach((height, r) => {
		const band = r === options.highlightRow ? BAND + 30 : BAND;
		fillRect(image, 0, y, image.width, height, band);
		if (r > 0 && options.separators !== false) {
			fillRect(image, 0, y, image.width, 2, SEPARATOR);
			y += 2;
			height -= 2;
		}
		tops.push(y);
		fillRect(image, 20, y + Math.floor(height / 2) - 6, 60, 12, TEXT);
		y += height;
	});

	return tops;
};

const ROWS: RowBands = { x: 10, width: 180, y: 50, rowHeight: 40, count: 4 };

describe('regionAlignment', () => {
	describe('toGrayscale', () => {
		it('should convert RGBA pixels to weighted luminance', () => {
			const data = new Uint8ClampedArray([
				255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 255, 255,
			]);
			const gray = toGrayscale({ width: 4, height: 1, data } as ImageData);

			expect(gray.width).toBe(4);
			expect(gray.height).toBe(1);
			expect([...gray.data]).toEqual([76, 150, 29, 255]);
		});
	});

	describe('downsample', () => {
		it('should average blocks of pixels', () => {
			const image: GrayImage = {
				width: 4,
				height: 2,
				data: new Uint8ClampedArray([0, 10, 100, 100, 20, 30, 200, 200]),
			};
			const small = downsample(image, 2);

			expect(small.width).toBe(2);
			expect(small.height).toBe(1);
			expect([...small.data]).toEqual([15, 150]);
		});

		it('should drop partial edge blocks', () => {
			const small = downsample(makeImage(5, 3), 2);

			expect(small.width).toBe(2);
			expect(small.height).toBe(1);
		});

		it('should return the image unchanged for factor 1', () => {
			const image = makeImage(3, 3);

			expect(downsample(image, 1)).toBe(image);
		});
	});

	describe('encodeTemplate and decodeTemplate', () => {
		it('should round-trip pixel data', () => {
			const image: GrayImage = {
				width: 3,
				height: 2,
				data: new Uint8ClampedArray([0, 1, 127, 128, 254, 255]),
			};
			const template = encodeTemplate(image);

			expect(typeof template.data).toBe('string');
			expect(decodeTemplate(template)).toEqual(image);
		});
	});

	describe('createAnchor', () => {
		it('should snap coordinates to ALIGN_SCALE and store a downscaled template', () => {
			const anchor = createAnchor(
				makeImage(100, 100),
				{ x: 11, y: 21, width: 30, height: 20 },
				10,
				20
			);

			expect(anchor.x % ALIGN_SCALE).toBe(0);
			expect(anchor.y % ALIGN_SCALE).toBe(0);
			expect(anchor.searchX).toBe(10);
			expect(anchor.searchY).toBe(20);
			expect(anchor.template.width).toBe(30 / ALIGN_SCALE);
			expect(anchor.template.height).toBe(20 / ALIGN_SCALE);
		});

		it('should clip the template to the image bounds', () => {
			const anchor = createAnchor(
				makeImage(40, 40),
				{ x: 20, y: 20, width: 40, height: 40 },
				0,
				0
			);

			expect(anchor.template.width).toBe(20 / ALIGN_SCALE);
			expect(anchor.template.height).toBe(20 / ALIGN_SCALE);
		});
	});

	describe('findAnchorOffset', () => {
		const LANDMARK = { x: 80, y: 60, width: 32, height: 32 };

		const makeReference = () => {
			const image = makeImage(240, 200);
			drawLandmark(image, LANDMARK.x, LANDMARK.y, LANDMARK.width);
			return image;
		};

		it('should find no offset at the expected position', () => {
			const reference = makeReference();
			const anchor = createAnchor(reference, LANDMARK, 40, 40);
			const match = findAnchorOffset(downsample(reference, ALIGN_SCALE), anchor);

			expect(match).toMatchObject({ dx: 0, dy: 0 });
			expect(match!.score).toBeCloseTo(1, 5);
		});

		it.each([
			[10, -20],
			[-36, 30],
			[0, 40],
		])('should find a landmark moved by (%i, %i)', (dx, dy) => {
			const anchor = createAnchor(makeReference(), LANDMARK, 40, 40);
			const moved = makeImage(240, 200);
			drawLandmark(moved, LANDMARK.x + dx, LANDMARK.y + dy, LANDMARK.width);

			const match = findAnchorOffset(downsample(moved, ALIGN_SCALE), anchor);

			expect(match).toMatchObject({ dx, dy });
		});

		it('should match despite brightness and contrast changes', () => {
			const anchor = createAnchor(makeReference(), LANDMARK, 40, 40);
			const moved = makeReference();
			for (let i = 0; i < moved.data.length; i++) {
				moved.data[i] = moved.data[i] * 0.6 + 50;
			}

			const match = findAnchorOffset(downsample(moved, ALIGN_SCALE), anchor);

			expect(match).toMatchObject({ dx: 0, dy: 0 });
		});

		it('should return null when the landmark is outside the search range', () => {
			const anchor = createAnchor(makeReference(), LANDMARK, 10, 10);
			const moved = makeImage(240, 200);
			drawLandmark(moved, LANDMARK.x + 60, LANDMARK.y, LANDMARK.width);

			expect(findAnchorOffset(downsample(moved, ALIGN_SCALE), anchor)).toBeNull();
		});

		it('should return null when the landmark is missing', () => {
			const anchor = createAnchor(makeReference(), LANDMARK, 40, 40);

			expect(
				findAnchorOffset(downsample(makeImage(240, 200), ALIGN_SCALE), anchor)
			).toBeNull();
		});

		it('should return null below the minimum score', () => {
			const anchor = {
				...createAnchor(makeReference(), LANDMARK, 40, 40),
				minScore: 1.1,
			};

			expect(
				findAnchorOffset(downsample(makeReference(), ALIGN_SCALE), anchor)
			).toBeNull();
		});

		it('should return null for a flat template', () => {
			const anchor = createAnchor(makeImage(240, 200), LANDMARK, 40, 40);

			expect(
				findAnchorOffset(downsample(makeReference(), ALIGN_SCALE), anchor)
			).toBeNull();
		});

		it('should return null for an empty template', () => {
			const anchor = createAnchor(makeReference(), { ...LANDMARK, width: 0 }, 40, 40);

			expect(
				findAnchorOffset(downsample(makeReference(), ALIGN_SCALE), anchor)
			).toBeNull();
		});
	});

	describe('detectRowTops', () => {
		it('should find evenly spaced rows', () => {
			const image = makeImage(200, 300);
			const tops = drawTable(image, 50, [40, 40, 40, 40]);

			expect(detectRowTops(image, ROWS, 0, 0)).toEqual(tops);
		});

		it('should follow rows of different heights', () => {
			const image = makeImage(200, 300);
			const tops = drawTable(image, 50, [46, 36, 47, 38]);

			expect(detectRowTops(image, ROWS, 0, 0)).toEqual(tops);
		});

		it('should apply the group offset', () => {
			const image = makeImage(200, 300);
			const tops = drawTable(image, 80, [44, 38, 40, 40]);

			expect(detectRowTops(image, ROWS, 0, 30)).toEqual(tops);
		});

		it('should handle a highlighted row', () => {
			const image = makeImage(200, 300);
			const tops = drawTable(image, 50, [40, 40, 40, 40], { highlightRow: 2 });

			expect(detectRowTops(image, ROWS, 0, 0)).toEqual(tops);
		});

		it('should keep nominal spacing when no separator is found', () => {
			const image = makeImage(200, 300);
			drawTable(image, 50, [44, 44, 44, 44], { separators: false });

			expect(detectRowTops(image, ROWS, 0, 0)).toEqual([50, 90, 130, 170]);
		});

		it('should keep nominal spacing when the strip is outside the image', () => {
			const image = makeImage(200, 300);
			drawTable(image, 50, [44, 44, 44, 44]);

			expect(detectRowTops(image, ROWS, 500, 0)).toEqual([50, 90, 130, 170]);
		});

		it('should return a single top for one row', () => {
			expect(detectRowTops(makeImage(200, 300), { ...ROWS, count: 1 }, 0, 5)).toEqual([
				55,
			]);
		});
	});

	describe('alignRegions', () => {
		const LANDMARK = { x: 100, y: 10, width: 32, height: 32 };

		const makeScreen = (dx: number, dy: number, heights: number[]) => {
			const image = makeImage(240, 300);
			const tops = drawTable(image, 50 + dy, heights);
			drawLandmark(image, LANDMARK.x + dx, LANDMARK.y + dy, LANDMARK.width);
			return { image, tops };
		};

		const makeGroups = (): AlignmentGroup[] => {
			const { image } = makeScreen(0, 0, [40, 40, 40, 40]);
			return [
				{
					name: 'table',
					anchor: createAnchor(image, LANDMARK, 20, 40),
					rows: { ...ROWS, x: 140, width: 90 },
				},
			];
		};

		const regions: TextRegion[] = [
			{ name: 'row0', x: 20, y: 55, width: 60, height: 30, group: 'table', row: 0 },
			{ name: 'row2', x: 20, y: 135, width: 60, height: 30, group: 'table', row: 2 },
			{ name: 'header', x: 100, y: 10, width: 30, height: 30, group: 'table' },
			{ name: 'free', x: 5, y: 5, width: 10, height: 10 },
			{ name: 'other', x: 5, y: 5, width: 10, height: 10, group: 'missing' },
		];

		beforeEach(() => {
			vi.spyOn(console, 'warn').mockImplementation(() => {});
		});

		afterEach(() => {
			vi.restoreAllMocks();
		});

		it('should return regions unchanged without groups', () => {
			const { image } = makeScreen(0, 0, [40, 40, 40, 40]);

			expect(alignRegions(regions, [], image)).toBe(regions);
		});

		it('should move rows by their detected tops and other regions by the anchor', () => {
			const { image, tops } = makeScreen(6, 20, [46, 36, 44, 40]);
			const aligned = alignRegions(regions, makeGroups(), image);
			const byName = Object.fromEntries(aligned.map((r) => [r.name, r]));

			expect(byName.row0).toMatchObject({ x: 26, y: 55 + (tops[0] - 50) });
			expect(byName.row2).toMatchObject({ x: 26, y: 135 + (tops[2] - 130) });
			expect(byName.header).toMatchObject({ x: 106, y: 30 });
		});

		it('should leave ungrouped and unknown-group regions unchanged', () => {
			const { image } = makeScreen(6, 20, [40, 40, 40, 40]);
			const aligned = alignRegions(regions, makeGroups(), image);

			expect(aligned[3]).toBe(regions[3]);
			expect(aligned[4]).toBe(regions[4]);
		});

		it('should fall back to profile positions when the anchor is not found', () => {
			const image = makeImage(240, 300);
			drawTable(image, 50, [40, 40, 40, 40]);
			const aligned = alignRegions(regions, makeGroups(), image);

			expect(aligned[2]).toMatchObject({ x: 100, y: 10 });
			expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("'table'"));
		});

		it('should use the group offset for rows beyond the row count', () => {
			const { image } = makeScreen(0, 20, [40, 40, 40, 40]);
			const outOfRange = { ...regions[0], name: 'row9', row: 9 };
			const [aligned] = alignRegions([outOfRange], makeGroups(), image);

			expect(aligned.y).toBe(75);
		});

		it('should align groups without an anchor using rows only', () => {
			const { image, tops } = makeScreen(0, 0, [46, 36, 44, 40]);
			const groups: AlignmentGroup[] = [{ name: 'table', rows: ROWS }];
			const aligned = alignRegions([regions[1]], groups, image);

			expect(aligned[0].y).toBe(135 + (tops[2] - 130));
		});

		it('should scale offsets to the target image size', () => {
			const { image } = makeScreen(10, 20, [40, 40, 40, 40]);
			const small = { ...regions[2], x: 50, y: 5, width: 10, height: 10 };
			const [aligned] = alignRegions([small], makeGroups(), image, 0.5, 0.5);

			expect(aligned).toMatchObject({ x: 55, y: 15 });
		});

		it('should clamp regions to the image bounds', () => {
			const { image } = makeScreen(-10, -10, [40, 40, 40, 40]);
			const edge = { ...regions[2], x: 2, y: 3 };
			const [aligned] = alignRegions([edge], makeGroups(), image);

			expect(aligned).toMatchObject({ x: 0, y: 0 });
		});
	});

	describe('alignRegionsToImage', () => {
		const regions: TextRegion[] = [
			{ name: 'a', x: 10, y: 10, width: 10, height: 10, group: 'g' },
		];
		const groups: AlignmentGroup[] = [{ name: 'g', rows: ROWS }];

		const mockImage = (event: 'onload' | 'onerror') => {
			const image = {
				onload: null as (() => void) | null,
				onerror: null as (() => void) | null,
				src: '',
			};
			vi.spyOn(globalThis, 'Image').mockImplementation(function () {
				setTimeout(() => image[event]?.(), 0);
				return image as unknown as HTMLImageElement;
			});
		};

		afterEach(() => {
			vi.restoreAllMocks();
		});

		it('should return regions without loading the image when there are no groups', async () => {
			const imageSpy = vi.spyOn(globalThis, 'Image');

			expect(await alignRegionsToImage('img.png', regions, [], 100, 100)).toBe(regions);
			expect(imageSpy).not.toHaveBeenCalled();
		});

		it('should return unaligned regions when the image fails to load', async () => {
			mockImage('onerror');
			const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

			expect(await alignRegionsToImage('bad.png', regions, groups, 100, 100)).toBe(
				regions
			);
			expect(warn).toHaveBeenCalled();
		});

		it('should draw the image at reference resolution and align regions', async () => {
			mockImage('onload');
			const ctx = {
				drawImage: vi.fn(),
				getImageData: vi.fn((_x: number, _y: number, w: number, h: number) => ({
					width: w,
					height: h,
					data: new Uint8ClampedArray(w * h * 4),
				})),
			};
			const canvas = { width: 0, height: 0, getContext: vi.fn(() => ctx) };
			const originalCreateElement = document.createElement.bind(document);
			vi.spyOn(document, 'createElement').mockImplementation((tag: string) =>
				tag === 'canvas' ?
					(canvas as unknown as HTMLCanvasElement)
				:	originalCreateElement(tag)
			);

			const aligned = await alignRegionsToImage('img.png', regions, groups, 1280, 720);

			expect(ctx.drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 2560, 1440);
			expect(aligned).toEqual(regions);
			expect(aligned).not.toBe(regions);
		});
	});
});
