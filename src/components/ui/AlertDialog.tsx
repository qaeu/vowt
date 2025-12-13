import type { Component } from 'solid-js';
import { createSignal, onMount } from 'solid-js';
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

	const actionText = () => options().actionText || 'Confirm';

	const handleConfirm = (e: MouseEvent) => {
		e.stopPropagation();
		options().onConfirm?.();
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
						<Dialog.CloseTrigger>
							<X size={18} />
						</Dialog.CloseTrigger>
						<div class="button-group">
							<button
								type="button"
								class="dialog-action highlight"
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
