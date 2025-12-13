import { describe, it, expect, vi, beforeEach } from 'vitest';
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

			await waitFor(() => {
				const closeButton = screen.getByText('✕');
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

			await waitFor(() => {
				const closeButton = screen.getByText('✕');
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

			await waitFor(() => {
				const closeButton = screen.getByText('✕');
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
			const closeButton = screen.getByText('✕');
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

	describe('Optional Callbacks', () => {
		it('should handle missing onConfirm callback gracefully', async () => {
			render(() => <AlertDialog openDialog={captureOpenDialog} />);

			const options: AlertDialogOptions = {
				title: 'No Callback',
				description: 'Test',
			};

			openDialogFn?.(options);

			await waitFor(() => {
				const confirmButton = screen.getByText('Confirm');
				expect(() => fireEvent.click(confirmButton)).not.toThrow();
			});

			await waitFor(() => {
				expect(screen.queryByRole('dialog')).toBeNull();
			});
		});
	});
});
