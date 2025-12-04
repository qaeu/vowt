import type { Component, JSXElement } from 'solid-js';
import { For } from 'solid-js';

import type { ScreenAction } from '#types';

interface ScreenProps {
	id: string;
	title: string;
	navActions?: () => ScreenAction[];
	screenActions?: () => ScreenAction[];
	children?: JSXElement;
}

const Screen: Component<ScreenProps> = (props) => {
	return (
		<div id={props.id} class="screen">
			<header>
				<h1>{props.title}</h1>
				<nav class="button-group nav-actions">
					<For each={props.navActions?.()}>
						{(action) => (
							<button id={action.id} onClick={action.onClick} {...action.opts?.()}>
								{action.text}
							</button>
						)}
					</For>
				</nav>
			</header>

			<section class="button-group screen-actions">
				<For each={props.screenActions?.()}>
					{(action) => (
						<button id={action.id} onClick={action.onClick} {...action.opts?.()}>
							{action.text}
						</button>
					)}
				</For>
			</section>

			<main>{props.children}</main>
		</div>
	);
};

export default Screen;
