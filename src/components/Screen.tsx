import type { Component, JSXElement } from 'solid-js';
import { For } from 'solid-js';

import type { ScreenAction } from '#types';

interface ScreenProps {
	id: string;
	title: string;
	actions: () => ScreenAction[];
	children?: JSXElement;
}

const Screen: Component<ScreenProps> = (props) => {
	return (
		<div class={props.id + '-container'}>
			<header>
				<h1>{props.title}</h1>

				<div class="button-group actions">
					<For each={props.actions()}>
						{(action) => {
							const attrs = { ...action.opts?.(), id: action.id };
							return (
								<button onClick={action.onClick} {...attrs}>
									{action.text}
								</button>
							);
						}}
					</For>
				</div>
			</header>

			<main>{props.children}</main>
		</div>
	);
};

export default Screen;
