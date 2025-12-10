import type { Component, JSXElement } from 'solid-js';
import { For, Show } from 'solid-js';

import type { ScreenAction } from '#types';
import { AlertDialog } from '#c/ui/AlertDialog';

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
							<Show
								when={action.dialog}
								fallback={
									<button
										id={action.id}
										class={action.class}
										disabled={action.disabled?.()}
										onClick={action.onClick}
									>
										{action.text}
									</button>
								}
							>
								<AlertDialog
									id={action.id}
									class={action.class}
									disabled={action.disabled?.()}
									triggerText={action.text}
									title={action.dialog!.title}
									description={action.dialog!.description}
									actionText={action.dialog!.actionText}
									condition={action.dialog!.condition || (() => true)}
									onConfirm={action.dialog!.onConfirm || (() => undefined)}
								/>
							</Show>
						)}
					</For>
				</nav>
			</header>

			<section class="button-group screen-actions">
				<For each={props.screenActions?.()}>
					{(action) => (
						<Show
							when={action.dialog}
							fallback={
								<button
									id={action.id}
									class={action.class}
									disabled={action.disabled?.()}
									onClick={action.onClick}
								>
									{action.text}
								</button>
							}
						>
							<AlertDialog
								id={action.id}
								class={action.class}
								disabled={action.disabled?.()}
								triggerText={action.text}
								title={action.dialog!.title}
								description={action.dialog!.description}
								actionText={action.dialog!.actionText}
								condition={action.dialog!.condition || (() => true)}
								onConfirm={action.dialog!.onConfirm || (() => undefined)}
							/>
						</Show>
					)}
				</For>
			</section>

			<main>{props.children}</main>
		</div>
	);
};

export default Screen;
