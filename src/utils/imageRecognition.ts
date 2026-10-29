/**
 * Image recognition: matches image regions against known colour templates.
 *
 * A template is a small RGB thumbnail of the centre of a region, built by area
 * averaging so it is stable against noise and resolution. Templates are compared
 * with normalised cross-correlation, and the query is resampled at small offsets
 * so a region that is a few pixels out of alignment still matches.
 */

import type { ImageHashSet } from '#types';

/** Width and height of a template thumbnail, in pixels */
export const TEMPLATE_SIZE = 16;

interface RecognitionResult {
	name: string;
	confidence: number;
	/** Template of the compared image, for saving as a new known hash */
	hash: string;
}

interface Rect {
	x: number;
	y: number;
	width: number;
	height: number;
}

/** Contributions of source pixels to one output pixel along an axis */
interface AxisWeights {
	pixels: number[];
	weights: number[];
}

type RgbaImage = Pick<ImageData, 'width' | 'height' | 'data'>;

/** Bytes in an encoded template (RGB per pixel) */
const TEMPLATE_LENGTH = TEMPLATE_SIZE ** 2 * 3;
/** Fraction trimmed from each edge so borders and team backgrounds matter less */
const CROP_INSET = 0.15;
/** Largest offset tried when matching, as a fraction of the region size */
const MAX_SHIFT = 0.07;
/** Minimum correlation (-1 to 1) with a known template for a match */
const MIN_SIMILARITY = 0.85;
/** Minimum lead in correlation over the best template of another name */
const MIN_MARGIN = 0.15;
/** Lead over the runner-up at which confidence reaches 100 */
const FULL_CONFIDENCE_MARGIN = 0.3;

/**
 * Works out how source pixels along one axis cover each output pixel
 * @param start - Start of the source span (may be fractional)
 * @param length - Length of the source span
 * @param size - Number of output pixels
 * @param limit - Number of source pixels; out-of-range pixels clamp to the edge
 */
function _axisWeights(
	start: number,
	length: number,
	size: number,
	limit: number
): AxisWeights[] {
	const step = length / size;
	const axis: AxisWeights[] = [];

	for (let i = 0; i < size; i++) {
		const from = start + i * step;
		const to = from + step;
		const pixels: number[] = [];
		const weights: number[] = [];

		for (let p = Math.floor(from); p < to; p++) {
			const weight = (Math.min(p + 1, to) - Math.max(p, from)) / step;
			if (weight <= 0) continue;
			pixels.push(Math.min(limit - 1, Math.max(0, p)));
			weights.push(weight);
		}
		axis.push({ pixels, weights });
	}

	return axis;
}

/**
 * Resamples a rectangle of an image to a square RGB thumbnail by area averaging
 * @returns RGB values, row by row
 */
function _resampleArea(image: RgbaImage, rect: Rect, size: number): Float32Array {
	const columns = _axisWeights(rect.x, rect.width, size, image.width);
	const rows = _axisWeights(rect.y, rect.height, size, image.height);
	const output = new Float32Array(size * size * 3);

	for (let oy = 0; oy < size; oy++) {
		const row = rows[oy];
		for (let ox = 0; ox < size; ox++) {
			const column = columns[ox];
			let r = 0;
			let g = 0;
			let b = 0;

			for (let j = 0; j < row.pixels.length; j++) {
				const rowOffset = row.pixels[j] * image.width;
				for (let i = 0; i < column.pixels.length; i++) {
					const weight = row.weights[j] * column.weights[i];
					const index = (rowOffset + column.pixels[i]) * 4;
					r += image.data[index] * weight;
					g += image.data[index + 1] * weight;
					b += image.data[index + 2] * weight;
				}
			}

			const out = (oy * size + ox) * 3;
			output[out] = r;
			output[out + 1] = g;
			output[out + 2] = b;
		}
	}

	return output;
}

/**
 * Trims CROP_INSET from each edge of a rectangle
 */
function _insetRect(rect: Rect): Rect {
	const dx = rect.width * CROP_INSET;
	const dy = rect.height * CROP_INSET;
	return {
		x: rect.x + dx,
		y: rect.y + dy,
		width: rect.width - 2 * dx,
		height: rect.height - 2 * dy,
	};
}

/**
 * Scales values to zero mean and unit variance so that a dot product of two
 * normalised vectors, divided by their length, is their correlation
 */
function _normalise(values: Float32Array): Float32Array {
	let mean = 0;
	for (const value of values) mean += value;
	mean /= values.length;

	let variance = 0;
	for (const value of values) variance += (value - mean) ** 2;
	const std = Math.sqrt(variance / values.length);

	const normalised = new Float32Array(values.length);
	if (std === 0) return normalised;
	for (let i = 0; i < values.length; i++) {
		normalised[i] = (values[i] - mean) / std;
	}
	return normalised;
}

/**
 * Pearson correlation of two normalised vectors (-1 to 1)
 */
function _correlation(a: Float32Array, b: Float32Array): number {
	let sum = 0;
	for (let i = 0; i < a.length; i++) {
		sum += a[i] * b[i];
	}
	return sum / a.length;
}

/**
 * Serialises RGB values as a base64 template string
 */
function _encodeTemplate(values: Float32Array): string {
	let binary = '';
	for (const value of values) {
		binary += String.fromCharCode(Math.min(255, Math.max(0, Math.round(value))));
	}
	return btoa(binary);
}

/**
 * Deserialises a base64 template string
 * @returns RGB values, or null if the string isn't a template (e.g. a legacy dHash)
 */
function _decodeTemplate(hash: string): Float32Array | null {
	let binary: string;
	try {
		binary = atob(hash);
	} catch {
		return null;
	}
	if (binary.length !== TEMPLATE_LENGTH) return null;

	const values = new Float32Array(TEMPLATE_LENGTH);
	for (let i = 0; i < TEMPLATE_LENGTH; i++) {
		values[i] = binary.charCodeAt(i);
	}
	return values;
}

/**
 * Decodes a template into RGBA pixels, e.g. to show what a learned hash looks like
 * @param hash - Base64 template string
 * @returns A TEMPLATE_SIZE square image, or null if the hash isn't a template
 */
export function templateToImage(hash: string): RgbaImage | null {
	const values = _decodeTemplate(hash);
	if (!values) return null;

	const data = new Uint8ClampedArray(TEMPLATE_SIZE ** 2 * 4);
	for (let i = 0; i < TEMPLATE_SIZE ** 2; i++) {
		data.set([values[i * 3], values[i * 3 + 1], values[i * 3 + 2], 255], i * 4);
	}
	return { width: TEMPLATE_SIZE, height: TEMPLATE_SIZE, data };
}

/**
 * Renders a template as a PNG data URL
 * @param hash - Base64 template string
 * @returns The data URL, or null if the hash isn't a template or canvas is unavailable
 */
export function templateToDataURL(hash: string): string | null {
	const image = templateToImage(hash);
	if (!image) return null;

	try {
		const canvas = document.createElement('canvas');
		canvas.width = image.width;
		canvas.height = image.height;
		const ctx = canvas.getContext('2d');
		if (!ctx) return null;
		ctx.putImageData(new ImageData(image.data, image.width, image.height), 0, 0);
		return canvas.toDataURL('image/png');
	} catch {
		return null;
	}
}

/**
 * Combines hash sets that share an ID so that later sets extend earlier ones
 * Hashes keep their input order, so earlier sets win ties during recognition
 * @param hashSets - Hash sets to combine, highest priority first
 * @returns One hash set per unique ID
 */
export function mergeHashSets(hashSets: ImageHashSet[]): ImageHashSet[] {
	const merged = new Map<string, ImageHashSet>();
	for (const hashSet of hashSets) {
		const existing = merged.get(hashSet.id);
		if (existing) {
			existing.hashes.push(...hashSet.hashes);
		} else {
			merged.set(hashSet.id, { ...hashSet, hashes: [...hashSet.hashes] });
		}
	}
	return [...merged.values()];
}

/**
 * Creates a colour template of the centre of an image region
 * @param image - Image to sample
 * @param rect - Region of the image to sample (default: the whole image); may be fractional
 * @returns Base64 template string, stored as the `hash` of a known image
 */
export function createTemplate(
	image: RgbaImage,
	rect: Rect = { x: 0, y: 0, width: image.width, height: image.height }
): string {
	return _encodeTemplate(_resampleArea(image, _insetRect(rect), TEMPLATE_SIZE));
}

/**
 * Recognises an image by comparing its colour template against a set of known templates
 * Entries that aren't templates (such as legacy dHashes) are ignored
 * @param imageData - Image data to compare
 * @param hashSet - Set of known templates to compare against
 * @returns Object with matched image name (or empty string if no confident match),
 * confidence (0-100) and the image's template
 */
export function recogniseImage(
	imageData: RgbaImage,
	hashSet: ImageHashSet
): RecognitionResult {
	const hash = createTemplate(imageData);
	const known = hashSet.hashes.flatMap(({ name, hash: knownHash }) => {
		const values = _decodeTemplate(knownHash);
		return values ? [{ name, template: _normalise(values) }] : [];
	});

	// Best correlation per name across all offsets
	const scores = new Map<string, number>();
	const inner = _insetRect({
		x: 0,
		y: 0,
		width: imageData.width,
		height: imageData.height,
	});
	const maxShift = Math.round(Math.min(imageData.width, imageData.height) * MAX_SHIFT);

	for (let dy = -maxShift; dy <= maxShift; dy++) {
		for (let dx = -maxShift; dx <= maxShift; dx++) {
			const query = _normalise(
				_resampleArea(
					imageData,
					{ ...inner, x: inner.x + dx, y: inner.y + dy },
					TEMPLATE_SIZE
				)
			);
			for (const { name, template } of known) {
				const score = _correlation(query, template);
				if (score > (scores.get(name) ?? -Infinity)) {
					scores.set(name, score);
				}
			}
		}
	}

	// Map keeps insertion order, so earlier hash sets win ties
	let bestName = '';
	let bestScore = 0;
	let runnerUpScore = 0;
	for (const [name, score] of scores) {
		if (score > bestScore) {
			runnerUpScore = bestScore;
			bestScore = score;
			bestName = name;
		} else if (score > runnerUpScore) {
			runnerUpScore = score;
		}
	}

	const margin = bestScore - runnerUpScore;
	const confidence = Math.round(
		100 * bestScore * Math.min(1, margin / FULL_CONFIDENCE_MARGIN)
	);
	const isMatch = bestScore >= MIN_SIMILARITY && margin >= MIN_MARGIN;

	return { name: isMatch ? bestName : '', confidence, hash };
}
