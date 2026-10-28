/**
 * Game matching: recognise screenshots of a game that already has a record, such as an
 * in-game scoreboard and the post-game summary, and merge what each one shows
 */

import type { GameRecord, MatchInfo, PlayerStats } from '#types';
import { PLAYER_STATS_NUMBER_FIELD_NAMES } from '#utils/storage';
import { isSameName } from '#utils/playerNames';

export type GameStats = Pick<GameRecord, 'players' | 'matchInfo'>;

/** Existing record that a screenshot belongs to */
export interface GameMatch {
	record: GameRecord;
	/** Whether the screenshot was taken later in the game than the record's data */
	isLater: boolean;
	/** Pairs of [record player index, screenshot player index] for the same player */
	pairs: [number, number][];
}

/** Players that must be read with matching names on the same team */
const MIN_MATCHED_NAMES = 6;

/** Fraction of the named players (on the side with fewer) whose names must match */
const MIN_MATCHED_RATIO = 0.7;

/** Fraction of changed stats allowed to go against the rest, for OCR misreads */
const MAX_CONTRADICTION_RATIO = 0.1;

/** Match info that never changes during a game, compared allowing for OCR errors */
const FUZZY_MATCH_INFO_FIELDS = ['game_mode', 'map'] as const;

/** Match info that never changes during a game, compared exactly */
const EXACT_MATCH_INFO_FIELDS = ['date', 'result'] as const;

const TEAMS: PlayerStats['team'][] = ['blue', 'red'];

/** Parses a stat read, ignoring stray characters; null if it has no digits */
function _parseStat(value: string | undefined): number | null {
	const digits = (value ?? '').replace(/\D/g, '');
	return digits ? Number(digits) : null;
}

function _normalise(value: string | undefined): string {
	return (value ?? '').trim().toUpperCase().replace(/\s+/g, ' ');
}

/** Checks for match info that both games have but that differs */
function _hasConflictingMatchInfo(a: MatchInfo, b: MatchInfo): boolean {
	const fuzzyConflict = FUZZY_MATCH_INFO_FIELDS.some(
		(field) =>
			_normalise(a[field]) && _normalise(b[field]) && !isSameName(a[field], b[field])
	);
	const exactConflict = EXACT_MATCH_INFO_FIELDS.some(
		(field) =>
			_normalise(a[field])
			&& _normalise(b[field])
			&& _normalise(a[field]) !== _normalise(b[field])
	);
	return fuzzyConflict || exactConflict;
}

/**
 * Pairs up the same players in two reads of a game
 * @returns Pairs matched by name, and pairs of leftover players matched by slot
 */
function _pairPlayers(
	recordPlayers: PlayerStats[],
	screenshotPlayers: PlayerStats[]
): { named: [number, number][]; bySlot: [number, number][] } {
	const named: [number, number][] = [];
	const bySlot: [number, number][] = [];

	for (const team of TEAMS) {
		const teamIndices = (players: PlayerStats[]) =>
			players.flatMap((player, i) => (player.team === team ? [i] : []));
		const unpaired = new Set(teamIndices(screenshotPlayers));
		const leftovers: number[] = [];

		for (const recordIndex of teamIndices(recordPlayers)) {
			const name = recordPlayers[recordIndex].name;
			const match = [...unpaired].find((i) =>
				isSameName(name, screenshotPlayers[i].name)
			);
			if (match === undefined) {
				leftovers.push(recordIndex);
			} else {
				named.push([recordIndex, match]);
				unpaired.delete(match);
			}
		}

		// The rest are probably the same people with misread names, in the same slots
		const remaining = [...unpaired];
		if (leftovers.length === remaining.length) {
			bySlot.push(...leftovers.map((i, n): [number, number] => [i, remaining[n]]));
		}
	}

	return { named, bySlot };
}

/** Counts paired stats that went up or down from the record to the screenshot */
function _compareStats(
	pairs: [number, number][],
	recordPlayers: PlayerStats[],
	screenshotPlayers: PlayerStats[]
): { higher: number; lower: number } {
	let higher = 0;
	let lower = 0;
	for (const [recordIndex, screenshotIndex] of pairs) {
		for (const field of PLAYER_STATS_NUMBER_FIELD_NAMES) {
			const before = _parseStat(recordPlayers[recordIndex][field]);
			const after = _parseStat(screenshotPlayers[screenshotIndex][field]);
			if (before === null || after === null) continue;
			if (after > before) higher++;
			else if (after < before) lower++;
		}
	}
	return { higher, lower };
}

/** Checks a screenshot against one record; see findMatchingRecord */
function _matchRecord(
	stats: GameStats,
	record: GameRecord
): (GameMatch & { score: number; contradictions: number }) | null {
	if (_hasConflictingMatchInfo(record.matchInfo, stats.matchInfo)) return null;

	const countNamed = (players: PlayerStats[]) =>
		players.filter(({ name }) => name.trim()).length;
	const { named, bySlot } = _pairPlayers(record.players, stats.players);
	const minNamed = Math.min(countNamed(record.players), countNamed(stats.players));
	if (named.length < MIN_MATCHED_NAMES || named.length < MIN_MATCHED_RATIO * minNamed) {
		return null;
	}

	// Stats only grow during a game, so one read must be ahead of the other
	const { higher, lower } = _compareStats(named, record.players, stats.players);
	const contradictions = Math.min(higher, lower);
	if (contradictions > Math.max(1, MAX_CONTRADICTION_RATIO * (higher + lower))) {
		return null;
	}

	// A result is only shown once the game is over
	const hasResult = Boolean(_normalise(stats.matchInfo.result));
	const recordHasResult = Boolean(_normalise(record.matchInfo.result));
	const isLater = hasResult !== recordHasResult ? hasResult : higher > lower;

	return {
		record,
		isLater,
		pairs: [...named, ...bySlot],
		score: named.length,
		contradictions,
	};
}

/**
 * Finds the record for the game a screenshot shows, even if it was read from a different
 * screenshot (e.g. in-game vs post-game, or earlier vs later in the game). Games match
 * when most players' names match on the same teams, no fixed match info differs, and
 * every stat moved the same way between the two reads.
 * @param stats - Stats read from the screenshot
 * @param records - Saved game records
 * @returns The best-matching record, or undefined if none match
 */
export function findMatchingRecord(
	stats: GameStats,
	records: GameRecord[]
): GameMatch | undefined {
	let best: ReturnType<typeof _matchRecord> = null;
	for (const record of records) {
		const match = _matchRecord(stats, record);
		if (
			match
			&& (!best
				|| match.score > best.score
				|| (match.score === best.score && match.contradictions < best.contradictions))
		) {
			best = match;
		}
	}
	if (!best) return undefined;
	const { record, isLater, pairs } = best;
	return { record, isLater, pairs };
}

/**
 * Combines a record with a screenshot of the same game. Values from the later of the two
 * win, gaps are filled from the other, and the record's player names and order are kept.
 * @param record - Stats saved for the game
 * @param stats - Stats read from the screenshot
 * @param match - Match from findMatchingRecord
 * @returns New merged stats
 */
export function mergeGameStats(
	record: GameStats,
	stats: GameStats,
	match: Pick<GameMatch, 'isLater' | 'pairs'>
): GameStats {
	const [later, earlier] = match.isLater ? [stats, record] : [record, stats];
	const pick = (field: Exclude<keyof MatchInfo, 'final_score'>) =>
		later.matchInfo[field] || earlier.matchInfo[field];
	const laterScore = later.matchInfo.final_score;

	const matchInfo: MatchInfo = {
		...record.matchInfo,
		result: pick('result'),
		final_score:
			laterScore?.blue || laterScore?.red ?
				{ ...laterScore }
			:	{ ...earlier.matchInfo.final_score },
		date: pick('date'),
		game_mode: pick('game_mode'),
		game_length: pick('game_length'),
		map: pick('map'),
	};

	const players = record.players.map((player, i) => {
		const pair = match.pairs.find(([recordIndex]) => recordIndex === i);
		if (!pair) return { ...player };

		const other = stats.players[pair[1]];
		const [laterPlayer, earlierPlayer] =
			match.isLater ? [other, player] : [player, other];
		const merged: PlayerStats = {
			...player,
			name: player.name || other.name,
			hero: laterPlayer.hero || earlierPlayer.hero,
		};
		for (const field of PLAYER_STATS_NUMBER_FIELD_NAMES) {
			merged[field] = laterPlayer[field] || earlierPlayer[field];
		}
		return merged;
	});

	return { players, matchInfo };
}
