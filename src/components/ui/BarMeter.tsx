/**
 * Horizontal bar made of SVG rects; one segment for a single bar, several for stacked
 */

import type { Component } from 'solid-js';
import { For, Show, createMemo } from 'solid-js';

export type BarTone = 'primary' | 'success' | 'error' | 'neutral';

export interface BarMeterSegment {
	value: number;
	tone: BarTone;
}

interface BarMeterProps {
	segments: BarMeterSegment[];
	/** Value that fills the whole bar; defaults to the sum of the segments */
	max?: number;
	/** Position of a marker line, in the same units as `max` */
	marker?: number;
	/** Accessible description; omit to hide the bar from assistive technology */
	label?: string;
}

const VIEW_WIDTH = 100;
const VIEW_HEIGHT = 10;

const BarMeter: Component<BarMeterProps> = (props) => {
	const scale = createMemo(() => {
		const total = props.segments.reduce((sum, s) => sum + Math.max(s.value, 0), 0);
		return props.max !== undefined && props.max > 0 ? props.max : total;
	});

	const rects = createMemo(() => {
		const max = scale();
		let x = 0;
		return props.segments.map((segment) => {
			const width = max > 0 ? Math.min((Math.max(segment.value, 0) / max) * 100, 100) : 0;
			const rect = { x, width, tone: segment.tone };
			x += width;
			return rect;
		});
	});

	const markerX = () =>
		props.marker !== undefined && scale() > 0 ? (props.marker / scale()) * 100 : null;

	return (
		<svg
			class="bar-meter"
			viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
			preserveAspectRatio="none"
			role={props.label ? 'img' : undefined}
			aria-label={props.label}
			aria-hidden={props.label ? undefined : 'true'}
		>
			<rect
				class="bar-meter__track"
				x="0"
				y="0"
				width={VIEW_WIDTH}
				height={VIEW_HEIGHT}
			/>
			<For each={rects()}>
				{(rect) => (
					<rect
						class={`bar-meter__segment bar-meter__segment--${rect.tone}`}
						x={rect.x}
						y="0"
						width={rect.width}
						height={VIEW_HEIGHT}
					/>
				)}
			</For>
			<Show when={markerX() !== null}>
				<line
					class="bar-meter__marker"
					x1={markerX()!}
					x2={markerX()!}
					y1="0"
					y2={VIEW_HEIGHT}
				/>
			</Show>
		</svg>
	);
};

export default BarMeter;
