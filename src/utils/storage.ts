/**
 * Storage utilities for managing app data in localStorage
 */

import type {
	Settings,
	Merge,
	PlayerStats,
	MatchInfo,
	GameRecord,
	ExportedGameRecords,
} from '#types';

interface SettingsStore extends Settings {
	schemaVersion: number;
}

interface GameStore {
	schemaVersion: number;
	records: GameRecord[];
}

type ImportedGameRecords = Merge<
	ExportedGameRecords,
	{
		records: GameRecord[];
	}
>;

const GAME_RECORDS_STORAGE_KEY = 'vowt_game_records';
const SCHEMA_VERSION = 2;
const DATE_FIELD_NAMES = ['createdAt', 'updatedAt', 'exportedAt'];

const SETTINGS_STORAGE_KEY = 'vowt_settings';
const SETTINGS_SCHEMA_VERSION = 1;
const DEFAULT_SETTINGS: Settings = {
	darkMode: false,
};

export const PLAYER_STATS_NUMBER_FIELD_NAMES = [
	'e',
	'a',
	'd',
	'dmg',
	'h',
	'mit',
] as const;

// Game Records

function _reviver(key: string, value: unknown) {
	if (DATE_FIELD_NAMES.includes(key)) {
		return new Date(value as string);
	}
	return value;
}

/**
 * Generate a unique ID for a game record
 */
function _generateGameId(): string {
	return `game_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

function _loadStorage(): GameStore {
	try {
		const data = localStorage.getItem(GAME_RECORDS_STORAGE_KEY);
		if (!data) {
			return { schemaVersion: SCHEMA_VERSION, records: [] };
		}

		const stored: GameStore = JSON.parse(data, _reviver);

		// Handle schema version for future migrations
		if (stored.schemaVersion !== SCHEMA_VERSION) {
			console.error(
				`Stored game records use schema version ${stored.schemaVersion}, expected ${SCHEMA_VERSION}`
			);
			return { schemaVersion: SCHEMA_VERSION, records: [] };
		}

		return stored;
	} catch (error) {
		console.error('Error loading game records:', error);
		return { schemaVersion: SCHEMA_VERSION, records: [] };
	}
}

/** Reads a file as a data URL, resolving null if it cannot be read */
function _readFileAsDataURL(file: File): Promise<string | null> {
	return new Promise((resolve) => {
		const reader = new FileReader();
		reader.onload = (event) => resolve((event.target?.result as string) ?? null);
		reader.onerror = () => {
			console.error(`Error reading file '${file.name}':`, reader.error);
			resolve(null);
		};
		reader.readAsDataURL(file);
	});
}

/**
 * Opens a file picker for one or more images
 * @param callback - Receives the selected images as data URLs, in selection order
 */
export function triggerUploadDialog(callback: (images: string[]) => void) {
	const input = document.createElement('input');
	input.type = 'file';
	input.accept = 'image/*';
	input.multiple = true;
	input.onchange = async (event) => {
		const input = event.target as HTMLInputElement;
		const images = await readImageFiles(input.files ?? []);
		if (images.length > 0) {
			callback(images);
		}
	};
	input.click();
}

/**
 * Reads image files as data URLs, skipping non-images and files that fail to read
 * @returns Data URLs in the order the files were given
 */
export async function readImageFiles(files: FileList | File[]): Promise<string[]> {
	const imageFiles = Array.from(files).filter((file) => file.type.startsWith('image/'));
	const images = await Promise.all(imageFiles.map(_readFileAsDataURL));
	return images.filter((image): image is string => image !== null);
}

/**
 * Load all game records from localStorage
 */
export function loadGameRecords(): GameRecord[] {
	const store = _loadStorage();
	return store.records;
}

function _saveGameRecords(storage: GameStore): void {
	const storageData: GameStore = {
		schemaVersion: SCHEMA_VERSION,
		records: storage.records,
	};
	localStorage.setItem(GAME_RECORDS_STORAGE_KEY, JSON.stringify(storageData));
}

/**
 * Hashes a screenshot so a re-upload of the same file can be recognised
 * @param image - Screenshot as a data URL
 * @returns Hex-encoded SHA-256 of the data URL, or null if hashing is unavailable
 */
export async function hashScreenshot(image: string): Promise<string | null> {
	try {
		const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(image));
		return Array.from(new Uint8Array(digest), (byte) =>
			byte.toString(16).padStart(2, '0')
		).join('');
	} catch (error) {
		console.error('Error hashing screenshot:', error);
		return null;
	}
}

/**
 * Finds the game record read from a screenshot
 * @param screenshotHash - Hash from hashScreenshot
 */
export function findGameRecordByScreenshot(
	screenshotHash: string
): GameRecord | undefined {
	return _loadStorage().records.find((r) => r.screenshotHashes?.includes(screenshotHash));
}

/**
 * Save a new game record to localStorage
 * @param screenshotHash - Hash of the source screenshot, if known
 * @returns The saved GameRecord ID
 */
export function saveGameRecord(
	players: PlayerStats[],
	matchInfo: MatchInfo,
	screenshotHash?: string
): string {
	const now = new Date();
	const record: GameRecord = {
		id: _generateGameId(),
		players,
		matchInfo,
		...(screenshotHash && { screenshotHashes: [screenshotHash] }),
		createdAt: now,
		updatedAt: now,
	};

	try {
		const storage = _loadStorage();
		storage.records.push(record);

		_saveGameRecords(storage);
		return record.id;
	} catch (error) {
		console.error('Error saving game record:', error);
		throw error;
	}
}

/**
 * Update an existing game record
 * @param screenshotHashes - Replaces the record's screenshot hashes, if given
 */
export function updateGameRecord(
	id: string,
	players: PlayerStats[],
	matchInfo: MatchInfo,
	screenshotHashes?: string[]
): GameRecord | null {
	try {
		const stored = _loadStorage();
		const index = stored.records.findIndex((r) => r.id === id);

		if (index === -1) {
			return null;
		}

		const now = new Date();
		stored.records[index] = {
			...stored.records[index],
			players,
			matchInfo,
			...(screenshotHashes && { screenshotHashes }),
			updatedAt: now,
		};

		_saveGameRecords(stored);
		return stored.records[index];
	} catch (error) {
		console.error('Error updating game record:', error);
		throw error;
	}
}

/**
 * Delete a game record by ID
 */
export function deleteGameRecord(recordId: string): void {
	try {
		const stored = _loadStorage();
		const filteredRecords = stored.records.filter((r) => r.id !== recordId);

		if (filteredRecords.length === stored.records.length) {
			throw `Game record with ID "${recordId}" not found.`;
		}

		_saveGameRecords({ ...stored, records: filteredRecords });
	} catch (error) {
		console.error('Error deleting game record:', error);
		throw error;
	}
}

/**
 * Clear all game records
 */
export function clearAllGameRecords(): void {
	try {
		localStorage.removeItem(GAME_RECORDS_STORAGE_KEY);
	} catch (error) {
		console.error('Error clearing game records:', error);
		throw error;
	}
}

/**
 * Export game records as JSON string
 */
export function exportGameRecords(): string {
	const stored = _loadStorage();

	const exportData: ExportedGameRecords = {
		type: 'vowt-game-records',
		schemaVersion: SCHEMA_VERSION,
		records: stored.records as unknown as ExportedGameRecords['records'],
		exportedAt: new Date() as unknown as string,
	};

	return JSON.stringify(exportData, null, 2);
}

/**
 * Import game records from JSON string
 */
export function importGameRecords(jsonData: string): number {
	try {
		const parsed: ImportedGameRecords = JSON.parse(jsonData, _reviver);
		const store = _loadStorage();

		// Handle schema version for future migrations
		if (parsed.schemaVersion !== SCHEMA_VERSION) {
			console.warn(
				`Imported game records use schema version ${parsed.schemaVersion}, expected ${SCHEMA_VERSION}`
			);
		}

		// Merge with existing records, avoiding duplicates by ID
		const existingIds = new Set(store.records.map((r) => r.id));
		const newRecords = parsed.records.filter((r) => !existingIds.has(r.id));

		const mergedRecords = [...store.records, ...newRecords];
		_saveGameRecords({
			schemaVersion: SCHEMA_VERSION,
			records: mergedRecords,
		});

		return newRecords.length;
	} catch (error) {
		console.error('Error importing game records:', error);
		throw error;
	}
}

// Settings

/**
 * Builds settings from stored values, using defaults for missing or invalid fields
 */
function _sanitiseSettings(stored: unknown): Settings {
	const values =
		typeof stored === 'object' && stored !== null ?
			(stored as Partial<Record<keyof Settings, unknown>>)
		:	{};

	return {
		darkMode:
			typeof values.darkMode === 'boolean' ? values.darkMode : DEFAULT_SETTINGS.darkMode,
	};
}

/**
 * Loads app settings from localStorage
 * @returns Stored settings, with defaults for anything missing, invalid or unreadable
 */
export function loadSettings(): Settings {
	try {
		const data = localStorage.getItem(SETTINGS_STORAGE_KEY);
		if (!data) {
			return { ...DEFAULT_SETTINGS };
		}

		const stored: unknown = JSON.parse(data);
		const schemaVersion = (stored as Partial<SettingsStore> | null)?.schemaVersion;
		// Settings saved before versioning have no schemaVersion and use the same fields
		if (schemaVersion !== undefined && schemaVersion !== SETTINGS_SCHEMA_VERSION) {
			console.warn(
				`Settings storage uses schema version ${schemaVersion}, expected ${SETTINGS_SCHEMA_VERSION}`
			);
		}

		return _sanitiseSettings(stored);
	} catch (error) {
		console.error('Error loading settings:', error);
		return { ...DEFAULT_SETTINGS };
	}
}

/**
 * Saves app settings to localStorage; failures are logged, not thrown
 * @param settings - Settings to save
 */
export function saveSettings(settings: Settings): void {
	try {
		const store: SettingsStore = { schemaVersion: SETTINGS_SCHEMA_VERSION, ...settings };
		localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(store));
	} catch (error) {
		console.error('Error saving settings:', error);
	}
}
