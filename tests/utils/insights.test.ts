import { describe, it, expect } from 'vitest';

import type {
	GameRecord,
	InsightsFilters,
	OverFastHero,
	PlayerGame,
	PlayerStats,
} from '#types';
import {
	MIN_FINDING_GAMES,
	parseResult,
	parseMatchDate,
	parseGameLengthSeconds,
	parseStat,
	getPlayerNameCounts,
	toPlayerGames,
	filterGames,
	buildHeadline,
	buildWeeklyTrend,
	buildRecentForm,
	buildHeroPool,
	buildLobbyComparison,
	buildMapStats,
	buildModeStats,
	buildPersonalBests,
	buildFindings,
	buildInsightsSummary,
} from '#utils/insights';

const NOW = new Date(2025, 5, 15, 12);
const DAY = 24 * 60 * 60 * 1000;

const HEROES: OverFastHero[] = [
	{ key: 'ana', name: 'Ana', portrait: '', role: 'support', subrole: '', gamemodes: [] },
	{ key: 'dva', name: 'D.Va', portrait: '', role: 'tank', subrole: '', gamemodes: [] },
	{
		key: 'tracer',
		name: 'Tracer',
		portrait: '',
		role: 'damage',
		subrole: '',
		gamemodes: [],
	},
];

const player = (name: string, team: 'blue' | 'red', over: Partial<PlayerStats> = {}) => ({
	name,
	team,
	e: '10',
	a: '5',
	d: '5',
	dmg: '6000',
	h: '0',
	mit: '0',
	hero: 'Tracer',
	...over,
});

interface RecordOptions {
	id?: string;
	result?: string;
	date?: string;
	mode?: string;
	map?: string;
	length?: string;
	me?: Partial<PlayerStats>;
	team?: 'blue' | 'red';
	players?: PlayerStats[];
	createdAt?: Date;
}

/** Record with ALICE plus one teammate and two enemies */
const rec = (o: RecordOptions = {}): GameRecord => ({
	id: o.id ?? 'r1',
	players: o.players ?? [
		player('ALICE', o.team ?? 'blue', o.me),
		player('MATE', o.team ?? 'blue', { e: '20', a: '0', d: '10', dmg: '8000', h: '100' }),
		player('FOE1', o.team === 'red' ? 'blue' : 'red', { e: '4', dmg: '2000' }),
		player('FOE2', o.team === 'red' ? 'blue' : 'red', { e: '6', dmg: '4000' }),
	],
	matchInfo: {
		result: o.result ?? 'VICTORY',
		final_score: { blue: '1', red: '0' },
		date: o.date ?? '06/10/2025',
		game_mode: o.mode ?? 'Push',
		game_length: o.length ?? '10:00',
		map: o.map ?? 'Colosseo',
	},
	createdAt: o.createdAt ?? new Date(2025, 5, 10, 20),
	updatedAt: new Date(2025, 5, 10, 20),
});

const game = (o: Partial<PlayerGame> = {}): PlayerGame => ({
	recordId: 'g',
	date: new Date(2025, 5, 10),
	createdAt: new Date(2025, 5, 10),
	result: 'win',
	team: 'blue',
	lengthSeconds: 600,
	mode: 'PUSH',
	map: 'COLOSSEO',
	hero: 'Tracer',
	role: 'damage',
	stats: { e: 10, a: 5, d: 5, dmg: 6000, h: 0, mit: 0 },
	teamAvg: { e: null, a: null, d: null, dmg: null, h: null, mit: null },
	enemyAvg: { e: null, a: null, d: null, dmg: null, h: null, mit: null },
	...o,
});

/** n games with sequential ids; overrides may be a function of the index */
const games = (n: number, o: (i: number) => Partial<PlayerGame> = () => ({})) =>
	Array.from({ length: n }, (_, i) =>
		game({
			recordId: `g${i}`,
			date: new Date(2025, 5, 1 + i),
			createdAt: new Date(2025, 5, 1 + i),
			...o(i),
		})
	);

const FILTERS: InsightsFilters = {
	player: 'alice',
	period: 'all',
	compare: 'none',
	role: 'all',
	mode: 'all',
};

describe('insights', () => {
	describe('parsers', () => {
		describe('parseResult', () => {
			it('maps the three known results', () => {
				expect(parseResult('VICTORY')).toBe('win');
				expect(parseResult('DEFEAT')).toBe('loss');
				expect(parseResult('DRAW')).toBe('draw');
			});

			it('ignores case and whitespace', () => {
				expect(parseResult(' victory ')).toBe('win');
			});

			it.each(['', 'VICT0RY', 'WIN', '??'])('treats %j as unknown', (text) => {
				expect(parseResult(text)).toBe('unknown');
			});
		});

		describe('parseMatchDate', () => {
			const dated = (date: string) => rec({ date });

			it('parses MM/DD/YYYY as local midnight', () => {
				expect(parseMatchDate(dated('03/07/2025'))).toEqual(new Date(2025, 2, 7));
			});

			it('ignores extra time text', () => {
				expect(parseMatchDate(dated('03/07/2025 14:32'))).toEqual(new Date(2025, 2, 7));
				expect(parseMatchDate(dated('3-7-2025'))).toEqual(new Date(2025, 2, 7));
			});

			it('accepts two-digit years', () => {
				expect(parseMatchDate(dated('03/07/25'))).toEqual(new Date(2025, 2, 7));
			});

			it.each(['', 'yesterday', '13/40/2025', '02/30/2025', '12/2025'])(
				'falls back to createdAt for %j',
				(date) => {
					const record = dated(date);
					expect(parseMatchDate(record)).toEqual(record.createdAt);
				}
			);
		});

		describe('parseGameLengthSeconds', () => {
			it('parses mm:ss and h:mm:ss', () => {
				expect(parseGameLengthSeconds('12:34')).toBe(754);
				expect(parseGameLengthSeconds('1:02:03')).toBe(3723);
				expect(parseGameLengthSeconds(' 5:00 ')).toBe(300);
			});

			it.each(['', 'abc', '10', '10:75', '1:75:00', '0:00', '10:5', '1:2:3:4'])(
				'returns null for %j',
				(text) => {
					expect(parseGameLengthSeconds(text)).toBeNull();
				}
			);
		});

		describe('parseStat', () => {
			it('parses digit strings', () => {
				expect(parseStat('0')).toBe(0);
				expect(parseStat(' 12345 ')).toBe(12345);
			});

			it.each(['', 'abc', '1O', '-3', '1.5', '1,000'])('returns null for %j', (text) => {
				expect(parseStat(text)).toBeNull();
			});
		});
	});

	describe('getPlayerNameCounts', () => {
		it('returns an empty list for no records', () => {
			expect(getPlayerNameCounts([])).toEqual([]);
		});

		it('counts records per normalised name, most frequent first', () => {
			const records = [
				rec({ id: 'a' }),
				rec({ id: 'b', players: [player(' alice ', 'blue'), player('Zed', 'red')] }),
				rec({ id: 'c', players: [player('Zed', 'red'), player('Zed', 'blue')] }),
			];
			const counts = getPlayerNameCounts(records);
			expect(counts[0]).toEqual({ name: 'ALICE', count: 2 });
			expect(counts.find((c) => c.name === 'ZED')).toEqual({ name: 'ZED', count: 2 });
		});

		it('sorts ties alphabetically and skips empty names', () => {
			const records = [
				rec({ players: [player('', 'blue'), player('B', 'red'), player('A', 'red')] }),
			];
			expect(getPlayerNameCounts(records).map((c) => c.name)).toEqual(['A', 'B']);
		});
	});

	describe('toPlayerGames', () => {
		it('returns nothing for empty records or an empty player', () => {
			expect(toPlayerGames([], 'alice', HEROES)).toEqual([]);
			expect(toPlayerGames([rec()], '  ', HEROES)).toEqual([]);
		});

		it('skips records the player is absent from', () => {
			const out = toPlayerGames([rec({ id: 'a' }), rec({ id: 'b' })], 'nobody', HEROES);
			expect(out).toEqual([]);
		});

		it('matches the name case-insensitively and builds the row', () => {
			const [g] = toPlayerGames([rec({ me: { hero: 'ana' } })], ' Alice ', HEROES);
			expect(g).toMatchObject({
				recordId: 'r1',
				result: 'win',
				team: 'blue',
				lengthSeconds: 600,
				mode: 'PUSH',
				map: 'COLOSSEO',
				hero: 'Ana',
				role: 'support',
			});
			expect(g.date).toEqual(new Date(2025, 5, 10));
			expect(g.stats).toEqual({ e: 10, a: 5, d: 5, dmg: 6000, h: 0, mit: 0 });
		});

		it('averages teammates and enemies separately, excluding the player', () => {
			const [g] = toPlayerGames([rec()], 'alice', HEROES);
			expect(g.teamAvg.e).toBe(20);
			expect(g.enemyAvg.e).toBe(5);
			expect(g.enemyAvg.dmg).toBe(3000);
		});

		it('leaves averages null when a team has no readable values', () => {
			const record = rec({
				players: [player('ALICE', 'blue'), player('MATE', 'blue', { e: '?' })],
			});
			const [g] = toPlayerGames([record], 'alice', HEROES);
			expect(g.teamAvg.e).toBeNull();
			expect(g.enemyAvg.e).toBeNull();
		});

		it('keeps results as read for blue and inverts VICTORY/DEFEAT for red', () => {
			const out = (result: string, team: 'blue' | 'red') =>
				toPlayerGames([rec({ result, team })], 'alice', HEROES)[0].result;
			expect(out('VICTORY', 'blue')).toBe('win');
			expect(out('VICTORY', 'red')).toBe('loss');
			expect(out('DEFEAT', 'red')).toBe('win');
			expect(out('DRAW', 'red')).toBe('draw');
			expect(out('???', 'red')).toBe('unknown');
		});

		it('uses unknown role for unmatched or missing heroes', () => {
			const out = toPlayerGames(
				[
					rec({ id: 'a', me: { hero: 'Mystery' } }),
					rec({ id: 'b', me: { hero: undefined } }),
				],
				'alice',
				HEROES
			);
			expect(out.map((g) => g.role)).toEqual(['unknown', 'unknown']);
			expect(out.find((g) => g.recordId === 'a')!.hero).toBe('Mystery');
			expect(out.find((g) => g.recordId === 'b')!.hero).toBeNull();
		});

		it('works without hero data', () => {
			expect(toPlayerGames([rec()], 'alice', [])[0].role).toBe('unknown');
		});

		it('nulls unreadable length and stats and labels empty mode/map', () => {
			const [g] = toPlayerGames(
				[rec({ length: 'x', mode: ' ', map: '', me: { e: '', dmg: 'abc' } })],
				'alice',
				HEROES
			);
			expect(g.lengthSeconds).toBeNull();
			expect(g.stats.e).toBeNull();
			expect(g.stats.dmg).toBeNull();
			expect(g.stats.a).toBe(5);
			expect(g.mode).toBe('UNKNOWN');
			expect(g.map).toBe('UNKNOWN');
		});

		it('falls back to createdAt when the date is unreadable', () => {
			const createdAt = new Date(2025, 4, 1);
			const [g] = toPlayerGames([rec({ date: 'junk', createdAt })], 'alice', HEROES);
			expect(g.date).toEqual(createdAt);
		});

		it('sorts by date, then createdAt', () => {
			const out = toPlayerGames(
				[
					rec({ id: 'late', date: '06/12/2025' }),
					rec({ id: 'tie2', date: '06/01/2025', createdAt: new Date(2025, 5, 3) }),
					rec({ id: 'tie1', date: '06/01/2025', createdAt: new Date(2025, 5, 2) }),
				],
				'alice',
				HEROES
			);
			expect(out.map((g) => g.recordId)).toEqual(['tie1', 'tie2', 'late']);
		});
	});

	describe('filterGames', () => {
		const dayAgo = (n: number) => new Date(NOW.getTime() - n * DAY);
		const set = [
			game({ recordId: 'now', date: dayAgo(1) }),
			game({ recordId: 'edge29', date: dayAgo(29) }),
			game({ recordId: 'prev', date: dayAgo(40), role: 'tank', mode: 'CONTROL' }),
			game({ recordId: 'prevEdge', date: dayAgo(59) }),
			game({ recordId: 'old', date: dayAgo(100) }),
			game({ recordId: 'future', date: dayAgo(-3) }),
		];
		const ids = (gs: PlayerGame[]) => gs.map((g) => g.recordId);

		it('returns empty windows for no games', () => {
			expect(filterGames([], { ...FILTERS, period: 'last30' }, NOW)).toEqual({
				current: [],
				previous: [],
				hasComparison: false,
			});
		});

		it('keeps everything for period all, with no comparison', () => {
			const out = filterGames(set, { ...FILTERS, compare: 'previous' }, NOW);
			expect(out.current).toHaveLength(6);
			expect(out.previous).toEqual([]);
			expect(out.hasComparison).toBe(false);
		});

		it('splits the period and the equal-length window before it', () => {
			const out = filterGames(
				set,
				{ ...FILTERS, period: 'last30', compare: 'previous' },
				NOW
			);
			expect(ids(out.current)).toEqual(['now', 'edge29', 'future']);
			expect(ids(out.previous)).toEqual(['prev', 'prevEdge']);
			expect(out.hasComparison).toBe(true);
		});

		it('skips the comparison window when compare is none', () => {
			const out = filterGames(set, { ...FILTERS, period: 'last30' }, NOW);
			expect(out.previous).toEqual([]);
			expect(out.hasComparison).toBe(false);
		});

		it('uses 90 days for last90', () => {
			const out = filterGames(
				set,
				{ ...FILTERS, period: 'last90', compare: 'previous' },
				NOW
			);
			expect(ids(out.current)).toContain('prevEdge');
			expect(ids(out.current)).not.toContain('old');
			expect(ids(out.previous)).toEqual(['old']);
		});

		it('applies role and mode to both windows', () => {
			const roleOut = filterGames(
				set,
				{ ...FILTERS, period: 'last30', compare: 'previous', role: 'tank' },
				NOW
			);
			expect(roleOut.current).toEqual([]);
			expect(ids(roleOut.previous)).toEqual(['prev']);

			const modeOut = filterGames(set, { ...FILTERS, mode: ' control ' }, NOW);
			expect(ids(modeOut.current)).toEqual(['prev']);
		});
	});

	describe('buildHeadline', () => {
		it('handles no games', () => {
			expect(buildHeadline([], [], true)).toEqual({
				games: { value: 0, delta: null },
				wins: 0,
				losses: 0,
				draws: 0,
				winRate: { value: null, delta: null },
				kda: { value: null, delta: null },
				dmg10: { value: null, delta: null },
				heal10: { value: null, delta: null },
				deaths10: { value: null, delta: null },
			});
		});

		it('computes deaths per 10 minutes with a delta against the previous window', () => {
			const withDeaths = (d: number) =>
				game({ lengthSeconds: 600, stats: { e: 0, a: 0, d, dmg: 0, h: 0, mit: 0 } });
			const h = buildHeadline([withDeaths(6), withDeaths(8)], [withDeaths(10)], true);
			expect(h.deaths10.value).toBe(7);
			expect(h.deaths10.delta).toBe(-3);
		});

		it('skips games with an invalid length or unreadable deaths in deaths per 10', () => {
			const h = buildHeadline(
				[
					game({
						lengthSeconds: 600,
						stats: { e: 0, a: 0, d: 4, dmg: 0, h: 0, mit: 0 },
					}),
					game({
						lengthSeconds: null,
						stats: { e: 0, a: 0, d: 40, dmg: 0, h: 0, mit: 0 },
					}),
					game({
						lengthSeconds: 600,
						stats: { e: 0, a: 0, d: null, dmg: 0, h: 0, mit: 0 },
					}),
				],
				[],
				false
			);
			expect(h.deaths10).toEqual({ value: 4, delta: null });
		});

		it('counts results and excludes unknown from win rate but not games', () => {
			const h = buildHeadline(
				[
					game({ result: 'win' }),
					game({ result: 'loss' }),
					game({ result: 'draw' }),
					game({ result: 'win' }),
					game({ result: 'unknown' }),
				],
				[],
				false
			);
			expect(h).toMatchObject({ wins: 2, losses: 1, draws: 1 });
			expect(h.games.value).toBe(5);
			expect(h.winRate.value).toBe(50);
		});

		it('computes KDA from sums and floors deaths at 1', () => {
			const h = buildHeadline(
				[
					game({ stats: { e: 10, a: 4, d: 0, dmg: 0, h: 0, mit: 0 } }),
					game({ stats: { e: 5, a: 1, d: 0, dmg: 0, h: 0, mit: 0 } }),
				],
				[],
				false
			);
			expect(h.kda.value).toBe(20);
		});

		it('computes KDA only over games where e, a and d are readable', () => {
			const h = buildHeadline(
				[
					game({ stats: { e: 10, a: 0, d: 5, dmg: 0, h: 0, mit: 0 } }),
					game({ stats: { e: 99, a: null, d: 1, dmg: 0, h: 0, mit: 0 } }),
				],
				[],
				false
			);
			expect(h.kda.value).toBe(2);
		});

		it('computes per-10 as sum over seconds, not a mean of ratios', () => {
			const h = buildHeadline(
				[
					game({
						lengthSeconds: 600,
						stats: { e: 0, a: 0, d: 0, dmg: 1000, h: 0, mit: 0 },
					}),
					game({
						lengthSeconds: 1800,
						stats: { e: 0, a: 0, d: 0, dmg: 5000, h: 0, mit: 0 },
					}),
				],
				[],
				false
			);
			// (1000 + 5000) / 2400 * 600 = 1500; a mean of ratios would give 3333
			expect(h.dmg10.value).toBe(1500);
		});

		it('skips games with an invalid length or stat in per-10 only', () => {
			const h = buildHeadline(
				[
					game({
						lengthSeconds: 600,
						stats: { e: 0, a: 0, d: 0, dmg: 1000, h: 0, mit: 0 },
					}),
					game({
						lengthSeconds: null,
						stats: { e: 0, a: 0, d: 0, dmg: 9000, h: 0, mit: 0 },
					}),
					game({
						lengthSeconds: 600,
						stats: { e: 0, a: 0, d: 0, dmg: null, h: 0, mit: 0 },
					}),
				],
				[],
				false
			);
			expect(h.dmg10.value).toBe(1000);
			expect(h.games.value).toBe(3);
		});

		it('returns null per-10 when no game has a valid length', () => {
			expect(
				buildHeadline([game({ lengthSeconds: null })], [], false).dmg10.value
			).toBeNull();
		});

		it('computes deltas against the comparison window', () => {
			const h = buildHeadline(
				[game({ result: 'win' }), game({ result: 'win' }), game({ result: 'win' })],
				[game({ result: 'win' }), game({ result: 'loss' })],
				true
			);
			expect(h.winRate.delta).toBe(50);
			expect(h.games.delta).toBe(1);
		});

		it('gives null deltas without a comparison', () => {
			const h = buildHeadline([game()], [game({ result: 'loss' })], false);
			expect(h.winRate.delta).toBeNull();
			expect(h.games.delta).toBeNull();
		});

		it('gives null deltas when the comparison window has no games', () => {
			const h = buildHeadline([game()], [], true);
			expect(h.winRate.value).toBe(100);
			expect(h.winRate.delta).toBeNull();
			expect(h.kda.delta).toBeNull();
			expect(h.games.delta).toBeNull();
		});
	});

	describe('buildWeeklyTrend', () => {
		// 2025-06-02 is a Monday
		const mon = (d: number) => new Date(2025, 5, d);

		it('returns nothing for no games', () => {
			expect(buildWeeklyTrend([], 'winRate')).toEqual([]);
		});

		it('buckets by Monday-start weeks', () => {
			const out = buildWeeklyTrend(
				[
					game({ date: mon(1), result: 'win' }), // Sunday, previous week
					game({ date: mon(2), result: 'loss' }),
					game({ date: mon(8), result: 'win' }), // Sunday
					game({ date: mon(9), result: 'win' }),
				],
				'winRate'
			);
			expect(out.map((p) => p.weekStart)).toEqual([
				new Date(2025, 4, 26),
				mon(2),
				mon(9),
			]);
			expect(out.map((p) => p.games)).toEqual([1, 2, 1]);
			expect(out.map((p) => p.value)).toEqual([100, 50, 100]);
		});

		it('includes empty weeks between games', () => {
			const out = buildWeeklyTrend(
				[game({ date: mon(2) }), game({ date: new Date(2025, 5, 16) })],
				'winRate'
			);
			expect(out.map((p) => p.games)).toEqual([1, 0, 1]);
			expect(out[1].value).toBeNull();
		});

		it('limits to the most recent weeks ending at the latest game', () => {
			const out = buildWeeklyTrend(
				games(60, (i) => ({ date: new Date(2025, 0, 1 + i * 3) })),
				'winRate',
				4
			);
			expect(out).toHaveLength(4);
			expect(out.at(-1)!.games).toBeGreaterThan(0);
		});

		it('computes the other metrics per week', () => {
			const stats = { e: 6, a: 6, d: 3, dmg: 3000, h: 600, mit: 0 };
			const g = [game({ date: mon(2), stats })];
			expect(buildWeeklyTrend(g, 'kda')[0].value).toBe(4);
			expect(buildWeeklyTrend(g, 'dmg10')[0].value).toBe(3000);
			expect(buildWeeklyTrend(g, 'heal10')[0].value).toBe(600);
		});

		it('gives a null value to weeks whose metric has no data', () => {
			const out = buildWeeklyTrend(
				[game({ date: mon(2), result: 'unknown' })],
				'winRate'
			);
			expect(out).toEqual([{ weekStart: mon(2), games: 1, value: null }]);
		});
	});

	describe('buildRecentForm', () => {
		const run = (...results: PlayerGame['result'][]) =>
			results.map((result, i) =>
				game({ recordId: `g${i}`, result, date: new Date(2025, 5, 1 + i) })
			);

		it('handles no games', () => {
			expect(buildRecentForm([])).toEqual({
				results: [],
				wins: 0,
				losses: 0,
				draws: 0,
				currentStreak: { result: null, length: 0 },
				bestWinStreak: 0,
			});
		});

		it('lists the last N results oldest first', () => {
			const form = buildRecentForm(run('win', 'loss', 'draw', 'win'), 3);
			expect(form.results.map((r) => r.result)).toEqual(['loss', 'draw', 'win']);
			expect(form.results.map((r) => r.recordId)).toEqual(['g1', 'g2', 'g3']);
			expect(form).toMatchObject({ wins: 1, losses: 1, draws: 1 });
		});

		it('sorts games by date regardless of input order', () => {
			const form = buildRecentForm(run('win', 'win', 'loss').reverse());
			expect(form.currentStreak).toEqual({ result: 'loss', length: 1 });
		});

		it('tracks the current and best win streaks', () => {
			const form = buildRecentForm(run('win', 'win', 'win', 'loss', 'win', 'win'));
			expect(form.currentStreak).toEqual({ result: 'win', length: 2 });
			expect(form.bestWinStreak).toBe(3);
		});

		it('tracks a losing streak', () => {
			const form = buildRecentForm(run('win', 'loss', 'loss'));
			expect(form.currentStreak).toEqual({ result: 'loss', length: 2 });
		});

		it('breaks streaks on draws', () => {
			const form = buildRecentForm(run('win', 'win', 'draw', 'win'));
			expect(form.bestWinStreak).toBe(2);
			expect(form.currentStreak).toEqual({ result: 'win', length: 1 });
		});

		it('ignores unknown results without breaking a streak', () => {
			const form = buildRecentForm(run('win', 'unknown', 'win'));
			expect(form.results).toHaveLength(2);
			expect(form.bestWinStreak).toBe(2);
		});

		it('counts best streak beyond the listed window', () => {
			const form = buildRecentForm(run('win', 'win', 'win', 'win', 'loss'), 2);
			expect(form.bestWinStreak).toBe(4);
		});
	});

	describe('buildHeroPool', () => {
		it('returns nothing for no games', () => {
			expect(buildHeroPool([])).toEqual([]);
		});

		it('skips games without a hero', () => {
			expect(buildHeroPool([game({ hero: null })])).toEqual([]);
		});

		it('groups per hero with win rate delta against overall', () => {
			const rows = buildHeroPool([
				game({ hero: 'Ana', role: 'support', result: 'win' }),
				game({ hero: 'Ana', role: 'support', result: 'win' }),
				game({ hero: 'Tracer', result: 'loss' }),
				game({ hero: 'Tracer', result: 'loss' }),
				game({ hero: 'Tracer', result: 'win' }),
				game({ hero: null, result: 'loss' }),
			]);
			expect(rows.map((r) => r.hero)).toEqual(['Tracer', 'Ana']);
			expect(rows[0]).toMatchObject({ games: 3, role: 'damage' });
			// overall: 3 wins in 6 = 50
			expect(rows[1]).toMatchObject({
				games: 2,
				winRate: 100,
				winRateDelta: 50,
				role: 'support',
			});
			expect(rows[0].winRateDelta).toBeCloseTo(33.33 - 50, 1);
		});

		it('gives null stats for unreadable values and unknown results', () => {
			const [row] = buildHeroPool([
				game({
					result: 'unknown',
					lengthSeconds: null,
					stats: { e: null, a: null, d: null, dmg: null, h: null, mit: null },
				}),
			]);
			expect(row).toMatchObject({
				winRate: null,
				winRateDelta: null,
				kda: null,
				dmg10: null,
				heal10: null,
				mit10: null,
			});
		});

		it('breaks game-count ties by name', () => {
			const rows = buildHeroPool([game({ hero: 'Zarya' }), game({ hero: 'Ana' })]);
			expect(rows.map((r) => r.hero)).toEqual(['Ana', 'Zarya']);
		});
	});

	describe('buildLobbyComparison', () => {
		it('returns null values for no games', () => {
			const rows = buildLobbyComparison([]);
			expect(rows.map((r) => r.stat)).toEqual(['e', 'a', 'd', 'h', 'dmg']);
			expect(
				rows.every((r) => r.you === null && r.team === null && r.enemy === null)
			).toBe(true);
		});

		it('computes per-10 for you, team and enemy', () => {
			const g = game({
				lengthSeconds: 1200,
				stats: { e: 20, a: 0, d: 0, dmg: 0, h: 0, mit: 0 },
				teamAvg: { e: 10, a: 0, d: 0, dmg: 0, h: 0, mit: 0 },
				enemyAvg: { e: 30, a: 0, d: 0, dmg: 0, h: 0, mit: 0 },
			});
			const row = buildLobbyComparison([g]).find((r) => r.stat === 'e')!;
			expect(row).toEqual({ stat: 'e', you: 10, team: 5, enemy: 15 });
		});

		it('only uses games where all three values and the length are readable', () => {
			const full = game({
				stats: { e: 10, a: 0, d: 0, dmg: 0, h: 0, mit: 0 },
				teamAvg: { e: 10, a: 0, d: 0, dmg: 0, h: 0, mit: 0 },
				enemyAvg: { e: 10, a: 0, d: 0, dmg: 0, h: 0, mit: 0 },
			});
			const noEnemy = game({
				stats: { e: 999, a: 0, d: 0, dmg: 0, h: 0, mit: 0 },
				teamAvg: { e: 999, a: 0, d: 0, dmg: 0, h: 0, mit: 0 },
			});
			const noLength = { ...full, lengthSeconds: null };
			const row = buildLobbyComparison([full, noEnemy, noLength]).find(
				(r) => r.stat === 'e'
			)!;
			expect(row).toEqual({ stat: 'e', you: 10, team: 10, enemy: 10 });
		});
	});

	describe('buildMapStats', () => {
		it('returns nothing for no games', () => {
			expect(buildMapStats([])).toEqual([]);
		});

		it('hides maps below the minimum and sorts by win rate', () => {
			const rows = buildMapStats([
				...games(4, () => ({ map: 'A', result: 'loss' })),
				...games(4, (i) => ({ map: 'B', result: i < 3 ? 'win' : 'loss' })),
				...games(3, () => ({ map: 'C', result: 'win' })),
			]);
			expect(rows.map((r) => r.map)).toEqual(['B', 'A']);
			expect(rows[0]).toEqual({
				map: 'B',
				games: 4,
				wins: 3,
				losses: 1,
				draws: 0,
				winRate: 75,
			});
		});

		it('respects a custom minimum and counts draws and unknowns', () => {
			const [row] = buildMapStats(
				[
					game({ map: 'A', result: 'draw' }),
					game({ map: 'A', result: 'unknown' }),
					game({ map: 'A', result: 'win' }),
				],
				3
			);
			expect(row).toMatchObject({ games: 3, wins: 1, draws: 1, winRate: 50 });
		});

		it('sorts maps with no readable result last', () => {
			const rows = buildMapStats(
				[
					...games(2, () => ({ map: 'A', result: 'unknown' })),
					...games(2, () => ({ map: 'B', result: 'loss' })),
				],
				2
			);
			expect(rows.map((r) => r.map)).toEqual(['B', 'A']);
			expect(rows[1].winRate).toBeNull();
		});
	});

	describe('buildModeStats', () => {
		it('returns nothing for no games', () => {
			expect(buildModeStats([])).toEqual([]);
		});

		it('counts W/L/D per mode, most played first', () => {
			const rows = buildModeStats([
				game({ mode: 'PUSH', result: 'win' }),
				game({ mode: 'PUSH', result: 'draw' }),
				game({ mode: 'PUSH', result: 'loss' }),
				game({ mode: 'CONTROL', result: 'loss' }),
			]);
			expect(rows).toEqual([
				{ mode: 'PUSH', games: 3, wins: 1, losses: 1, draws: 1, winRate: (1 / 3) * 100 },
				{ mode: 'CONTROL', games: 1, wins: 0, losses: 1, draws: 0, winRate: 0 },
			]);
		});
	});

	describe('buildPersonalBests', () => {
		it('returns nulls for no games', () => {
			expect(buildPersonalBests([])).toEqual({
				kills: null,
				damage: null,
				healing: null,
				fewestDeathsInWin: null,
			});
		});

		it('finds the best of each with its record id', () => {
			const stats = (e: number, d: number, dmg: number, h: number) => ({
				e,
				a: 0,
				d,
				dmg,
				h,
				mit: 0,
			});
			const best = buildPersonalBests([
				game({ recordId: 'a', stats: stats(10, 5, 9000, 100), result: 'win' }),
				game({ recordId: 'b', stats: stats(30, 0, 5000, 5000), result: 'loss' }),
				game({ recordId: 'c', stats: stats(20, 2, 12000, 50), result: 'win' }),
			]);
			expect(best.kills).toMatchObject({ value: 30, recordId: 'b' });
			expect(best.damage).toMatchObject({ value: 12000, recordId: 'c' });
			expect(best.healing).toMatchObject({ value: 5000, recordId: 'b' });
			// the 0-death game was a loss
			expect(best.fewestDeathsInWin).toMatchObject({ value: 2, recordId: 'c' });
		});

		it('has no fewest-deaths record without a win', () => {
			const best = buildPersonalBests([
				game({ result: 'loss' }),
				game({ result: 'draw' }),
			]);
			expect(best.fewestDeathsInWin).toBeNull();
		});

		it('skips unreadable stats and gives ties to the earliest game', () => {
			const none = { e: null, a: null, d: null, dmg: null, h: null, mit: null };
			const best = buildPersonalBests([
				game({ recordId: 'x', stats: none }),
				game({ recordId: 'late', date: new Date(2025, 5, 20), stats: { ...none, e: 9 } }),
				game({ recordId: 'early', date: new Date(2025, 5, 2), stats: { ...none, e: 9 } }),
			]);
			expect(best.kills).toMatchObject({ value: 9, recordId: 'early' });
			expect(best.damage).toBeNull();
		});

		it('treats zero as a valid value', () => {
			const best = buildPersonalBests([
				game({ stats: { e: 0, a: 0, d: 0, dmg: 0, h: 0, mit: 0 } }),
			]);
			expect(best.kills?.value).toBe(0);
			expect(best.fewestDeathsInWin?.value).toBe(0);
		});
	});

	describe('buildFindings', () => {
		const deaths = (d: number) => ({ stats: { e: 0, a: 0, d, dmg: 0, h: 0, mit: 0 } });
		/** Win/loss list helper */
		const results = (wins: number, losses: number): PlayerGame['result'][] => [
			...Array<'win'>(wins).fill('win'),
			...Array<'loss'>(losses).fill('loss'),
		];

		it('returns nothing for no games or too few games', () => {
			expect(buildFindings([])).toEqual([]);
			expect(buildFindings(games(MIN_FINDING_GAMES - 1))).toEqual([]);
		});

		describe('deathsSplit', () => {
			it('fires when low-death games win much more', () => {
				const low = results(5, 0).map((result) => game({ result, ...deaths(2) }));
				const high = results(0, 5).map((result) => game({ result, ...deaths(10) }));
				const findings = buildFindings([...low, ...high]);
				expect(findings).toContainEqual({
					kind: 'deathsSplit',
					medianDeaths: 6,
					lowDeaths: { games: 5, winRate: 100 },
					highDeaths: { games: 5, winRate: 0 },
				});
			});

			it('does not fire when a bucket is too small', () => {
				const low = results(5, 0).map((result) => game({ result, ...deaths(2) }));
				const high = results(0, 4).map((result) => game({ result, ...deaths(10) }));
				// median 2: low bucket is 5 games, high is 4
				expect(buildFindings([...low, ...high]).map((f) => f.kind)).not.toContain(
					'deathsSplit'
				);
			});

			it('does not fire when the gap is below the threshold', () => {
				const mixed = (d: number) =>
					results(3, 2).map((result) => game({ result, ...deaths(d) }));
				expect(buildFindings([...mixed(2), ...mixed(10)])).toEqual([]);
			});

			it('does not fire when low-death games win less', () => {
				const low = results(0, 5).map((result) => game({ result, ...deaths(2) }));
				const high = results(5, 0).map((result) => game({ result, ...deaths(10) }));
				expect(buildFindings([...low, ...high]).map((f) => f.kind)).not.toContain(
					'deathsSplit'
				);
			});

			it('ignores games with unreadable deaths or results', () => {
				const unreadable = games(10, () => ({
					result: 'unknown' as const,
					stats: { e: 0, a: 0, d: null, dmg: 0, h: 0, mit: 0 },
				}));
				expect(buildFindings(unreadable)).toEqual([]);
			});
		});

		describe('bestHero', () => {
			const mk = (hero: string, wins: number, losses: number) =>
				results(wins, losses).map((result) => game({ hero, result }));

			it('fires for a hero well above the overall win rate', () => {
				const findings = buildFindings([...mk('Ana', 5, 0), ...mk('Tracer', 0, 5)]);
				expect(findings).toContainEqual({
					kind: 'bestHero',
					hero: 'Ana',
					games: 5,
					winRate: 100,
					overallWinRate: 50,
				});
			});

			it('needs the minimum games', () => {
				const findings = buildFindings([...mk('Ana', 4, 0), ...mk('Tracer', 0, 6)]);
				expect(findings.map((f) => f.kind)).not.toContain('bestHero');
			});

			it('needs the gap to be reached', () => {
				const findings = buildFindings([...mk('Ana', 3, 2), ...mk('Tracer', 3, 2)]);
				expect(findings.map((f) => f.kind)).not.toContain('bestHero');
			});
		});

		describe('weakestMode', () => {
			const mk = (mode: string, map: string, wins: number, losses: number) =>
				results(wins, losses).map((result) => game({ mode, map, result }));

			it('fires with the mode and its worst map', () => {
				const findings = buildFindings([
					...mk('PUSH', 'A', 5, 0),
					...mk('CONTROL', 'B', 0, 3),
					...mk('CONTROL', 'C', 2, 0),
				]);
				const f = findings.find((x) => x.kind === 'weakestMode');
				expect(f).toEqual({
					kind: 'weakestMode',
					mode: 'CONTROL',
					games: 5,
					winRate: 40,
					overallWinRate: 70,
					worstMap: { map: 'B', games: 3, wins: 0, losses: 3, draws: 0, winRate: 0 },
				});
			});

			it('has a null worst map when no map has enough games', () => {
				const findings = buildFindings([
					...mk('PUSH', 'A', 5, 0),
					...mk('CONTROL', 'B', 0, 2),
					...mk('CONTROL', 'C', 0, 2),
					...mk('CONTROL', 'D', 0, 1),
				]);
				const f = findings.find((x) => x.kind === 'weakestMode');
				expect(f).toMatchObject({ mode: 'CONTROL' });
				expect(f && f.kind === 'weakestMode' && f.worstMap).toBeNull();
			});

			it('does not fire for a single mode or a small gap', () => {
				expect(buildFindings(mk('PUSH', 'A', 5, 5)).map((f) => f.kind)).toEqual([]);
				const close = [...mk('PUSH', 'A', 3, 2), ...mk('CONTROL', 'B', 3, 2)];
				expect(buildFindings(close).map((f) => f.kind)).not.toContain('weakestMode');
			});

			it('does not fire when the weak mode has too few games', () => {
				const findings = buildFindings([
					...mk('PUSH', 'A', 6, 0),
					...mk('CONTROL', 'B', 0, 4),
				]);
				expect(findings.map((f) => f.kind)).not.toContain('weakestMode');
			});
		});
	});

	describe('buildInsightsSummary', () => {
		const records = [
			rec({ id: 'a', date: '06/01/2025', result: 'VICTORY' }),
			rec({ id: 'b', date: '06/05/2025', result: 'DEFEAT', mode: 'Control' }),
			rec({ id: 'c', date: '03/01/2025', result: 'VICTORY' }),
			rec({
				id: 'd',
				date: '06/08/2025',
				result: 'VICTORY',
				team: 'red',
				me: { hero: 'Ana' },
			}),
			rec({ id: 'other', players: [player('SOMEONE', 'blue')] }),
		];

		it('handles empty records', () => {
			const s = buildInsightsSummary([], FILTERS, HEROES, NOW);
			expect(s.totalGames).toBe(0);
			expect(s.availableModes).toEqual([]);
			expect(s.headline.games.value).toBe(0);
			expect(s.trend.winRate).toEqual([]);
			expect(s.heroPool).toEqual([]);
			expect(s.findings).toEqual([]);
			expect(s.generatedAt).toBe(NOW);
		});

		it('composes the sections for the tracked player', () => {
			const s = buildInsightsSummary(records, FILTERS, HEROES, NOW);
			expect(s.totalGames).toBe(4);
			expect(s.availableModes).toEqual(['CONTROL', 'PUSH']);
			expect(s.headline).toMatchObject({ wins: 2, losses: 2 });
			expect(s.recentForm.results.map((r) => r.recordId)).toEqual(['c', 'a', 'b', 'd']);
			expect(s.trend.kda.length).toBeGreaterThan(0);
			expect(s.heroPool.map((r) => r.hero).sort()).toEqual(['Ana', 'Tracer']);
			expect(s.personalBests.kills?.value).toBe(10);
			expect(s.modes.map((m) => m.mode)).toEqual(['PUSH', 'CONTROL']);
			expect(s.filters).toBe(FILTERS);
		});

		it('applies period, comparison and role filters', () => {
			const s = buildInsightsSummary(
				records,
				{ ...FILTERS, period: 'last30', compare: 'previous' },
				HEROES,
				NOW
			);
			expect(s.totalGames).toBe(4);
			expect(s.headline.games.value).toBe(3);
			expect(s.headline.games.delta).toBeNull(); // 03/01 is outside the previous 30 days

			const support = buildInsightsSummary(
				records,
				{ ...FILTERS, role: 'support' },
				HEROES,
				NOW
			);
			expect(support.headline.games.value).toBe(1);
			expect(support.availableModes).toEqual(['CONTROL', 'PUSH']);
		});

		it('returns an empty summary for a player who is absent', () => {
			const s = buildInsightsSummary(
				records,
				{ ...FILTERS, player: 'ghost' },
				HEROES,
				NOW
			);
			expect(s.totalGames).toBe(0);
			expect(s.headline.winRate.value).toBeNull();
		});

		it('is JSON-serialisable', () => {
			const s = buildInsightsSummary(records, FILTERS, HEROES, NOW);
			expect(() => JSON.stringify(s)).not.toThrow();
		});
	});
});
