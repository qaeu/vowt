import type { GrayImage } from '#types';
import { describe, it, expect } from 'vitest';
import {
	upscale,
	otsuThreshold,
	binarise,
	findComponents,
	cropToText,
	cropToBounds,
	pad,
	isolateText,
} from '#utils/textCleanup';

const TEXT = 0;
const WHITE = 255;

/** Creates a flat grayscale image */
const makeImage = (width: number, height: number, fill = WHITE): GrayImage => ({
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

const countValue = (image: GrayImage, value: number) =>
	image.data.reduce((sum, v) => sum + (v === value ? 1 : 0), 0);

/** Binary image with a left icon, a run of four glyphs and optional noise */
const makeLine = (): GrayImage => {
	const image = makeImage(80, 30);
	fillRect(image, 2, 5, 16, 16, TEXT); // icon
	for (const x of [30, 39, 48, 57]) fillRect(image, x, 5, 6, 10, TEXT); // glyphs
	return image;
};

const GLYPH_PIXELS = 4 * 6 * 10;

describe('textCleanup', () => {
	describe('upscale', () => {
		it('produces the scaled dimensions', () => {
			const result = upscale(makeImage(7, 4, 100), 3);
			expect(result.width).toBe(21);
			expect(result.height).toBe(12);
			expect(result.data.length).toBe(21 * 12);
		});

		it('returns the input when factor is 1 or less', () => {
			const image = makeImage(4, 4, 50);
			expect(upscale(image, 1)).toBe(image);
			expect(upscale(image, 0.5)).toBe(image);
		});

		it('keeps a uniform image uniform', () => {
			const result = upscale(makeImage(5, 5, 123), 3);
			expect(new Set(result.data)).toEqual(new Set([123]));
		});

		it('interpolates between neighbouring values', () => {
			const image = makeImage(2, 2, 0);
			fillRect(image, 1, 0, 1, 2, 100);
			const result = upscale(image, 2);
			expect(Array.from(result.data.subarray(0, 4))).toEqual([0, 25, 75, 100]);
			for (const v of result.data) {
				expect(v).toBeGreaterThanOrEqual(0);
				expect(v).toBeLessThanOrEqual(100);
			}
		});
	});

	describe('otsuThreshold', () => {
		it('falls between the peaks of a bimodal image', () => {
			const image = makeImage(10, 10, 30);
			fillRect(image, 0, 0, 10, 5, 200);
			const threshold = otsuThreshold(image);
			expect(threshold).toBeGreaterThanOrEqual(30);
			expect(threshold).toBeLessThan(200);
		});

		it('handles a uniform image without throwing', () => {
			expect(() => otsuThreshold(makeImage(4, 4, 90))).not.toThrow();
		});
	});

	describe('binarise', () => {
		it('maps light text on a dark background to black on white', () => {
			const image = makeImage(10, 10, 20);
			fillRect(image, 2, 2, 3, 3, 230);
			const result = binarise(image, 128);
			expect(result.data[2 * 10 + 2]).toBe(TEXT);
			expect(result.data[0]).toBe(WHITE);
			expect(countValue(result, TEXT)).toBe(9);
		});

		it('maps dark text on a light background to black on white', () => {
			const image = makeImage(10, 10, 230);
			fillRect(image, 2, 2, 3, 3, 20);
			const result = binarise(image, 128);
			expect(result.data[2 * 10 + 2]).toBe(TEXT);
			expect(result.data[0]).toBe(WHITE);
			expect(countValue(result, TEXT)).toBe(9);
		});

		it('only outputs 0 and 255 and preserves dimensions', () => {
			const result = binarise(makeImage(6, 3, 77), 50);
			expect(result.width).toBe(6);
			expect(result.height).toBe(3);
			for (const v of result.data) expect([TEXT, WHITE]).toContain(v);
		});
	});

	describe('findComponents', () => {
		it('counts separate blobs separately', () => {
			const image = makeImage(20, 10);
			fillRect(image, 1, 1, 3, 3, TEXT);
			fillRect(image, 10, 4, 2, 2, TEXT);
			const components = findComponents(image);
			expect(components).toHaveLength(2);
			expect(components.map((c) => c.area).sort()).toEqual([4, 9]);
		});

		it('connects diagonal pixels (8-connectivity)', () => {
			const image = makeImage(6, 6);
			for (let i = 1; i <= 3; i++) image.data[i * 6 + i] = TEXT;
			const components = findComponents(image);
			expect(components).toHaveLength(1);
			expect(components[0]).toEqual({ x: 1, y: 1, width: 3, height: 3, area: 3 });
		});

		it('reports the correct bounding box and area', () => {
			const image = makeImage(12, 12);
			fillRect(image, 3, 2, 4, 5, TEXT);
			expect(findComponents(image)).toEqual([
				{ x: 3, y: 2, width: 4, height: 5, area: 20 },
			]);
		});

		it('returns an empty list when there are no text pixels', () => {
			expect(findComponents(makeImage(5, 5))).toEqual([]);
		});
	});

	describe('cropToText', () => {
		it('drops a large icon separated from the glyphs by a wide gap', () => {
			const result = cropToText(makeLine());
			expect(result.width).toBe(57 + 6 - 30);
			expect(result.height).toBe(10);
			expect(countValue(result, TEXT)).toBe(GLYPH_PIXELS);
		});

		it('drops bars touching the top or bottom edge', () => {
			const image = makeLine();
			fillRect(image, 25, 0, 45, 3, TEXT); // top bar
			fillRect(image, 25, 27, 45, 3, TEXT); // bottom bar
			const result = cropToText(image);
			expect(result.width).toBe(33);
			expect(result.height).toBe(10);
			expect(countValue(result, TEXT)).toBe(GLYPH_PIXELS);
		});

		it('drops tiny specks, including those inside the text bounds', () => {
			const image = makeLine();
			fillRect(image, 37, 8, 1, 1, TEXT); // between glyphs 1 and 2
			fillRect(image, 70, 12, 2, 2, TEXT); // right of text
			const result = cropToText(image);
			expect(result.width).toBe(33);
			expect(countValue(result, TEXT)).toBe(GLYPH_PIXELS);
		});

		it('keeps the cluster with the most glyphs even when on the left', () => {
			const image = makeImage(80, 30);
			for (const x of [2, 11, 20]) fillRect(image, x, 5, 6, 10, TEXT);
			fillRect(image, 60, 5, 16, 16, TEXT);
			const result = cropToText(image);
			expect(result.width).toBe(24);
			expect(countValue(result, TEXT)).toBe(180);
		});

		it('returns the input unchanged when there is no text', () => {
			const blank = makeImage(20, 10);
			expect(cropToText(blank)).toBe(blank);

			const specks = makeImage(20, 10);
			fillRect(specks, 5, 4, 2, 2, TEXT);
			expect(cropToText(specks)).toBe(specks);
		});
	});

	describe('cropToBounds', () => {
		it('keeps digits touching the top and bottom edges', () => {
			const image = makeImage(40, 12);
			for (const x of [4, 13, 22]) fillRect(image, x, 0, 6, 12, TEXT);
			const result = cropToBounds(image);
			expect(result.width).toBe(24);
			expect(result.height).toBe(12);
			expect(countValue(result, TEXT)).toBe(3 * 72);
		});

		it('keeps shapes separated by a wide gap, such as a comma', () => {
			const image = makeImage(80, 20);
			fillRect(image, 2, 4, 6, 10, TEXT);
			fillRect(image, 30, 12, 4, 6, TEXT); // comma
			fillRect(image, 60, 4, 6, 10, TEXT);
			const result = cropToBounds(image);
			expect(result.width).toBe(64);
			expect(countValue(result, TEXT)).toBe(60 + 24 + 60);
		});

		it('drops tiny specks', () => {
			const image = makeImage(40, 20);
			fillRect(image, 10, 4, 6, 10, TEXT);
			fillRect(image, 35, 1, 2, 2, TEXT);
			const result = cropToBounds(image);
			expect(result.width).toBe(6);
			expect(countValue(result, TEXT)).toBe(60);
		});

		it('returns the input unchanged when there is no text', () => {
			const blank = makeImage(20, 10);
			expect(cropToBounds(blank)).toBe(blank);
		});
	});

	describe('pad', () => {
		it('adds the margin on every side', () => {
			const result = pad(makeImage(4, 2, TEXT), 3);
			expect(result.width).toBe(10);
			expect(result.height).toBe(8);
			expect(result.data.length).toBe(80);
		});

		it('fills the border with white and offsets the content', () => {
			const result = pad(makeImage(2, 2, TEXT), 3);
			expect(result.data[0]).toBe(WHITE);
			expect(result.data[3 * result.width + 2]).toBe(WHITE);
			expect(result.data[3 * result.width + 3]).toBe(TEXT);
			expect(result.data[4 * result.width + 4]).toBe(TEXT);
			expect(result.data[4 * result.width + 5]).toBe(WHITE);
			expect(countValue(result, TEXT)).toBe(4);
		});

		it('leaves the image unchanged with a margin of zero', () => {
			const image = makeLine();
			const result = pad(image, 0);
			expect(result.width).toBe(image.width);
			expect(Array.from(result.data)).toEqual(Array.from(image.data));
		});
	});

	describe('isolateText', () => {
		/** Plain RGBA object (jsdom may lack an ImageData constructor) */
		const makeRgba = (width: number, height: number, background: number) => {
			const data = new Uint8ClampedArray(width * height * 4);
			const rect = (x: number, y: number, w: number, h: number, value: number) => {
				for (let yy = y; yy < y + h; yy++) {
					for (let xx = x; xx < x + w; xx++) {
						const i = (yy * width + xx) * 4;
						data[i] = data[i + 1] = data[i + 2] = value;
						data[i + 3] = 255;
					}
				}
			};
			rect(0, 0, width, height, background);
			return { width, height, data, rect };
		};

		it('crops away the icon and returns padded black-on-white text', () => {
			const { rect, ...imageData } = makeRgba(80, 30, 20);
			rect(2, 5, 16, 16, 230); // icon
			for (const x of [30, 39, 48, 57]) rect(x, 5, 6, 10, 230);

			const result = isolateText(imageData);

			// Icon cropped: narrower than the whole enlarged image and the icon-to-glyph span
			expect(result.width).toBeLessThan(80 * 3);
			expect(result.width).toBeLessThan((63 - 2) * 3);
			expect(result.width).toBeGreaterThan(20 + 25 * 3);
			expect(result.height).toBeGreaterThan(20 + 8 * 3);
			expect(result.data.length).toBe(result.width * result.height);

			// Binary, black text on white
			for (const v of result.data) expect([TEXT, WHITE]).toContain(v);
			expect(countValue(result, TEXT)).toBeGreaterThan(0);
			expect(countValue(result, TEXT)).toBeLessThan(result.data.length / 2);

			// 10px white border on every side
			for (let y = 0; y < result.height; y++) {
				for (let x = 0; x < result.width; x++) {
					if (x < 10 || y < 10 || x >= result.width - 10 || y >= result.height - 10) {
						expect(result.data[y * result.width + x]).toBe(WHITE);
					}
				}
			}
		});

		it('keeps digits touching the edges in number mode', () => {
			const { rect, ...imageData } = makeRgba(40, 12, 20);
			for (const x of [4, 13, 22]) rect(x, 0, 6, 12, 230);

			const named = isolateText(imageData, 2, 'name');
			const numbered = isolateText(imageData, 2, 'number');

			// Name mode drops edge-touching shapes, leaving nothing to crop to
			expect(named.width).toBe(40 * 2 + 20);
			expect(numbered.width).toBe(24 * 2 + 20);
			expect(numbered.height).toBe(12 * 2 + 20);
			expect(countValue(numbered, TEXT)).toBe(3 * 72 * 4);
		});

		it('also handles dark text on a light background', () => {
			const { rect, ...imageData } = makeRgba(80, 30, 220);
			for (const x of [30, 39, 48, 57]) rect(x, 5, 6, 10, 15);

			const result = isolateText(imageData, 2);
			expect(result.width).toBeLessThan(80 * 2);
			expect(countValue(result, TEXT)).toBeGreaterThan(0);
			expect(result.data[0]).toBe(WHITE);
		});
	});
});
