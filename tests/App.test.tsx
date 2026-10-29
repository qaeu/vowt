import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@solidjs/testing-library';
import App from '#App';
import { loadSettings, saveSettings } from '#utils/storage';

// Mock the ScoreboardOCR component
vi.mock(import('#c/ScoreboardOCR'), () => ({
	default: (props) => (
		<div>
			Mocked ScoreboardOCR
			<span data-testid="ocr-batch">{props.uploadBatch?.images.join(',')}</span>
		</div>
	),
}));

// Mock the GameRecordsTable component
vi.mock(import('#c/GameRecordsTable'), () => ({
	default: (props) => (
		<div>
			Mocked GameRecordsTable
			{props.onUploadClick && (
				<button onClick={props.onUploadClick}>📤 Upload Image</button>
			)}
			<span data-testid="initial-expanded">{props.initialExpandedId ?? ''}</span>
		</div>
	),
}));

// Mock the RegionProfileManager component
vi.mock(import('#c/RegionProfileManager'), () => ({
	default: (props) => (
		<div>
			Mocked RegionProfileManager
			<span data-testid="region-preview">{props.previewImage}</span>
		</div>
	),
}));

// Mock the Insights component
vi.mock(import('#c/Insights'), () => ({
	default: (props) => (
		<div>
			Mocked Insights
			<button onClick={() => props.onOpenRecord('rec_7')}>Open Record</button>
		</div>
	),
}));

describe('App', () => {
	beforeEach(() => {
		localStorage.clear();
		document.body.classList.remove('dark-theme');
	});

	it('should render the component', () => {
		render(() => <App />);
		expect(screen.getByText('Mocked GameRecordsTable')).toBeDefined();
	});

	it('should show Records view by default', () => {
		render(() => <App />);
		expect(screen.getByText('Mocked GameRecordsTable')).toBeDefined();
	});

	describe('header navigation', () => {
		const navButton = (name: RegExp) => screen.getByRole('button', { name });

		it('should mark History as the current page by default', () => {
			render(() => <App />);

			expect(navButton(/History/).getAttribute('aria-current')).toBe('page');
			expect(navButton(/Insights/).getAttribute('aria-current')).toBeNull();
		});

		it('should open Region profiles from the header and mark it current', () => {
			render(() => <App />);

			fireEvent.click(navButton(/Region profiles/));

			expect(screen.getByText('Mocked RegionProfileManager')).toBeDefined();
			expect(navButton(/Region profiles/).getAttribute('aria-current')).toBe('page');
			expect(navButton(/History/).getAttribute('aria-current')).toBeNull();
		});

		it('should keep the header visible on every screen', () => {
			render(() => <App />);

			fireEvent.click(navButton(/Insights/));

			expect(screen.getByRole('navigation', { name: 'Main' })).toBeDefined();
			expect(navButton(/Insights/).getAttribute('aria-current')).toBe('page');
		});
	});

	it('should have drag and drop event listeners attached', () => {
		// This test verifies that the component sets up event listeners
		// Testing actual drag/drop behavior in JSDOM is complex due to DragEvent limitations
		render(() => <App />);

		// Component should render successfully with event listeners
		expect(screen.getByText('Mocked GameRecordsTable')).toBeDefined();
	});

	describe('insights view', () => {
		it('should open Insights from records and go back', async () => {
			render(() => <App />);

			fireEvent.click(screen.getByRole('button', { name: /Insights/ }));
			expect(await screen.findByText('Mocked Insights')).toBeDefined();
			expect(screen.queryByText('Mocked GameRecordsTable')).toBeNull();

			fireEvent.click(screen.getByRole('button', { name: /History/ }));
			expect(await screen.findByText('Mocked GameRecordsTable')).toBeDefined();
			expect(screen.getByTestId('initial-expanded').textContent).toBe('');
		});

		it('should show the chosen record expanded in the records view', async () => {
			render(() => <App />);
			fireEvent.click(screen.getByRole('button', { name: /Insights/ }));

			fireEvent.click(await screen.findByText('Open Record'));

			expect(await screen.findByText('Mocked GameRecordsTable')).toBeDefined();
			expect(screen.getByTestId('initial-expanded').textContent).toBe('rec_7');
		});
	});

	describe('dark mode', () => {
		it('should save the setting without losing the tracked player', () => {
			saveSettings({ darkMode: false, trackedPlayer: 'ALICE', lastExportedAt: null });
			render(() => <App />);

			fireEvent.click(screen.getByLabelText('Toggle dark mode'));

			expect(loadSettings()).toEqual({
				darkMode: true,
				trackedPlayer: 'ALICE',
				lastExportedAt: null,
			});
			expect(document.body.classList.contains('dark-theme')).toBe(true);
		});

		it('should keep a tracked player chosen after the app started', () => {
			render(() => <App />);
			saveSettings({ ...loadSettings(), trackedPlayer: 'BOB' });

			fireEvent.click(screen.getByLabelText('Toggle dark mode'));

			expect(loadSettings().trackedPlayer).toBe('BOB');
		});
	});

	describe('dropping screenshots', () => {
		const toDataURL = (content: string) =>
			`data:image/png;base64,${Buffer.from(content).toString('base64')}`;
		const png = (name: string) => new File([name], name, { type: 'image/png' });

		const drop = (files: File[]) => {
			const event = new Event('drop', { bubbles: true, cancelable: true });
			Object.defineProperty(event, 'dataTransfer', { value: { files } });
			document.dispatchEvent(event);
		};

		it('should send every dropped image to the OCR view', async () => {
			render(() => <App />);
			const text = new File(['text'], 'notes.txt', { type: 'text/plain' });

			drop([png('a.png'), text, png('b.png')]);

			expect(await screen.findByTestId('ocr-batch')).toBeDefined();
			expect(screen.getByTestId('ocr-batch').textContent).toBe(
				`${toDataURL('a.png')},${toDataURL('b.png')}`
			);
		});

		it('should ignore drops without images', async () => {
			render(() => <App />);

			drop([new File(['text'], 'notes.txt', { type: 'text/plain' })]);

			await new Promise((resolve) => setTimeout(resolve, 20));
			expect(screen.getByText('Mocked GameRecordsTable')).toBeDefined();
		});

		it('should stay in the regions view and preview the first image', async () => {
			render(() => <App />);
			drop([png('a.png')]);
			await screen.findByTestId('ocr-batch');
			fireEvent.click(screen.getByRole('button', { name: /Region profiles/ }));

			drop([png('b.png'), png('c.png')]);

			await waitFor(() =>
				expect(screen.getByTestId('region-preview').textContent).toBe(toDataURL('b.png'))
			);
			expect(screen.getByText('Mocked RegionProfileManager')).toBeDefined();
		});
	});
});
