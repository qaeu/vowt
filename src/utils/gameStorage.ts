/**
 * Storage utilities for managing game data in localStorage
 */

import type {
    PlayerStatsNumberFields,
    PlayerStats,
    MatchInfo,
    GameRecord,
} from '#/types';

export const PLAYER_STATS_NUMBER_FIELD_NAMES = [
    'e',
    'a',
    'd',
    'dmg',
    'h',
    'mit',
] as const;

export type {
    PlayerStatsNumberFields,
    PlayerStats,
    MatchInfo,
    GameRecord,
};

const STORAGE_KEY = 'vowt_game_records';
const SCHEMA_VERSION = 1;

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
 * Generate a unique ID for a game record
 */
function generateGameId(): string {
    return `game_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Load all game records from localStorage
 */
export function loadGameRecords(): GameRecord[] {
    try {
        const data = localStorage.getItem(STORAGE_KEY);
        if (!data) {
            return [];
        }
        const records = JSON.parse(data) as GameRecord[];
        return records.filter((record) => record.version === SCHEMA_VERSION);
    } catch (error) {
        console.error('Error loading game records:', error);
        return [];
    }
}

/**
 * Save a new game record to localStorage
 */
export function saveGameRecord(
    players: PlayerStats[],
    matchInfo: MatchInfo
): GameRecord {
    const record: GameRecord = {
        id: generateGameId(),
        timestamp: Date.now(),
        players,
        matchInfo,
        version: SCHEMA_VERSION,
    };

    try {
        const records = loadGameRecords();
        records.push(record);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
        return record;
    } catch (error) {
        console.error('Error saving game record:', error);
        throw error;
    }
}

/**
 * Delete a game record by ID
 */
export function deleteGameRecord(id: string): void {
    try {
        const records = loadGameRecords();
        const filtered = records.filter((record) => record.id !== id);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    } catch (error) {
        console.error('Error deleting game record:', error);
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
        const records = loadGameRecords();
        const index = records.findIndex((record) => record.id === id);

        if (index === -1) {
            return null;
        }

        // Update the record, preserving id, timestamp, and version
        records[index] = {
            ...records[index],
            players,
            matchInfo,
        };

        localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
        return records[index];
    } catch (error) {
        console.error('Error updating game record:', error);
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
    const records = loadGameRecords();
    return JSON.stringify(records, null, 2);
}

/**
 * Import game records from JSON string
 */
export function importGameRecords(jsonData: string): number {
    try {
        const importedRecords = JSON.parse(jsonData) as GameRecord[];
        const existingRecords = loadGameRecords();

        // Filter valid records with correct version
        const validRecords = importedRecords.filter(
            (record) =>
                record.version === SCHEMA_VERSION &&
                record.id &&
                record.timestamp
        );

        // Merge with existing records, avoiding duplicates by ID
        const existingIds = new Set(existingRecords.map((r) => r.id));
        const newRecords = validRecords.filter((r) => !existingIds.has(r.id));

        const mergedRecords = [...existingRecords, ...newRecords];
        localStorage.setItem(STORAGE_KEY, JSON.stringify(mergedRecords));

        return newRecords.length;
    } catch (error) {
        console.error('Error importing game records:', error);
        throw error;
    }
}
