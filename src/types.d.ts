import type { Component, JSX } from 'solid-js';

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
	/** Extra content rendered below the description */
	content?: () => JSX.Element;
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
	/** Clean up the region on its own (enlarge, binarise, crop to text) instead of the global filter */
	isolateText?: boolean;
	imgHashSet?: string;
	/** Alignment group that moves this region; see AlignmentGroup */
	group?: string;
	/** Row index within the group's RowBands */
	row?: number;
}

/** 8-bit single-channel image */
export interface GrayImage {
	width: number;
	height: number;
	data: Uint8ClampedArray;
}

/** Grayscale image patch, stored downscaled by ALIGN_SCALE */
export interface AnchorTemplate {
	width: number;
	height: number;
	/** Base64-encoded 8-bit pixels, row-major */
	data: string;
}

/** Static landmark located by template matching to find a group's offset */
export interface RegionAnchor {
	/** Expected top-left of the template at reference resolution */
	x: number;
	y: number;
	/** Maximum offsets to search, in reference pixels */
	searchX: number;
	searchY: number;
	/** Minimum correlation score (0-1) to accept a match */
	minScore?: number;
	template: AnchorTemplate;
}

/** Table rows separated by darker lines; rows may differ in height */
export interface RowBands {
	/** Horizontal sample strip at reference resolution; should avoid text-heavy columns */
	x: number;
	width: number;
	/** Top of the first row at reference resolution */
	y: number;
	/** Nominal row pitch; region y values assume rows at y + row * rowHeight */
	rowHeight: number;
	count: number;
}

/** Set of regions that move together to follow layout changes */
export interface AlignmentGroup {
	name: string;
	anchor?: RegionAnchor;
	rows?: RowBands;
}

/** Alignment feature the region editor's next drawn rectangle defines */
export interface AlignmentDrawTarget {
	group: string;
	kind: 'anchor' | 'rows';
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
	alignment?: AlignmentGroup[];
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

// OverFast API

/** Hero role from OverFast API */
export type OverFastHeroRole = 'tank' | 'damage' | 'support';

/** Hero data from OverFast API */
export interface OverFastHero {
	key: string;
	name: string;
	portrait: string;
	role: OverFastHeroRole;
	subrole: string;
	gamemodes: string[];
}

/** Map data from OverFast API */
export interface OverFastMap {
	key: string;
	name: string;
	screenshot: string;
	gamemodes: string[];
	uses: string[];
	location: string;
	country_code: string | null;
}

/** Player search result from OverFast API */
export interface OverFastPlayerResult {
	player_id: string;
	name: string;
	avatar?: string | null;
	namecard?: string | null;
	title: string | null;
	career_url: string;
	blizzard_id: string;
	last_updated_at?: number | null;
	is_public?: boolean;
}

/** Paginated player search response from OverFast API */
export interface OverFastPlayerSearchResponse {
	total: number;
	results: OverFastPlayerResult[];
}

/** Player search pagination and ordering options */
export interface OverFastPlayerSearchOptions {
	offset?: number;
	limit?: number;
	order_by?: string;
}

/** Persistent OverFast API data store */
export interface OverFastStore {
	schemaVersion: number;
	heroes: OverFastHero[];
	maps: OverFastMap[];
	updatedAt: Date;
}
