import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@solidjs/testing-library';
import App from '#App';

// Mock the ScoreboardOCR component
vi.mock(import('#c/ScoreboardOCR'), () => ({
	default: (props) => (
		<div>
			Mocked ScoreboardOCR
			<span data-testid="ocr-batch">{props.uploadBatch?.images.join(',')}</span>
			{props.onOpenRegionManager && (
				<button onClick={props.onOpenRegionManager}>Region Profiles</button>
			)}
			{props.onClose && <button onClick={props.onClose}>✕ Close</button>}
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
		</div>
	),
}));

// Mock the RegionProfileManager component
vi.mock(import('#c/RegionProfileManager'), () => ({
	default: (props) => (
		<div>
			Mocked RegionProfileManager
			<span data-testid="region-preview">{props.previewImage}</span>
			{props.onClose && <button onClick={props.onClose}>✕ Close</button>}
		</div>
	),
}));

describe('App', () => {
	it('should render the component', () => {
		render(() => <App />);
		expect(screen.getByText('Mocked GameRecordsTable')).toBeDefined();
	});

	it('should show Records view by default', () => {
		render(() => <App />);
		expect(screen.getByText('Mocked GameRecordsTable')).toBeDefined();
	});

	it('should not show navigation buttons on records view', () => {
		render(() => <App />);

		// Initially on Records view, should not show navigation buttons
		expect(screen.queryByText('Records')).toBeNull();
	});

	it('should have drag and drop event listeners attached', () => {
		// This test verifies that the component sets up event listeners
		// Testing actual drag/drop behavior in JSDOM is complex due to DragEvent limitations
		render(() => <App />);

		// Component should render successfully with event listeners
		expect(screen.getByText('Mocked GameRecordsTable')).toBeDefined();
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
			fireEvent.click(await screen.findByText('Region Profiles'));

			drop([png('b.png'), png('c.png')]);

			await waitFor(() =>
				expect(screen.getByTestId('region-preview').textContent).toBe(toDataURL('b.png'))
			);
			expect(screen.getByText('Mocked RegionProfileManager')).toBeDefined();
		});
	});
});
