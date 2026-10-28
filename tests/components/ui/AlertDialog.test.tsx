import { describe, it, expect, vi, beforeEach, assert } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@solidjs/testing-library';

import type { AlertDialogOptions } from '#types';
import AlertDialog from '#c/ui/AlertDialog';

describe('AlertDialog', () => {
	let openDialogFn: ((options: AlertDialogOptions) => void) | null = null;

	beforeEach(() => {
		openDialogFn = null;
	});

	const captureOpenDialog = (fn: (options: AlertDialogOptions) => void) => {
		openDialogFn = fn;
	};

	describe('Rendering', () => {
		it('should not render dialog initially', () => {
			render(() => <AlertDialog openDialog={captureOpenDialog} />);

			expect(screen.queryByRole('dialog')).toBeNull();
		});

		it('should render dialog when opened with title and description', async () => {
			render(() => <AlertDialog openDialog={captureOpenDialog} />);

			const options: AlertDialogOptions = {
				title: 'Test Title',
				description: 'Test Description',
				onConfirm: vi.fn(),
			};

			openDialogFn?.(options);

			await waitFor(() => {
				expect(screen.getByText('Test Title')).toBeDefined();
				expect(screen.getByText('Test Description')).toBeDefined();
			});
		});

		it('should display default action text "Confirm" when actionText is not provided', async () => {
			render(() => <AlertDialog openDialog={captureOpenDialog} />);

			const options: AlertDialogOptions = {
				title: 'Test',
				description: 'Test',
				onConfirm: vi.fn(),
			};

			openDialogFn?.(options);

			await waitFor(() => {
				const button = screen.getByText('Confirm');
				expect(button).toBeDefined();
			});
		});

		it('should display custom action text when actionText is provided', async () => {
			render(() => <AlertDialog openDialog={captureOpenDialog} />);

			const options: AlertDialogOptions = {
				title: 'Delete Item',
				description: 'Are you sure?',
				actionText: 'Delete',
				onConfirm: vi.fn(),
			};

			openDialogFn?.(options);

			await waitFor(() => {
				const button = screen.getByText('Delete');
				expect(button).toBeDefined();
			});
		});

		it('should render close button', async () => {
			render(() => <AlertDialog openDialog={captureOpenDialog} />);

			const options: AlertDialogOptions = {
				title: 'Test',
				description: 'Test',
				onConfirm: vi.fn(),
			};

			openDialogFn?.(options);

			const closeButton = document.querySelector('[data-part="close-trigger"]');
			assert(closeButton, 'Could not find close button');

			await waitFor(() => {
				expect(closeButton).toBeDefined();
			});
		});
	});

	describe('Interactions', () => {
		it('should call onConfirm callback when confirm button is clicked', async () => {
			const onConfirm = vi.fn();
			render(() => <AlertDialog openDialog={captureOpenDialog} />);

			const options: AlertDialogOptions = {
				title: 'Confirm Action',
				description: 'Are you sure?',
				onConfirm,
			};

			openDialogFn?.(options);

			await waitFor(() => {
				const confirmButton = screen.getByText('Confirm');
				fireEvent.click(confirmButton);
			});

			expect(onConfirm).toHaveBeenCalledOnce();
		});

		it('should close dialog after confirm button is clicked', async () => {
			const onConfirm = vi.fn();
			render(() => <AlertDialog openDialog={captureOpenDialog} />);

			const options: AlertDialogOptions = {
				title: 'Test',
				description: 'Test',
				onConfirm,
			};

			openDialogFn?.(options);

			await waitFor(() => {
				const confirmButton = screen.getByText('Confirm');
				fireEvent.click(confirmButton);
			});

			await waitFor(() => {
				expect(screen.queryByRole('dialog')).toBeNull();
			});
		});

		it('should close dialog when close button is clicked', async () => {
			render(() => <AlertDialog openDialog={captureOpenDialog} />);

			const options: AlertDialogOptions = {
				title: 'Test',
				description: 'Test',
				onConfirm: vi.fn(),
			};

			openDialogFn?.(options);

			const closeButton = document.querySelector('[data-part="close-trigger"]');
			assert(closeButton, 'Could not find close button');

			await waitFor(() => {
				fireEvent.click(closeButton);
			});

			await waitFor(() => {
				expect(screen.queryByRole('dialog')).toBeNull();
			});
		});

		it('should not call onConfirm when close button is clicked', async () => {
			const onConfirm = vi.fn();
			render(() => <AlertDialog openDialog={captureOpenDialog} />);

			const options: AlertDialogOptions = {
				title: 'Test',
				description: 'Test',
				onConfirm,
			};

			openDialogFn?.(options);

			const closeButton = document.querySelector('[data-part="close-trigger"]');
			assert(closeButton, 'Could not find close button');

			await waitFor(() => {
				fireEvent.click(closeButton);
			});

			expect(onConfirm).not.toHaveBeenCalled();
		});

		it('should handle multiple dialog opens with different options', async () => {
			render(() => <AlertDialog openDialog={captureOpenDialog} />);

			// First dialog
			const options1: AlertDialogOptions = {
				title: 'First Dialog',
				description: 'First Description',
				onConfirm: vi.fn(),
			};

			openDialogFn?.(options1);

			await waitFor(() => {
				expect(screen.getByText('First Dialog')).toBeDefined();
			});

			// Close it
			const closeButton = document.querySelector('[data-part="close-trigger"]');
			assert(closeButton, 'Could not find close button');

			fireEvent.click(closeButton);

			await waitFor(() => {
				expect(screen.queryByRole('dialog')).toBeNull();
			});

			// Second dialog
			const options2: AlertDialogOptions = {
				title: 'Second Dialog',
				description: 'Second Description',
				actionText: 'Accept',
				onConfirm: vi.fn(),
			};

			openDialogFn?.(options2);

			await waitFor(() => {
				expect(screen.getByText('Second Dialog')).toBeDefined();
				expect(screen.getByText('Second Description')).toBeDefined();
				expect(screen.getByText('Accept')).toBeDefined();
			});
		});
	});

	describe('Cancel button', () => {
		const open = async (options: Partial<AlertDialogOptions> = {}) => {
			render(() => <AlertDialog openDialog={captureOpenDialog} />);
			openDialogFn?.({ title: 'Test', description: 'Test', ...options });
			await screen.findByRole('dialog');
		};

		it('should close without calling onConfirm when Cancel is clicked', async () => {
			const onConfirm = vi.fn();
			await open({ onConfirm });

			fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

			await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
			expect(onConfirm).not.toHaveBeenCalled();
		});

		it('should use cancelText when provided', async () => {
			await open({ onConfirm: vi.fn(), cancelText: 'Keep it' });

			expect(screen.getByRole('button', { name: 'Keep it' })).toBeDefined();
			expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull();
		});

		it('should not render Cancel when onConfirm is absent', async () => {
			await open();

			expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull();
		});

		it('should default the action text to "Close" when onConfirm is absent', async () => {
			await open();

			expect(screen.getByRole('button', { name: 'Close' })).toBeDefined();
		});
	});

	describe('Tone', () => {
		const actionButton = () => document.querySelector('.dialog-action');

		it('should style the action as primary by default', async () => {
			render(() => <AlertDialog openDialog={captureOpenDialog} />);
			openDialogFn?.({ title: 'Test', description: 'Test', onConfirm: vi.fn() });
			await screen.findByRole('dialog');

			expect(actionButton()?.classList.contains('primary')).toBe(true);
			expect(actionButton()?.classList.contains('danger')).toBe(false);
		});

		it('should add the danger class for the danger tone', async () => {
			render(() => <AlertDialog openDialog={captureOpenDialog} />);
			openDialogFn?.({
				title: 'Test',
				description: 'Test',
				tone: 'danger',
				onConfirm: vi.fn(),
			});
			await screen.findByRole('dialog');

			expect(actionButton()?.classList.contains('primary')).toBe(true);
			expect(actionButton()?.classList.contains('danger')).toBe(true);
		});
	});

	describe('Event Propagation', () => {
		it('should stop propagation on confirm button click', async () => {
			const onConfirm = vi.fn();
			render(() => <AlertDialog openDialog={captureOpenDialog} />);

			const options: AlertDialogOptions = {
				title: 'Test',
				description: 'Test',
				onConfirm,
			};

			openDialogFn?.(options);

			await waitFor(() => {
				const confirmButton = screen.getByText('Confirm');
				const event = new MouseEvent('click', { bubbles: true, cancelable: true });
				const stopPropagationSpy = vi.spyOn(event, 'stopPropagation');

				fireEvent(confirmButton, event);

				expect(stopPropagationSpy).toHaveBeenCalled();
			});
		});
	});

	describe('Extra Content', () => {
		it('should render extra content below the description', async () => {
			render(() => <AlertDialog openDialog={captureOpenDialog} />);

			openDialogFn?.({
				title: 'With Content',
				description: 'Test',
				content: () => <p data-testid="extra-content">Extra</p>,
			});

			expect(await screen.findByTestId('extra-content')).toBeDefined();
		});

		it('should not render a content wrapper without content', async () => {
			render(() => <AlertDialog openDialog={captureOpenDialog} />);

			openDialogFn?.({ title: 'No Content', description: 'Test' });

			await screen.findByText('No Content');
			expect(document.querySelector('.dialog-content')).toBeNull();
		});
	});

	describe('Optional Callbacks', () => {
		it('should handle missing onConfirm callback gracefully', async () => {
			render(() => <AlertDialog openDialog={captureOpenDialog} />);

			const options: AlertDialogOptions = {
				title: 'No Callback',
				description: 'Test',
			};

			openDialogFn?.(options);

			await waitFor(() => {
				const closeButton = screen.getByRole('button', { name: 'Close' });
				expect(() => fireEvent.click(closeButton)).not.toThrow();
			});

			await waitFor(() => {
				expect(screen.queryByRole('dialog')).toBeNull();
			});
		});
	});
});
