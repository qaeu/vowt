/**
 * Region alignment: shifts profile regions to follow small layout changes in a screenshot.
 *
 * Each alignment group locates a static landmark (anchor) with normalised
 * cross-correlation to find the group's offset, then optionally snaps individual
 * rows to the darker separator lines between them.
 */

import type {
	AlignmentGroup,
	AnchorTemplate,
	GrayImage,
	RegionAnchor,
	RowBands,
	TextRegion,
} from '#types';
import { REFERENCE_WIDTH, REFERENCE_HEIGHT } from '#utils/regionProfiles';

/** Downscale factor (from reference resolution) that anchor templates are stored at */
export const ALIGN_SCALE = 2;

interface AnchorMatch {
	dx: number;
	dy: number;
	score: number;
}

interface GroupOffset {
	dx: number;
	dy: number;
	rowShifts?: number[];
}

type Rect = Pick<TextRegion, 'x' | 'y' | 'width' | 'height'>;

const MIN_SCORE_DEFAULT = 0.6;

/** A separator row must be at least this much darker than the surrounding band */
const SEPARATOR_RATIO = 0.92;

/**
 * Copies a rectangle out of a grayscale image, clipped to the image bounds
 */
function cropGray(image: GrayImage, rect: Rect): GrayImage {
	const x0 = Math.max(0, rect.x);
	const y0 = Math.max(0, rect.y);
	const width = Math.max(0, Math.min(image.width, rect.x + rect.width) - x0);
	const height = Math.max(0, Math.min(image.height, rect.y + rect.height) - y0);
	const data = new Uint8ClampedArray(width * height);

	for (let y = 0; y < height; y++) {
		const start = (y0 + y) * image.width + x0;
		data.set(image.data.subarray(start, start + width), y * width);
	}

	return { width, height, data };
}

/**
 * Median of a list of numbers
 */
function median(values: number[]): number {
	const sorted = [...values].sort((a, b) => a - b);
	const mid = Math.floor(sorted.length / 2);
	return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Converts RGBA image data to 8-bit luminance
 * @param imageData - Source RGBA pixels
 * @returns Grayscale image of the same size
 */
export function toGrayscale(
	imageData: Pick<ImageData, 'width' | 'height' | 'data'>
): GrayImage {
	const { width, height, data } = imageData;
	const gray = new Uint8ClampedArray(width * height);

	for (let i = 0; i < gray.length; i++) {
		const p = i * 4;
		gray[i] = Math.round(0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2]);
	}

	return { width, height, data: gray };
}

/**
 * Shrinks a grayscale image by averaging factor x factor pixel blocks
 * @param image - Source image
 * @param factor - Integer downscale factor
 * @returns Downscaled image (partial edge blocks are dropped)
 */
export function downsample(image: GrayImage, factor: number): GrayImage {
	if (factor <= 1) return image;

	const width = Math.floor(image.width / factor);
	const height = Math.floor(image.height / factor);
	const data = new Uint8ClampedArray(width * height);
	const area = factor * factor;

	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			let sum = 0;
			for (let by = 0; by < factor; by++) {
				const row = (y * factor + by) * image.width + x * factor;
				for (let bx = 0; bx < factor; bx++) {
					sum += image.data[row + bx];
				}
			}
			data[y * width + x] = Math.round(sum / area);
		}
	}

	return { width, height, data };
}

/**
 * Serialises a grayscale image as a base64 anchor template
 */
export function encodeTemplate(image: GrayImage): AnchorTemplate {
	let binary = '';
	for (let i = 0; i < image.data.length; i++) {
		binary += String.fromCharCode(image.data[i]);
	}
	return { width: image.width, height: image.height, data: btoa(binary) };
}

/**
 * Deserialises a base64 anchor template into a grayscale image
 */
export function decodeTemplate(template: AnchorTemplate): GrayImage {
	const binary = atob(template.data);
	const data = new Uint8ClampedArray(binary.length);
	for (let i = 0; i < binary.length; i++) {
		data[i] = binary.charCodeAt(i);
	}
	return { width: template.width, height: template.height, data };
}

/**
 * Captures an anchor from a reference-resolution screenshot
 * @param gray - Grayscale screenshot at reference resolution
 * @param rect - Landmark rectangle at reference resolution; should contain only static UI
 * @param searchX - Maximum horizontal offset to search, in reference pixels
 * @param searchY - Maximum vertical offset to search, in reference pixels
 * @returns Anchor with its template stored at ALIGN_SCALE
 */
export function createAnchor(
	gray: GrayImage,
	rect: Rect,
	searchX: number,
	searchY: number
): RegionAnchor {
	const snap = (v: number) => Math.round(v / ALIGN_SCALE) * ALIGN_SCALE;
	const x = snap(rect.x);
	const y = snap(rect.y);
	const cropped = cropGray(gray, {
		x,
		y,
		width: snap(rect.width),
		height: snap(rect.height),
	});

	return {
		x,
		y,
		searchX,
		searchY,
		template: encodeTemplate(downsample(cropped, ALIGN_SCALE)),
	};
}

/**
 * Finds an anchor near its expected position using normalised cross-correlation
 * @param scaled - Grayscale screenshot downscaled by ALIGN_SCALE from reference resolution
 * @param anchor - Anchor to locate
 * @returns Offset from the expected position in reference pixels, or null if no good match
 */
export function findAnchorOffset(
	scaled: GrayImage,
	anchor: RegionAnchor
): AnchorMatch | null {
	const template = decodeTemplate(anchor.template);
	const n = template.width * template.height;
	if (n === 0) return null;

	let templateSum = 0;
	for (let i = 0; i < n; i++) templateSum += template.data[i];
	const templateMean = templateSum / n;

	const zeroMean = new Float32Array(n);
	let templateNormSq = 0;
	for (let i = 0; i < n; i++) {
		zeroMean[i] = template.data[i] - templateMean;
		templateNormSq += zeroMean[i] * zeroMean[i];
	}
	// A flat template has no features to match
	if (templateNormSq === 0) return null;
	const templateNorm = Math.sqrt(templateNormSq);

	const expectedX = Math.round(anchor.x / ALIGN_SCALE);
	const expectedY = Math.round(anchor.y / ALIGN_SCALE);
	const rangeX = Math.ceil(anchor.searchX / ALIGN_SCALE);
	const rangeY = Math.ceil(anchor.searchY / ALIGN_SCALE);

	let best: AnchorMatch | null = null;

	for (let oy = -rangeY; oy <= rangeY; oy++) {
		const py = expectedY + oy;
		if (py < 0 || py + template.height > scaled.height) continue;

		for (let ox = -rangeX; ox <= rangeX; ox++) {
			const px = expectedX + ox;
			if (px < 0 || px + template.width > scaled.width) continue;

			let sum = 0;
			let sumSq = 0;
			let cross = 0;
			for (let ty = 0; ty < template.height; ty++) {
				const row = (py + ty) * scaled.width + px;
				const tRow = ty * template.width;
				for (let tx = 0; tx < template.width; tx++) {
					const v = scaled.data[row + tx];
					sum += v;
					sumSq += v * v;
					cross += zeroMean[tRow + tx] * v;
				}
			}

			const variance = sumSq - (sum * sum) / n;
			if (variance <= 0) continue;

			const score = cross / (templateNorm * Math.sqrt(variance));
			if (!best || score > best.score) {
				best = { dx: ox * ALIGN_SCALE, dy: oy * ALIGN_SCALE, score };
			}
		}
	}

	if (!best || best.score < (anchor.minScore ?? MIN_SCORE_DEFAULT)) return null;
	return best;
}

/**
 * Finds the top of each row in a table by locating the darker separator lines between rows.
 * Rows can differ in height; each separator is searched for near the previous row's top
 * plus the nominal row height. Rows without a detectable separator keep their nominal spacing.
 * @param gray - Grayscale screenshot at reference resolution
 * @param rows - Row layout at reference resolution
 * @param dx - Horizontal offset of the group, in reference pixels
 * @param dy - Vertical offset of the group, in reference pixels
 * @returns Top y coordinate of each row, in reference pixels
 */
export function detectRowTops(
	gray: GrayImage,
	rows: RowBands,
	dx: number,
	dy: number
): number[] {
	const x0 = Math.max(0, Math.min(gray.width, rows.x + dx));
	const x1 = Math.max(x0, Math.min(gray.width, rows.x + rows.width + dx));
	const lumaCache = new Map<number, number>();

	/** Mean luminance of the sample strip at row y, or NaN outside the image */
	const luma = (y: number): number => {
		if (y < 0 || y >= gray.height || x1 === x0) return NaN;
		const cached = lumaCache.get(y);
		if (cached !== undefined) return cached;

		let sum = 0;
		const row = y * gray.width;
		for (let x = x0; x < x1; x++) sum += gray.data[row + x];
		const mean = sum / (x1 - x0);
		lumaCache.set(y, mean);
		return mean;
	};

	const snap = Math.max(2, Math.round(rows.rowHeight / 4));
	const half = Math.round(rows.rowHeight / 2);
	const tops = [rows.y + dy];

	for (let r = 1; r < rows.count; r++) {
		const expected = tops[r - 1] + rows.rowHeight;

		let minY = expected;
		let minLuma = Infinity;
		for (let y = expected - snap; y <= expected + snap; y++) {
			const value = luma(y);
			if (value < minLuma) {
				minLuma = value;
				minY = y;
			}
		}

		// Compare against the darker side, as neighbouring rows can differ in brightness
		const above: number[] = [];
		const below: number[] = [];
		for (let i = 1; i <= half; i++) {
			const up = luma(minY - i);
			const down = luma(minY + i);
			if (!Number.isNaN(up)) above.push(up);
			if (!Number.isNaN(down)) below.push(down);
		}

		const sides = [above, below].filter((side) => side.length > 0).map(median);
		const reference = sides.length ? Math.min(...sides) : NaN;
		if (!(minLuma < reference * SEPARATOR_RATIO)) {
			tops.push(expected);
			continue;
		}

		// The next row starts just below the separator line
		const threshold = (minLuma + reference) / 2;
		let end = minY;
		while (luma(end + 1) < threshold) end++;
		tops.push(end + 1);
	}

	return tops;
}

/**
 * Shifts regions to match the screenshot using their profile's alignment groups.
 * Regions without a group, or in a group whose anchor is not found, keep their positions.
 * @param regions - Regions scaled to the target image
 * @param groups - Alignment groups at reference resolution
 * @param gray - Grayscale screenshot resampled to reference resolution
 * @param scaleX - Target image width / reference width
 * @param scaleY - Target image height / reference height
 * @returns Aligned copies of the regions
 */
export function alignRegions(
	regions: TextRegion[],
	groups: AlignmentGroup[],
	gray: GrayImage,
	scaleX: number = 1,
	scaleY: number = 1
): TextRegion[] {
	if (groups.length === 0) return regions;

	const scaled = groups.some((g) => g.anchor) ? downsample(gray, ALIGN_SCALE) : null;
	const offsets = new Map<string, GroupOffset>();

	for (const group of groups) {
		let dx = 0;
		let dy = 0;

		if (group.anchor && scaled) {
			const match = findAnchorOffset(scaled, group.anchor);
			if (match) {
				({ dx, dy } = match);
			} else {
				console.warn(
					`Alignment anchor for group '${group.name}' not found; using profile positions`
				);
			}
		}

		const { rows } = group;
		const rowShifts =
			rows
			&& detectRowTops(gray, rows, dx, dy).map(
				(top, r) => top - (rows.y + r * rows.rowHeight)
			);

		offsets.set(group.name, { dx, dy, rowShifts });
	}

	const maxX = Math.round(gray.width * scaleX);
	const maxY = Math.round(gray.height * scaleY);

	return regions.map((region) => {
		const offset = region.group ? offsets.get(region.group) : undefined;
		if (!offset) return region;

		const rowShift =
			region.row !== undefined ? offset.rowShifts?.[region.row] : undefined;
		const shiftY = rowShift ?? offset.dy;

		const x = Math.round(region.x + offset.dx * scaleX);
		const y = Math.round(region.y + shiftY * scaleY);

		return {
			...region,
			x: Math.max(0, Math.min(maxX - region.width, x)),
			y: Math.max(0, Math.min(maxY - region.height, y)),
		};
	});
}

/**
 * Loads an image resampled to reference resolution as grayscale
 * @param imageSrc - Source image URL or data URL
 * @returns Promise resolving to the grayscale image
 */
export function loadReferenceGrayscale(imageSrc: string): Promise<GrayImage> {
	return new Promise((resolve, reject) => {
		const img = new Image();

		img.onload = () => {
			const canvas = document.createElement('canvas');
			const ctx = canvas.getContext('2d', { willReadFrequently: true });

			if (!ctx) {
				reject(new Error('Failed to get canvas context'));
				return;
			}

			canvas.width = REFERENCE_WIDTH;
			canvas.height = REFERENCE_HEIGHT;
			ctx.drawImage(img, 0, 0, REFERENCE_WIDTH, REFERENCE_HEIGHT);

			resolve(toGrayscale(ctx.getImageData(0, 0, REFERENCE_WIDTH, REFERENCE_HEIGHT)));
		};

		img.onerror = () => reject(new Error('Failed to load image'));
		img.src = imageSrc;
	});
}

/**
 * Aligns regions to a screenshot; falls back to the unaligned regions on failure
 * @param imageSrc - Source image URL or data URL
 * @param regions - Regions scaled to the image dimensions
 * @param groups - Alignment groups from the region profile
 * @param imgWidth - Image width
 * @param imgHeight - Image height
 * @returns Promise resolving to the aligned regions
 */
export async function alignRegionsToImage(
	imageSrc: string,
	regions: TextRegion[],
	groups: AlignmentGroup[],
	imgWidth: number,
	imgHeight: number
): Promise<TextRegion[]> {
	if (groups.length === 0) return regions;

	try {
		const gray = await loadReferenceGrayscale(imageSrc);
		return alignRegions(
			regions,
			groups,
			gray,
			imgWidth / REFERENCE_WIDTH,
			imgHeight / REFERENCE_HEIGHT
		);
	} catch (error) {
		console.warn('Region alignment failed; using profile positions:', error);
		return regions;
	}
}
