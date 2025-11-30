/**
 * Image preprocessing utilities for OCR optimization
 */

import type { TextRegion } from '#types';
import { getActiveProfile } from '#utils/regionProfiles';

const SKEW_ANGLE_DEFAULT = -14;
const REGION_COLOUR_DEFAULT = '#ff0000';
const REGION_COLOUR_ITALIC = '#4caf50';
const REGION_COLOUR_IMAGE = '#3131da';

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
	const ctx = canvas.getContext('2d', { willReadFrequently: true });

	if (!ctx) {
		return imageData;
	}

	canvas.width = imageData.width;
	canvas.height = imageData.height;

	// Put the image data on canvas
	ctx.putImageData(imageData, 0, 0);

	// Create a new canvas for the transformed image
	const outputCanvas = document.createElement('canvas');
	const outputCtx = outputCanvas.getContext('2d', { willReadFrequently: true });

	if (!outputCtx) {
		return imageData;
	}

	outputCanvas.width = imageData.width;
	outputCanvas.height = imageData.height;

	// Fill background with gray before transformation
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
 * @returns Promise resolving to a data URL of the preprocessed image
 */
export async function preprocessImageForOCR(imageUrl: string): Promise<string> {
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

			const regions = getActiveProfile(img.width, img.height);
			for (const region of regions) {
				// Extract region image data
				const regionImageData = ctx.getImageData(
					region.x,
					region.y,
					region.width,
					region.height
				);
				const imageData = preprocessRegionForOCR(regionImageData, region);
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
 * Draws italic regions with unskew visualization on the preprocessed image
 * Uses green overlay for regions to show which ones are being unskewed
 * @param imageUrl - URL of the preprocessed image
 * @param sourceImageUrl - URL of the source image to extract region data
 * @returns Promise resolving to data URL with unskew regions highlighted
 */
export async function drawRegionsOnImage(
	imageUrl: string,
	sourceImageUrl: string
): Promise<string> {
	return new Promise((resolve, reject) => {
		const img = new Image();

		img.onload = () => {
			const sourceImg = new Image();

			sourceImg.onload = () => {
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

				const regions = getActiveProfile(img.width, img.height);
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

			sourceImg.onerror = () => {
				reject(new Error('Failed to load source image'));
			};

			sourceImg.src = sourceImageUrl;
		};

		img.onerror = () => {
			reject(new Error('Failed to load image'));
		};

		img.src = imageUrl;
	});
}

/**
 * Preprocesses a specific region of the image for OCR
 * @param imageData - Region image data
 * @param region - Region definition
 * @returns Promise resolving to preprocessed region data URL
 */
function preprocessRegionForOCR(imageData: ImageData, region: TextRegion): ImageData {
	const canvas = document.createElement('canvas');
	const ctx = canvas.getContext('2d', { willReadFrequently: true });

	if (!ctx || !region.isItalic) {
		return imageData;
	}

	// Set canvas to region size
	canvas.width = region.width;
	canvas.height = region.height;

	// Put the image data on canvas
	ctx.putImageData(imageData, 0, 0);

	// Apply italic correction if needed
	if (region.isItalic) {
		imageData = unskewItalicText(imageData);
		ctx.putImageData(imageData, 0, 0);
	}

	return ctx.getImageData(0, 0, canvas.width, canvas.height);
}
