/**
 * Per-region text clean-up: isolates a single line of text for OCR by enlarging,
 * binarising and cropping away icons, banner edges and noise
 */

import type { GrayImage } from '#types';
import { toGrayscale } from '#utils/regionAlignment';

/** Bounding box and pixel count of a connected group of text pixels */
export interface Component {
	x: number;
	y: number;
	width: number;
	height: number;
	area: number;
}

/** Enlargement factor; Tesseract reads best with glyphs roughly 30-40px tall */
const UPSCALE_FACTOR = 3;
/** Components smaller than this many pixels (after enlarging) are noise */
const MIN_COMPONENT_AREA = 20;
/** Horizontal gap, relative to median glyph height, that separates clusters */
const CLUSTER_GAP_RATIO = 0.8;
/** White border added around the cropped text, in pixels */
const PADDING = 10;

const TEXT = 0;
const BACKGROUND = 255;

/**
 * Enlarges a grayscale image with bilinear interpolation
 * @param image - Source image
 * @param factor - Scale factor (values of 1 or less return the input)
 * @returns Enlarged image
 */
export function upscale(image: GrayImage, factor: number): GrayImage {
	if (factor <= 1) return image;

	const width = Math.round(image.width * factor);
	const height = Math.round(image.height * factor);
	const data = new Uint8ClampedArray(width * height);
	const maxX = image.width - 1;
	const maxY = image.height - 1;

	for (let y = 0; y < height; y++) {
		// Sample at pixel centres so edges are not biased
		const sy = Math.min(Math.max((y + 0.5) / factor - 0.5, 0), maxY);
		const y0 = Math.floor(sy);
		const y1 = Math.min(y0 + 1, maxY);
		const fy = sy - y0;

		for (let x = 0; x < width; x++) {
			const sx = Math.min(Math.max((x + 0.5) / factor - 0.5, 0), maxX);
			const x0 = Math.floor(sx);
			const x1 = Math.min(x0 + 1, maxX);
			const fx = sx - x0;

			const top =
				image.data[y0 * image.width + x0] * (1 - fx)
				+ image.data[y0 * image.width + x1] * fx;
			const bottom =
				image.data[y1 * image.width + x0] * (1 - fx)
				+ image.data[y1 * image.width + x1] * fx;
			data[y * width + x] = Math.round(top * (1 - fy) + bottom * fy);
		}
	}

	return { width, height, data };
}

/**
 * Finds the threshold that best separates two brightness classes (Otsu's method)
 * @param image - Grayscale image
 * @returns Threshold; pixels above it belong to the brighter class
 */
export function otsuThreshold(image: GrayImage): number {
	const histogram = new Array<number>(256).fill(0);
	for (const value of image.data) histogram[value]++;

	const total = image.data.length;
	let sumAll = 0;
	for (let i = 0; i < 256; i++) sumAll += i * histogram[i];

	let sumBelow = 0;
	let countBelow = 0;
	let bestVariance = -1;
	let threshold = 0;

	for (let t = 0; t < 256; t++) {
		countBelow += histogram[t];
		if (countBelow === 0) continue;
		const countAbove = total - countBelow;
		if (countAbove === 0) break;

		sumBelow += t * histogram[t];
		const meanBelow = sumBelow / countBelow;
		const meanAbove = (sumAll - sumBelow) / countAbove;
		const variance = countBelow * countAbove * (meanBelow - meanAbove) ** 2;

		if (variance > bestVariance) {
			bestVariance = variance;
			threshold = t;
		}
	}

	return threshold;
}

/**
 * Converts to black text on white; the class with fewer pixels is taken to be text
 * @param image - Grayscale image
 * @param threshold - Pixels above this value are bright
 * @returns Binary image with text pixels 0 and background 255
 */
export function binarise(image: GrayImage, threshold: number): GrayImage {
	let brightCount = 0;
	for (const value of image.data) {
		if (value > threshold) brightCount++;
	}
	const textIsBright = brightCount < image.data.length - brightCount;

	const data = new Uint8ClampedArray(image.data.length);
	for (let i = 0; i < data.length; i++) {
		const isBright = image.data[i] > threshold;
		data[i] = isBright === textIsBright ? TEXT : BACKGROUND;
	}

	return { width: image.width, height: image.height, data };
}

/**
 * Labels 8-connected groups of text pixels
 * @param binary - Binary image from binarise()
 * @returns Bounding box and area of each component
 */
export function findComponents(binary: GrayImage): Component[] {
	const { width, height, data } = binary;
	const visited = new Uint8Array(data.length);
	const components: Component[] = [];
	const stack: number[] = [];

	for (let start = 0; start < data.length; start++) {
		if (data[start] !== TEXT || visited[start]) continue;

		let minX = width;
		let minY = height;
		let maxX = -1;
		let maxY = -1;
		let area = 0;

		visited[start] = 1;
		stack.push(start);
		while (stack.length > 0) {
			const index = stack.pop() as number;
			const x = index % width;
			const y = (index - x) / width;
			area++;
			minX = Math.min(minX, x);
			maxX = Math.max(maxX, x);
			minY = Math.min(minY, y);
			maxY = Math.max(maxY, y);

			for (let dy = -1; dy <= 1; dy++) {
				const ny = y + dy;
				if (ny < 0 || ny >= height) continue;
				for (let dx = -1; dx <= 1; dx++) {
					const nx = x + dx;
					if (nx < 0 || nx >= width) continue;
					const neighbour = ny * width + nx;
					if (data[neighbour] === TEXT && !visited[neighbour]) {
						visited[neighbour] = 1;
						stack.push(neighbour);
					}
				}
			}
		}

		components.push({
			x: minX,
			y: minY,
			width: maxX - minX + 1,
			height: maxY - minY + 1,
			area,
		});
	}

	return components;
}

/**
 * Crops a binary image to its main run of glyphs, dropping noise, shapes touching the
 * top or bottom edge, and shapes separated by a wide gap (e.g. a banner icon)
 * @param binary - Binary image from binarise()
 * @returns Cropped image, or the input if no text is found
 */
export function cropToText(binary: GrayImage): GrayImage {
	const glyphs = findComponents(binary)
		.filter(({ area }) => area >= MIN_COMPONENT_AREA)
		.filter(({ y, height }) => y > 0 && y + height < binary.height)
		.sort((a, b) => a.x - b.x);
	if (glyphs.length === 0) return binary;

	const heights = glyphs.map(({ height }) => height).sort((a, b) => a - b);
	const maxGap = heights[Math.floor(heights.length / 2)] * CLUSTER_GAP_RATIO;

	// Split into left-to-right clusters wherever the gap is wide
	const clusters: Component[][] = [[glyphs[0]]];
	let clusterRight = glyphs[0].x + glyphs[0].width;
	for (const glyph of glyphs.slice(1)) {
		if (glyph.x - clusterRight > maxGap) {
			clusters.push([]);
		}
		clusters[clusters.length - 1].push(glyph);
		clusterRight = Math.max(clusterRight, glyph.x + glyph.width);
	}

	// Most glyphs wins; ties go to the larger total area
	const area = (cluster: Component[]) => cluster.reduce((sum, c) => sum + c.area, 0);
	const text = clusters.reduce((best, cluster) =>
		(
			cluster.length > best.length
			|| (cluster.length === best.length && area(cluster) > area(best))
		) ?
			cluster
		:	best
	);

	const left = Math.min(...text.map(({ x }) => x));
	const top = Math.min(...text.map(({ y }) => y));
	const right = Math.max(...text.map(({ x, width }) => x + width));
	const bottom = Math.max(...text.map(({ y, height }) => y + height));

	// Copy only the kept glyphs' bounding boxes so stray pixels inside the crop are dropped
	const width = right - left;
	const height = bottom - top;
	const data = new Uint8ClampedArray(width * height).fill(BACKGROUND);
	for (const glyph of text) {
		for (let y = glyph.y; y < glyph.y + glyph.height; y++) {
			for (let x = glyph.x; x < glyph.x + glyph.width; x++) {
				if (binary.data[y * binary.width + x] === TEXT) {
					data[(y - top) * width + (x - left)] = TEXT;
				}
			}
		}
	}

	return { width, height, data };
}

/**
 * Adds a white border around an image
 * @param image - Source image
 * @param margin - Border width in pixels
 * @returns Padded image
 */
export function pad(image: GrayImage, margin: number): GrayImage {
	const width = image.width + 2 * margin;
	const height = image.height + 2 * margin;
	const data = new Uint8ClampedArray(width * height).fill(BACKGROUND);

	for (let y = 0; y < image.height; y++) {
		data.set(
			image.data.subarray(y * image.width, (y + 1) * image.width),
			(y + margin) * width + margin
		);
	}

	return { width, height, data };
}

/**
 * Isolates a line of text for OCR: grayscale, enlarge, binarise, crop and pad
 * @param imageData - Region pixels
 * @param scale - Enlargement factor
 * @returns Black-on-white image of the text
 */
export function isolateText(
	imageData: Pick<ImageData, 'width' | 'height' | 'data'>,
	scale: number = UPSCALE_FACTOR
): GrayImage {
	const enlarged = upscale(toGrayscale(imageData), scale);
	const binary = binarise(enlarged, otsuThreshold(enlarged));
	return pad(cropToText(binary), PADDING);
}
