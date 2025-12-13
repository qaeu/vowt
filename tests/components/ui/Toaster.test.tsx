import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@solidjs/testing-library';

import Toaster, { toast } from '#c/ui/Toaster';

describe('Toaster', () => {
	describe('Component Rendering', () => {
		it('should render the Toaster component', () => {
			const { container } = render(() => <Toaster />);
			expect(container).toBeDefined();
		});

		it('should apply custom class when provided', async () => {
			render(() => <Toaster class="custom-toaster" />);

			// Trigger a toast to make the component render
			toast('Test', 'Test');

			await waitFor(() => {
				const toastRoot = screen.getByRole('status');
				expect(toastRoot.classList.contains('custom-toaster')).toBe(true);
			});
		});

		it('should render without errors when no class is provided', () => {
			const { container } = render(() => <Toaster />);
			expect(container).toBeDefined();
		});
	});

	describe('Toast Function', () => {
		it('should not throw when called before Toaster mounts', () => {
			expect(() => {
				toast('Early Toast', 'Before mount');
			}).not.toThrow();
		});

		it('should create a toast that can be displayed', async () => {
			render(() => <Toaster />);

			toast('Test Title', 'Test Description');

			await waitFor(
				() => {
					expect(screen.getByText('Test Title')).toBeDefined();
					expect(screen.getByText('Test Description')).toBeDefined();
				},
				{ timeout: 2000 }
			);
		});

		it('should handle special characters in toast content', async () => {
			render(() => <Toaster />);

			const title = 'Special: <>&"\'';

			toast(title, 'Description');

			await waitFor(
				() => {
					expect(screen.getByText(title)).toBeDefined();
				},
				{ timeout: 2000 }
			);
		});

		it('should handle empty strings', async () => {
			render(() => <Toaster />);

			expect(() => {
				toast('', '');
			}).not.toThrow();
		});
	});

	describe('Toast Content Structure', () => {
		it('should render title as h3 element', async () => {
			render(() => <Toaster />);

			toast('Heading Toast', 'Description');

			await waitFor(
				() => {
					const heading = screen.getByText('Heading Toast');
					expect(heading.tagName.toLowerCase()).toBe('h3');
				},
				{ timeout: 2000 }
			);
		});
	});

	describe('Multiple Toaster Instances', () => {
		it('should render multiple Toaster components', () => {
			const result1 = render(() => <Toaster class="toaster-1" />);
			const result2 = render(() => <Toaster class="toaster-2" />);

			expect(result1.container).toBeDefined();
			expect(result2.container).toBeDefined();
		});
	});

	describe('Toast Module Export', () => {
		it('should export toast function', () => {
			expect(typeof toast).toBe('function');
		});

		it('should export Toaster component', () => {
			expect(typeof Toaster).toBe('function');
		});
	});
});
