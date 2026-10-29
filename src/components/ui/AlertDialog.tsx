import type { Component } from 'solid-js';
import { createSignal, onMount, Show } from 'solid-js';
import { Portal } from 'solid-js/web';
import { Dialog } from '@ark-ui/solid/dialog';
import { X } from 'lucide-solid';

import type { AlertDialogOptions } from '#types';

interface AlertDialogProps {
	openDialog: (fn: (options: AlertDialogOptions) => void) => void;
}

const AlertDialog: Component<AlertDialogProps> = (props) => {
	const [open, setOpen] = createSignal(false);
	const [options, setOptions] = createSignal<AlertDialogOptions>({
		title: '',
		description: '',
		onConfirm: () => {},
	});

	// Expose openDialog function to parent
	onMount(() => {
		props.openDialog((newOptions: AlertDialogOptions) => {
			setOptions(newOptions);
			setOpen(true);
		});
	});

	const hasConfirm = () => !!options().onConfirm;
	const actionText = () => options().actionText || (hasConfirm() ? 'Confirm' : 'Close');
	const cancelText = () => options().cancelText || 'Cancel';

	const handleConfirm = (e: MouseEvent) => {
		e.stopPropagation();
		options().onConfirm?.();
		setOpen(false);
	};

	const handleCancel = (e: MouseEvent) => {
		e.stopPropagation();
		setOpen(false);
	};

	const handleContentClick = (e: MouseEvent) => {
		e.stopPropagation();
	};

	return (
		<Dialog.Root
			open={open()}
			onOpenChange={(details) => setOpen(details.open)}
			closeOnInteractOutside={true}
			preventScroll={false}
		>
			<Portal>
				<Dialog.Backdrop />
				<Dialog.Positioner>
					<Dialog.Content onClick={handleContentClick}>
						<Dialog.Title asChild={(props) => <h3 {...props()} />}>
							{options().title}
						</Dialog.Title>
						<Dialog.Description>{options().description}</Dialog.Description>
						<Show when={options().content}>
							{(content) => <div class="dialog-content">{content()()}</div>}
						</Show>
						<Dialog.CloseTrigger>
							<X size={18} />
						</Dialog.CloseTrigger>
						<div class="button-group">
							<Show when={hasConfirm()}>
								<button type="button" class="dialog-cancel" onClick={handleCancel}>
									{cancelText()}
								</button>
							</Show>
							<button
								type="button"
								class="dialog-action primary"
								classList={{ danger: options().tone === 'danger' }}
								onClick={handleConfirm}
							>
								{actionText()}
							</button>
						</div>
					</Dialog.Content>
				</Dialog.Positioner>
			</Portal>
		</Dialog.Root>
	);
};

export default AlertDialog;
