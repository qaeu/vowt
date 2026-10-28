import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@solidjs/testing-library';

import AppHeader from '#c/ui/AppHeader';
import type { ViewMode } from '#c/ui/AppHeader';

const renderHeader = (viewMode: ViewMode = 'records', overrides = {}) => {
	const props = {
		onNavigate: vi.fn(),
		onUploadClick: vi.fn(),
		onToggleDarkMode: vi.fn(),
		...overrides,
	};
	render(() => <AppHeader viewMode={viewMode} isDarkMode={false} {...props} />);
	return props;
};

const navButton = (name: RegExp) =>
	screen.getByRole('button', { name }) as HTMLButtonElement;

describe('AppHeader', () => {
	describe('structure', () => {
		it('should show the wordmark and a Main navigation with three items', () => {
			renderHeader();

			expect(screen.getByText('VOWT')).toBeDefined();
			const nav = screen.getByRole('navigation', { name: 'Main' });
			expect(nav.querySelectorAll('button')).toHaveLength(3);
			expect(navButton(/History/)).toBeDefined();
			expect(navButton(/Insights/)).toBeDefined();
			expect(navButton(/Region profiles/)).toBeDefined();
		});
	});

	describe('current page', () => {
		it.each([
			['records', /History/],
			['insights', /Insights/],
			['regions', /Region profiles/],
		] as const)('should mark only the %s item with aria-current', (view, name) => {
			renderHeader(view);

			const current = document.querySelectorAll('nav [aria-current="page"]');
			expect(current).toHaveLength(1);
			expect(navButton(name).getAttribute('aria-current')).toBe('page');
		});

		it('should mark no item while the review screen is open', () => {
			renderHeader('ocr');

			expect(document.querySelector('nav [aria-current]')).toBeNull();
		});
	});

	describe('navigation', () => {
		it.each([
			[/History/, 'records'],
			[/Insights/, 'insights'],
			[/Region profiles/, 'regions'],
		] as const)('should call onNavigate with the right view for %s', (name, view) => {
			const { onNavigate } = renderHeader('ocr');

			fireEvent.click(navButton(name));

			expect(onNavigate).toHaveBeenCalledTimes(1);
			expect(onNavigate).toHaveBeenCalledWith(view);
		});
	});

	describe('actions', () => {
		it('should call onUploadClick from the primary Upload Screenshots button', () => {
			const { onUploadClick } = renderHeader();

			const upload = navButton(/Upload Screenshots/);
			expect(upload.classList.contains('primary')).toBe(true);
			fireEvent.click(upload);

			expect(onUploadClick).toHaveBeenCalledTimes(1);
		});

		it('should call onToggleDarkMode from the theme toggle', () => {
			const { onToggleDarkMode } = renderHeader();

			fireEvent.click(screen.getByLabelText('Toggle dark mode'));

			expect(onToggleDarkMode).toHaveBeenCalledTimes(1);
		});
	});
});
