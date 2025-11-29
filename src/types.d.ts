/**
 * Centralized type definitions for VOWT
 * This file contains all shared type definitions used across the application
 */

type ExportFileType = 'vowt-game-records' | 'vowt-region-profile' | 'vowt-image-hashes';

interface ExportFileBase {
	type: ExportFileType;
	schemaVersion: number;
	exportedAt: string;
}

interface ExportRecordBase {
	createdAt: string;
	updatedAt: string;
}

type ExportedRecord<T> = Merge<T, ExportRecordBase>;

export type DateFieldName = 'createdAt' | 'updatedAt' | 'exportedAt';

// Utility Types

/**
 * Merges two types A and B, with B's properties taking precedence in case of conflicts
 */
export type Merge<A, B> = Omit<A, keyof B> & B;

// Game Records

export type PlayerStatsNumberFields = Record<
	'e' | 'a' | 'd' | 'dmg' | 'h' | 'mit',
	string
>;

export interface PlayerStats extends PlayerStatsNumberFields {
	name: string;
	team: 'blue' | 'red';
	hero?: string;
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
	map?: string;
}

export interface GameRecord {
	id: string;
	players: PlayerStats[];
	matchInfo: MatchInfo;
	createdAt: Date;
	updatedAt: Date;
}

export interface ExportedGameRecords extends ExportFileBase {
	type: 'vowt-game-records';
	records: ExportedRecord<GameRecord>[];
}

// OCR Region Profiles

export interface TextRegion {
	name: string;
	x: number;
	y: number;
	width: number;
	height: number;
	charSet?: string;
	isItalic?: boolean;
	imgHashSet?: string;
}

export type DrawnRegion = TextRegion & {
	id: string;
	colour: string;
};

export interface ProfileDetails {
	id: string;
	description: string;
}

export interface RegionProfile extends ProfileDetails {
	regions: TextRegion[];
	hashSets: ImageHashSet[];
	createdAt: Date;
	updatedAt: Date;
}

export interface ExportedProfile extends ExportFileBase {
	type: 'vowt-region-profile';
	profile: ExportedRecord<RegionProfile>;
}

export interface ImageHash {
	name: string;
	hash: string;
}

export interface ImageHashSet {
	id: string;
	description: string;
	hashes: ImageHash[];
	createdAt: Date;
	updatedAt: Date;
}

export interface ExportedImageHashSet extends ExportFileBase {
	type: 'vowt-image-hashes';
	hashSet: ExportedRecord<ImageHashSet>;
}
