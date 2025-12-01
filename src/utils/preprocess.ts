/**
 * Image preprocessing utilities for OCR optimization
 */

import type { TextRegion, PartitionGroup } from '#types';

const SKEW_ANGLE_DEFAULT = -14;
const REGION_COLOUR_DEFAULT = '#ff0000';
const REGION_COLOUR_ITALIC = '#4caf50';
const REGION_COLOUR_IMAGE = '#3131da';

/** Minimum number of jobs to warrant using a scheduler instead of a standalone worker */
const SCHEDULER_JOBS_MIN = 3;

/**
 * Applies skew correction to italic text to make it more readable
 * @param imageData - Image data to process
 * @param skewAngle - Angle in degrees to unskew (negative for italic correction)
 * @returns Processed image data
 */
function unskewItalicText(
	imageData: ImageData,
	skewAngle: number = SKEW_ANGLE_DEFAULT
): ImageData {
	const canvas = document.createElement('canvas');
	const ctx = canvas.getContext('2d');

	if (!ctx) {
		return imageData;
	}

	canvas.width = imageData.width;
	canvas.height = imageData.height;

	// Put the image data on canvas
	ctx.putImageData(imageData, 0, 0);

	// Create a new canvas for the transformed image
	const outputCanvas = document.createElement('canvas');
	const outputCtx = outputCanvas.getContext('2d');

	if (!outputCtx) {
		return imageData;
	}

	outputCanvas.width = imageData.width;
	outputCanvas.height = imageData.height;

	// Fill background with grey before transformation
	outputCtx.fillStyle = '#444444';
	outputCtx.fillRect(0, 0, outputCanvas.width, outputCanvas.height);

	// Apply skew transformation to counteract italic
	const angleRad = (skewAngle * Math.PI) / 180;
	outputCtx.transform(1, 0, -Math.tan(angleRad), 1, 0, 0);
	outputCtx.drawImage(canvas, 0, 0);

	return outputCtx.getImageData(0, 0, outputCanvas.width, outputCanvas.height);
}

/**
 * Converts an image to grayscale and enhances contrast for better OCR results
 * @param imageUrl - URL of the image to preprocess
 * @param regions - Array of region definitions for preprocessing
 * @param regionImageDataMap - Pre-extracted ImageData for each region
 * @returns Promise resolving to a data URL of the preprocessed image
 */
export async function preprocessImageForOCR(
	imageUrl: string,
	regions: TextRegion[],
	preprocessedRegionMap: Map<string, ImageData>
): Promise<string> {
	return new Promise((resolve, reject) => {
		const img = new Image();

		img.onload = () => {
			const canvas = document.createElement('canvas');
			const ctx = canvas.getContext('2d', { willReadFrequently: true });

			if (!ctx) {
				reject(new Error('Failed to get canvas context'));
				return;
			}

			canvas.width = img.width;
			canvas.height = img.height;

			ctx.drawImage(img, 0, 0);

			for (const region of regions) {
				// Use pre-processed region image data
				const imageData = preprocessedRegionMap.get(region.name);
				if (!imageData) continue;

				ctx.putImageData(imageData, region.x, region.y);
			}

			ctx.filter = 'brightness(70%) contrast(300%) grayscale(100%) invert(100%)';
			ctx.drawImage(canvas, 0, 0);

			// Convert to data URL
			resolve(canvas.toDataURL('image/png'));
		};

		img.onerror = () => {
			reject(new Error('Failed to load image'));
		};

		img.src = imageUrl;
	});
}

/**
 * Extracts ImageData for multiple regions from an image in a single pass
 * @param imageSrc - Source image URL or data URL
 * @param regions - Array of region definitions with coordinates
 * @returns Promise resolving to Map of region name to ImageData
 */
export const getRegionImageData = (
	imageSrc: string,
	regions: TextRegion[]
): Promise<Map<string, ImageData>> => {
	return new Promise((resolve, reject) => {
		const img = new Image();

		img.onload = () => {
			const canvas = document.createElement('canvas');
			const ctx = canvas.getContext('2d', { willReadFrequently: true });

			if (!ctx) {
				reject(new Error('Failed to get canvas context'));
				return;
			}

			canvas.width = img.width;
			canvas.height = img.height;
			ctx.drawImage(img, 0, 0);

			const imageDataMap = new Map<string, ImageData>();
			for (const region of regions) {
				const imageData = ctx.getImageData(
					region.x,
					region.y,
					region.width,
					region.height
				);
				imageDataMap.set(region.name, imageData);
			}

			resolve(imageDataMap);
		};

		img.onerror = () => reject(new Error('Failed to load image'));
		img.src = imageSrc;
	});
};

/**
 * Extracts regions from an image as data URL strings
 * @param imageSrc - Source image URL or data URL
 * @param regions - Array of region definitions with coordinates
 * @returns Promise resolving to Map of region name to data URL string
 */
export const getRegionDataURLs = (
	imageSrc: string,
	regions: TextRegion[]
): Promise<Map<string, string>> => {
	return new Promise((resolve, reject) => {
		const img = new Image();

		img.onload = () => {
			const sourceCanvas = document.createElement('canvas');
			const sourceCtx = sourceCanvas.getContext('2d', { willReadFrequently: true });

			if (!sourceCtx) {
				reject(new Error('Failed to get canvas context'));
				return;
			}

			sourceCanvas.width = img.width;
			sourceCanvas.height = img.height;
			sourceCtx.drawImage(img, 0, 0);

			// Reusable canvas for region extraction
			const regionCanvas = document.createElement('canvas');
			const regionCtx = regionCanvas.getContext('2d');

			if (!regionCtx) {
				reject(new Error('Failed to get region canvas context'));
				return;
			}

			const dataURLMap = new Map<string, string>();
			for (const region of regions) {
				const imageData = sourceCtx.getImageData(
					region.x,
					region.y,
					region.width,
					region.height
				);

				// Resize region canvas only when needed
				if (
					regionCanvas.width !== region.width
					|| regionCanvas.height !== region.height
				) {
					regionCanvas.width = region.width;
					regionCanvas.height = region.height;
				}

				regionCtx.putImageData(imageData, 0, 0);
				dataURLMap.set(region.name, regionCanvas.toDataURL('image/png'));
			}

			resolve(dataURLMap);
		};

		img.onerror = () => reject(new Error('Failed to load image'));
		img.src = imageSrc;
	});
};

/**
 * Draws italic regions with unskew visualization on the preprocessed image
 * Uses green overlay for regions to show which ones are being unskewed
 * @param imageUrl - URL of the preprocessed image
 * @param regions - Array of region definitions to draw
 * @returns Promise resolving to data URL with unskew regions highlighted
 */
export async function drawRegionsOnImage(
	imageUrl: string,
	regions: TextRegion[]
): Promise<string> {
	return new Promise((resolve, reject) => {
		const img = new Image();

		img.onload = () => {
			const canvas = document.createElement('canvas');
			const ctx = canvas.getContext('2d');

			if (!ctx) {
				reject(new Error('Failed to get canvas context'));
				return;
			}

			canvas.width = img.width;
			canvas.height = img.height;

			// Draw the preprocessed image with regions
			ctx.drawImage(img, 0, 0);

			ctx.lineWidth = 1;

			for (const region of regions) {
				if (region.imgHashSet && region.imgHashSet.length > 0) {
					ctx.strokeStyle = REGION_COLOUR_IMAGE;
				} else if (region.isItalic) {
					ctx.strokeStyle = REGION_COLOUR_ITALIC;
				} else {
					ctx.strokeStyle = REGION_COLOUR_DEFAULT;
				}
				ctx.strokeRect(region.x, region.y, region.width, region.height);
			}

			resolve(canvas.toDataURL('image/png'));
		};

		img.onerror = () => {
			reject(new Error('Failed to load image'));
		};

		img.src = imageUrl;
	});
}

/**
 * Preprocesses multiple regions for OCR
 * Reuses a single canvas and context for efficiency
 * @param regionImageDataMap - Map of region name to ImageData
 * @param regions - Array of region definitions
 * @returns Map of region name to preprocessed ImageData
 */
export const preprocessRegionsForOCR = (
	regionImageDataMap: Map<string, ImageData>,
	regions: TextRegion[]
): Map<string, ImageData> => {
	const preprocessedMap = new Map<string, ImageData>();

	// Create canvas and context once, reuse for all regions
	const canvas = document.createElement('canvas');
	const ctx = canvas.getContext('2d', { willReadFrequently: true });

	for (const region of regions) {
		const imageData = regionImageDataMap.get(region.name);
		if (!imageData) continue;

		// Skip preprocessing for non-italic regions
		if (!ctx || !region.isItalic) {
			preprocessedMap.set(region.name, imageData);
			continue;
		}

		// Resize canvas only when needed
		if (canvas.width !== region.width || canvas.height !== region.height) {
			canvas.width = region.width;
			canvas.height = region.height;
		}

		// Apply italic correction
		const unskewed = unskewItalicText(imageData);
		ctx.putImageData(unskewed, 0, 0);

		preprocessedMap.set(region.name, ctx.getImageData(0, 0, canvas.width, canvas.height));
	}

	return preprocessedMap;
};

/**
 * Groups OCR regions by their charSet value
 * @param regions - Array of text regions to group
 * @returns Map of charSet to regions with that charSet
 */
export const groupRegionsByCharSet = (
	regions: TextRegion[]
): Map<string, TextRegion[]> => {
	const groups = new Map<string, TextRegion[]>();
	for (const region of regions) {
		const key = region.charSet || '';
		const existing = groups.get(key) || [];
		existing.push(region);
		groups.set(key, existing);
	}
	return groups;
};

/**
 * Loads an image and returns its dimensions
 * @param imageSrc - Source URL or data URL of the image
 * @returns Promise resolving to image width and height
 */
export const loadImageDimensions = (
	imageSrc: string
): Promise<{ width: number; height: number }> => {
	return new Promise<{ width: number; height: number }>((resolve, reject) => {
		const img = new Image();
		img.onload = () => resolve({ width: img.width, height: img.height });
		img.onerror = () => reject(new Error('Failed to load image'));
		img.src = imageSrc;
	});
};

/**
 * Separates regions into large groups (for scheduler) and small groups (for worker)
 * Large groups have more than SCHEDULER_JOBS_MIN regions and benefit from parallel processing
 * @param charSetGroups - Map of charSet to regions
 * @returns Object containing largeGroups and smallGroups arrays
 */
export const partitionRegionGroups = (
	charSetGroups: Map<string, TextRegion[]>
): { smallGroups: PartitionGroup[]; largeGroups: PartitionGroup[] } => {
	const entries = [...charSetGroups.entries()].map(([charSet, regions]) => ({
		charSet,
		regions,
	}));

	const { large = [], small = [] } = Object.groupBy(entries, ({ regions }) =>
		regions.length > SCHEDULER_JOBS_MIN ? 'large' : 'small'
	);

	return { largeGroups: large, smallGroups: small };
};
