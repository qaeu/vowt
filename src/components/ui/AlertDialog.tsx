import { Dialog } from '@ark-ui/solid/dialog';
import { Portal } from 'solid-js/web';
import { createSignal } from 'solid-js';

interface AlertDialogProps {
	title: string;
	triggerText: string;
	description: string;
	actionText?: string;
	id?: string;
	class?: string;
	disabled?: boolean;
	condition?: () => boolean;
	onConfirm: () => void;
}

export const AlertDialog = (props: AlertDialogProps) => {
	const actionText = () => props.actionText || 'Confirm';
	const [open, setOpen] = createSignal(false);

	const handleTriggerClick = (e: MouseEvent) => {
		e.stopPropagation();
		if (props.condition?.() ?? true) {
			setOpen(true);
		}
	};

	const handleConfirm = (e: MouseEvent) => {
		e.stopPropagation();
		props.onConfirm();
		setOpen(false);
	};

	const handleContentClick = (e: MouseEvent) => {
		e.stopPropagation();
	};

	return (
		<>
			<button
				type="button"
				id={props.id}
				class={props.class}
				disabled={props.disabled}
				onClick={handleTriggerClick}
			>
				{props.triggerText}
			</button>

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
								{props.title}
							</Dialog.Title>
							<Dialog.Description>{props.description}</Dialog.Description>
							<Dialog.CloseTrigger>✕</Dialog.CloseTrigger>
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
		</>
	);
};
