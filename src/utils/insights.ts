/**
 * Insights: aggregate stats across saved game records for one tracked player
 *
 * Pure functions with no DOM access. Every field in a record is an OCR string, so
 * parsers return null/'unknown' for unreadable values and aggregates skip them.
 */

import type {
	GameRecord,
	GameResult,
	FindingConfidence,
	InsightFinding,
	InsightsFilters,
	InsightsHeadline,
	InsightsMetric,
	InsightsSummary,
	FilteredGames,
	GameNumberRow,
	HeroPoolRow,
	LobbyComparisonRow,
	MapStatsRow,
	ModeStatsRow,
	OverFastHero,
	PersonalBest,
	PersonalBests,
	PlayerGame,
	RecentForm,
	RecordStatsRow,
	RoleDeathsMedian,
	RoleLobbyComparison,
	SessionStats,
	StatKey,
	TrendMetric,
	WeeklyTrendPoint,
} from '#types';

import { getHeroDisplayName } from '#utils/gameData';
import { normaliseName } from '#utils/playerNames';

/** Minimum games in every bucket before a finding is reported */
export const MIN_FINDING_GAMES = 5;

/** Minimum win-rate gap (points) between low- and high-death games */
export const MIN_DEATHS_GAP = 10;

/** Minimum win-rate gap (points) between the best hero and your other games */
export const MIN_HERO_GAP = 5;

/** Minimum win-rate gap (points) between the weakest mode and your other games */
export const MIN_MODE_GAP = 10;

/** Minimum games on a map for it to be named as a mode's worst map */
export const MIN_WORST_MAP_GAMES = 3;

/** Minimum win-rate gap (points) between games 1-3 and game 4 onwards of a session */
export const MIN_FATIGUE_GAP = 10;

/** Minimum win-rate gap (points) between the game after a win and after a loss */
export const MIN_TILT_GAP = 10;

/** A gap of more than this many minutes between games starts a new session */
export const SESSION_BREAK_MINUTES = 60;

/** Decided games in the smaller group at which confidence becomes medium */
export const MEDIUM_CONFIDENCE_GAMES = 10;

/** Decided games in the smaller group at which confidence becomes high */
export const HIGH_CONFIDENCE_GAMES = 25;

/** Default minimum games for a map to appear in the map stats */
export const DEFAULT_MIN_MAP_GAMES = 4;

/** Default number of games shown in recent form */
export const DEFAULT_FORM_GAMES = 20;

/** Default number of weeks in the weekly trend */
export const DEFAULT_TREND_WEEKS = 12;

/** Mode and map name used when none was read */
export const UNKNOWN_NAME = 'UNKNOWN';

/** Minimum games on each side of the team-average split to show its win rates */
export const MIN_TEAM_SPLIT_GAMES = 5;

/** Stats compared against the lobby, in display order */
export const LOBBY_STATS = ['e', 'a', 'd', 'h', 'dmg'] as const;

const STAT_KEYS: StatKey[] = ['e', 'a', 'd', 'dmg', 'h', 'mit'];
const MINUTE_MS = 60 * 1000;
/** Games per session counted as "early"; later games count as fatigued */
const EARLY_SESSION_GAMES = 3;
/** Game numbers at or above this share the last bucket */
const LAST_GAME_BUCKET = 5;
const DAY_MS = 24 * 60 * 60 * 1000;
const PERIOD_DAYS = { last30: 30, last90: 90 } as const;
const SECONDS_PER_10_MINUTES = 600;
/** Role display order for per-role groups */
const ROLE_ORDER: PlayerGame['role'][] = ['tank', 'damage', 'support', 'unknown'];
/** z for a two-sided 90% interval */
const Z_90 = 1.645;

type DecidedResult = Exclude<GameResult, 'unknown'>;
type PlayerRecord = Pick<GameRecord, 'players' | 'matchInfo' | 'createdAt'>;

interface WilsonInterval {
	low: number;
	high: number;
}

interface RateComparison {
	/** Win percentages 0-100 over decided games; 0 for an empty group */
	aRate: number;
	bRate: number;
	/** Decided games in each group */
	aGames: number;
	bGames: number;
	/** Whether the difference interval excludes 0 */
	significant: boolean;
	confidence: FindingConfidence;
}

interface ParsedMatchDate {
	date: Date;
	/** True only when a valid time of day was read from the date text */
	hasTime: boolean;
}

const RESULT_BY_TEXT: Record<string, DecidedResult> = {
	VICTORY: 'win',
	DEFEAT: 'loss',
	DRAW: 'draw',
};

// Parsers

/**
 * Parses a result as read from the screen (blue team's view)
 * @returns 'unknown' for anything other than VICTORY, DEFEAT or DRAW
 */
export function parseResult(text: string): GameResult {
	return RESULT_BY_TEXT[normaliseName(text ?? '')] ?? 'unknown';
}

/**
 * Parses the match date of a record
 * @param record - Record with `matchInfo.date` as `MM/DD/YYYY`, optionally followed by
 * a 24-hour `HH:MM` (other text is ignored)
 * @returns The date and time in local time (midnight without a valid time), or the
 * record's createdAt if the date is unparseable
 */
export function parseMatchDate(record: PlayerRecord): Date {
	return _parseMatchDateTime(record).date;
}

/**
 * Parses a game length
 * @param text - `mm:ss` or `h:mm:ss`
 * @returns Seconds, or null if invalid or zero
 */
export function parseGameLengthSeconds(text: string): number | null {
	const match = /^(?:(\d{1,2}):)?(\d{1,3}):(\d{2})$/.exec((text ?? '').trim());
	if (!match) return null;
	const hours = match[1] === undefined ? 0 : Number(match[1]);
	const minutes = Number(match[2]);
	const seconds = Number(match[3]);
	if (seconds > 59 || (match[1] !== undefined && minutes > 59)) return null;
	const total = hours * 3600 + minutes * 60 + seconds;
	return total > 0 ? total : null;
}

/**
 * Parses a stat value; a blank stat counts as 0
 * @returns A non-negative integer, or null if the text is not all digits
 */
export function parseStat(text: string): number | null {
	const trimmed = (text ?? '').trim();
	if (!trimmed) return 0;
	return /^\d+$/.test(trimmed) ? Number(trimmed) : null;
}

// Local helpers

/** Like parseMatchDate, but also reports whether a valid time was read */
function _parseMatchDateTime(record: PlayerRecord): ParsedMatchDate {
	const text = record.matchInfo.date ?? '';
	const match = /(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4}|\d{2})(?!\d)/.exec(text);
	if (match) {
		const month = Number(match[1]);
		const day = Number(match[2]);
		const year = match[3].length === 2 ? 2000 + Number(match[3]) : Number(match[3]);
		const midnight = new Date(year, month - 1, day);
		if (
			midnight.getFullYear() === year
			&& midnight.getMonth() === month - 1
			&& midnight.getDate() === day
		) {
			const time = /^[\s,@-]*(\d{1,2}):(\d{2})(?!\d)/.exec(
				text.slice(match.index + match[0].length)
			);
			const hours = time ? Number(time[1]) : 0;
			const minutes = time ? Number(time[2]) : 0;
			if (time && hours < 24 && minutes < 60) {
				return { date: new Date(year, month - 1, day, hours, minutes), hasTime: true };
			}
			return { date: midnight, hasTime: false };
		}
	}
	return { date: new Date(record.createdAt), hasTime: false };
}

function _mean(values: (number | null)[]): number | null {
	const valid = values.filter((v): v is number => v !== null);
	return valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : null;
}

function _median(values: number[]): number {
	const sorted = [...values].sort((a, b) => a - b);
	const mid = Math.floor(sorted.length / 2);
	return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function _normaliseLabel(text: string): string {
	return normaliseName(text ?? '') || UNKNOWN_NAME;
}

function _invert(result: GameResult): GameResult {
	return (
		result === 'win' ? 'loss'
		: result === 'loss' ? 'win'
		: result
	);
}

function _delta(current: number | null, previous: number | null): number | null {
	return current === null || previous === null ? null : current - previous;
}

function _metric(
	current: number | null,
	previous: number | null,
	hasComparison: boolean
): InsightsMetric {
	return { value: current, delta: hasComparison ? _delta(current, previous) : null };
}

function _avgStats(players: GameRecord['players']): Record<StatKey, number | null> {
	return Object.fromEntries(
		STAT_KEYS.map((key) => [key, _mean(players.map((p) => parseStat(p[key])))])
	) as Record<StatKey, number | null>;
}

function _compareGames(a: PlayerGame, b: PlayerGame): number {
	return (
		a.date.getTime() - b.date.getTime()
		|| a.createdAt.getTime() - b.createdAt.getTime()
		|| a.recordId.localeCompare(b.recordId)
	);
}

function _sorted(games: PlayerGame[]): PlayerGame[] {
	return [...games].sort(_compareGames);
}

function _countResults(games: PlayerGame[]): Omit<RecordStatsRow, 'games'> & {
	decided: number;
} {
	const wins = games.filter((g) => g.result === 'win').length;
	const losses = games.filter((g) => g.result === 'loss').length;
	const draws = games.filter((g) => g.result === 'draw').length;
	const decided = wins + losses + draws;
	return {
		wins,
		losses,
		draws,
		decided,
		winRate: decided ? (wins / decided) * 100 : null,
	};
}

function _recordStats(games: PlayerGame[]): RecordStatsRow {
	const { wins, losses, draws, winRate } = _countResults(games);
	return { games: games.length, wins, losses, draws, winRate };
}

/**
 * Wilson score interval for a proportion
 * @param wins - Successes
 * @param n - Trials; 0 gives the uninformative interval 0 to 1
 * @param z - Standard normal quantile for the confidence level
 * @returns Bounds as proportions 0-1
 */
function _wilson(wins: number, n: number, z: number): WilsonInterval {
	if (n <= 0) return { low: 0, high: 1 };
	const p = wins / n;
	const z2 = z * z;
	const denominator = 1 + z2 / n;
	const centre = (p + z2 / (2 * n)) / denominator;
	const half = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / denominator;
	return { low: Math.max(0, centre - half), high: Math.min(1, centre + half) };
}

/** Confidence tier from the decided games in the smaller group */
function _confidence(smallerGames: number): FindingConfidence {
	return (
		smallerGames >= HIGH_CONFIDENCE_GAMES ? 'high'
		: smallerGames >= MEDIUM_CONFIDENCE_GAMES ? 'medium'
		: 'low'
	);
}

/**
 * Compares the win rates of two groups of games
 * Draws count as decided non-wins, as in the win rate elsewhere. Significance is a
 * Newcombe hybrid-score interval for the difference (a minus b) built from 90% Wilson
 * intervals; it is significant when the interval excludes 0. Groups with fewer than
 * MIN_FINDING_GAMES decided games are never significant.
 */
function _compareRates(a: PlayerGame[], b: PlayerGame[]): RateComparison {
	const { wins: aWins, decided: aGames } = _countResults(a);
	const { wins: bWins, decided: bGames } = _countResults(b);
	const p1 = aGames ? aWins / aGames : 0;
	const p2 = bGames ? bWins / bGames : 0;
	const { low: l1, high: u1 } = _wilson(aWins, aGames, Z_90);
	const { low: l2, high: u2 } = _wilson(bWins, bGames, Z_90);
	const diff = p1 - p2;
	const lower = diff - Math.sqrt((p1 - l1) ** 2 + (u2 - p2) ** 2);
	const upper = diff + Math.sqrt((u1 - p1) ** 2 + (p2 - l2) ** 2);
	const enough = Math.min(aGames, bGames) >= MIN_FINDING_GAMES;
	return {
		aRate: p1 * 100,
		bRate: p2 * 100,
		aGames,
		bGames,
		significant: enough && (lower > 0 || upper < 0),
		confidence: _confidence(Math.min(aGames, bGames)),
	};
}

/** Win percentage over games with a readable result; null if there are none */
function _winRate(games: PlayerGame[]): number | null {
	return _countResults(games).winRate;
}

/** One game's value per 10 minutes; null if the value or the game length is missing */
function _gamePer10(game: PlayerGame, value: number | null): number | null {
	if (value === null || game.lengthSeconds === null) return null;
	return (value / game.lengthSeconds) * SECONDS_PER_10_MINUTES;
}

/** Games grouped by role, only roles with games, in ROLE_ORDER */
function _byRole(games: PlayerGame[]): [PlayerGame['role'], PlayerGame[]][] {
	const groups = _groupBy(games, (g) => g.role);
	return ROLE_ORDER.filter((role) => groups.has(role)).map((role) => [
		role,
		groups.get(role)!,
	]);
}

/** Sum of a stat per 10 minutes over games with both a valid length and stat */
function _per10(
	games: PlayerGame[],
	value: (game: PlayerGame) => number | null
): number | null {
	let total = 0;
	let seconds = 0;
	for (const game of games) {
		const v = value(game);
		if (v === null || game.lengthSeconds === null) continue;
		total += v;
		seconds += game.lengthSeconds;
	}
	return seconds ? (total / seconds) * SECONDS_PER_10_MINUTES : null;
}

/** (kills + assists) / max(deaths, 1) over games where all three were read */
function _kda(games: PlayerGame[]): number | null {
	let kills = 0;
	let assists = 0;
	let deaths = 0;
	let count = 0;
	for (const { stats } of games) {
		if (stats.e === null || stats.a === null || stats.d === null) continue;
		kills += stats.e;
		assists += stats.a;
		deaths += stats.d;
		count++;
	}
	return count ? (kills + assists) / Math.max(deaths, 1) : null;
}

function _metricValue(games: PlayerGame[], metric: TrendMetric): number | null {
	switch (metric) {
		case 'winRate':
			return _winRate(games);
		case 'kda':
			return _kda(games);
		case 'dmg10':
			return _per10(games, (g) => g.stats.dmg);
		case 'heal10':
			return _per10(games, (g) => g.stats.h);
	}
}

function _groupBy<T>(items: T[], key: (item: T) => string | null): Map<string, T[]> {
	const groups = new Map<string, T[]>();
	for (const item of items) {
		const k = key(item);
		if (k === null) continue;
		const group = groups.get(k);
		if (group) group.push(item);
		else groups.set(k, [item]);
	}
	return groups;
}

function _weekStart(date: Date): Date {
	const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
	start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
	return start;
}

/**
 * Splits games into play sessions
 * Only games with a readable time are used. A gap of more than SESSION_BREAK_MINUTES
 * between consecutive games starts a new session (exactly that long stays in one).
 * Dates carry the full date and time, so a session can span midnight.
 * @returns Sessions oldest first, each oldest game first
 */
function _sessions(games: PlayerGame[]): PlayerGame[][] {
	const sessions: PlayerGame[][] = [];
	let previous: PlayerGame | null = null;
	for (const game of _sorted(games.filter((g) => g.hasTime))) {
		const gap = previous ? game.date.getTime() - previous.date.getTime() : 0;
		if (previous && gap <= SESSION_BREAK_MINUTES * MINUTE_MS) {
			sessions[sessions.length - 1].push(game);
		} else {
			sessions.push([game]);
		}
		previous = game;
	}
	return sessions;
}

/** Games that directly follow a win, and those that follow a loss, within sessions */
function _afterResult(sessions: PlayerGame[][]): {
	afterWin: PlayerGame[];
	afterLoss: PlayerGame[];
} {
	const afterWin: PlayerGame[] = [];
	const afterLoss: PlayerGame[] = [];
	for (const session of sessions) {
		for (let i = 1; i < session.length; i++) {
			const before = session[i - 1].result;
			if (before === 'win') afterWin.push(session[i]);
			else if (before === 'loss') afterLoss.push(session[i]);
		}
	}
	return { afterWin, afterLoss };
}

// Exported functions

/**
 * Lists player names found in records, for choosing the tracked player
 * @param records - Saved game records
 * @returns Normalised (trimmed, uppercase) names with the number of records they
 * appear in, most frequent first (ties alphabetical)
 */
export function getPlayerNameCounts(
	records: GameRecord[]
): { name: string; count: number }[] {
	const counts = new Map<string, number>();
	for (const record of records) {
		const names = new Set(record.players.map((p) => normaliseName(p.name)));
		names.delete('');
		for (const name of names) counts.set(name, (counts.get(name) ?? 0) + 1);
	}
	return [...counts]
		.map(([name, count]) => ({ name, count }))
		.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

/**
 * Turns records into per-game rows from the tracked player's point of view
 * Records the player does not appear in are skipped. If a name appears twice in a
 * record, the first is used. A result read as VICTORY/DEFEAT is inverted for red.
 * @param records - Saved game records
 * @param player - Tracked player name (trimmed, case-insensitive)
 * @param heroes - OverFast heroes, used to look up roles; may be empty
 * @returns Games sorted by match date, then creation time (oldest first)
 */
export function toPlayerGames(
	records: GameRecord[],
	player: string,
	heroes: OverFastHero[]
): PlayerGame[] {
	const target = normaliseName(player ?? '');
	if (!target) return [];

	const games: PlayerGame[] = [];
	for (const record of records) {
		const me = record.players.find((p) => normaliseName(p.name) === target);
		if (!me) continue;

		const heroName = me.hero?.trim() ? getHeroDisplayName(me.hero, heroes) : null;
		const hero = heroName ? heroName.trim() : null;
		const matched = hero ? heroes.find((h) => h.name === hero) : undefined;
		const others = record.players.filter((p) => p !== me);
		const result = parseResult(record.matchInfo.result);
		const dateTime = _parseMatchDateTime(record);

		games.push({
			recordId: record.id,
			date: dateTime.date,
			hasTime: dateTime.hasTime,
			createdAt: new Date(record.createdAt),
			result: me.team === 'red' ? _invert(result) : result,
			team: me.team,
			lengthSeconds: parseGameLengthSeconds(record.matchInfo.game_length),
			mode: _normaliseLabel(record.matchInfo.game_mode),
			map: _normaliseLabel(record.matchInfo.map),
			hero,
			role: matched?.role ?? 'unknown',
			stats: _avgStats([me]),
			teamAvg: _avgStats(others.filter((p) => p.team === me.team)),
			enemyAvg: _avgStats(others.filter((p) => p.team !== me.team)),
		});
	}
	return _sorted(games);
}

/**
 * Applies the period, role and mode filters
 * The player filter is applied by toPlayerGames. The comparison window is the span of
 * equal length immediately before the period. Games dated in the future count in the
 * current window.
 * @param games - Games from toPlayerGames
 * @param filters - Active filters
 * @param now - Current time
 */
export function filterGames(
	games: PlayerGame[],
	filters: InsightsFilters,
	now: Date
): FilteredGames {
	const matches = (game: PlayerGame) =>
		(filters.role === 'all' || game.role === filters.role)
		&& (filters.mode === 'all' || game.mode === normaliseName(filters.mode));

	if (filters.period === 'all') {
		return { current: games.filter(matches), previous: [], hasComparison: false };
	}

	const span = PERIOD_DAYS[filters.period] * DAY_MS;
	const currentStart = now.getTime() - span;
	const previousStart = currentStart - span;
	const current = games.filter((g) => g.date.getTime() >= currentStart && matches(g));
	const hasComparison = filters.compare === 'previous';
	const previous =
		hasComparison ?
			games.filter(
				(g) =>
					g.date.getTime() >= previousStart
					&& g.date.getTime() < currentStart
					&& matches(g)
			)
		:	[];
	return { current, previous, hasComparison };
}

/**
 * Builds the headline numbers with changes against the comparison window
 * Win rate is wins over games with a readable result (draws count as non-wins).
 * KDA is (sum kills + sum assists) / max(sum deaths, 1). Per-10 stats are summed
 * stat over summed seconds, so games with an unreadable length or stat are skipped.
 * @param current - Games in the current window
 * @param previous - Games in the comparison window
 * @param hasComparison - Whether deltas should be computed
 */
export function buildHeadline(
	current: PlayerGame[],
	previous: PlayerGame[],
	hasComparison: boolean
): InsightsHeadline {
	const { wins, losses, draws } = _countResults(current);
	const metric = (name: TrendMetric) =>
		_metric(_metricValue(current, name), _metricValue(previous, name), hasComparison);

	return {
		games: {
			value: current.length,
			delta: hasComparison && previous.length ? current.length - previous.length : null,
		},
		wins,
		losses,
		draws,
		winRate: metric('winRate'),
		kda: metric('kda'),
		dmg10: metric('dmg10'),
		heal10: metric('heal10'),
		deaths10: _metric(
			_per10(current, (g) => g.stats.d),
			_per10(previous, (g) => g.stats.d),
			hasComparison
		),
	};
}

/**
 * Buckets a metric by week (Monday start, local time)
 * Weeks end at the latest game's week and start at most `weeks` back, with empty weeks
 * included as `{ games: 0, value: null }`.
 * @param games - Games to bucket
 * @param metric - Metric to compute per week
 * @param weeks - Maximum number of weeks
 * @returns Weekly points, oldest first; empty if there are no games
 */
export function buildWeeklyTrend(
	games: PlayerGame[],
	metric: TrendMetric,
	weeks = DEFAULT_TREND_WEEKS
): WeeklyTrendPoint[] {
	if (!games.length || weeks < 1) return [];

	const byWeek = _groupBy(games, (g) => String(_weekStart(g.date).getTime()));
	const last = _sorted(games).at(-1)!;
	const lastWeek = _weekStart(last.date);
	const firstStart = new Date(lastWeek);
	firstStart.setDate(firstStart.getDate() - 7 * (weeks - 1));

	const points: WeeklyTrendPoint[] = [];
	const cursor = new Date(firstStart);
	const earliest = _weekStart(_sorted(games)[0].date);
	if (earliest > cursor) cursor.setTime(earliest.getTime());
	while (cursor <= lastWeek) {
		const inWeek = byWeek.get(String(cursor.getTime())) ?? [];
		points.push({
			weekStart: new Date(cursor),
			games: inWeek.length,
			value: inWeek.length ? _metricValue(inWeek, metric) : null,
		});
		cursor.setDate(cursor.getDate() + 7);
	}
	return points;
}

/**
 * Summarises the most recent results and streaks
 * Games with an unreadable result are ignored (they do not break a streak); a draw does.
 * @param games - Games in any order
 * @param count - Number of recent games to list
 */
export function buildRecentForm(
	games: PlayerGame[],
	count = DEFAULT_FORM_GAMES
): RecentForm {
	const decided = _sorted(games).filter(
		(g): g is PlayerGame & { result: DecidedResult } => g.result !== 'unknown'
	);

	let best = 0;
	let run = 0;
	for (const game of decided) {
		run = game.result === 'win' ? run + 1 : 0;
		best = Math.max(best, run);
	}

	const latest = decided.at(-1)?.result ?? null;
	let length = 0;
	for (let i = decided.length - 1; i >= 0 && decided[i].result === latest; i--) length++;

	const results = decided
		.slice(Math.max(decided.length - count, 0))
		.map((g) => ({ recordId: g.recordId, result: g.result }));
	return {
		results,
		wins: results.filter((r) => r.result === 'win').length,
		losses: results.filter((r) => r.result === 'loss').length,
		draws: results.filter((r) => r.result === 'draw').length,
		currentStreak: { result: latest, length },
		bestWinStreak: best,
	};
}

/**
 * Builds per-hero stats; games without a hero are skipped
 * @param games - Games to group
 * @returns Rows by games played (descending), then hero name
 */
export function buildHeroPool(games: PlayerGame[]): HeroPoolRow[] {
	const overall = _winRate(games);
	const rows = [..._groupBy(games, (g) => g.hero)].map(
		([hero, heroGames]): HeroPoolRow => {
			const winRate = _winRate(heroGames);
			return {
				hero,
				role: heroGames.find((g) => g.role !== 'unknown')?.role ?? 'unknown',
				games: heroGames.length,
				winRate,
				winRateDelta: _delta(winRate, overall),
				kda: _kda(heroGames),
				dmg10: _per10(heroGames, (g) => g.stats.dmg),
				heal10: _per10(heroGames, (g) => g.stats.h),
				mit10: _per10(heroGames, (g) => g.stats.mit),
			};
		}
	);
	return rows.sort((a, b) => b.games - a.games || a.hero.localeCompare(b.hero));
}

/**
 * Compares the player with the team average and enemy average per 10 minutes, per role
 * Only games with a valid length and all three values read are used for the per-10
 * columns, so they are measured over the same games.
 * The above/below split compares your stat with your team's average in the same game
 * (teammates only, excluding you) and needs only those two values: games with either
 * missing are skipped for that stat, and a tie (exactly equal) counts as neither above
 * nor below. Win rates are over decided games; null if a side has none. For deaths,
 * "above" is the worse side.
 * @param games - Games to compare
 * @returns One group per role that has games (tank, damage, support, unknown)
 */
export function buildLobbyComparison(games: PlayerGame[]): RoleLobbyComparison[] {
	return _byRole(games).map(([role, roleGames]) => ({
		role,
		rows: LOBBY_STATS.map((stat): LobbyComparisonRow => {
			const usable = roleGames.filter(
				(g) =>
					g.stats[stat] !== null && g.teamAvg[stat] !== null && g.enemyAvg[stat] !== null
			);
			const compared = roleGames.filter(
				(g) => g.stats[stat] !== null && g.teamAvg[stat] !== null
			);
			const above = compared.filter((g) => g.stats[stat]! > g.teamAvg[stat]!);
			const below = compared.filter((g) => g.stats[stat]! < g.teamAvg[stat]!);
			return {
				stat,
				you: _per10(usable, (g) => g.stats[stat]),
				team: _per10(usable, (g) => g.teamAvg[stat]),
				enemy: _per10(usable, (g) => g.enemyAvg[stat]),
				gamesAbove: above.length,
				gamesBelow: below.length,
				winRateAbove: _winRate(above),
				winRateBelow: _winRate(below),
			};
		}),
	}));
}

/**
 * Builds per-map results
 * @param games - Games to group
 * @param minGames - Maps with fewer games are left out
 * @returns Rows by win rate (descending; unreadable last), then games played
 */
export function buildMapStats(
	games: PlayerGame[],
	minGames = DEFAULT_MIN_MAP_GAMES
): MapStatsRow[] {
	return [..._groupBy(games, (g) => g.map)]
		.filter(([, mapGames]) => mapGames.length >= minGames)
		.map(([map, mapGames]) => ({ map, ..._recordStats(mapGames) }))
		.sort(
			(a, b) =>
				(b.winRate ?? -1) - (a.winRate ?? -1)
				|| b.games - a.games
				|| a.map.localeCompare(b.map)
		);
}

/**
 * Builds per-mode results
 * @param games - Games to group
 * @returns Rows by games played (descending), then mode name
 */
export function buildModeStats(games: PlayerGame[]): ModeStatsRow[] {
	return [..._groupBy(games, (g) => g.mode)]
		.map(([mode, modeGames]) => ({ mode, ..._recordStats(modeGames) }))
		.sort((a, b) => b.games - a.games || a.mode.localeCompare(b.mode));
}

/**
 * Finds personal bests; ties go to the earliest game
 * @param games - Games to search
 */
export function buildPersonalBests(games: PlayerGame[]): PersonalBests {
	const best = (
		pool: PlayerGame[],
		value: (g: PlayerGame) => number | null,
		better: (a: number, b: number) => boolean
	): PersonalBest | null => {
		let result: PersonalBest | null = null;
		for (const game of _sorted(pool)) {
			const v = value(game);
			if (v !== null && (result === null || better(v, result.value))) {
				result = { value: v, recordId: game.recordId, date: game.date };
			}
		}
		return result;
	};
	const more = (a: number, b: number) => a > b;

	return {
		kills: best(games, (g) => g.stats.e, more),
		damage: best(games, (g) => g.stats.dmg, more),
		healing: best(games, (g) => g.stats.h, more),
		fewestDeathsInWin: best(
			games.filter((g) => g.result === 'win'),
			(g) => g.stats.d,
			(a, b) => a < b
		),
	};
}

/**
 * Reports notable patterns; each rule needs MIN_FINDING_GAMES in every bucket
 * - deathsSplit: win rate at or below your role's median deaths per 10 minutes vs
 *   above it (MIN_DEATHS_GAP); games without a length are skipped, and 'unknown' is
 *   its own role
 * - bestHero: best win rate among heroes vs all other games (MIN_HERO_GAP)
 * - weakestMode: lowest win rate among modes vs all other games (MIN_MODE_GAP), with
 *   its worst map
 * - sessionFatigue: win rate in games 1-3 of a session vs game 4 onwards
 *   (MIN_FATIGUE_GAP)
 * - tilt: win rate in the game after a win vs after a loss, within a session
 *   (MIN_TILT_GAP)
 * Sessions only use games with a readable time (see buildSessionStats).
 * Win rates are over games with a readable result. A finding also needs its gap to be
 * statistically significant (see _compareRates), which sets its confidence.
 * @param games - Games to analyse
 * @returns Zero or more findings, in the order above
 */
export function buildFindings(games: PlayerGame[]): InsightFinding[] {
	const findings: InsightFinding[] = [];
	const decided = games.filter((g) => g.result !== 'unknown');
	if (decided.length < MIN_FINDING_GAMES) return findings;

	const withDeaths = decided
		.map((g) => ({ game: g, deaths10: _gamePer10(g, g.stats.d) }))
		.filter((x): x is { game: PlayerGame; deaths10: number } => x.deaths10 !== null);
	if (withDeaths.length) {
		const medians: RoleDeathsMedian[] = [];
		const low: PlayerGame[] = [];
		const high: PlayerGame[] = [];
		for (const role of ROLE_ORDER) {
			const inRole = withDeaths.filter((x) => x.game.role === role);
			if (!inRole.length) continue;
			const medianDeaths10 = _median(inRole.map((x) => x.deaths10));
			medians.push({ role, medianDeaths10 });
			for (const { game, deaths10 } of inRole) {
				(deaths10 <= medianDeaths10 ? low : high).push(game);
			}
		}
		if (low.length >= MIN_FINDING_GAMES && high.length >= MIN_FINDING_GAMES) {
			const { aRate, bRate, significant, confidence } = _compareRates(low, high);
			if (aRate - bRate >= MIN_DEATHS_GAP && significant) {
				findings.push({
					kind: 'deathsSplit',
					confidence,
					medians,
					lowDeaths: { games: low.length, winRate: aRate },
					highDeaths: { games: high.length, winRate: bRate },
				});
			}
		}
	}

	const heroes = [..._groupBy(decided, (g) => g.hero)]
		.filter(([, heroGames]) => heroGames.length >= MIN_FINDING_GAMES)
		.map(([hero, heroGames]) => ({
			hero,
			heroGames,
			winRate: _winRate(heroGames)!,
		}))
		.sort(
			(a, b) =>
				b.winRate - a.winRate
				|| b.heroGames.length - a.heroGames.length
				|| a.hero.localeCompare(b.hero)
		);
	if (heroes.length) {
		const { hero, heroGames } = heroes[0];
		const rest = decided.filter((g) => g.hero !== hero);
		const { aRate, bRate, bGames, significant, confidence } = _compareRates(
			heroGames,
			rest
		);
		if (aRate - bRate >= MIN_HERO_GAP && significant) {
			findings.push({
				kind: 'bestHero',
				confidence,
				hero,
				games: heroGames.length,
				winRate: aRate,
				restWinRate: bRate,
				restGames: bGames,
			});
		}
	}

	const modes = [..._groupBy(decided, (g) => g.mode)]
		.filter(([, modeGames]) => modeGames.length >= MIN_FINDING_GAMES)
		.map(([mode, modeGames]) => ({ mode, modeGames, winRate: _winRate(modeGames)! }))
		.sort(
			(a, b) =>
				a.winRate - b.winRate
				|| b.modeGames.length - a.modeGames.length
				|| a.mode.localeCompare(b.mode)
		);
	if (modes.length) {
		const { mode, modeGames } = modes[0];
		const rest = decided.filter((g) => g.mode !== mode);
		const { aRate, bRate, bGames, significant, confidence } = _compareRates(
			modeGames,
			rest
		);
		if (bRate - aRate >= MIN_MODE_GAP && significant) {
			const worstMap = [..._groupBy(modeGames, (g) => g.map)]
				.filter(([, mapGames]) => mapGames.length >= MIN_WORST_MAP_GAMES)
				.map(([map, mapGames]) => {
					const { games, wins, losses, draws } = _recordStats(mapGames);
					return { map, games, wins, losses, draws, winRate: _winRate(mapGames)! };
				})
				.sort(
					(a, b) =>
						a.winRate - b.winRate || b.games - a.games || a.map.localeCompare(b.map)
				)[0];
			findings.push({
				kind: 'weakestMode',
				confidence,
				mode,
				games: modeGames.length,
				winRate: aRate,
				restWinRate: bRate,
				restGames: bGames,
				worstMap: worstMap ?? null,
			});
		}
	}

	const sessions = _sessions(games);
	const fatigue = _compareRates(
		sessions.flatMap((s) => s.slice(0, EARLY_SESSION_GAMES)),
		sessions.flatMap((s) => s.slice(EARLY_SESSION_GAMES))
	);
	if (fatigue.aRate - fatigue.bRate >= MIN_FATIGUE_GAP && fatigue.significant) {
		findings.push({
			kind: 'sessionFatigue',
			confidence: fatigue.confidence,
			early: { games: fatigue.aGames, winRate: fatigue.aRate },
			late: { games: fatigue.bGames, winRate: fatigue.bRate },
		});
	}

	const next = _afterResult(sessions);
	const tilt = _compareRates(next.afterWin, next.afterLoss);
	if (tilt.aRate - tilt.bRate >= MIN_TILT_GAP && tilt.significant) {
		findings.push({
			kind: 'tilt',
			confidence: tilt.confidence,
			afterWin: { games: tilt.aGames, winRate: tilt.aRate },
			afterLoss: { games: tilt.bGames, winRate: tilt.bRate },
		});
	}

	return findings;
}

/**
 * Builds session statistics from games with a readable time of day
 * Games without one are left out and counted in `untimedGames`. Game-number buckets
 * are 1, 2, 3, 4 and 5+, all always present (empty ones have 0 games). The after-win
 * and after-loss rows cover the next game in the same session; a draw or unknown
 * result as the previous game counts as neither, and pairs never cross sessions.
 * @param games - Games in any order
 */
export function buildSessionStats(games: PlayerGame[]): SessionStats {
	const sessions = _sessions(games);
	const timedGames = sessions.reduce((sum, s) => sum + s.length, 0);
	const { afterWin, afterLoss } = _afterResult(sessions);

	const byGameNumber = Array.from({ length: LAST_GAME_BUCKET }, (_, i): GameNumberRow => {
		const number = i + 1;
		const inBucket = sessions.flatMap((s) =>
			number === LAST_GAME_BUCKET ? s.slice(i) : s.slice(i, number)
		);
		return {
			label: number === LAST_GAME_BUCKET ? `${number}+` : String(number),
			..._recordStats(inBucket),
		};
	});

	return {
		byGameNumber,
		afterWin: _recordStats(afterWin),
		afterLoss: _recordStats(afterLoss),
		sessionCount: sessions.length,
		averageLength: sessions.length ? timedGames / sessions.length : null,
		timedGames,
		untimedGames: games.length - timedGames,
	};
}

/**
 * Computes every Insights section for the given filters
 * @param records - Saved game records
 * @param filters - Active filters
 * @param heroes - OverFast heroes (for roles); may be empty
 * @param now - Current time, injected for testability
 */
export function buildInsightsSummary(
	records: GameRecord[],
	filters: InsightsFilters,
	heroes: OverFastHero[],
	now: Date
): InsightsSummary {
	const all = toPlayerGames(records, filters.player, heroes);
	const { current, previous, hasComparison } = filterGames(all, filters, now);

	return {
		filters,
		generatedAt: now,
		totalGames: all.length,
		availableModes: [...new Set(all.map((g) => g.mode))].sort(),
		headline: buildHeadline(current, previous, hasComparison),
		trend: {
			winRate: buildWeeklyTrend(current, 'winRate'),
			kda: buildWeeklyTrend(current, 'kda'),
			dmg10: buildWeeklyTrend(current, 'dmg10'),
			heal10: buildWeeklyTrend(current, 'heal10'),
		},
		recentForm: buildRecentForm(current),
		heroPool: buildHeroPool(current),
		lobby: buildLobbyComparison(current),
		maps: buildMapStats(current),
		modes: buildModeStats(current),
		personalBests: buildPersonalBests(current),
		findings: buildFindings(current),
		sessions: buildSessionStats(current),
	};
}
