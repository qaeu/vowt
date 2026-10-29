/**
 * Interactive region editor for selecting, drawing and identifying scoreboard regions
 */

import type { DrawnRegion, TextRegion } from '#types';

/**
 * - 'select': a click picks the region under the pointer (see hitTestRegion)
 * - 'draw': click and drag draws a new region
 */
export type RegionEditorMode = 'select' | 'draw';

export interface RegionEditorOptions {
	/** Regions drawn when the image first loads */
	initialRegions?: DrawnRegion[];
	/** Current mode; read on every pointer event so it can change at any time. Defaults to 'draw' */
	mode?: () => RegionEditorMode;
	/** Regions that can be selected; read on every click. Defaults to initialRegions */
	getRegions?: () => DrawnRegion[];
	/** Called in select mode with the clicked region's ID, or null for empty space */
	onRegionSelect?: (id: string | null) => void;
	/** Stops the editor when aborted, e.g. before restarting it on a new image */
	signal?: AbortSignal;
}

const REGION_COLOUR_NEW = '#FF0000';
const REGION_LINE_WIDTH = 2;
const SELECTED_LINE_WIDTH = 3;
const HANDLE_SIZE = 8;
const HANDLE_FILL = '#FFFFFF';
/** Drags smaller than this, in canvas pixels, are ignored */
const MIN_DRAW_SIZE = 5;
/** Class set on the canvas while a selectable region is under the pointer */
const HOVER_CLASS = 'region-editor--hover';

const TEXT_REGION_KEYS: (keyof TextRegion)[] = [
	'name',
	'x',
	'y',
	'width',
	'height',
	'charSet',
	'isItalic',
	'isolateText',
	'imgHashSet',
	'group',
	'row',
];

function drawRegion(ctx: CanvasRenderingContext2D, r: DrawnRegion): void {
	ctx.strokeStyle = r.colour;
	ctx.lineWidth = REGION_LINE_WIDTH;
	ctx.strokeRect(r.x, r.y, r.width, r.height);
}

/** Outlines a region more heavily and adds handles at its corners and edge midpoints */
function drawSelectedRegion(ctx: CanvasRenderingContext2D, r: DrawnRegion): void {
	ctx.strokeStyle = r.colour;
	ctx.lineWidth = SELECTED_LINE_WIDTH;
	ctx.strokeRect(r.x, r.y, r.width, r.height);

	ctx.fillStyle = HANDLE_FILL;
	ctx.lineWidth = 1;
	const half = HANDLE_SIZE / 2;
	for (const hx of [r.x, r.x + r.width / 2, r.x + r.width]) {
		for (const hy of [r.y, r.y + r.height / 2, r.y + r.height]) {
			if (hx === r.x + r.width / 2 && hy === r.y + r.height / 2) continue;
			ctx.fillRect(hx - half, hy - half, HANDLE_SIZE, HANDLE_SIZE);
			ctx.strokeRect(hx - half, hy - half, HANDLE_SIZE, HANDLE_SIZE);
		}
	}
}

/**
 * Finds the region under a point, in canvas pixels.
 * When regions overlap the smallest one wins, so a small region inside a large one can
 * still be picked. Regions of equal area resolve to the one drawn last (topmost).
 * @param regions - Regions to test, in draw order
 * @param x - Point X in canvas pixels
 * @param y - Point Y in canvas pixels
 * @returns The hit region, or undefined when the point is over empty space
 */
export function hitTestRegion(
	regions: DrawnRegion[],
	x: number,
	y: number
): DrawnRegion | undefined {
	let hit: DrawnRegion | undefined;
	let hitArea = Infinity;

	for (const r of regions) {
		const inside = x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height;
		if (!inside) continue;

		const area = r.width * r.height;
		if (area <= hitArea) {
			hit = r;
			hitArea = area;
		}
	}

	return hit;
}

/**
 * Compares the text-region fields of two regions, ignoring editor-only ID and colour
 * @returns true when every TextRegion field matches
 */
export function isSameRegion(a: TextRegion, b: TextRegion): boolean {
	return TEXT_REGION_KEYS.every((key) => Object.is(a[key], b[key]));
}

/**
 * Makes a canvas interactive for selecting regions or drawing new ones
 * @param canvasElement - Canvas element to draw on
 * @param imageUrl - URL of the image to draw regions on
 * @param onRegionComplete - Callback when a region is drawn in draw mode
 * @param options - Initial regions, mode and selection callbacks
 * @returns Promise that resolves when the editor is stopped with Escape or the signal
 */
export async function startRegionEditor(
	canvasElement: HTMLCanvasElement,
	imageUrl: string | null,
	onRegionComplete: (region: DrawnRegion) => void,
	options: RegionEditorOptions = {}
): Promise<void> {
	const { initialRegions = [], onRegionSelect, signal } = options;
	const getMode = options.mode ?? (() => 'draw' as const);
	const getRegions = options.getRegions ?? (() => initialRegions);

	return new Promise((resolve, reject) => {
		if (signal?.aborted) {
			resolve();
			return;
		}

		const img = new Image();

		img.onload = () => {
			// Aborted while the image was loading
			if (signal?.aborted) {
				resolve();
				return;
			}

			const ctx = canvasElement.getContext('2d');
			if (!ctx) {
				reject(new Error('Failed to get canvas context'));
				return;
			}

			canvasElement.width = img.width;
			canvasElement.height = img.height;

			// Draw the image and any initial regions
			ctx.drawImage(img, 0, 0);
			initialRegions.forEach((r) => drawRegion(ctx, r));

			let isDrawing = false;
			let startX = 0;
			let startY = 0;
			let regionCount = 0;

			const redrawImage = () => {
				ctx.drawImage(img, 0, 0);
			};

			/** Maps a mouse event to canvas pixel coordinates */
			const toCanvasPoint = (e: MouseEvent) => {
				const rect = canvasElement.getBoundingClientRect();
				const scaleX = canvasElement.width / rect.width;
				const scaleY = canvasElement.height / rect.height;
				return {
					x: (e.clientX - rect.left) * scaleX,
					y: (e.clientY - rect.top) * scaleY,
				};
			};

			const handleMouseDown = (e: MouseEvent) => {
				const point = toCanvasPoint(e);

				if (getMode() === 'select') {
					const hit = hitTestRegion(getRegions(), point.x, point.y);
					onRegionSelect?.(hit?.id ?? null);
					return;
				}

				startX = point.x;
				startY = point.y;
				isDrawing = true;
			};

			const handleMouseMove = (e: MouseEvent) => {
				const point = toCanvasPoint(e);

				if (!isDrawing) {
					const hovering =
						getMode() === 'select'
						&& hitTestRegion(getRegions(), point.x, point.y) !== undefined;
					canvasElement.classList.toggle(HOVER_CLASS, hovering);
					return;
				}

				// Redraw the image with the rectangle being drawn
				redrawImage();
				ctx.strokeStyle = REGION_COLOUR_NEW;
				ctx.lineWidth = REGION_LINE_WIDTH;
				ctx.strokeRect(startX, startY, point.x - startX, point.y - startY);
			};

			const handleMouseUp = (e: MouseEvent) => {
				if (!isDrawing) return;
				isDrawing = false;

				const end = toCanvasPoint(e);
				const x = Math.min(startX, end.x);
				const y = Math.min(startY, end.y);
				const width = Math.abs(end.x - startX);
				const height = Math.abs(end.y - startY);

				if (width > MIN_DRAW_SIZE && height > MIN_DRAW_SIZE) {
					const region: DrawnRegion = {
						id: `drawn-${regionCount}`,
						name: `region_${regionCount}`,
						x: Math.round(x),
						y: Math.round(y),
						width: Math.round(width),
						height: Math.round(height),
						colour: REGION_COLOUR_NEW,
					};

					regionCount++;
					redrawImage();
					onRegionComplete(region);
				}
			};

			const stop = () => {
				canvasElement.removeEventListener('mousedown', handleMouseDown);
				canvasElement.removeEventListener('mousemove', handleMouseMove);
				canvasElement.removeEventListener('mouseup', handleMouseUp);
				canvasElement.removeEventListener('keydown', handleKeyDown);
				canvasElement.classList.remove(HOVER_CLASS);
				signal?.removeEventListener('abort', stop);
				resolve();
			};

			const handleKeyDown = (e: KeyboardEvent) => {
				if (e.key === 'Escape') stop();
			};

			signal?.addEventListener('abort', stop);

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
 * @param selectedId - ID of a region to highlight with handles
 */
export function drawRegions(
	canvasElement: HTMLCanvasElement,
	regions: DrawnRegion[],
	imgSrc: string,
	selectedId: string | null = null
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

		// Draw the selection last so its handles sit above neighbouring outlines
		const selected = selectedId ? regions.find((r) => r.id === selectedId) : undefined;
		if (selected) drawSelectedRegion(ctx, selected);
	};

	img.onerror = () => {
		console.error('Failed to load image for drawRegions');
	};

	img.src = imgSrc;
}
