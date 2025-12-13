import type { Component } from 'solid-js';
import { Toast, Toaster as ArkToaster, createToaster } from '@ark-ui/solid/toast';

const toaster = createToaster({
	placement: 'bottom-end',
	gap: 46,
	max: 6,
	overlap: true,
	offsets: '15px',
	duration: 20000,
});

export const toast = (title: string, description: string) => {
	toaster.create({
		title,
		description,
	});
};

interface ToasterProps {
	class?: string;
}

const Toaster: Component<ToasterProps> = (props) => {
	return (
		<ArkToaster toaster={toaster}>
			{(toast) => (
				<Toast.Root class={props.class}>
					<Toast.Title asChild={(props) => <h3 {...props()} />}>
						{toast().title}
					</Toast.Title>
					<Toast.Description>{toast().description}</Toast.Description>
					<Toast.CloseTrigger>✕</Toast.CloseTrigger>
				</Toast.Root>
			)}
		</ArkToaster>
	);
};

export default Toaster;
