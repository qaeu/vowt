/**
 * Weekly trend line with point markers, optional reference line and games-per-week bars
 */

import type { Component } from 'solid-js';
import { For, Show, createMemo } from 'solid-js';

import type { WeeklyTrendPoint } from '#types';

interface TrendChartProps {
	points: WeeklyTrendPoint[];
	/** Metric name used in the accessible description */
	label: string;
	format: (value: number) => string;
	/** Fixed value range; defaults to 0 up to just above the highest value */
	domain?: [number, number];
	/** Value drawn as a dashed reference line (e.g. 50 for win rate) */
	referenceLine?: number;
}

interface WeekLabel {
	x: number;
	text: string;
	anchor: 'start' | 'middle' | 'end';
}

const WIDTH = 640;
const HEIGHT = 220;
const PAD = { left: 48, right: 12, top: 12, bottom: 34 };
const PLOT_WIDTH = WIDTH - PAD.left - PAD.right;
const PLOT_HEIGHT = HEIGHT - PAD.top - PAD.bottom;
const BASELINE = PAD.top + PLOT_HEIGHT;
const MAX_BAR_HEIGHT = PLOT_HEIGHT * 0.18;
const MAX_BAR_WIDTH = 24;
const DOMAIN_HEADROOM = 1.1;

const formatWeek = (date: Date) =>
	date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

const TrendChart: Component<TrendChartProps> = (props) => {
	const values = createMemo(() =>
		props.points.map((p) => p.value).filter((v): v is number => v !== null)
	);

	const domain = createMemo<[number, number]>(() => {
		if (props.domain) return props.domain;
		const max = Math.max(0, ...values()) * DOMAIN_HEADROOM;
		return [0, max > 0 ? max : 1];
	});

	const x = (index: number) =>
		props.points.length === 1 ?
			PAD.left + PLOT_WIDTH / 2
		:	PAD.left + (index * PLOT_WIDTH) / (props.points.length - 1);

	const y = (value: number) => {
		const [min, max] = domain();
		const clamped = Math.min(Math.max(value, min), max);
		return PAD.top + PLOT_HEIGHT - ((clamped - min) / (max - min)) * PLOT_HEIGHT;
	};

	/** Weeks that have a value, as chart coordinates */
	const plotted = createMemo(() =>
		props.points.flatMap((point, i) =>
			point.value === null ? [] : [{ index: i, x: x(i), y: y(point.value) }]
		)
	);

	/** Line segments between plotted weeks; bridged ones skip weeks without a value */
	const segmentPath = (bridged: boolean) =>
		plotted()
			.slice(1)
			.map((to, i) => ({ from: plotted()[i], to }))
			.filter(({ from, to }) => to.index - from.index > 1 === bridged)
			.map(({ from, to }) => `M${from.x} ${from.y} L${to.x} ${to.y}`)
			.join(' ');

	const ticks = createMemo(() => {
		const [min, max] = domain();
		return [min, (min + max) / 2, max];
	});

	const bars = createMemo(() => {
		const maxGames = Math.max(1, ...props.points.map((p) => p.games));
		const width = Math.min(MAX_BAR_WIDTH, (PLOT_WIDTH / props.points.length) * 0.6);
		return props.points.map((p, i) => {
			const height = (p.games / maxGames) * MAX_BAR_HEIGHT;
			return { x: x(i) - width / 2, y: BASELINE - height, width, height };
		});
	});

	const weekLabels = createMemo(() => {
		const last = props.points.length - 1;
		if (last < 0) return [];
		const indices = [...new Set([0, Math.floor(last / 2), last])];
		return indices.map((i): WeekLabel => ({
			x: x(i),
			text: formatWeek(props.points[i].weekStart),
			anchor:
				i === 0 && last > 0 ? 'start'
				: i === last && last > 0 ? 'end'
				: 'middle',
		}));
	});

	const description = createMemo(() => {
		const vs = values();
		if (!vs.length) return `${props.label} by week: no data`;
		const latest = vs[vs.length - 1];
		return (
			`${props.label} by week over ${props.points.length} weeks: latest `
			+ `${props.format(latest)}, lowest ${props.format(Math.min(...vs))}, `
			+ `highest ${props.format(Math.max(...vs))}`
		);
	});

	return (
		<Show
			when={values().length > 0}
			fallback={<p class="trend-chart__empty">No data for this period</p>}
		>
			<svg
				class="trend-chart"
				viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
				role="img"
				aria-label={description()}
			>
				<For each={ticks()}>
					{(tick) => (
						<>
							<line
								class="trend-chart__grid"
								x1={PAD.left}
								x2={WIDTH - PAD.right}
								y1={y(tick)}
								y2={y(tick)}
							/>
							<text
								class="trend-chart__axis-label"
								x={PAD.left - 6}
								y={y(tick) + 4}
								text-anchor="end"
							>
								{props.format(tick)}
							</text>
						</>
					)}
				</For>
				<Show when={props.referenceLine !== undefined}>
					<line
						class="trend-chart__reference"
						x1={PAD.left}
						x2={WIDTH - PAD.right}
						y1={y(props.referenceLine!)}
						y2={y(props.referenceLine!)}
					/>
				</Show>
				<For each={bars()}>
					{(bar) => (
						<rect
							class="trend-chart__bar"
							x={bar.x}
							y={bar.y}
							width={bar.width}
							height={bar.height}
						/>
					)}
				</For>
				<Show when={segmentPath(false)}>
					{(d) => <path class="trend-chart__line" d={d()} />}
				</Show>
				<Show when={segmentPath(true)}>
					{(d) => <path class="trend-chart__line trend-chart__line--gap" d={d()} />}
				</Show>
				<For each={plotted()}>
					{(p) => <circle class="trend-chart__point" cx={p.x} cy={p.y} r="3.5" />}
				</For>
				<For each={weekLabels()}>
					{(label) => (
						<text
							class="trend-chart__axis-label"
							x={label.x}
							y={HEIGHT - 10}
							text-anchor={label.anchor}
						>
							{label.text}
						</text>
					)}
				</For>
			</svg>
		</Show>
	);
};

export default TrendChart;
