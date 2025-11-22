import { describe, it, expect, beforeEach } from 'vitest';

import type { PlayerStats, MatchInfo } from '#types';
import {
    loadGameRecords,
    saveGameRecord,
    deleteGameRecord,
    updateGameRecord,
    clearAllGameRecords,
    exportGameRecords,
    importGameRecords,
} from '#utils/gameStorage';

describe('gameStorage', () => {
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
        },
    ];

    const mockMatchInfo: MatchInfo = {
        result: 'VICTORY',
        final_score: { blue: '3', red: '2' },
        date: '09/15/25 - 02:49',
        game_mode: 'ESCORT',
        game_length: '10:25',
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
        };

        const updatedRecord = updateGameRecord(
            recordId,
            updatedPlayers,
            updatedMatchInfo
        );

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
        const result = updateGameRecord(
            'non-existent-id',
            mockPlayers,
            mockMatchInfo
        );
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
});
