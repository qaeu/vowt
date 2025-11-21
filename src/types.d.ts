/**
 * Centralized type definitions for VOWT
 * This file contains all shared type definitions used across the application
 */

/**
 * Game Storage Types
 */

export type PlayerStatsNumberFields = Record<
    'e' | 'a' | 'd' | 'dmg' | 'h' | 'mit',
    string
>;

export interface PlayerStats {
    name: string;
    team: 'blue' | 'red';
    e: string;
    a: string;
    d: string;
    dmg: string;
    h: string;
    mit: string;
}

export interface MatchInfo {
    result: string;
    final_score: {
        blue: string;
        red: string;
    };
    date: string;
    game_mode: string;
    game_length: string;
}

export interface GameRecord {
    id: string;
    timestamp: number;
    players: PlayerStats[];
    matchInfo: MatchInfo;
    version: number;
}

/**
 * Text Region Types
 */

export interface TextRegion {
    name: string;
    x: number;
    y: number;
    width: number;
    height: number;
    charSet?: string;
    isItalic?: boolean;
}

/**
 * Region Editor Types
 */

export type DrawnRegion = TextRegion & {
    color: string;
};

/**
 * Region Profile Types
 */

export interface ExportedProfile {
    type: 'vowt-region-profile';
    schemaVersion: number;
    profile: {
        id: string;
        description: string;
        regions: TextRegion[];
        createdAt: string;
        updatedAt: string;
    };
    exportedAt: string;
}
