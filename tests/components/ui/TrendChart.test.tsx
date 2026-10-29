import { describe, it, expect } from 'vitest';
import { render, screen } from '@solidjs/testing-library';

import type { WeeklyTrendPoint } from '#types';
import TrendChart from '#c/ui/TrendChart';

const week = (index: number, games: number, value: number | null): WeeklyTrendPoint => ({
	weekStart: new Date(2025, 0, 6 + index * 7),
	games,
	value,
});

const format = (v: number) => `${Math.round(v)}%`;

describe('TrendChart', () => {
	describe('with data', () => {
		const points = [week(0, 3, 40), week(1, 5, 60), week(2, 4, 80)];

		it('should describe the chart for assistive technology', () => {
			render(() => <TrendChart points={points} label="Win rate" format={format} />);

			const label = screen.getByRole('img').getAttribute('aria-label');
			expect(label).toContain('Win rate by week over 3 weeks');
			expect(label).toContain('latest 80%');
			expect(label).toContain('lowest 40%');
			expect(label).toContain('highest 80%');
		});

		it('should draw one point per week and a connected line', () => {
			const { container } = render(() => (
				<TrendChart points={points} label="Win rate" format={format} />
			));

			expect(container.querySelectorAll('circle')).toHaveLength(3);
			expect(container.querySelectorAll('path.trend-chart__line')).toHaveLength(1);
		});

		it('should draw a games bar per week', () => {
			const { container } = render(() => (
				<TrendChart points={points} label="Win rate" format={format} />
			));

			expect(container.querySelectorAll('rect.trend-chart__bar')).toHaveLength(3);
		});

		it('should draw the reference line only when given', () => {
			const { container, unmount } = render(() => (
				<TrendChart
					points={points}
					label="Win rate"
					format={format}
					domain={[0, 100]}
					referenceLine={50}
				/>
			));
			expect(container.querySelector('.trend-chart__reference')).not.toBeNull();
			unmount();

			const { container: other } = render(() => (
				<TrendChart points={points} label="Win rate" format={format} />
			));
			expect(other.querySelector('.trend-chart__reference')).toBeNull();
		});

		it('should label the axis with formatted values', () => {
			const { container } = render(() => (
				<TrendChart points={points} label="Win rate" format={format} domain={[0, 100]} />
			));

			const labels = Array.from(container.querySelectorAll('text')).map(
				(t) => t.textContent
			);
			expect(labels).toEqual(expect.arrayContaining(['0%', '50%', '100%']));
		});

		it('should not use inline styles', () => {
			const { container } = render(() => (
				<TrendChart points={points} label="Win rate" format={format} />
			));

			expect(container.querySelector('[style]')).toBeNull();
		});
	});

	describe('gaps', () => {
		it('should connect points across weeks without a value', () => {
			const points = [
				week(0, 2, 40),
				week(1, 2, 50),
				week(2, 0, null),
				week(3, 2, 60),
				week(4, 2, 70),
			];
			const { container } = render(() => (
				<TrendChart points={points} label="KDA" format={format} />
			));

			const solid = container.querySelector(
				'path.trend-chart__line:not(.trend-chart__line--gap)'
			);
			const gap = container.querySelector('path.trend-chart__line--gap');
			expect(solid?.getAttribute('d')?.match(/M/g)).toHaveLength(2);
			expect(gap?.getAttribute('d')?.match(/M/g)).toHaveLength(1);
			expect(container.querySelectorAll('circle')).toHaveLength(4);
		});

		it('should join isolated weeks with a dashed line', () => {
			const points = [week(0, 1, 50), week(1, 0, null), week(2, 1, 60), week(3, 0, null)];
			const { container } = render(() => (
				<TrendChart points={points} label="KDA" format={format} />
			));

			expect(container.querySelectorAll('circle')).toHaveLength(2);
			expect(
				container.querySelector('path.trend-chart__line--gap')?.getAttribute('d')
			).toMatch(/^M[\d.]+ [\d.]+ L[\d.]+ [\d.]+$/);
		});

		it('should handle a single week', () => {
			const { container } = render(() => (
				<TrendChart points={[week(0, 3, 50)]} label="KDA" format={format} />
			));

			expect(container.querySelectorAll('circle')).toHaveLength(1);
		});
	});

	describe('without data', () => {
		it('should show a message instead of a chart when no week has a value', () => {
			render(() => (
				<TrendChart points={[week(0, 0, null)]} label="KDA" format={format} />
			));

			expect(screen.getByText('No data for this period')).toBeDefined();
			expect(screen.queryByRole('img')).toBeNull();
		});

		it('should show the message for no points', () => {
			render(() => <TrendChart points={[]} label="KDA" format={format} />);

			expect(screen.getByText('No data for this period')).toBeDefined();
		});
	});
});
