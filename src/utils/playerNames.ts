/**
 * Player name helpers: correct look-alike OCR errors against names from saved records
 */

import type { GameRecord, PlayerStats } from '#types';

/** Cost of substituting one character for a look-alike in the same group */
export const CONFUSABLE_COST = 0.25;

/** Groups of glyphs that OCR commonly confuses */
const CONFUSABLE_GROUPS = ['O0DQ', 'I1L', 'S5', 'B8', 'Z2', 'G6', 'A4', 'T7', 'E3'];

/** Smallest distance tolerance, regardless of name length */
const MIN_DISTANCE_LIMIT = 0.5;

/** Distance tolerance as a fraction of the raw name length */
const DISTANCE_LIMIT_RATIO = 0.2;

/** Minimum gap between the best and second-best distance for an unambiguous match */
const MIN_RUNNER_UP_GAP = 0.5;

/** Look-alike glyph lookup: character to the group it belongs to */
const CONFUSABLE_GROUP_BY_CHAR = new Map<string, string>(
	CONFUSABLE_GROUPS.flatMap((group) => [...group].map((char) => [char, group] as const))
);

/**
 * Trims and uppercases a name
 * @param name - Raw player name
 */
export function normaliseName(name: string): string {
	return name.trim().toUpperCase();
}

/** Cost of substituting one character for another */
function _substitutionCost(a: string, b: string): number {
	if (a === b) return 0;
	const group = CONFUSABLE_GROUP_BY_CHAR.get(a);
	return group !== undefined && group === CONFUSABLE_GROUP_BY_CHAR.get(b) ?
			CONFUSABLE_COST
		:	1;
}

/**
 * Builds a lexicon of player names from saved game records
 * @param records - Saved game records
 * @param minRecords - Number of distinct records a name must appear in
 * @returns Normalised (trimmed, uppercase) names meeting the threshold
 */
export function buildNameLexicon(records: GameRecord[], minRecords = 2): string[] {
	const counts = new Map<string, number>();

	for (const record of records) {
		const names = new Set(record.players.map((p) => normaliseName(p.name)));
		names.delete('');
		for (const name of names) counts.set(name, (counts.get(name) ?? 0) + 1);
	}

	return [...counts].filter(([, count]) => count >= minRecords).map(([name]) => name);
}

/**
 * Weighted Levenshtein distance where look-alike substitutions are cheap
 * @param a - First string
 * @param b - Second string
 * @returns Edit distance; look-alike substitutions cost CONFUSABLE_COST, others 1
 */
export function confusionDistance(a: string, b: string): number {
	if (a === b) return 0;
	if (!a.length) return b.length;
	if (!b.length) return a.length;

	let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
	for (let i = 1; i <= a.length; i++) {
		const curr = [i];
		for (let j = 1; j <= b.length; j++) {
			curr[j] = Math.min(
				prev[j] + 1,
				curr[j - 1] + 1,
				prev[j - 1] + _substitutionCost(a[i - 1], b[j - 1])
			);
		}
		prev = curr;
	}
	return prev[b.length];
}

/**
 * Checks whether two reads are probably the same name, allowing for OCR errors
 * @param a - First name
 * @param b - Second name
 * @returns False if either name is empty
 */
export function isSameName(a: string, b: string): boolean {
	const [first, second] = [normaliseName(a), normaliseName(b)];
	if (!first || !second) return false;
	const limit = Math.max(
		MIN_DISTANCE_LIMIT,
		DISTANCE_LIMIT_RATIO * Math.max(first.length, second.length)
	);
	return confusionDistance(first, second) <= limit;
}

/**
 * Matches a raw OCR player name to a known name
 * @param raw - Raw player name
 * @param lexicon - Known names
 * @returns The unambiguous close known name, or the trimmed raw name
 */
export function matchPlayerName(raw: string, lexicon: string[]): string {
	const trimmed = raw.trim();
	const normalised = normaliseName(raw);
	if (!normalised || !lexicon.length) return trimmed;

	const candidates = [...new Set(lexicon.map(normaliseName))].filter(Boolean);
	if (candidates.includes(normalised)) return trimmed;

	let best: { name: string; distance: number } | null = null;
	let runnerUp = Infinity;
	for (const name of candidates) {
		const distance = confusionDistance(normalised, name);
		if (!best || distance < best.distance) {
			if (best) runnerUp = best.distance;
			best = { name, distance };
		} else if (distance < runnerUp) {
			runnerUp = distance;
		}
	}

	if (!best) return trimmed;
	const limit = Math.max(MIN_DISTANCE_LIMIT, DISTANCE_LIMIT_RATIO * normalised.length);
	const isClose = best.distance <= limit;
	const isUnambiguous = runnerUp - best.distance >= MIN_RUNNER_UP_GAP;
	return isClose && isUnambiguous ? best.name : trimmed;
}

/**
 * Corrects player names in one game against known names
 * A known name is never assigned to two players in the same game
 * @param players - Players of a single game (not mutated)
 * @param lexicon - Known names
 * @returns New player list with corrected names
 */
export function correctPlayerNames(
	players: PlayerStats[],
	lexicon: string[]
): PlayerStats[] {
	const exactReads = new Set(players.map((p) => normaliseName(p.name)));
	const available = new Set(lexicon.map(normaliseName).filter(Boolean));
	for (const read of exactReads) available.delete(read);

	return players.map((player) => {
		const normalised = normaliseName(player.name);
		if (!normalised) {
			return { ...player };
		}

		const matched = matchPlayerName(player.name, [...available]);
		if (matched === player.name.trim()) return { ...player };

		available.delete(matched);
		return { ...player, name: matched };
	});
}
