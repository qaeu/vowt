/**
 * Generates the bundled hero portrait templates from a folder of hero portraits.
 *
 * Each portrait (a square PNG with a transparent background, named by hero key) is
 * composited onto a background between the two team colours and framed the way the
 * scoreboard shows it, then turned into a template with the same code the app uses
 * for recognition. One template per hero matches portraits on either team.
 *
 * Usage: npm run generate:portraits -- <portrait-dir>
 */

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { PNG } from 'pngjs';

import type { ExportedImageHashSet, ImageHash } from '#types';
import { createTemplate } from '../src/utils/imageRecognition';

const OUTPUT_PATH = 'src/data/hashSets/hero-portrait-hashes.json';

/** Portrait size relative to its scoreboard region (78px portrait in a 76px region) */
const PORTRAIT_SCALE = 78 / 76;
/** Portrait offset from the region's top-left corner, as a fraction of the region size */
const PORTRAIT_OFFSET_X = 0;
const PORTRAIT_OFFSET_Y = -2 / 76;

/**
 * Background behind the portraits: the average of the blue (19, 148, 192) and
 * red (181, 54, 84) team colours sampled from 1440p screenshots
 */
const BACKGROUND: [number, number, number] = [100, 101, 138];

/**
 * Flattens an RGBA image onto a solid background colour
 */
function composite(
	image: PNG,
	background: [number, number, number]
): Pick<ImageData, 'width' | 'height' | 'data'> {
	const data = new Uint8ClampedArray(image.data.length);
	for (let i = 0; i < image.data.length; i += 4) {
		const alpha = image.data[i + 3] / 255;
		for (let c = 0; c < 3; c++) {
			data[i + c] = image.data[i + c] * alpha + background[c] * (1 - alpha);
		}
		data[i + 3] = 255;
	}
	return { width: image.width, height: image.height, data };
}

/**
 * Creates the template for a portrait file
 */
function portraitTemplate(path: string): ImageHash {
	const portrait = PNG.sync.read(readFileSync(path));
	const name = basename(path, '.png');

	// The scoreboard region, in portrait pixels
	const regionWidth = portrait.width / PORTRAIT_SCALE;
	const regionHeight = portrait.height / PORTRAIT_SCALE;
	const region = {
		x: -PORTRAIT_OFFSET_X * regionWidth,
		y: -PORTRAIT_OFFSET_Y * regionHeight,
		width: regionWidth,
		height: regionHeight,
	};

	return { name, hash: createTemplate(composite(portrait, BACKGROUND), region) };
}

const portraitDir = process.argv[2];
if (!portraitDir) {
	console.error('Usage: npm run generate:portraits -- <portrait-dir>');
	process.exit(1);
}

const files = readdirSync(portraitDir)
	.filter((file) => file.endsWith('.png'))
	.sort();
const now = new Date().toISOString();
const output: ExportedImageHashSet = {
	type: 'vowt-image-hashes',
	schemaVersion: 2,
	hashSet: {
		id: 'hero-portrait',
		description: 'In-game hero portraits',
		hashes: files.map((file) => portraitTemplate(join(portraitDir, file))),
		createdAt: now,
		updatedAt: now,
	},
	exportedAt: now,
};

writeFileSync(OUTPUT_PATH, `${JSON.stringify(output, null, '\t')}\n`);
console.log(`Wrote ${output.hashSet.hashes.length} templates for ${files.length} heroes`);
