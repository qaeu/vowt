import type { Component, JSX } from 'solid-js';

/**
 * Centralized type definitions for VOWT
 * This file contains all shared type definitions used across the application
 */

type ExportFileType =
	| 'vowt-game-records'
	| 'vowt-region-profile'
	| 'vowt-image-hashes'
	| 'vowt-insights-summary';

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
	/** Player whose games the Insights screen analyses; null until chosen */
	trackedPlayer: string | null;
	/** ISO timestamp of the last records export (backup); null if never exported */
	lastExportedAt: string | null;
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
	/** Action button label; defaults to 'Confirm', or 'Close' without onConfirm */
	actionText?: string;
	/** Cancel button label, shown only when onConfirm is set; defaults to 'Cancel' */
	cancelText?: string;
	/** 'danger' styles the action as destructive */
	tone?: 'default' | 'danger';
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
	/** SHA-256 of each screenshot the record was read from, used to spot re-uploads */
	screenshotHashes?: string[];
	createdAt: Date;
	updatedAt: Date;
}

export interface ExportedGameRecords extends ExportFileBase {
	type: 'vowt-game-records';
	records: ExportedRecord<GameRecord>[];
}

// Insights

/** Time window the Insights screen analyses */
export type InsightsPeriod = 'last30' | 'last90' | 'all';

/** Player stat field name */
export type StatKey = keyof PlayerStatsNumberFields;

/** Game outcome from the tracked player's side; 'unknown' when unreadable */
export type GameResult = 'win' | 'loss' | 'draw' | 'unknown';

export interface InsightsFilters {
	/** Tracked player name (compared trimmed and case-insensitively) */
	player: string;
	period: InsightsPeriod;
	/** 'previous' also computes the window before the period, for deltas */
	compare: 'previous' | 'none';
	role: OverFastHeroRole | 'all';
	/** Normalised (trimmed, uppercase) game mode, or 'all' */
	mode: string | 'all';
}

export type TrendMetric = 'winRate' | 'kda' | 'dmg10' | 'heal10';

/** One game from the tracked player's point of view */
export interface PlayerGame {
	recordId: string;
	/** Match date, or the record's creation time if the date is unreadable */
	date: Date;
	createdAt: Date;
	result: GameResult;
	team: 'blue' | 'red';
	/** Game length in seconds, null if unreadable */
	lengthSeconds: number | null;
	/** Normalised (trimmed, uppercase); 'UNKNOWN' if empty */
	mode: string;
	/** Normalised (trimmed, uppercase); 'UNKNOWN' if empty */
	map: string;
	/** Hero display name, null if none was read */
	hero: string | null;
	role: OverFastHeroRole | 'unknown';
	/** The tracked player's stats; null for unreadable fields */
	stats: Record<StatKey, number | null>;
	/** Mean stats of the tracked player's teammates (excluding them) */
	teamAvg: Record<StatKey, number | null>;
	/** Mean stats of the opposing team */
	enemyAvg: Record<StatKey, number | null>;
}

export interface FilteredGames {
	current: PlayerGame[];
	/** Equal-length window before `current`; empty when not compared */
	previous: PlayerGame[];
	/** False when there is nothing to compare against (compare off or period 'all') */
	hasComparison: boolean;
}

/** A value with its change against the comparison window */
export interface InsightsMetric {
	value: number | null;
	/** current minus previous; null without a comparison or a value in either window */
	delta: number | null;
}

export interface InsightsHeadline {
	/** Games played, including those with an unreadable result */
	games: InsightsMetric;
	wins: number;
	losses: number;
	draws: number;
	/** Percentage 0-100 of games with a readable result */
	winRate: InsightsMetric;
	kda: InsightsMetric;
	dmg10: InsightsMetric;
	heal10: InsightsMetric;
	/** Deaths per 10 minutes; lower is better */
	deaths10: InsightsMetric;
}

export interface WeeklyTrendPoint {
	/** Monday (local midnight) of the week */
	weekStart: Date;
	games: number;
	/** Metric value for the week, null if the week has no data */
	value: number | null;
}

export interface RecentFormEntry {
	recordId: string;
	result: Exclude<GameResult, 'unknown'>;
}

export interface RecentForm {
	/** Last games with a readable result, oldest first */
	results: RecentFormEntry[];
	wins: number;
	losses: number;
	draws: number;
	/** Run of identical results ending at the latest game; null result if no games */
	currentStreak: { result: Exclude<GameResult, 'unknown'> | null; length: number };
	/** Longest run of wins across all given games */
	bestWinStreak: number;
}

export interface HeroPoolRow {
	hero: string;
	role: OverFastHeroRole | 'unknown';
	games: number;
	winRate: number | null;
	/** Hero win rate minus overall win rate, in points */
	winRateDelta: number | null;
	kda: number | null;
	dmg10: number | null;
	heal10: number | null;
	mit10: number | null;
}

export interface LobbyComparisonRow {
	stat: 'e' | 'a' | 'd' | 'h' | 'dmg';
	/** Per 10 minutes */
	you: number | null;
	team: number | null;
	enemy: number | null;
}

export interface RecordStatsRow {
	games: number;
	wins: number;
	losses: number;
	draws: number;
	/** Percentage 0-100 of games with a readable result */
	winRate: number | null;
}

export interface MapStatsRow extends RecordStatsRow {
	map: string;
}

export interface ModeStatsRow extends RecordStatsRow {
	mode: string;
}

export interface PersonalBest {
	value: number;
	recordId: string;
	date: Date;
}

export interface PersonalBests {
	kills: PersonalBest | null;
	damage: PersonalBest | null;
	healing: PersonalBest | null;
	fewestDeathsInWin: PersonalBest | null;
}

interface WinRateBucket {
	games: number;
	winRate: number;
}

/** Rule-based observation; the UI owns the wording. Rates are percentages 0-100 */
export type InsightFinding =
	| {
			kind: 'deathsSplit';
			medianDeaths: number;
			lowDeaths: WinRateBucket;
			highDeaths: WinRateBucket;
	  }
	| {
			kind: 'bestHero';
			hero: string;
			games: number;
			winRate: number;
			overallWinRate: number;
	  }
	| {
			kind: 'weakestMode';
			mode: string;
			games: number;
			winRate: number;
			overallWinRate: number;
			worstMap:
				(Omit<RecordStatsRow, 'winRate'> & { map: string; winRate: number }) | null;
	  };

export interface InsightsSummary {
	filters: InsightsFilters;
	generatedAt: Date;
	/** All games the player appears in, before period, role and mode filters */
	totalGames: number;
	/** Normalised modes the player has games in, for building mode filters */
	availableModes: string[];
	headline: InsightsHeadline;
	trend: Record<TrendMetric, WeeklyTrendPoint[]>;
	recentForm: RecentForm;
	heroPool: HeroPoolRow[];
	lobby: LobbyComparisonRow[];
	maps: MapStatsRow[];
	modes: ModeStatsRow[];
	personalBests: PersonalBests;
	findings: InsightFinding[];
}

export interface ExportedInsightsSummary extends ExportFileBase {
	type: 'vowt-insights-summary';
	summary: InsightsSummary;
}

// OCR Region Profiles

/**
 * Per-region text clean-up: 'name' crops to the main run of glyphs, dropping icons and
 * shapes touching the edges; 'number' keeps every non-noise shape
 */
export type TextCleanupMode = 'name' | 'number';

export interface TextRegion {
	name: string;
	x: number;
	y: number;
	width: number;
	height: number;
	charSet?: string;
	isItalic?: boolean;
	/** Clean up the region on its own (enlarge, binarise, crop to text) instead of the global filter */
	isolateText?: TextCleanupMode;
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
