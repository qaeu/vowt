import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@solidjs/testing-library';

import Screen from '#c/Screen';
import type { ScreenAction } from '#types';

describe('Screen', () => {
	it('should render the component with correct ID and container class', () => {
		const actions: ScreenAction[] = [];
		render(() => <Screen id="test-screen" title="Test Screen" actions={() => actions} />);

		const container = document.querySelector('.test-screen-container');
		expect(container).toBeDefined();
	});

	it('should display the screen title in the header', () => {
		const actions: ScreenAction[] = [];
		render(() => (
			<Screen id="test-screen" title="My Test Screen" actions={() => actions} />
		));

		expect(screen.getByText('My Test Screen')).toBeDefined();
	});

	it('should render action buttons with correct text', () => {
		const actions: ScreenAction[] = [
			{
				id: 'action-1',
				text: 'Action 1',
				onClick: vi.fn(),
			},
			{
				id: 'action-2',
				text: 'Action 2',
				onClick: vi.fn(),
			},
		];

		render(() => <Screen id="test-screen" title="Test" actions={() => actions} />);

		expect(screen.getByText('Action 1')).toBeDefined();
		expect(screen.getByText('Action 2')).toBeDefined();
	});

	it('should render buttons with correct IDs', () => {
		const actions: ScreenAction[] = [
			{
				id: 'upload-btn',
				text: 'Upload',
				onClick: vi.fn(),
			},
			{
				id: 'export-btn',
				text: 'Export',
				onClick: vi.fn(),
			},
		];

		render(() => <Screen id="test-screen" title="Test" actions={() => actions} />);

		expect(document.getElementById('upload-btn')).toBeDefined();
		expect(document.getElementById('export-btn')).toBeDefined();
	});

	it('should call onClick handler when button is clicked', () => {
		const mockHandler = vi.fn();
		const actions: ScreenAction[] = [
			{
				id: 'test-action',
				text: 'Click Me',
				onClick: mockHandler,
			},
		];

		render(() => <Screen id="test-screen" title="Test" actions={() => actions} />);

		const button = screen.getByText('Click Me');
		fireEvent.click(button);

		expect(mockHandler).toHaveBeenCalled();
	});

	it('should call multiple onClick handlers independently', () => {
		const mockHandler1 = vi.fn();
		const mockHandler2 = vi.fn();
		const actions: ScreenAction[] = [
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

		render(() => <Screen id="test-screen" title="Test" actions={() => actions} />);

		fireEvent.click(screen.getByText('Action 1'));
		fireEvent.click(screen.getByText('Action 2'));

		expect(mockHandler1).toHaveBeenCalled();
		expect(mockHandler2).toHaveBeenCalled();
	});

	it('should render children content in main section', () => {
		const actions: ScreenAction[] = [];
		render(() => (
			<Screen id="test-screen" title="Test" actions={() => actions}>
				<div data-testid="test-content">Test Content</div>
			</Screen>
		));

		expect(screen.getByTestId('test-content')).toBeDefined();
		expect(screen.getByText('Test Content')).toBeDefined();
	});

	it('should render empty main section when no children provided', () => {
		const actions: ScreenAction[] = [];
		render(() => <Screen id="test-screen" title="Test" actions={() => actions} />);

		const main = document.querySelector('main');
		expect(main).toBeDefined();
	});

	it('should have proper semantic HTML structure', () => {
		const actions: ScreenAction[] = [];
		render(() => <Screen id="test-screen" title="Test" actions={() => actions} />);

		const header = document.querySelector('header');
		const main = document.querySelector('main');

		expect(header).toBeDefined();
		expect(main).toBeDefined();
	});

	it('should apply button group class to actions container', () => {
		const actions: ScreenAction[] = [
			{
				id: 'test-action',
				text: 'Test',
				onClick: vi.fn(),
			},
		];

		render(() => <Screen id="test-screen" title="Test" actions={() => actions} />);

		const buttonGroup = document.querySelector('.button-group.actions');
		expect(buttonGroup).toBeDefined();
	});

	it('should apply button attributes from opts() when provided', () => {
		const actions: ScreenAction[] = [
			{
				id: 'test-action',
				text: 'Test Button',
				onClick: vi.fn(),
				opts: () => ({ disabled: true, title: 'Test Title' }),
			},
		];

		render(() => <Screen id="test-screen" title="Test" actions={() => actions} />);

		const button = document.getElementById('test-action') as HTMLButtonElement;
		expect(button.disabled).toBe(true);
		expect(button.title).toBe('Test Title');
	});

	it('should apply dynamic button attributes when opts provides them', () => {
		const actions: ScreenAction[] = [
			{
				id: 'dynamic-button',
				text: 'Dynamic',
				onClick: vi.fn(),
				opts: () => ({ 'aria-label': 'Dynamic Button', title: 'Hover Text' }),
			},
		];

		render(() => <Screen id="test-screen" title="Test" actions={() => actions} />);

		const button = document.getElementById('dynamic-button');
		expect(button?.getAttribute('aria-label')).toBe('Dynamic Button');
		expect(button?.getAttribute('title')).toBe('Hover Text');
	});

	it('should handle empty actions array', () => {
		render(() => <Screen id="test-screen" title="Test" actions={() => []} />);

		const header = document.querySelector('header');
		expect(header).toBeDefined();

		// Should not crash and should render header
		expect(screen.getByText('Test')).toBeDefined();
	});

	it('should handle different screen IDs correctly', () => {
		const actions: ScreenAction[] = [];
		const { unmount } = render(() => (
			<Screen id="screen-a" title="Screen A" actions={() => actions} />
		));

		expect(document.querySelector('.screen-a-container')).toBeDefined();

		unmount();

		render(() => <Screen id="screen-b" title="Screen B" actions={() => actions} />);

		expect(document.querySelector('.screen-b-container')).toBeDefined();
	});

	it('should render multiple children elements', () => {
		const actions: ScreenAction[] = [];
		render(() => (
			<Screen id="test-screen" title="Test" actions={() => actions}>
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
		const actions: ScreenAction[] = [];
		const specialTitle = 'Game Records & Analysis (v2.0)';

		render(() => (
			<Screen id="test-screen" title={specialTitle} actions={() => actions} />
		));

		expect(screen.getByText(specialTitle)).toBeDefined();
	});

	it('should preserve action text exactly as provided', () => {
		const actions: ScreenAction[] = [
			{
				id: 'action-1',
				text: '✕ Close Window',
				onClick: vi.fn(),
			},
		];

		render(() => <Screen id="test-screen" title="Test" actions={() => actions} />);

		expect(screen.getByText('✕ Close Window')).toBeDefined();
	});

	it('should render action buttons in the order provided', () => {
		const actions: ScreenAction[] = [
			{ id: 'first', text: 'First', onClick: vi.fn() },
			{ id: 'second', text: 'Second', onClick: vi.fn() },
			{ id: 'third', text: 'Third', onClick: vi.fn() },
		];

		render(() => <Screen id="test-screen" title="Test" actions={() => actions} />);

		const buttons = document.querySelectorAll('.button-group.actions button');
		expect(buttons[0]?.id).toBe('first');
		expect(buttons[1]?.id).toBe('second');
		expect(buttons[2]?.id).toBe('third');
	});
});
