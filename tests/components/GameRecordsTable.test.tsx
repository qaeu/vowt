import { describe, it, expect, vi, beforeEach, assert } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@solidjs/testing-library';

import type {
	PlayerStats,
	MatchInfo,
	GameRecord,
	OverFastHero,
	OverFastMap,
	OverFastStore,
} from '#types';
import GameRecordsTable from '#c/GameRecordsTable';
import * as gameStorage from '#utils/storage';
import { updateOverFastData } from '#utils/overfastApi';

// Mock storage module
vi.mock('#utils/storage', () => ({
	loadGameRecords: vi.fn(),
	deleteGameRecord: vi.fn(),
	updateGameRecord: vi.fn(),
	clearAllGameRecords: vi.fn(),
	exportGameRecords: vi.fn(),
	importGameRecords: vi.fn(),
	loadSettings: vi.fn(),
	saveSettings: vi.fn(),
	PLAYER_STATS_NUMBER_FIELD_NAMES: ['e', 'a', 'd', 'dmg', 'h', 'mit'],
}));

vi.mock('#utils/overfastApi');

interface EditableGameDataProps {
	initialPlayers: PlayerStats[];
	initialMatchInfo: MatchInfo;
	onSave: (players: PlayerStats[], matchInfo: MatchInfo) => void;
}

// Mock EditableGameData component
vi.mock('#c/ui/EditableGameData', () => ({
	default: (props: EditableGameDataProps) => (
		<div data-testid="editable-game-data">
			<div data-testid="players-count">{props.initialPlayers?.length || 0} players</div>
			<div data-testid="match-result">{props.initialMatchInfo?.result || 'unknown'}</div>
			<button
				onClick={() =>
					props.onSave?.(props.initialPlayers || [], props.initialMatchInfo || {})
				}
				data-testid="save-edits-button"
			>
				Save Edits
			</button>
		</div>
	),
}));

// jsdom has no ResizeObserver, which the menu's positioning needs
vi.stubGlobal(
	'ResizeObserver',
	class {
		observe() {}
		unobserve() {}
		disconnect() {}
	}
);

const openMoreMenu = async () => {
	const trigger = screen.getByRole('button', { name: /More actions/ });
	fireEvent.click(trigger);
	await waitFor(() => expect(trigger.getAttribute('data-state')).toBe('open'));
};

const clickMenuItem = async (name: RegExp) => {
	await openMoreMenu();
	fireEvent.click(await screen.findByRole('menuitem', { name }));
};

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
		vi.mocked(gameStorage.loadGameRecords).mockReturnValue(mockRecords);
		vi.mocked(gameStorage.loadSettings).mockReturnValue({
			darkMode: false,
			trackedPlayer: null,
			lastExportedAt: null,
		});
	});

	const renderTable = (props: { initialExpandedId?: string } = {}) =>
		render(() => <GameRecordsTable onUploadClick={mockOnUploadClick} {...props} />);

	describe('title row', () => {
		it('should render the title and a record count subtitle', () => {
			renderTable();
			expect(screen.getByText('Game History')).toBeDefined();
			expect(screen.getByText(/2 records · stored in this browser/)).toBeDefined();
		});

		it('should say there is no backup when never exported', () => {
			renderTable();
			expect(screen.getByText(/no backup yet/)).toBeDefined();
		});

		it('should show the last backup as relative time', () => {
			const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
			vi.mocked(gameStorage.loadSettings).mockReturnValue({
				darkMode: false,
				trackedPlayer: null,
				lastExportedAt: twoDaysAgo,
			});
			renderTable();
			expect(screen.getByText(/last backup 2 days ago/)).toBeDefined();
		});

		it('should not offer Upload (it lives in the header)', () => {
			renderTable();
			expect(screen.queryByText(/Upload Screenshot/)).toBeNull();
		});

		it('should show Import and Export buttons', () => {
			renderTable();
			expect(screen.getByText('Import Records')).toBeDefined();
			expect(screen.getByText('Export Records')).toBeDefined();
		});

		it('should disable Export when no records exist', () => {
			vi.mocked(gameStorage.loadGameRecords).mockReturnValue([]);
			renderTable();
			const exportButton = screen.getByText('Export Records') as HTMLButtonElement;
			expect(exportButton.disabled).toBe(true);
		});

		describe('export', () => {
			it('should export records and save the last backup time', () => {
				window.URL.createObjectURL = vi.fn(() => 'blob:mock');
				window.URL.revokeObjectURL = vi.fn();
				renderTable();

				fireEvent.click(screen.getByText('Export Records'));

				expect(gameStorage.exportGameRecords).toHaveBeenCalled();
				expect(gameStorage.saveSettings).toHaveBeenCalledWith(
					expect.objectContaining({ lastExportedAt: expect.any(String) })
				);
				const saved = vi.mocked(gameStorage.saveSettings).mock.calls[0][0];
				expect(Number.isNaN(Date.parse(saved.lastExportedAt!))).toBe(false);
				expect(screen.getByText(/last backup/).textContent).not.toMatch(/no backup/);
			});
		});

		describe('more actions menu', () => {
			it('should delete all records after confirmation', async () => {
				renderTable();
				await clickMenuItem(/Delete all records/);

				await waitFor(() => screen.getByText('Clear All Records'));
				fireEvent.click(screen.getByText('Confirm'));

				expect(gameStorage.clearAllGameRecords).toHaveBeenCalled();
			});

			it('should not delete all records when cancelled', async () => {
				renderTable();
				await clickMenuItem(/Delete all records/);

				await waitFor(() => screen.getByText('Clear All Records'));
				const closeButton = document.querySelector(
					'[data-scope="dialog"][data-part="close-trigger"]'
				);
				assert(closeButton, 'Dialog close button not found');
				fireEvent.click(closeButton);

				expect(gameStorage.clearAllGameRecords).not.toHaveBeenCalled();
			});

			it('should disable Delete all records when there are no records', async () => {
				vi.mocked(gameStorage.loadGameRecords).mockReturnValue([]);
				renderTable();
				await openMoreMenu();
				const item = await screen.findByRole('menuitem', {
					name: /Delete all records/,
				});
				expect(item.hasAttribute('data-disabled')).toBe(true);
			});
		});
	});

	describe('records list', () => {
		it('should display all game records', () => {
			renderTable();
			expect(screen.getByText('VICTORY')).toBeDefined();
			expect(screen.getByText('DEFEAT')).toBeDefined();
			expect(screen.getAllByText('ESCORT').length).toBeGreaterThan(0);
			expect(screen.getAllByText('PAYLOAD').length).toBeGreaterThan(0);
		});

		it('should display the score, map and length', () => {
			renderTable();
			expect(screen.getByText(/3 - 2/)).toBeDefined();
			expect(screen.getByText(/2 - 3/)).toBeDefined();
			expect(screen.getByText('Hollywood')).toBeDefined();
			expect(screen.getByText('10:30')).toBeDefined();
		});

		it('should fall back to the creation time when the date is unreadable', () => {
			const records = [
				{
					...mockRecords[0],
					matchInfo: { ...mockRecords[0].matchInfo, date: 'unreadable' },
				},
			];
			vi.mocked(gameStorage.loadGameRecords).mockReturnValue(records);
			renderTable();
			expect(screen.getByText(records[0].createdAt.toLocaleDateString())).toBeDefined();
		});

		it('should apply victory and defeat CSS classes to result badges', () => {
			const { container } = renderTable();
			expect(container.querySelector('.result-badge.victory')).not.toBeNull();
			expect(container.querySelector('.result-badge.defeat')).not.toBeNull();
		});

		it('should have no per-row delete button', () => {
			const { container } = renderTable();
			expect(container.querySelector('.delete-button')).toBeNull();
		});
	});

	describe('row expansion', () => {
		const getRowButton = (resultText: string) =>
			screen.getByText(resultText).closest('button')!;

		it('should start with every row button collapsed', () => {
			renderTable();
			const buttons = document.querySelectorAll('button.record-row');
			expect(buttons).toHaveLength(2);
			buttons.forEach((b) => expect(b.getAttribute('aria-expanded')).toBe('false'));
		});

		it('should set aria-expanded when a row is opened and closed', async () => {
			renderTable();
			const button = getRowButton('VICTORY');

			fireEvent.click(button);
			expect(button.getAttribute('aria-expanded')).toBe('true');
			expect(getRowButton('DEFEAT').getAttribute('aria-expanded')).toBe('false');

			fireEvent.click(button);
			expect(button.getAttribute('aria-expanded')).toBe('false');
			await waitFor(() => expect(screen.queryByText('Edit Record')).toBeNull());
		});

		it('should show the Blue and Red team scoreboards when opened', () => {
			renderTable();
			fireEvent.click(getRowButton('VICTORY'));

			expect(screen.getByText('Blue team')).toBeDefined();
			expect(screen.getByText('Red team')).toBeDefined();
			expect(screen.getByText('Player1')).toBeDefined();
			expect(screen.getByText('Player2')).toBeDefined();
			expect(screen.queryByTestId('editable-game-data')).toBeNull();
		});

		it('should expand the record given by initialExpandedId', () => {
			renderTable({ initialExpandedId: 'game_2' });
			expect(
				document.getElementById('record-game_2')?.classList.contains('expanded')
			).toBe(true);
			expect(
				document.getElementById('record-game_1')?.classList.contains('expanded')
			).toBe(false);
			expect(screen.getByText('Player3')).toBeDefined();
		});

		it('should scroll the initial record into view when supported', async () => {
			const scrollIntoView = vi.fn();
			Element.prototype.scrollIntoView = scrollIntoView;
			try {
				renderTable({ initialExpandedId: 'game_1' });
				await waitFor(() => expect(scrollIntoView).toHaveBeenCalled());
			} finally {
				// jsdom does not implement scrollIntoView
				delete (Element.prototype as Partial<Element>).scrollIntoView;
			}
		});

		it('should ignore an initialExpandedId that has no record', () => {
			renderTable({ initialExpandedId: 'missing' });
			expect(screen.queryByText('Blue team')).toBeNull();
		});
	});

	describe('editing and deleting a record', () => {
		const openFirstRecord = () =>
			fireEvent.click(screen.getByText('VICTORY').closest('button')!);

		it('should swap the scoreboard for the editor on Edit Record', () => {
			renderTable();
			openFirstRecord();
			fireEvent.click(screen.getByText('Edit Record'));

			expect(screen.getByTestId('players-count').textContent).toBe('2 players');
			expect(screen.getByTestId('match-result').textContent).toBe('VICTORY');
			expect(screen.queryByText('Blue team')).toBeNull();
		});

		it('should return to the scoreboard when the editor is closed', () => {
			renderTable();
			openFirstRecord();
			fireEvent.click(screen.getByText('Edit Record'));
			fireEvent.click(screen.getByText('Close Editor'));

			expect(screen.queryByTestId('editable-game-data')).toBeNull();
			expect(screen.getByText('Blue team')).toBeDefined();
		});

		it('should call updateGameRecord when edits are saved', () => {
			renderTable();
			openFirstRecord();
			fireEvent.click(screen.getByText('Edit Record'));
			fireEvent.click(screen.getByTestId('save-edits-button'));

			expect(gameStorage.updateGameRecord).toHaveBeenCalledWith(
				'game_1',
				mockRecords[0].players,
				mockRecords[0].matchInfo
			);
		});

		it('should delete the record after confirmation', async () => {
			renderTable();
			openFirstRecord();
			fireEvent.click(screen.getByText('Delete Record'));

			await waitFor(() => screen.getByText('Confirm'));
			fireEvent.click(screen.getByText('Confirm'));

			expect(gameStorage.deleteGameRecord).toHaveBeenCalledWith('game_1');
		});

		it('should not delete the record when cancelled', async () => {
			renderTable();
			openFirstRecord();
			fireEvent.click(screen.getByText('Delete Record'));

			await waitFor(() => screen.getByText('Confirm'));
			const closeButton = document.querySelector(
				'[data-scope="dialog"][data-part="close-trigger"]'
			);
			assert(closeButton, 'Dialog close button not found');
			fireEvent.click(closeButton);

			expect(gameStorage.deleteGameRecord).not.toHaveBeenCalled();
		});
	});

	describe('filters', () => {
		const rowCount = () => document.querySelectorAll('button.record-row').length;
		const search = (value: string) =>
			fireEvent.input(screen.getByLabelText('Search records'), {
				target: { value },
			});

		describe('search', () => {
			it.each([
				['map', 'hollywood', 'VICTORY'],
				['mode', 'payload', 'DEFEAT'],
				['hero', 'reinhardt', 'DEFEAT'],
				['player name', 'player2', 'VICTORY'],
			])('should match by %s', (_label, query, expected) => {
				renderTable();
				search(query);
				expect(rowCount()).toBe(1);
				expect(screen.getByText(expected)).toBeDefined();
			});
		});

		describe('result toggles', () => {
			it('should mark All as pressed by default', () => {
				renderTable();
				expect(screen.getByText('All').getAttribute('aria-pressed')).toBe('true');
			});

			it('should show only victories', () => {
				renderTable();
				fireEvent.click(screen.getByText('Victories'));
				expect(screen.getByText('Victories').getAttribute('aria-pressed')).toBe('true');
				expect(screen.getByText('All').getAttribute('aria-pressed')).toBe('false');
				expect(rowCount()).toBe(1);
				expect(screen.queryByText('DEFEAT')).toBeNull();
			});

			it('should show only defeats', () => {
				renderTable();
				fireEvent.click(screen.getByText('Defeats'));
				expect(rowCount()).toBe(1);
				expect(screen.queryByText('VICTORY')).toBeNull();
			});
		});

		describe('mode select', () => {
			it('should list the modes found in the records', () => {
				renderTable();
				const options = Array.from(
					(screen.getByLabelText('Mode') as HTMLSelectElement).options
				).map((o) => o.value);
				expect(options).toEqual(['all', 'ESCORT', 'PAYLOAD']);
			});

			it('should filter by mode', () => {
				renderTable();
				fireEvent.change(screen.getByLabelText('Mode'), { target: { value: 'ESCORT' } });
				expect(rowCount()).toBe(1);
				expect(screen.getByText('VICTORY')).toBeDefined();
			});
		});

		describe('no matches', () => {
			it('should show a no-match state with Clear filters', () => {
				renderTable();
				search('zzz');
				expect(screen.getByText('No records match')).toBeDefined();
				expect(rowCount()).toBe(0);
			});

			it('should restore all records on Clear filters', () => {
				renderTable();
				fireEvent.click(screen.getByText('Victories'));
				search('zzz');
				fireEvent.click(screen.getByText('Clear filters'));

				expect(rowCount()).toBe(2);
				expect((screen.getByLabelText('Search records') as HTMLInputElement).value).toBe(
					''
				);
				expect(screen.getByText('All').getAttribute('aria-pressed')).toBe('true');
				expect((screen.getByLabelText('Mode') as HTMLSelectElement).value).toBe('all');
			});
		});
	});

	describe('empty state', () => {
		beforeEach(() => {
			vi.mocked(gameStorage.loadGameRecords).mockReturnValue([]);
		});

		it('should show the drop zone', () => {
			renderTable();
			expect(screen.getByText('Drop scoreboard screenshots here')).toBeDefined();
			expect(screen.queryByLabelText('Search records')).toBeNull();
		});

		it('should open the file picker from Choose Files', () => {
			renderTable();
			fireEvent.click(screen.getByText('Choose Files'));
			expect(mockOnUploadClick).toHaveBeenCalled();
		});
	});

	describe('update game data', () => {
		const mockUpdate = vi.mocked(updateOverFastData);

		it('should show a success toast with counts', async () => {
			mockUpdate.mockResolvedValue({
				schemaVersion: 1,
				heroes: [{}, {}, {}] as OverFastHero[],
				maps: [{}, {}] as OverFastMap[],
				updatedAt: new Date('2025-11-11T00:00:00.000Z'),
			});
			renderTable();

			await clickMenuItem(/Update game data/);

			expect(await screen.findByText('Update Success')).toBeDefined();
			expect(screen.getByText('3 heroes and 2 maps updated.')).toBeDefined();
		});

		it('should show a failure toast when the update rejects', async () => {
			const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
			mockUpdate.mockRejectedValue(new Error('network'));
			renderTable();

			await clickMenuItem(/Update game data/);

			expect(await screen.findByText('Update Failed')).toBeDefined();
			expect(
				screen.getByText(
					'Could not fetch game data from OverFast. Please try again later.'
				)
			).toBeDefined();
			expect(errorSpy).toHaveBeenCalled();
			errorSpy.mockRestore();
		});

		it('should disable the item while pending and re-enable afterwards', async () => {
			let resolveUpdate!: (v: OverFastStore) => void;
			mockUpdate.mockReturnValue(new Promise((r) => (resolveUpdate = r)));
			renderTable();
			const item = () =>
				screen.getByRole('menuitem', { name: /Update game data/, hidden: true });
			await openMoreMenu();
			expect(item().hasAttribute('data-disabled')).toBe(false);

			fireEvent.click(item());
			await waitFor(() => expect(item().hasAttribute('data-disabled')).toBe(true));

			resolveUpdate({ schemaVersion: 1, heroes: [], maps: [], updatedAt: new Date() });
			await waitFor(() => expect(item().hasAttribute('data-disabled')).toBe(false));
		});
	});
});
