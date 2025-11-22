/**
 * Storage utilities for managing game data in localStorage
 */

import type {
    Merge,
    PlayerStats,
    MatchInfo,
    GameRecord,
    ExportedGameRecords,
} from '#types';

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

const STORAGE_KEY = 'vowt_game_records';
const SCHEMA_VERSION = 2;
const DATE_FIELD_NAMES = ['createdAt', 'updatedAt', 'exportedAt'];

export const PLAYER_STATS_NUMBER_FIELD_NAMES = [
    'e',
    'a',
    'd',
    'dmg',
    'h',
    'mit',
] as const;

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
        const data = localStorage.getItem(STORAGE_KEY);
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

export function triggerUploadDialog(callback: (imageData: string) => void) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (event) => {
        const input = event.target as HTMLInputElement;
        const file = input.files?.[0] as File;

        handleFileUpload(file, callback);
    };
    input.click();
}

export function handleFileUpload(
    file: File,
    callback: (imageData: string) => void
) {
    if (file && file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (event) => {
            callback(event.target?.result as string);
        };
        reader.readAsDataURL(file);
    }
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
    localStorage.setItem(STORAGE_KEY, JSON.stringify(storageData));
}

/**
 * Save a new game record to localStorage
 * @returns The saved GameRecord ID
 */
export function saveGameRecord(
    players: PlayerStats[],
    matchInfo: MatchInfo
): string {
    const now = new Date();
    const record: GameRecord = {
        id: _generateGameId(),
        players,
        matchInfo,
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
 */
export function updateGameRecord(
    id: string,
    players: PlayerStats[],
    matchInfo: MatchInfo
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
        localStorage.removeItem(STORAGE_KEY);
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
