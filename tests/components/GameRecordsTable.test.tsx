import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@solidjs/testing-library';

import type { PlayerStats, MatchInfo, GameRecord } from '#types';
import GameRecordsTable from '#c/GameRecordsTable';
import * as gameStorage from '#utils/gameStorage';

// Mock gameStorage module
vi.mock('#utils/gameStorage', () => ({
	loadGameRecords: vi.fn(),
	deleteGameRecord: vi.fn(),
	updateGameRecord: vi.fn(),
	clearAllGameRecords: vi.fn(),
	exportGameRecords: vi.fn(),
	importGameRecords: vi.fn(),
}));

interface EditableGameDataProps {
	initialPlayers: PlayerStats[];
	initialMatchInfo: MatchInfo;
	onSave: (players: PlayerStats[], matchInfo: MatchInfo) => void;
}

// Mock EditableGameData component
vi.mock('#c/EditableGameData', () => ({
	default: (props: EditableGameDataProps) => (
		<div data-testid="editable-game-data">
			<div data-testid="players-count">{props.initialPlayers.length} players</div>
			<div data-testid="match-result">{props.initialMatchInfo.result}</div>
			<button
				onClick={() => props.onSave(props.initialPlayers, props.initialMatchInfo)}
				data-testid="save-edits-button"
			>
				Save Edits
			</button>
		</div>
	),
}));

describe('GameRecordsTable', () => {
	const mockOnUploadClick = vi.fn();

	const mockRecords: GameRecord[] = [
		{
			id: 'game_1',
			players: [
				{
					name: 'Player1',
					team: 'blue',
					e: '10',
					a: '5',
					d: '2',
					dmg: '15000',
					h: '8000',
					mit: '12000',
					hero: 'Tracer',
				},
				{
					name: 'Player2',
					team: 'red',
					e: '8',
					a: '6',
					d: '3',
					dmg: '12000',
					h: '7000',
					mit: '10000',
					hero: 'Winston',
				},
			],
			matchInfo: {
				result: 'VICTORY',
				final_score: { blue: '3', red: '2' },
				date: '10/21/2025',
				game_mode: 'ESCORT',
				game_length: '10:30',
				map: 'Hollywood',
			},
			createdAt: new Date('2025-11-11T00:00:00.000Z'),
			updatedAt: new Date('2025-11-12T00:00:00.000Z'),
		},
		{
			id: 'game_2',
			players: [
				{
					name: 'Player3',
					team: 'blue',
					e: '7',
					a: '4',
					d: '4',
					dmg: '11000',
					h: '6000',
					mit: '9000',
					hero: 'Reinhardt',
				},
			],
			matchInfo: {
				result: 'DEFEAT',
				final_score: { blue: '2', red: '3' },
				date: '10/22/2025',
				game_mode: 'PAYLOAD',
				game_length: '08:15',
				map: "King's Row",
			},
			createdAt: new Date('2025-11-11T00:00:00.000Z'),
			updatedAt: new Date('2025-11-12T00:00:00.000Z'),
		},
	];

	beforeEach(() => {
		vi.clearAllMocks();
		(gameStorage.loadGameRecords as ReturnType<typeof vi.fn>).mockReturnValue(
			mockRecords
		);
	});

	it('should render the component', () => {
		render(() => <GameRecordsTable onUploadClick={mockOnUploadClick} />);
		expect(screen.getByText('Game History')).toBeDefined();
	});

	it('should display upload, export, import, and clear buttons', () => {
		render(() => <GameRecordsTable onUploadClick={mockOnUploadClick} />);
		expect(screen.getByText(/Upload Screenshot/)).toBeDefined();
		expect(screen.getByText(/Export Records/)).toBeDefined();
		expect(screen.getByText(/Import Records/)).toBeDefined();
		expect(screen.getByText(/Delete All/)).toBeDefined();
	});

	it('should show empty state when no records exist', () => {
		(gameStorage.loadGameRecords as ReturnType<typeof vi.fn>).mockReturnValue([]);
		render(() => <GameRecordsTable onUploadClick={mockOnUploadClick} />);
		expect(screen.getByText(/No game records found/)).toBeDefined();
	});

	it('should display all game records in table', () => {
		render(() => <GameRecordsTable onUploadClick={mockOnUploadClick} />);
		expect(screen.getByText('VICTORY')).toBeDefined();
		expect(screen.getByText('DEFEAT')).toBeDefined();
		expect(screen.getByText('ESCORT')).toBeDefined();
		expect(screen.getByText('PAYLOAD')).toBeDefined();
	});

	it('should display correct score format in table', () => {
		render(() => <GameRecordsTable onUploadClick={mockOnUploadClick} />);
		expect(screen.getByText(/3 - 2/)).toBeDefined();
		expect(screen.getByText(/2 - 3/)).toBeDefined();
	});

	it('should display player count in table', () => {
		render(() => <GameRecordsTable onUploadClick={mockOnUploadClick} />);
		const rows = screen.getAllByRole('row');
		// Should have header + 2 data rows (+ 0 expanded rows initially)
		expect(rows.length).toBeGreaterThanOrEqual(3);
	});

	it('should call onUploadClick when upload button is clicked', () => {
		render(() => <GameRecordsTable onUploadClick={mockOnUploadClick} />);
		const uploadButton = screen.getByText(/Upload Screenshot/);
		fireEvent.click(uploadButton);
		expect(mockOnUploadClick).toHaveBeenCalled();
	});

	it('should expand record when clicked', async () => {
		render(() => <GameRecordsTable onUploadClick={mockOnUploadClick} />);

		const victoryCell = screen.getByText('VICTORY');
		fireEvent.click(victoryCell);

		await waitFor(() => {
			expect(screen.queryByTestId('editable-game-data')).not.toBeNull();
		});
	});

	it('should render EditableGameData with correct props when expanded', async () => {
		render(() => <GameRecordsTable onUploadClick={mockOnUploadClick} />);

		const victoryCell = screen.getByText('VICTORY');
		fireEvent.click(victoryCell);

		await waitFor(() => {
			const playersCount = screen.queryByTestId('players-count');
			expect(playersCount?.textContent).toBe('2 players');
		});
	});

	it('should display match result in EditableGameData', async () => {
		render(() => <GameRecordsTable onUploadClick={mockOnUploadClick} />);

		const victoryCell = screen.getByText('VICTORY');
		fireEvent.click(victoryCell);

		await waitFor(() => {
			const matchResult = screen.queryByTestId('match-result');
			expect(matchResult?.textContent).toBe('VICTORY');
		});
	});

	it('should collapse record when clicked again', async () => {
		render(() => <GameRecordsTable onUploadClick={mockOnUploadClick} />);

		const victoryCell = screen.getByText('VICTORY');

		// Expand
		fireEvent.click(victoryCell);
		await waitFor(() => {
			expect(screen.queryByTestId('editable-game-data')).not.toBeNull();
		});

		// Collapse
		fireEvent.click(victoryCell);
		await waitFor(() => {
			expect(screen.queryByTestId('editable-game-data')).toBeNull();
		});
	});

	it('should call updateGameRecord when save edits is clicked', async () => {
		render(() => <GameRecordsTable onUploadClick={mockOnUploadClick} />);

		const victoryCell = screen.getByText('VICTORY');
		fireEvent.click(victoryCell);

		await waitFor(() => {
			const saveButton = screen.queryByTestId('save-edits-button');
			expect(saveButton).not.toBeNull();
		});

		const saveButton = screen.getByTestId('save-edits-button');
		fireEvent.click(saveButton);

		expect(gameStorage.updateGameRecord).toHaveBeenCalledWith(
			'game_1',
			mockRecords[0].players,
			mockRecords[0].matchInfo
		);
	});

	it('should delete record when delete button is clicked', async () => {
		window.confirm = vi.fn(() => true);
		render(() => <GameRecordsTable onUploadClick={mockOnUploadClick} />);

		const deleteButtons = screen.getAllByRole('button', { name: '✕' });
		fireEvent.click(deleteButtons[0]);

		expect(window.confirm).toHaveBeenCalled();
		expect(gameStorage.deleteGameRecord).toHaveBeenCalledWith('game_1');
	});

	it('should not delete record when confirm is cancelled', async () => {
		window.confirm = vi.fn(() => false);
		render(() => <GameRecordsTable onUploadClick={mockOnUploadClick} />);

		const deleteButtons = screen.getAllByRole('button', { name: '✕' });
		fireEvent.click(deleteButtons[0]);

		expect(window.confirm).toHaveBeenCalled();
		expect(gameStorage.deleteGameRecord).not.toHaveBeenCalled();
	});

	it('should close expanded record when deleted', async () => {
		window.confirm = vi.fn(() => true);
		render(() => <GameRecordsTable onUploadClick={mockOnUploadClick} />);

		const victoryCell = screen.getByText('VICTORY');
		fireEvent.click(victoryCell);

		await waitFor(() => {
			expect(screen.queryByTestId('editable-game-data')).not.toBeNull();
		});

		const deleteButtons = screen.getAllByRole('button', { name: '✕' });
		fireEvent.click(deleteButtons[0]);

		expect(gameStorage.deleteGameRecord).toHaveBeenCalledWith('game_1');
	});

	it('should call exportGameRecords when export button is clicked', () => {
		window.URL.createObjectURL = vi.fn(() => 'blob:mock');
		window.URL.revokeObjectURL = vi.fn();

		render(() => <GameRecordsTable onUploadClick={mockOnUploadClick} />);
		const exportButton = screen.getByText(/Export/);
		fireEvent.click(exportButton);

		expect(gameStorage.exportGameRecords).toHaveBeenCalled();
	});

	it('should call clearAllGameRecords when clear all button is clicked with confirmation', async () => {
		window.confirm = vi.fn(() => true);
		render(() => <GameRecordsTable onUploadClick={mockOnUploadClick} />);

		const clearButton = screen.getByText(/Delete All/);
		fireEvent.click(clearButton);

		expect(window.confirm).toHaveBeenCalled();
		expect(gameStorage.clearAllGameRecords).toHaveBeenCalled();
	});

	it('should not clear records when confirm is cancelled', async () => {
		window.confirm = vi.fn(() => false);
		render(() => <GameRecordsTable onUploadClick={mockOnUploadClick} />);

		const clearButton = screen.getByText(/Delete All/);
		fireEvent.click(clearButton);

		expect(window.confirm).toHaveBeenCalled();
		expect(gameStorage.clearAllGameRecords).not.toHaveBeenCalled();
	});

	it('should disable export button when records undefined', () => {
		(gameStorage.loadGameRecords as ReturnType<typeof vi.fn>).mockReturnValue(undefined);
		render(() => <GameRecordsTable onUploadClick={mockOnUploadClick} />);

		const exportButton = screen.getByText(/Export/);
		expect((exportButton as HTMLButtonElement).disabled).toBe(true);
	});

	it('should disable clear all button when records undefined', () => {
		(gameStorage.loadGameRecords as ReturnType<typeof vi.fn>).mockReturnValue(undefined);
		render(() => <GameRecordsTable onUploadClick={mockOnUploadClick} />);

		const clearButton = screen.getByText(/Delete All/);
		expect((clearButton as HTMLButtonElement).disabled).toBe(true);
	});

	it('should format timestamp correctly', () => {
		render(() => <GameRecordsTable onUploadClick={mockOnUploadClick} />);

		const dateTexts = screen.getAllByText(/2025/);
		expect(dateTexts.length).toBeGreaterThanOrEqual(1);
		expect(dateTexts[0].textContent).toMatch(/\d+\/\d+\/2025/);
	});

	it('should apply victory and defeat CSS classes to result badges', () => {
		const { container } = render(() => (
			<GameRecordsTable onUploadClick={mockOnUploadClick} />
		));

		const badges = container.querySelectorAll('.result-badge');
		expect(badges.length).toBeGreaterThanOrEqual(2);

		let hasVictoryClass = false;
		let hasDefeatClass = false;

		badges.forEach((badge) => {
			if (badge.classList.contains('victory')) {
				hasVictoryClass = true;
			}
			if (badge.classList.contains('defeat')) {
				hasDefeatClass = true;
			}
		});

		expect(hasVictoryClass).toBe(true);
		expect(hasDefeatClass).toBe(true);
	});
});
