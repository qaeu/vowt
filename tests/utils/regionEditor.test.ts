import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import type { DrawnRegion } from '#types';
import type { RegionEditorMode, RegionEditorOptions } from '#utils/regionEditor';
import {
	hitTestRegion,
	isSameRegion,
	startRegionEditor,
	drawRegions,
} from '#utils/regionEditor';

const region = (
	id: string,
	x: number,
	y: number,
	width: number,
	height: number
): DrawnRegion => ({ id, name: id, x, y, width, height, colour: '#f00' });

/** Image whose load completes on the next microtask, at a fixed size */
class MockImage {
	onload: (() => void) | null = null;
	onerror: (() => void) | null = null;
	width = 400;
	height = 200;
	set src(_value: string) {
		queueMicrotask(() => this.onload?.());
	}
}

const createContext = () => ({
	drawImage: vi.fn(),
	strokeRect: vi.fn(),
	fillRect: vi.fn(),
	strokeStyle: '',
	fillStyle: '',
	lineWidth: 0,
});

describe('regionEditor', () => {
	describe('hitTestRegion', () => {
		const big = region('big', 0, 0, 100, 100);
		const small = region('small', 20, 20, 10, 10);

		it('should return the region containing the point', () => {
			expect(hitTestRegion([big], 50, 50)).toBe(big);
		});

		it('should return undefined over empty space', () => {
			expect(hitTestRegion([small], 50, 50)).toBeUndefined();
			expect(hitTestRegion([], 0, 0)).toBeUndefined();
		});

		it('should include region edges', () => {
			expect(hitTestRegion([small], 20, 20)).toBe(small);
			expect(hitTestRegion([small], 30, 30)).toBe(small);
		});

		describe('overlapping regions', () => {
			it('should pick the smallest region whatever the draw order', () => {
				expect(hitTestRegion([big, small], 25, 25)).toBe(small);
				expect(hitTestRegion([small, big], 25, 25)).toBe(small);
			});

			it('should pick the larger region outside the smaller one', () => {
				expect(hitTestRegion([big, small], 60, 60)).toBe(big);
			});

			it('should pick the topmost of equally sized regions', () => {
				const first = region('first', 0, 0, 50, 50);
				const second = region('second', 25, 25, 50, 50);
				expect(hitTestRegion([first, second], 30, 30)).toBe(second);
				expect(hitTestRegion([second, first], 30, 30)).toBe(first);
			});
		});
	});

	describe('isSameRegion', () => {
		const base = { ...region('a', 1, 2, 3, 4), charSet: '0123' };

		it('should ignore the ID and colour', () => {
			const recoloured: DrawnRegion = { ...base, id: 'b', colour: '#00f' };
			expect(isSameRegion(base, recoloured)).toBe(true);
		});

		it('should detect a changed field', () => {
			expect(isSameRegion(base, { ...base, x: 9 })).toBe(false);
			expect(isSameRegion(base, { ...base, charSet: undefined })).toBe(false);
			expect(isSameRegion(base, { ...base, group: 'blue' })).toBe(false);
		});

		it('should treat NaN positions as equal', () => {
			expect(isSameRegion({ ...base, x: NaN }, { ...base, x: NaN })).toBe(true);
		});
	});

	describe('startRegionEditor', () => {
		let canvas: HTMLCanvasElement;
		let ctx: ReturnType<typeof createContext>;

		/** Dispatches a mouse event at a point in canvas pixels */
		const mouse = (type: 'mousedown' | 'mousemove' | 'mouseup', x: number, y: number) => {
			// The canvas is displayed at half size, see getBoundingClientRect below
			canvas.dispatchEvent(new MouseEvent(type, { clientX: x / 2, clientY: y / 2 }));
		};

		const drag = (x1: number, y1: number, x2: number, y2: number) => {
			mouse('mousedown', x1, y1);
			mouse('mousemove', x2, y2);
			mouse('mouseup', x2, y2);
		};

		/** Starts the editor and waits for its image to load */
		const start = async (
			onComplete: (region: DrawnRegion) => void,
			options?: RegionEditorOptions
		) => {
			const done = startRegionEditor(canvas, 'image.png', onComplete, options);
			await vi.waitFor(() => expect(canvas.width).toBe(400));
			// Wrapped, since the editor's promise only settles on Escape
			return { done };
		};

		beforeEach(() => {
			vi.stubGlobal('Image', MockImage);
			canvas = document.createElement('canvas');
			ctx = createContext();
			vi.spyOn(canvas, 'getContext').mockReturnValue(
				ctx as unknown as CanvasRenderingContext2D
			);
			vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
				left: 0,
				top: 0,
				width: 200,
				height: 100,
			} as DOMRect);
		});

		afterEach(() => {
			vi.unstubAllGlobals();
			vi.restoreAllMocks();
		});

		it('should draw the image and initial regions', async () => {
			await start(vi.fn(), { initialRegions: [region('a', 1, 2, 3, 4)] });

			expect(ctx.drawImage).toHaveBeenCalled();
			expect(ctx.strokeRect).toHaveBeenCalledWith(1, 2, 3, 4);
		});

		describe('draw mode', () => {
			it('should draw by default and report the region in canvas pixels', async () => {
				const onComplete = vi.fn();
				await start(onComplete);

				drag(100, 40, 20, 140);

				expect(onComplete).toHaveBeenCalledWith(
					expect.objectContaining({ x: 20, y: 40, width: 80, height: 100 })
				);
			});

			it('should ignore tiny drags', async () => {
				const onComplete = vi.fn();
				await start(onComplete, { mode: () => 'draw' });

				drag(10, 10, 14, 30);

				expect(onComplete).not.toHaveBeenCalled();
			});

			it('should give each drawn region a new ID', async () => {
				const onComplete = vi.fn();
				await start(onComplete, { mode: () => 'draw' });

				drag(0, 0, 20, 20);
				drag(40, 40, 80, 80);

				expect(onComplete.mock.calls.map(([r]) => r.id)).toEqual(['drawn-0', 'drawn-1']);
			});

			it('should not select regions', async () => {
				const onSelect = vi.fn();
				await start(vi.fn(), {
					mode: () => 'draw',
					getRegions: () => [region('a', 0, 0, 100, 100)],
					onRegionSelect: onSelect,
				});

				drag(10, 10, 50, 50);

				expect(onSelect).not.toHaveBeenCalled();
			});
		});

		describe('select mode', () => {
			const regions = [region('big', 0, 0, 200, 200), region('small', 40, 40, 20, 20)];

			it('should select the clicked region instead of drawing', async () => {
				const onComplete = vi.fn();
				const onSelect = vi.fn();
				await start(onComplete, {
					mode: () => 'select',
					getRegions: () => regions,
					onRegionSelect: onSelect,
				});

				drag(100, 100, 180, 180);

				expect(onSelect).toHaveBeenCalledWith('big');
				expect(onComplete).not.toHaveBeenCalled();
			});

			it('should select the smallest of overlapping regions', async () => {
				const onSelect = vi.fn();
				await start(vi.fn(), {
					mode: () => 'select',
					getRegions: () => regions,
					onRegionSelect: onSelect,
				});

				mouse('mousedown', 50, 50);

				expect(onSelect).toHaveBeenCalledWith('small');
			});

			it('should clear the selection over empty space', async () => {
				const onSelect = vi.fn();
				await start(vi.fn(), {
					mode: () => 'select',
					getRegions: () => regions,
					onRegionSelect: onSelect,
				});

				mouse('mousedown', 300, 50);

				expect(onSelect).toHaveBeenCalledWith(null);
			});

			it('should hit-test the regions current at click time', async () => {
				let current = [regions[1]];
				const onSelect = vi.fn();
				await start(vi.fn(), {
					mode: () => 'select',
					getRegions: () => current,
					onRegionSelect: onSelect,
				});

				current = [regions[0]];
				mouse('mousedown', 100, 100);

				expect(onSelect).toHaveBeenCalledWith('big');
			});

			it('should fall back to the initial regions', async () => {
				const onSelect = vi.fn();
				await start(vi.fn(), {
					initialRegions: regions,
					mode: () => 'select',
					onRegionSelect: onSelect,
				});

				mouse('mousedown', 45, 45);

				expect(onSelect).toHaveBeenCalledWith('small');
			});

			it('should flag the canvas while hovering a region', async () => {
				await start(vi.fn(), { mode: () => 'select', getRegions: () => regions });

				mouse('mousemove', 50, 50);
				expect(canvas.classList.contains('region-editor--hover')).toBe(true);

				mouse('mousemove', 300, 50);
				expect(canvas.classList.contains('region-editor--hover')).toBe(false);
			});
		});

		it('should follow mode changes after starting', async () => {
			let mode: RegionEditorMode = 'select';
			const onComplete = vi.fn();
			const onSelect = vi.fn();
			await start(onComplete, {
				mode: () => mode,
				getRegions: () => [region('a', 0, 0, 100, 100)],
				onRegionSelect: onSelect,
			});

			drag(10, 10, 50, 50);
			expect(onSelect).toHaveBeenCalledTimes(1);
			expect(onComplete).not.toHaveBeenCalled();

			mode = 'draw';
			drag(10, 10, 50, 50);
			expect(onSelect).toHaveBeenCalledTimes(1);
			expect(onComplete).toHaveBeenCalledTimes(1);
		});

		it('should stop listening and resolve on Escape', async () => {
			const onComplete = vi.fn();
			const { done } = await start(onComplete);

			canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
			await expect(done).resolves.toBeUndefined();

			drag(0, 0, 50, 50);
			expect(onComplete).not.toHaveBeenCalled();
		});
	});

	describe('drawRegions', () => {
		let canvas: HTMLCanvasElement;
		let ctx: ReturnType<typeof createContext>;

		const regions = [region('a', 10, 10, 40, 20), region('b', 100, 100, 30, 30)];

		beforeEach(() => {
			vi.stubGlobal('Image', MockImage);
			canvas = document.createElement('canvas');
			ctx = createContext();
			vi.spyOn(canvas, 'getContext').mockReturnValue(
				ctx as unknown as CanvasRenderingContext2D
			);
		});

		afterEach(() => {
			vi.unstubAllGlobals();
			vi.restoreAllMocks();
		});

		it('should outline every region without handles', async () => {
			drawRegions(canvas, regions, 'image.png');

			await vi.waitFor(() => expect(ctx.strokeRect).toHaveBeenCalledTimes(2));
			expect(ctx.fillRect).not.toHaveBeenCalled();
		});

		it('should highlight the selected region with eight handles', async () => {
			drawRegions(canvas, regions, 'image.png', 'b');

			await vi.waitFor(() => expect(ctx.fillRect).toHaveBeenCalledTimes(8));
			// Two outlines, the heavier selected outline, then a stroke per handle
			expect(ctx.strokeRect).toHaveBeenCalledTimes(2 + 1 + 8);
			expect(ctx.strokeRect).toHaveBeenNthCalledWith(3, 100, 100, 30, 30);
			expect(ctx.fillRect).toHaveBeenCalledWith(96, 96, 8, 8);
			expect(ctx.fillRect).toHaveBeenCalledWith(126, 126, 8, 8);
		});

		it('should ignore a selected ID that is not drawn', async () => {
			drawRegions(canvas, regions, 'image.png', 'missing');

			await vi.waitFor(() => expect(ctx.strokeRect).toHaveBeenCalledTimes(2));
			expect(ctx.fillRect).not.toHaveBeenCalled();
		});
	});
});
