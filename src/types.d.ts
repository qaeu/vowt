import type { Component } from 'solid-js';

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

export interface Settings {
	darkMode: boolean;
}

// UI Component Types

export interface ScreenAction {
	id: string;
	text: string;
	class?: string;
	icon?: Component;
	disabled?: () => boolean;
	onClick?: () => void;
}

export interface AlertDialogOptions {
	title: string;
	description: string;
	actionText?: string;
	onConfirm?: () => void;
}

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
	map: string;
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

// OverFast API types

/** Hero entry from OverFast API /heroes endpoint */
export interface OverFastHero {
	key: string;
	name: string;
	portrait: string;
	role: 'damage' | 'support' | 'tank';
}

/** Map entry from OverFast API /maps endpoint */
export interface OverFastMap {
	key: string;
	name: string;
	screenshot: string;
	gamemodes: string[];
	location: string;
	country_code: string | null;
}

/** Stored hero with optional portrait hash */
export interface StoredHero {
	key: string;
	name: string;
	portrait: string;
	role: 'damage' | 'support' | 'tank';
	portraitHash: string | null;
}

/** Stored map data */
export interface StoredMap {
	key: string;
	name: string;
	screenshot: string;
	gamemodes: string[];
	location: string;
	country_code: string | null;
}

/** localStorage schema for OverFast API data */
export interface OverFastStore {
	schemaVersion: number;
	heroes: StoredHero[];
	maps: StoredMap[];
	updatedAt: Date;
}

// Recognition processing

/** Partitioned region group for processing */
export interface PartitionGroup {
	charSet: string;
	regions: TextRegion[];
}

/** Result from OCR or image hash recognition */
export interface RecognitionResult {
	name: string;
	value: string;
	confidence: number;
}
