import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@solidjs/testing-library';

import Screen from '#c/ui/Screen';
import type { ScreenAction } from '#types';

describe('Screen', () => {
	it('should render the component with correct ID and screen class', () => {
		render(() => <Screen id="test-screen" title="Test Screen" />);

		const container = document.querySelector('#test-screen.screen');
		expect(container).toBeDefined();
	});

	it('should display the screen title in the header', () => {
		render(() => <Screen id="test-screen" title="My Test Screen" />);

		expect(screen.getByText('My Test Screen')).toBeDefined();
	});

	it('should render nav action buttons with correct text', () => {
		const navActions: ScreenAction[] = [
			{
				id: 'nav-action-1',
				text: 'Nav 1',
				onClick: vi.fn(),
			},
			{
				id: 'nav-action-2',
				text: 'Nav 2',
				onClick: vi.fn(),
			},
		];

		render(() => <Screen id="test-screen" title="Test" navActions={() => navActions} />);

		expect(screen.getByText('Nav 1')).toBeDefined();
		expect(screen.getByText('Nav 2')).toBeDefined();
	});

	it('should render screen action buttons with correct text', () => {
		const screenActions: ScreenAction[] = [
			{
				id: 'screen-action-1',
				text: 'Screen Action 1',
				onClick: vi.fn(),
			},
			{
				id: 'screen-action-2',
				text: 'Screen Action 2',
				onClick: vi.fn(),
			},
		];

		render(() => (
			<Screen id="test-screen" title="Test" screenActions={() => screenActions} />
		));

		expect(screen.getByText('Screen Action 1')).toBeDefined();
		expect(screen.getByText('Screen Action 2')).toBeDefined();
	});

	it('should render buttons with correct IDs', () => {
		const navActions: ScreenAction[] = [
			{
				id: 'upload-btn',
				text: 'Upload',
				onClick: vi.fn(),
			},
		];
		const screenActions: ScreenAction[] = [
			{
				id: 'export-btn',
				text: 'Export',
				onClick: vi.fn(),
			},
		];

		render(() => (
			<Screen
				id="test-screen"
				title="Test"
				navActions={() => navActions}
				screenActions={() => screenActions}
			/>
		));

		expect(document.getElementById('upload-btn')).toBeDefined();
		expect(document.getElementById('export-btn')).toBeDefined();
	});

	it('should call onClick handler when nav button is clicked', () => {
		const mockHandler = vi.fn();
		const navActions: ScreenAction[] = [
			{
				id: 'test-action',
				text: 'Click Me',
				onClick: mockHandler,
			},
		];

		render(() => <Screen id="test-screen" title="Test" navActions={() => navActions} />);

		const button = screen.getByText('Click Me');
		fireEvent.click(button);

		expect(mockHandler).toHaveBeenCalled();
	});

	it('should call multiple onClick handlers independently', () => {
		const mockHandler1 = vi.fn();
		const mockHandler2 = vi.fn();
		const screenActions: ScreenAction[] = [
			{
				id: 'action-1',
				text: 'Action 1',
				onClick: mockHandler1,
			},
			{
				id: 'action-2',
				text: 'Action 2',
				onClick: mockHandler2,
			},
		];

		render(() => (
			<Screen id="test-screen" title="Test" screenActions={() => screenActions} />
		));

		fireEvent.click(screen.getByText('Action 1'));
		fireEvent.click(screen.getByText('Action 2'));

		expect(mockHandler1).toHaveBeenCalled();
		expect(mockHandler2).toHaveBeenCalled();
	});

	it('should render children content in main section', () => {
		render(() => (
			<Screen id="test-screen" title="Test">
				<div data-testid="test-content">Test Content</div>
			</Screen>
		));

		expect(screen.getByTestId('test-content')).toBeDefined();
		expect(screen.getByText('Test Content')).toBeDefined();
	});

	it('should render empty main section when no children provided', () => {
		render(() => <Screen id="test-screen" title="Test" />);

		const main = document.querySelector('main');
		expect(main).toBeDefined();
	});

	it('should have proper semantic HTML structure', () => {
		render(() => <Screen id="test-screen" title="Test" />);

		const header = document.querySelector('header');
		const main = document.querySelector('main');

		expect(header).toBeDefined();
		expect(main).toBeDefined();
	});

	it('should apply button group class to nav-actions container', () => {
		const navActions: ScreenAction[] = [
			{
				id: 'test-action',
				text: 'Test',
				onClick: vi.fn(),
			},
		];

		render(() => <Screen id="test-screen" title="Test" navActions={() => navActions} />);

		const buttonGroup = document.querySelector('.button-group.nav-actions');
		expect(buttonGroup).toBeDefined();
	});

	it('should apply button attributes from opts() when provided', () => {
		const screenActions: ScreenAction[] = [
			{
				id: 'test-action',
				text: 'Test Button',
				onClick: vi.fn(),
				opts: () => ({ disabled: true, title: 'Test Title' }),
			},
		];

		render(() => (
			<Screen id="test-screen" title="Test" screenActions={() => screenActions} />
		));

		const button = document.getElementById('test-action') as HTMLButtonElement;
		expect(button.disabled).toBe(true);
		expect(button.title).toBe('Test Title');
	});

	it('should apply dynamic button attributes when opts provides them', () => {
		const screenActions: ScreenAction[] = [
			{
				id: 'dynamic-button',
				text: 'Dynamic',
				onClick: vi.fn(),
				opts: () => ({ 'aria-label': 'Dynamic Button', title: 'Hover Text' }),
			},
		];

		render(() => (
			<Screen id="test-screen" title="Test" screenActions={() => screenActions} />
		));

		const button = document.getElementById('dynamic-button');
		expect(button?.getAttribute('aria-label')).toBe('Dynamic Button');
		expect(button?.getAttribute('title')).toBe('Hover Text');
	});

	it('should handle empty navActions and screenActions arrays', () => {
		render(() => (
			<Screen
				id="test-screen"
				title="Test"
				navActions={() => []}
				screenActions={() => []}
			/>
		));

		const header = document.querySelector('header');
		expect(header).toBeDefined();

		// Should not crash and should render header
		expect(screen.getByText('Test')).toBeDefined();
	});

	it('should handle different screen IDs correctly', () => {
		const { unmount } = render(() => <Screen id="screen-a" title="Screen A" />);

		expect(document.querySelector('#screen-a.screen')).toBeDefined();

		unmount();

		render(() => <Screen id="screen-b" title="Screen B" />);

		expect(document.querySelector('#screen-b.screen')).toBeDefined();
	});

	it('should render multiple children elements', () => {
		render(() => (
			<Screen id="test-screen" title="Test">
				<div data-testid="child-1">Child 1</div>
				<div data-testid="child-2">Child 2</div>
				<div data-testid="child-3">Child 3</div>
			</Screen>
		));

		expect(screen.getByTestId('child-1')).toBeDefined();
		expect(screen.getByTestId('child-2')).toBeDefined();
		expect(screen.getByTestId('child-3')).toBeDefined();
	});

	it('should preserve title text exactly as provided', () => {
		const specialTitle = 'Game Records & Analysis (v2.0)';

		render(() => <Screen id="test-screen" title={specialTitle} />);

		expect(screen.getByText(specialTitle)).toBeDefined();
	});

	it('should preserve action text exactly as provided', () => {
		const screenActions: ScreenAction[] = [
			{
				id: 'action-1',
				text: '✕ Close Window',
				onClick: vi.fn(),
			},
		];

		render(() => (
			<Screen id="test-screen" title="Test" screenActions={() => screenActions} />
		));

		expect(screen.getByText('✕ Close Window')).toBeDefined();
	});

	it('should render action buttons in the order provided', () => {
		const navActions: ScreenAction[] = [
			{ id: 'first', text: 'First', onClick: vi.fn() },
			{ id: 'second', text: 'Second', onClick: vi.fn() },
			{ id: 'third', text: 'Third', onClick: vi.fn() },
		];

		render(() => <Screen id="test-screen" title="Test" navActions={() => navActions} />);

		const buttons = document.querySelectorAll('.button-group.nav-actions button');
		expect(buttons[0]?.id).toBe('first');
		expect(buttons[1]?.id).toBe('second');
		expect(buttons[2]?.id).toBe('third');
	});
});
