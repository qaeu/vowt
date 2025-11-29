/**
 * Interactive region editor for manually drawing and identifying scoreboard regions
 */

import type { DrawnRegion } from '#types';

const REGION_COLOUR_NEW = '#FF0000';

function drawRegion(ctx: CanvasRenderingContext2D, r: DrawnRegion): void {
	ctx.strokeStyle = r.colour;
	ctx.lineWidth = 2;
	ctx.strokeRect(r.x, r.y, r.width, r.height);
}

/**
 * Creates an interactive canvas where you can draw regions by clicking and dragging
 * Coordinates are logged to console for easy copying
 * @param canvasElement - Canvas element to draw on
 * @param imageUrl - URL of the image to draw regions on
 * @param onRegionComplete - Callback when a region is completed
 * @param initialRegions - Optional initial regions to display on load
 * @returns Promise that resolves when editor is ready
 */
export async function startRegionEditor(
	canvasElement: HTMLCanvasElement,
	imageUrl: string | null,
	onRegionComplete: (region: DrawnRegion) => void,
	initialRegions?: DrawnRegion[]
): Promise<void> {
	return new Promise((resolve, reject) => {
		const img = new Image();

		img.onload = () => {
			const ctx = canvasElement.getContext('2d');
			if (!ctx) {
				reject(new Error('Failed to get canvas context'));
				return;
			}

			canvasElement.width = img.width;
			canvasElement.height = img.height;
			canvasElement.style.cursor = 'crosshair';

			// Draw the image
			ctx.drawImage(img, 0, 0);

			// Draw initial regions if provided
			if (initialRegions && initialRegions.length > 0) {
				initialRegions.forEach((r) => drawRegion(ctx, r));
			}

			let isDrawing = false;
			let startX = 0;
			let startY = 0;
			let regionCount = 0;

			const redrawImage = () => {
				ctx.drawImage(img, 0, 0);
			};

			// Calculate scale factor for coordinate mapping
			const getScaleFactors = () => {
				const rect = canvasElement.getBoundingClientRect();
				const scaleX = canvasElement.width / rect.width;
				const scaleY = canvasElement.height / rect.height;
				return { scaleX, scaleY };
			};

			const handleMouseDown = (e: MouseEvent) => {
				const rect = canvasElement.getBoundingClientRect();
				const { scaleX, scaleY } = getScaleFactors();
				startX = (e.clientX - rect.left) * scaleX;
				startY = (e.clientY - rect.top) * scaleY;
				isDrawing = true;
			};

			const handleMouseMove = (e: MouseEvent) => {
				if (!isDrawing) return;

				const rect = canvasElement.getBoundingClientRect();
				const { scaleX, scaleY } = getScaleFactors();
				const currentX = (e.clientX - rect.left) * scaleX;
				const currentY = (e.clientY - rect.top) * scaleY;

				// Redraw image
				redrawImage();

				// Draw the current rectangle being drawn
				const width = currentX - startX;
				const height = currentY - startY;

				ctx.strokeStyle = REGION_COLOUR_NEW;
				ctx.lineWidth = 2;
				ctx.strokeRect(startX, startY, width, height);
			};

			const handleMouseUp = (e: MouseEvent) => {
				if (!isDrawing) return;
				isDrawing = false;

				const rect = canvasElement.getBoundingClientRect();
				const { scaleX, scaleY } = getScaleFactors();
				const endX = (e.clientX - rect.left) * scaleX;
				const endY = (e.clientY - rect.top) * scaleY;

				const x = Math.min(startX, endX);
				const y = Math.min(startY, endY);
				const width = Math.abs(endX - startX);
				const height = Math.abs(endY - startY);

				if (width > 5 && height > 5) {
					const region: DrawnRegion = {
						id: `drawn-${regionCount}`, // TODO: match existing IDs
						name: `region_${regionCount}`,
						x: Math.round(x),
						y: Math.round(y),
						width: Math.round(width),
						height: Math.round(height),
						colour: REGION_COLOUR_NEW,
					};

					onRegionComplete(region);
					regionCount++;

					// Redraw and persist this region
					redrawImage();

					// Redraw all previous regions
					// ctx.strokeStyle = region.colour;
					// ctx.lineWidth = 2;
					// ctx.strokeRect(x, y, width, height);
				}
			};

			const handleKeyDown = (e: KeyboardEvent) => {
				if (e.key === 'Escape') {
					canvasElement.removeEventListener('mousedown', handleMouseDown);
					canvasElement.removeEventListener('mousemove', handleMouseMove);
					canvasElement.removeEventListener('mouseup', handleMouseUp);
					canvasElement.removeEventListener('keydown', handleKeyDown);
					canvasElement.style.cursor = 'default';
					resolve();
				}
			};

			canvasElement.addEventListener('mousedown', handleMouseDown);
			canvasElement.addEventListener('mousemove', handleMouseMove);
			canvasElement.addEventListener('mouseup', handleMouseUp);
			canvasElement.addEventListener('keydown', handleKeyDown);
		};

		img.onerror = () => {
			reject(new Error('Failed to load image'));
		};

		if (imageUrl) {
			img.src = imageUrl;
		}
	});
}

/**
 * Draws regions on the canvas without setting up event handlers
 * Used to redraw regions when editing an existing profile
 * @param canvasElement - Canvas element to draw on
 * @param regions - Regions to draw
 * @param imgSrc - URL of the image to display
 */
export function drawRegions(
	canvasElement: HTMLCanvasElement,
	regions: DrawnRegion[],
	imgSrc: string
) {
	const ctx = canvasElement.getContext('2d');
	if (!ctx) {
		console.error('Failed to get canvas context');
		return;
	}

	const img = new Image();
	img.onload = () => {
		ctx.drawImage(img, 0, 0);
		regions.forEach((r) => drawRegion(ctx, r));
	};

	img.onerror = () => {
		console.error('Failed to load image for drawRegions');
	};

	img.src = imgSrc;
}
