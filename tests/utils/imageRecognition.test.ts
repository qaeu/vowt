import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PNG } from 'pngjs';
import {
	createTemplate,
	recogniseImage,
	mergeHashSets,
	templateToImage,
	TEMPLATE_SIZE,
} from '#utils/imageRecognition';
import { DEFAULT_HASH_SETS } from '#data/hashSets';
import type { ImageHashSet } from '#types';

type Colour = [number, number, number];
type Pattern = (x: number, y: number) => Colour;

// Helper to create ImageData-like objects for testing
// (ImageData constructor isn't available in Node.js test environment)
function createImage(width: number, height: number, pattern: Pattern): ImageData {
	const data = new Uint8ClampedArray(width * height * 4);
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			const index = (y * width + x) * 4;
			data.set([...pattern(x, y), 255], index);
		}
	}
	return { data, width, height, colorSpace: 'srgb' } as ImageData;
}

/** Shifts a pattern so the image appears moved by (-dx, -dy) */
const shifted =
	(pattern: Pattern, dx: number, dy: number): Pattern =>
	(x, y) =>
		pattern(x + dx, y + dy);

const horizontalStripes: Pattern = (_x, y) =>
	Math.floor(y / 6) % 2 ? [200, 40, 40] : [30, 30, 160];
const verticalStripes: Pattern = (x) =>
	Math.floor(x / 6) % 2 ? [40, 200, 40] : [160, 30, 30];
const checkerboard: Pattern = (x, y) =>
	(Math.floor(x / 9) + Math.floor(y / 9)) % 2 ? [230, 230, 60] : [20, 60, 90];
const diagonalGradient: Pattern = (x, y) => [x * 4, y * 4, 128];

const makeHashSet = (hashes: ImageHashSet['hashes']): ImageHashSet => ({
	id: 'test-heroes',
	description: 'Test hero portrait templates',
	hashes,
	createdAt: new Date(),
	updatedAt: new Date(),
});

const decodedLength = (hash: string) => atob(hash).length;

const knownHashSet = makeHashSet([
	{ name: 'ana', hash: createTemplate(createImage(40, 40, horizontalStripes)) },
	{ name: 'ashe', hash: createTemplate(createImage(40, 40, verticalStripes)) },
	{ name: 'baptiste', hash: createTemplate(createImage(40, 40, checkerboard)) },
]);

describe('imageRecognition', () => {
	describe('createTemplate', () => {
		it('should encode an RGB thumbnail as base64', () => {
			const hash = createTemplate(createImage(40, 40, checkerboard));

			expect(hash).toMatch(/^[A-Za-z0-9+/]+=*$/);
			expect(decodedLength(hash)).toBe(TEMPLATE_SIZE ** 2 * 3);
		});

		it('should average a uniform image to its colour', () => {
			const hash = createTemplate(createImage(37, 41, () => [10, 20, 30]));
			const bytes = [...atob(hash)].map((c) => c.charCodeAt(0));

			for (let i = 0; i < bytes.length; i += 3) {
				expect(bytes.slice(i, i + 3)).toEqual([10, 20, 30]);
			}
		});

		it('should ignore the border of the image', () => {
			const plain = createImage(40, 40, () => [90, 90, 90]);
			const framed = createImage(40, 40, (x, y) =>
				Math.min(x, y, 39 - x, 39 - y) < 5 ? [255, 0, 0] : [90, 90, 90]
			);

			expect(createTemplate(framed)).toBe(createTemplate(plain));
		});

		it('should sample only the given rectangle', () => {
			const large = createImage(80, 80, checkerboard);
			const cropped = createImage(40, 40, shifted(checkerboard, 10, 20));

			expect(createTemplate(large, { x: 10, y: 20, width: 40, height: 40 })).toBe(
				createTemplate(cropped)
			);
		});

		it('should be deterministic', () => {
			const image = createImage(50, 50, diagonalGradient);

			expect(createTemplate(image)).toBe(createTemplate(image));
		});
	});

	describe('recogniseImage', () => {
		it('should recognise an image matching a known template', () => {
			const result = recogniseImage(createImage(40, 40, verticalStripes), knownHashSet);

			expect(result.name).toBe('ashe');
			expect(result.confidence).toBeGreaterThan(90);
		});

		it('should recognise an image that is out of alignment by a few pixels', () => {
			const image = createImage(40, 40, shifted(checkerboard, 2, -1));

			expect(recogniseImage(image, knownHashSet).name).toBe('baptiste');
		});

		it('should recognise an image at a different resolution', () => {
			const scale = 76 / 40;
			const image = createImage(76, 76, (x, y) =>
				horizontalStripes(x / scale, y / scale)
			);

			expect(recogniseImage(image, knownHashSet).name).toBe('ana');
		});

		it('should not recognise an image unlike any known template', () => {
			const result = recogniseImage(createImage(40, 40, diagonalGradient), knownHashSet);

			expect(result.name).toBe('');
			expect(result.confidence).toBeLessThan(50);
		});

		it('should not recognise an image that matches two names equally', () => {
			const hash = createTemplate(createImage(40, 40, checkerboard));
			const ambiguous = makeHashSet([
				{ name: 'ana', hash },
				{ name: 'ashe', hash },
			]);

			const result = recogniseImage(createImage(40, 40, checkerboard), ambiguous);

			expect(result.name).toBe('');
			expect(result.confidence).toBe(0);
		});

		it('should ignore entries that are not templates', () => {
			const withLegacy = makeHashSet([
				{ name: 'ashe', hash: '6b2b17451147b400' },
				...knownHashSet.hashes,
			]);

			const result = recogniseImage(createImage(40, 40, horizontalStripes), withLegacy);

			expect(result.name).toBe('ana');
		});

		it('should return no match for a set without templates', () => {
			const image = createImage(40, 40, checkerboard);

			for (const hashSet of [
				makeHashSet([]),
				makeHashSet([{ name: 'ana', hash: '6b2b17451147b400' }]),
			]) {
				const result = recogniseImage(image, hashSet);
				expect(result.name).toBe('');
				expect(result.confidence).toBe(0);
			}
		});

		it('should return the template of the image', () => {
			const image = createImage(40, 40, diagonalGradient);

			expect(recogniseImage(image, knownHashSet).hash).toBe(createTemplate(image));
		});

		it('should recognise a learned template of the image itself', () => {
			const image = createImage(40, 40, diagonalGradient);
			const learned = makeHashSet([
				...knownHashSet.hashes,
				{ name: 'new-hero', hash: recogniseImage(image, knownHashSet).hash },
			]);

			expect(recogniseImage(image, learned).name).toBe('new-hero');
		});
	});

	describe('with bundled portraits and real screenshots', () => {
		// 76px portrait regions at 1440p with a 4px margin: post-game (Screenshot 920)
		// then in-game (examples/scoreboard-screenshot-example.jpg), blue team first
		const CROP_SIZE = 84;
		const MARGIN = 4;
		// Empty names are heroes missing from the bundled portraits
		const EXPECTED = [
			['doomfist', '', 'ashe', 'ana', '', 'sigma', 'vendetta', 'soldier', '', 'ana'],
			['zarya', 'genji', 'sombra', 'kiriko', 'moira'],
			['reinhardt', 'genji', 'torbjorn', 'lucio', 'ana'],
		].flat();

		const strip = PNG.sync.read(
			readFileSync(resolve(__dirname, '../fixtures/hero-portraits.png'))
		);
		const portraits = mergeHashSets(DEFAULT_HASH_SETS).find(
			(hs) => hs.id === 'hero-portrait'
		)!;

		/** Crops a 76px region from a fixture portrait, offset from its true position */
		const cropPortrait = (index: number, dx: number, dy: number) =>
			createImage(76, 76, (x, y) => {
				const sx = index * CROP_SIZE + MARGIN + dx + x;
				const i = ((MARGIN + dy + y) * strip.width + sx) * 4;
				return [strip.data[i], strip.data[i + 1], strip.data[i + 2]];
			});

		it.each(EXPECTED.map((name, index) => ({ name, index })))(
			'should recognise portrait $index as "$name"',
			({ name, index }) => {
				for (const [dx, dy] of [
					[0, 0],
					[-2, 1],
					[2, -2],
				]) {
					expect(recogniseImage(cropPortrait(index, dx, dy), portraits).name).toBe(name);
				}
			}
		);
	});

	describe('templateToImage', () => {
		it('should decode a template into an opaque square image', () => {
			const image = templateToImage(
				createTemplate(createImage(40, 40, () => [10, 20, 30]))
			);

			expect(image).not.toBeNull();
			expect(image!.width).toBe(TEMPLATE_SIZE);
			expect(image!.height).toBe(TEMPLATE_SIZE);
			expect(image!.data).toHaveLength(TEMPLATE_SIZE ** 2 * 4);
			expect([...image!.data.slice(0, 4)]).toEqual([10, 20, 30, 255]);
			expect([...image!.data.slice(-4)]).toEqual([10, 20, 30, 255]);
		});

		it('should keep pixel positions', () => {
			const topAndBottom: Pattern = (_x, y) => (y < 20 ? [200, 40, 40] : [30, 30, 160]);
			const image = templateToImage(createTemplate(createImage(40, 40, topAndBottom)))!;
			const pixel = (x: number, y: number) => {
				const index = (y * TEMPLATE_SIZE + x) * 4;
				return [...image.data.slice(index, index + 3)];
			};

			expect(pixel(0, 0)).toEqual([200, 40, 40]);
			expect(pixel(TEMPLATE_SIZE - 1, 0)).toEqual([200, 40, 40]);
			expect(pixel(0, TEMPLATE_SIZE - 1)).toEqual([30, 30, 160]);
		});

		it('should return null for a string that is not a template', () => {
			expect(templateToImage('abcdef1234567890')).toBeNull();
			expect(templateToImage('not base64!')).toBeNull();
		});
	});

	describe('mergeHashSets', () => {
		const makeNamedHashSet = (id: string, names: string[]): ImageHashSet => ({
			...makeHashSet(names.map((name, i) => ({ name, hash: `${i}` }))),
			id,
			description: id,
		});

		it('should combine hashes of sets sharing an ID, keeping input order', () => {
			const learned = makeNamedHashSet('hero-portrait', ['new-hero']);
			const bundled = makeNamedHashSet('hero-portrait', ['ana', 'ashe']);

			const merged = mergeHashSets([learned, bundled]);

			expect(merged).toHaveLength(1);
			expect(merged[0].hashes.map((h) => h.name)).toEqual(['new-hero', 'ana', 'ashe']);
		});

		it('should keep sets with different IDs separate', () => {
			const merged = mergeHashSets([
				makeNamedHashSet('hero-portrait', ['ana']),
				makeNamedHashSet('rank-icons', ['gold']),
			]);

			expect(merged.map((hs) => hs.id)).toEqual(['hero-portrait', 'rank-icons']);
		});

		it('should not mutate the input sets', () => {
			const learned = makeNamedHashSet('hero-portrait', ['new-hero']);
			const bundled = makeNamedHashSet('hero-portrait', ['ana']);

			mergeHashSets([learned, bundled]);

			expect(learned.hashes).toHaveLength(1);
			expect(bundled.hashes).toHaveLength(1);
		});

		it('should return an empty array for no sets', () => {
			expect(mergeHashSets([])).toEqual([]);
		});
	});
});
