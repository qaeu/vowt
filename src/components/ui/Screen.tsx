import type { Component, JSXElement } from 'solid-js';
import { For, Show } from 'solid-js';

import type { ScreenAction } from '#types';

interface ScreenProps {
	id: string;
	title: string;
	/** Short line shown under the title */
	subtitle?: string;
	/** Buttons shown on the right of the title row */
	screenActions?: () => ScreenAction[];
	children?: JSXElement;
}

const Screen: Component<ScreenProps> = (props) => {
	return (
		<div id={props.id} class="screen">
			<header>
				<div class="screen__heading">
					<h1>{props.title}</h1>
					<Show when={props.subtitle}>
						<p class="screen__subtitle">{props.subtitle}</p>
					</Show>
				</div>

				<div class="button-group screen-actions">
					<For each={props.screenActions?.()}>
						{(action) => (
							<button
								id={action.id}
								class={action.class}
								disabled={action.disabled?.()}
								onClick={action.onClick}
							>
								{action.text}
							</button>
						)}
					</For>
				</div>
			</header>

			<main>{props.children}</main>
		</div>
	);
};

export default Screen;
