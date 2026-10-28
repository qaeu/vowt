import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import type { PlayerStats, MatchInfo, InsightsSummary } from '#types';
import {
	loadGameRecords,
	saveGameRecord,
	deleteGameRecord,
	updateGameRecord,
	clearAllGameRecords,
	exportGameRecords,
	importGameRecords,
	loadSettings,
	saveSettings,
	readImageFiles,
	triggerUploadDialog,
	hashScreenshot,
	findGameRecordByScreenshot,
	exportInsightsSummary,
} from '#utils/storage';

describe('storage', () => {
	const mockPlayers: PlayerStats[] = [
		{
			name: 'Player1',
			team: 'blue',
			e: '10',
			a: '5',
			d: '2',
			dmg: '5000',
			h: '3000',
			mit: '1000',
			hero: 'Tracer',
		},
	];

	const mockMatchInfo: MatchInfo = {
		result: 'VICTORY',
		final_score: { blue: '3', red: '2' },
		date: '09/15/25 - 02:49',
		game_mode: 'ESCORT',
		game_length: '10:25',
		map: 'Hollywood',
	};

	beforeEach(() => {
		// Clear localStorage before each test
		clearAllGameRecords();
	});

	it('should save and load game records', () => {
		const recordId = saveGameRecord(mockPlayers, mockMatchInfo);
		expect(recordId).toBeDefined();

		const records = loadGameRecords();
		expect(records.length).toBe(1);
		expect(records[0].id).toBe(recordId);
		expect(records[0].players).toEqual(mockPlayers);
		expect(records[0].matchInfo).toEqual(mockMatchInfo);
	});

	it('should load empty array when no records exist', () => {
		const records = loadGameRecords();
		expect(records).toEqual([]);
	});

	it('should save multiple game records', () => {
		saveGameRecord(mockPlayers, mockMatchInfo);
		saveGameRecord(mockPlayers, mockMatchInfo);
		saveGameRecord(mockPlayers, mockMatchInfo);

		const records = loadGameRecords();
		expect(records.length).toBe(3);
	});

	it('should delete a game record by id', () => {
		const record1Id = saveGameRecord(mockPlayers, mockMatchInfo);
		const record2Id = saveGameRecord(mockPlayers, mockMatchInfo);

		deleteGameRecord(record1Id);

		const records = loadGameRecords();
		expect(records.length).toBe(1);
		expect(records[0].id).toBe(record2Id);
	});

	it('should update a game record by id', () => {
		const recordId = saveGameRecord(mockPlayers, mockMatchInfo);

		const updatedPlayers: PlayerStats[] = [
			{
				name: 'UpdatedPlayer1',
				team: 'blue',
				e: '20',
				a: '10',
				d: '4',
				dmg: '10000',
				h: '6000',
				mit: '2000',
			},
		];

		const updatedMatchInfo: MatchInfo = {
			result: 'DEFEAT',
			final_score: { blue: '2', red: '3' },
			date: '09/16/25 - 03:50',
			game_mode: 'CONTROL',
			game_length: '12:30',
			map: 'ILIOS',
		};

		const updatedRecord = updateGameRecord(recordId, updatedPlayers, updatedMatchInfo);

		expect(updatedRecord).toBeTruthy();
		expect(updatedRecord?.id).toBe(recordId);
		expect(updatedRecord?.players).toEqual(updatedPlayers);
		expect(updatedRecord?.matchInfo).toEqual(updatedMatchInfo);

		const records = loadGameRecords();
		expect(records.length).toBe(1);
		expect(records[0].players).toEqual(updatedPlayers);
		expect(records[0].matchInfo).toEqual(updatedMatchInfo);
	});

	it('should return null when updating non-existent record', () => {
		const result = updateGameRecord('non-existent-id', mockPlayers, mockMatchInfo);
		expect(result).toBeNull();
	});

	it('should clear all game records', () => {
		saveGameRecord(mockPlayers, mockMatchInfo);
		saveGameRecord(mockPlayers, mockMatchInfo);

		clearAllGameRecords();

		const records = loadGameRecords();
		expect(records).toEqual([]);
	});

	it('should export game records as JSON', () => {
		saveGameRecord(mockPlayers, mockMatchInfo);
		const exported = exportGameRecords();

		expect(exported).toBeDefined();
		const parsed = JSON.parse(exported);
		expect(parsed.type).toBe('vowt-game-records');
		expect(parsed.schemaVersion).toBe(2);
		expect(parsed.records.length).toBe(1);
		expect(parsed.records[0].players).toEqual(mockPlayers);
		expect(parsed.exportedAt).toBeDefined();
	});

	it('should import game records from JSON', () => {
		const recordId = saveGameRecord(mockPlayers, mockMatchInfo);
		const exported = exportGameRecords();

		clearAllGameRecords();

		const importedCount = importGameRecords(exported);
		expect(importedCount).toBe(1);

		const records = loadGameRecords();
		expect(records.length).toBe(1);
		expect(records[0].id).toBe(recordId);
	});

	it('should not import duplicate records', () => {
		saveGameRecord(mockPlayers, mockMatchInfo);
		const exported = exportGameRecords();

		// Try to import the same records again
		const importedCount = importGameRecords(exported);
		expect(importedCount).toBe(0);

		const records = loadGameRecords();
		expect(records.length).toBe(1);
	});

	it('should generate unique IDs for each record', () => {
		const record1Id = saveGameRecord(mockPlayers, mockMatchInfo);
		const record2Id = saveGameRecord(mockPlayers, mockMatchInfo);

		expect(record1Id).not.toBe(record2Id);
	});

	it('should handle corrupted localStorage data gracefully', () => {
		localStorage.setItem('vowt_game_records', 'invalid json');

		// Should return empty array without throwing
		const records = loadGameRecords();
		expect(records).toEqual([]);
	});

	describe('screenshot hashes', () => {
		const image = 'data:image/png;base64,screenshot';

		describe('hashScreenshot', () => {
			it('should return a hex SHA-256 digest', async () => {
				expect(await hashScreenshot(image)).toMatch(/^[0-9a-f]{64}$/);
			});

			it('should return the same hash for the same screenshot', async () => {
				expect(await hashScreenshot(image)).toBe(await hashScreenshot(image));
			});

			it('should return different hashes for different screenshots', async () => {
				expect(await hashScreenshot(image)).not.toBe(
					await hashScreenshot('data:image/png;base64,other')
				);
			});

			it('should return null when hashing fails', async () => {
				vi.spyOn(console, 'error').mockImplementation(() => {});
				vi.spyOn(crypto.subtle, 'digest').mockRejectedValueOnce(new Error('No crypto'));
				expect(await hashScreenshot(image)).toBeNull();
				vi.restoreAllMocks();
			});
		});

		describe('findGameRecordByScreenshot', () => {
			it('should find the record saved with a screenshot hash', () => {
				saveGameRecord(mockPlayers, mockMatchInfo);
				const recordId = saveGameRecord(mockPlayers, mockMatchInfo, 'abc123');

				expect(findGameRecordByScreenshot('abc123')?.id).toBe(recordId);
			});

			it('should return undefined when no record matches', () => {
				saveGameRecord(mockPlayers, mockMatchInfo, 'abc123');
				expect(findGameRecordByScreenshot('def456')).toBeUndefined();
			});

			it('should not store a hash when none is given', () => {
				saveGameRecord(mockPlayers, mockMatchInfo);
				expect(loadGameRecords()[0]).not.toHaveProperty('screenshotHashes');
			});

			it('should keep the hash through export and import', () => {
				const recordId = saveGameRecord(mockPlayers, mockMatchInfo, 'abc123');
				const exported = exportGameRecords();
				clearAllGameRecords();

				importGameRecords(exported);

				expect(findGameRecordByScreenshot('abc123')?.id).toBe(recordId);
			});

			it('should keep the hash when the record is updated', () => {
				const recordId = saveGameRecord(mockPlayers, mockMatchInfo, 'abc123');
				updateGameRecord(recordId, [], mockMatchInfo);

				expect(findGameRecordByScreenshot('abc123')?.id).toBe(recordId);
			});

			it('should find a record by any of its screenshots', () => {
				const recordId = saveGameRecord(mockPlayers, mockMatchInfo, 'abc123');
				updateGameRecord(recordId, mockPlayers, mockMatchInfo, ['abc123', 'def456']);

				expect(findGameRecordByScreenshot('abc123')?.id).toBe(recordId);
				expect(findGameRecordByScreenshot('def456')?.id).toBe(recordId);
			});

			it('should replace the hashes when updating with new ones', () => {
				const recordId = saveGameRecord(mockPlayers, mockMatchInfo, 'abc123');
				updateGameRecord(recordId, mockPlayers, mockMatchInfo, []);

				expect(findGameRecordByScreenshot('abc123')).toBeUndefined();
			});
		});
	});
});

describe('settings storage', () => {
	beforeEach(() => {
		localStorage.removeItem('vowt_settings');
	});

	it('should return default settings when none are stored', () => {
		const settings = loadSettings();
		expect(settings).toEqual({ darkMode: false, trackedPlayer: null });
	});

	it('should save and load settings', () => {
		saveSettings({ darkMode: true, trackedPlayer: null });
		const settings = loadSettings();
		expect(settings.darkMode).toBe(true);
	});

	it('should overwrite previously saved settings', () => {
		saveSettings({ darkMode: true, trackedPlayer: null });
		saveSettings({ darkMode: false, trackedPlayer: null });
		const settings = loadSettings();
		expect(settings.darkMode).toBe(false);
	});

	it('should store a schema version with the settings', () => {
		saveSettings({ darkMode: true, trackedPlayer: null });
		const stored = JSON.parse(localStorage.getItem('vowt_settings')!);
		expect(stored).toEqual({ schemaVersion: 1, darkMode: true, trackedPlayer: null });
	});

	it('should return a fresh copy of the defaults', () => {
		const settings = loadSettings();
		settings.darkMode = true;
		expect(loadSettings().darkMode).toBe(false);
	});

	describe('trackedPlayer', () => {
		beforeEach(() => {
			vi.spyOn(console, 'warn').mockImplementation(() => {});
		});

		afterEach(() => {
			vi.restoreAllMocks();
		});

		it('should default to null', () => {
			expect(loadSettings().trackedPlayer).toBeNull();
		});

		it('should save and load a tracked player', () => {
			saveSettings({ darkMode: false, trackedPlayer: 'ALICE' });
			expect(loadSettings().trackedPlayer).toBe('ALICE');
			const stored = JSON.parse(localStorage.getItem('vowt_settings')!);
			expect(stored.schemaVersion).toBe(1);
		});

		it('should keep the tracked player when dark mode changes', () => {
			saveSettings({ darkMode: false, trackedPlayer: 'ALICE' });
			saveSettings({ ...loadSettings(), darkMode: true });
			expect(loadSettings()).toEqual({ darkMode: true, trackedPlayer: 'ALICE' });
		});

		it('should trim the stored name', () => {
			localStorage.setItem('vowt_settings', '{"trackedPlayer":"  Bob "}');
			expect(loadSettings().trackedPlayer).toBe('Bob');
		});

		it.each([['""'], ['"   "'], ['5'], ['true'], ['{}'], ['null']])(
			'should fall back to null for %s',
			(value) => {
				localStorage.setItem('vowt_settings', `{"trackedPlayer":${value}}`);
				expect(loadSettings().trackedPlayer).toBeNull();
			}
		);

		it('should load settings saved before trackedPlayer existed', () => {
			localStorage.setItem('vowt_settings', '{"schemaVersion":1,"darkMode":true}');
			expect(loadSettings()).toEqual({ darkMode: true, trackedPlayer: null });
			expect(console.warn).not.toHaveBeenCalled();
		});
	});

	describe('invalid stored settings', () => {
		beforeEach(() => {
			vi.spyOn(console, 'error').mockImplementation(() => {});
			vi.spyOn(console, 'warn').mockImplementation(() => {});
		});

		afterEach(() => {
			vi.restoreAllMocks();
		});

		it('should return defaults for corrupt JSON', () => {
			localStorage.setItem('vowt_settings', '{not json');
			expect(loadSettings()).toEqual({ darkMode: false, trackedPlayer: null });
			expect(console.error).toHaveBeenCalled();
		});

		it('should return defaults for a non-object value', () => {
			localStorage.setItem('vowt_settings', 'null');
			expect(loadSettings()).toEqual({ darkMode: false, trackedPlayer: null });
		});

		it('should use defaults for fields with the wrong type', () => {
			localStorage.setItem('vowt_settings', '{"schemaVersion":1,"darkMode":"yes"}');
			expect(loadSettings()).toEqual({ darkMode: false, trackedPlayer: null });
		});

		it('should ignore unknown fields', () => {
			localStorage.setItem('vowt_settings', '{"schemaVersion":1,"darkMode":true,"x":1}');
			expect(loadSettings()).toEqual({ darkMode: true, trackedPlayer: null });
		});

		it('should load unversioned settings', () => {
			localStorage.setItem('vowt_settings', '{"darkMode":true}');
			expect(loadSettings()).toEqual({ darkMode: true, trackedPlayer: null });
			expect(console.warn).not.toHaveBeenCalled();
		});

		it('should warn about an unexpected schema version', () => {
			localStorage.setItem('vowt_settings', '{"schemaVersion":99,"darkMode":true}');
			expect(loadSettings()).toEqual({ darkMode: true, trackedPlayer: null });
			expect(console.warn).toHaveBeenCalled();
		});

		it('should not throw when settings cannot be saved', () => {
			vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
				throw new Error('QuotaExceededError');
			});
			expect(() => saveSettings({ darkMode: true, trackedPlayer: null })).not.toThrow();
			expect(console.error).toHaveBeenCalled();
		});
	});
});

describe('exportInsightsSummary', () => {
	const summary = {
		filters: {
			player: 'ALICE',
			period: 'all',
			compare: 'none',
			role: 'all',
			mode: 'all',
		},
		generatedAt: new Date('2025-03-01T00:00:00.000Z'),
		totalGames: 0,
	} as unknown as InsightsSummary;

	it('should wrap the summary with type, schema version and timestamp', () => {
		const parsed = JSON.parse(exportInsightsSummary(summary));
		expect(parsed.type).toBe('vowt-insights-summary');
		expect(parsed.schemaVersion).toBe(1);
		expect(parsed.exportedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
		expect(parsed.summary.filters.player).toBe('ALICE');
		expect(parsed.summary.generatedAt).toBe('2025-03-01T00:00:00.000Z');
	});

	it('should use the current time for exportedAt', () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2025-06-01T12:00:00.000Z'));
		try {
			expect(JSON.parse(exportInsightsSummary(summary)).exportedAt).toBe(
				'2025-06-01T12:00:00.000Z'
			);
		} finally {
			vi.useRealTimers();
		}
	});
});

describe('upload helpers', () => {
	const png = (name: string, content = name) =>
		new File([content], name, { type: 'image/png' });
	const toDataURL = (content: string) =>
		`data:image/png;base64,${Buffer.from(content).toString('base64')}`;

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('readImageFiles', () => {
		it('should read multiple images as data URLs in the given order', async () => {
			const images = await readImageFiles([png('a.png'), png('b.png'), png('c.png')]);
			expect(images).toEqual([
				toDataURL('a.png'),
				toDataURL('b.png'),
				toDataURL('c.png'),
			]);
		});

		it('should skip non-image files', async () => {
			const text = new File(['text'], 'notes.txt', { type: 'text/plain' });
			const images = await readImageFiles([text, png('a.png')]);
			expect(images).toEqual([toDataURL('a.png')]);
		});

		it('should return an empty list when no files are given', async () => {
			expect(await readImageFiles([])).toEqual([]);
		});

		it('should skip files that fail to read', async () => {
			vi.spyOn(console, 'error').mockImplementation(() => {});
			const OriginalFileReader = globalThis.FileReader;
			let calls = 0;
			vi.spyOn(globalThis, 'FileReader').mockImplementation(function () {
				const reader = new OriginalFileReader();
				if (calls++ === 0) {
					reader.readAsDataURL = function () {
						this.onerror?.(new ProgressEvent('error') as ProgressEvent<FileReader>);
					};
				}
				return reader;
			});

			const images = await readImageFiles([png('broken.png'), png('b.png')]);

			expect(images).toEqual([toDataURL('b.png')]);
			expect(console.error).toHaveBeenCalled();
		});
	});

	describe('triggerUploadDialog', () => {
		const openDialog = (files: File[]) => {
			const input = document.createElement('input');
			vi.spyOn(document, 'createElement').mockReturnValue(input);
			vi.spyOn(input, 'click').mockImplementation(() => {});
			const callback = vi.fn();

			triggerUploadDialog(callback);
			Object.defineProperty(input, 'files', { value: files });
			input.dispatchEvent(new Event('change'));

			return { input, callback };
		};

		it('should allow selecting multiple images', () => {
			const { input } = openDialog([]);
			expect.soft(input.type).toBe('file');
			expect.soft(input.accept).toBe('image/*');
			expect.soft(input.multiple).toBe(true);
		});

		it('should pass all selected images to the callback', async () => {
			const { callback } = openDialog([png('a.png'), png('b.png')]);
			await vi.waitFor(() => expect(callback).toHaveBeenCalledOnce());
			expect(callback).toHaveBeenCalledWith([toDataURL('a.png'), toDataURL('b.png')]);
		});

		it('should not call the callback when no images are selected', async () => {
			const text = new File(['text'], 'notes.txt', { type: 'text/plain' });
			const { callback } = openDialog([text]);
			await new Promise((resolve) => setTimeout(resolve, 10));
			expect(callback).not.toHaveBeenCalled();
		});
	});
});
