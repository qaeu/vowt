import { describe, it, expect } from 'vitest';
import { render } from '@solidjs/testing-library';

import BarMeter from '#c/ui/BarMeter';

const rects = (container: HTMLElement) =>
	Array.from(container.querySelectorAll('rect.bar-meter__segment'));

describe('BarMeter', () => {
	describe('segments', () => {
		it('should size a single segment against max', () => {
			const { container } = render(() => (
				<BarMeter segments={[{ value: 25, tone: 'success' }]} max={100} label="Test" />
			));

			const [segment] = rects(container);
			expect(segment.getAttribute('width')).toBe('25');
			expect(segment.getAttribute('x')).toBe('0');
			expect(segment.classList.contains('bar-meter__segment--success')).toBe(true);
		});

		it('should stack segments across the sum when max is omitted', () => {
			const { container } = render(() => (
				<BarMeter
					segments={[
						{ value: 1, tone: 'success' },
						{ value: 1, tone: 'neutral' },
						{ value: 2, tone: 'error' },
					]}
					label="Test"
				/>
			));

			expect(
				rects(container).map((r) => [r.getAttribute('x'), r.getAttribute('width')])
			).toEqual([
				['0', '25'],
				['25', '25'],
				['50', '50'],
			]);
		});

		it('should cap a segment that exceeds max', () => {
			const { container } = render(() => (
				<BarMeter segments={[{ value: 500, tone: 'primary' }]} max={100} />
			));

			expect(rects(container)[0].getAttribute('width')).toBe('100');
		});

		it('should draw nothing for empty or zero data', () => {
			const { container } = render(() => (
				<BarMeter segments={[{ value: 0, tone: 'primary' }]} />
			));

			expect(rects(container)[0].getAttribute('width')).toBe('0');
		});

		it('should set widths as attributes rather than inline styles', () => {
			const { container } = render(() => (
				<BarMeter segments={[{ value: 40, tone: 'primary' }]} max={100} />
			));

			expect(container.querySelector('[style]')).toBeNull();
		});
	});

	describe('marker', () => {
		it('should place the marker relative to max', () => {
			const { container } = render(() => (
				<BarMeter segments={[{ value: 70, tone: 'success' }]} max={100} marker={50} />
			));

			expect(container.querySelector('line')?.getAttribute('x1')).toBe('50');
		});

		it('should not render a marker unless asked', () => {
			const { container } = render(() => (
				<BarMeter segments={[{ value: 70, tone: 'success' }]} max={100} />
			));

			expect(container.querySelector('line')).toBeNull();
		});
	});

	describe('accessibility', () => {
		it('should expose the label as an image', () => {
			const { getByRole } = render(() => (
				<BarMeter segments={[{ value: 70, tone: 'success' }]} label="Win rate 70%" />
			));

			expect(getByRole('img', { name: 'Win rate 70%' })).toBeDefined();
		});

		it('should hide the bar when there is no label', () => {
			const { container } = render(() => (
				<BarMeter segments={[{ value: 70, tone: 'success' }]} />
			));

			const svg = container.querySelector('svg')!;
			expect(svg.getAttribute('aria-hidden')).toBe('true');
			expect(svg.getAttribute('role')).toBeNull();
		});
	});
});
