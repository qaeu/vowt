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
	MIN_FATIGUE_GAP,
	MIN_TILT_GAP,
	SESSION_BREAK_MINUTES,
	MIN_TEAM_SPLIT_GAMES,
	MIN_MATCHUP_GAMES,
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
	buildSessionStats,
	buildHeroMatchups,
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
	hasTime: false,
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
	allyHeroes: [],
	enemyHeroes: [],
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

			it('reads the time after the date', () => {
				expect(parseMatchDate(dated('03/07/2025 14:32'))).toEqual(
					new Date(2025, 2, 7, 14, 32)
				);
				expect(parseMatchDate(dated('09/15/25 - 02:49'))).toEqual(
					new Date(2025, 8, 15, 2, 49)
				);
				expect(parseMatchDate(dated('9/15/2025 2:05'))).toEqual(
					new Date(2025, 8, 15, 2, 5)
				);
			});

			it('uses midnight when the time is missing', () => {
				expect(parseMatchDate(dated('3-7-2025'))).toEqual(new Date(2025, 2, 7));
				expect(parseMatchDate(dated('03/07/2025 later'))).toEqual(new Date(2025, 2, 7));
			});

			it.each(['25:10', '10:75', '24:00'])(
				'uses midnight for the invalid time %j',
				(time) => {
					expect(parseMatchDate(dated(`03/07/2025 - ${time}`))).toEqual(
						new Date(2025, 2, 7)
					);
				}
			);

			it('accepts two-digit years', () => {
				expect(parseMatchDate(dated('03/07/25'))).toEqual(new Date(2025, 2, 7));
				expect(parseMatchDate(dated('03/07/25 - 08:15'))).toEqual(
					new Date(2025, 2, 7, 8, 15)
				);
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

			it.each(['', '   '])('counts blank %j as 0', (text) => {
				expect(parseStat(text)).toBe(0);
			});

			it.each(['abc', '1O', '-3', '1.5', '1,000'])('returns null for %j', (text) => {
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

		it('flags hasTime only when a valid time was parsed', () => {
			const hasTime = (date: string) =>
				toPlayerGames([rec({ date })], 'alice', HEROES)[0].hasTime;
			expect(hasTime('09/15/25 - 02:49')).toBe(true);
			expect(hasTime('09/15/25')).toBe(false);
			expect(hasTime('09/15/25 - 25:10')).toBe(false);
			expect(hasTime('09/15/25 - 10:75')).toBe(false);
			expect(hasTime('nonsense 10:15')).toBe(false);
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

		it('nulls unreadable length and stats, zeroes blank stats and labels empty mode/map', () => {
			const [g] = toPlayerGames(
				[rec({ length: 'x', mode: ' ', map: '', me: { e: '', dmg: 'abc' } })],
				'alice',
				HEROES
			);
			expect(g.lengthSeconds).toBeNull();
			expect(g.stats.e).toBe(0);
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

		describe('ally and enemy heroes', () => {
			const record = rec({
				players: [
					player('ALICE', 'blue', { hero: 'ana' }),
					player('MATE1', 'blue', { hero: 'dva' }),
					player('MATE2', 'blue', { hero: '  ' }),
					player('MATE3', 'blue', { hero: undefined }),
					player('FOE1', 'red', { hero: 'tracer' }),
					player('FOE2', 'red', { hero: '' }),
					player('FOE3', 'red', { hero: ' Mystery ' }),
					player('FOE4', 'red', { hero: 'Ana' }),
				],
			});

			it('resolves display names and drops blank heroes', () => {
				const [g] = toPlayerGames([record], 'alice', HEROES);
				expect(g.allyHeroes).toEqual(['D.Va']);
				expect(g.enemyHeroes).toEqual(['Tracer', 'Mystery', 'Ana']);
			});

			it('excludes your own hero and follows your team', () => {
				const red = rec({
					players: record.players.map((p) => ({
						...p,
						team: p.team === 'blue' ? ('red' as const) : ('blue' as const),
					})),
				});
				const [g] = toPlayerGames([red], 'alice', HEROES);
				expect(g.team).toBe('red');
				expect(g.allyHeroes).toEqual(['D.Va']);
				expect(g.allyHeroes).not.toContain('Ana');
				expect(g.enemyHeroes).toEqual(['Tracer', 'Mystery', 'Ana']);
			});

			it('is empty when no other hero was read', () => {
				const [g] = toPlayerGames(
					[rec({ players: [player('ALICE', 'blue', { hero: 'ana' })] })],
					'alice',
					HEROES
				);
				expect(g.allyHeroes).toEqual([]);
				expect(g.enemyHeroes).toEqual([]);
			});
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
		const statsOf = (e: number | null) => ({ e, a: 0, d: 0, dmg: 0, h: 0, mit: 0 });
		const rowOf = (groups: ReturnType<typeof buildLobbyComparison>, role: string) =>
			groups.find((g) => g.role === role)!.rows;
		const eRow = (g: PlayerGame[]) =>
			rowOf(buildLobbyComparison(g), 'damage').find((r) => r.stat === 'e')!;

		describe('role grouping', () => {
			it('returns no groups for no games', () => {
				expect(buildLobbyComparison([])).toEqual([]);
			});

			it('lists only roles with games, in a stable order', () => {
				const groups = buildLobbyComparison([
					game({ role: 'unknown' }),
					game({ role: 'support' }),
					game({ role: 'tank' }),
					game({ role: 'tank' }),
				]);
				expect(groups.map((g) => g.role)).toEqual(['tank', 'support', 'unknown']);
				expect(groups[0].rows.map((r) => r.stat)).toEqual(['e', 'a', 'd', 'h', 'dmg']);
			});

			it('computes each role from its own games only', () => {
				const mk = (role: PlayerGame['role'], e: number) =>
					game({ role, stats: statsOf(e), teamAvg: statsOf(e), enemyAvg: statsOf(e) });
				const groups = buildLobbyComparison([mk('tank', 10), mk('damage', 30)]);
				expect(rowOf(groups, 'tank')[0].you).toBe(10);
				expect(rowOf(groups, 'damage')[0].you).toBe(30);
			});
		});

		describe('per 10 minutes', () => {
			it('computes per-10 for you, team and enemy', () => {
				const g = game({
					lengthSeconds: 1200,
					stats: statsOf(20),
					teamAvg: statsOf(10),
					enemyAvg: statsOf(30),
				});
				expect(eRow([g])).toMatchObject({ stat: 'e', you: 10, team: 5, enemy: 15 });
			});

			it('only uses games where all three values and the length are readable', () => {
				const full = game({
					stats: statsOf(10),
					teamAvg: statsOf(10),
					enemyAvg: statsOf(10),
				});
				const noEnemy = game({ stats: statsOf(999), teamAvg: statsOf(999) });
				const noLength = { ...full, lengthSeconds: null };
				expect(eRow([full, noEnemy, noLength])).toMatchObject({
					you: 10,
					team: 10,
					enemy: 10,
				});
			});
		});

		describe('above/below team average', () => {
			/** Game with your e vs the team's e and a result */
			const vs = (
				you: number | null,
				team: number | null,
				result: PlayerGame['result']
			) => game({ result, stats: statsOf(you), teamAvg: statsOf(team) });

			it('splits win rates by your stat against the team average', () => {
				const row = eRow([
					vs(10, 5, 'win'),
					vs(10, 5, 'win'),
					vs(10, 5, 'loss'),
					vs(2, 5, 'loss'),
					vs(2, 5, 'win'),
				]);
				expect(row.gamesAbove).toBe(3);
				expect(row.winRateAbove).toBeCloseTo(66.67, 1);
				expect(row.gamesBelow).toBe(2);
				expect(row.winRateBelow).toBe(50);
			});

			it('counts exact ties on neither side', () => {
				const row = eRow([vs(5, 5, 'win'), vs(6, 5, 'win'), vs(4, 5, 'loss')]);
				expect(row).toMatchObject({ gamesAbove: 1, gamesBelow: 1 });
				expect(row.winRateAbove).toBe(100);
				expect(row.winRateBelow).toBe(0);
			});

			it('counts games without a decided result in the games but not the rate', () => {
				const row = eRow([vs(9, 5, 'unknown'), vs(9, 5, 'win'), vs(1, 5, 'unknown')]);
				expect(row).toMatchObject({ gamesAbove: 2, gamesBelow: 1 });
				expect(row.winRateAbove).toBe(100);
				expect(row.winRateBelow).toBeNull();
			});

			it('skips games with a missing stat or team average', () => {
				const row = eRow([vs(null, 5, 'win'), vs(9, null, 'win'), vs(9, 5, 'loss')]);
				expect(row).toMatchObject({ gamesAbove: 1, gamesBelow: 0 });
				expect(row.winRateAbove).toBe(0);
				expect(row.winRateBelow).toBeNull();
			});

			it('does not need the enemy average or the game length', () => {
				const noLength = game({
					lengthSeconds: null,
					stats: statsOf(9),
					teamAvg: statsOf(5),
				});
				const row = eRow([noLength]);
				expect(row).toMatchObject({ gamesAbove: 1, you: null });
			});

			it('is empty when no game has both values', () => {
				expect(eRow([game()])).toMatchObject({
					gamesAbove: 0,
					gamesBelow: 0,
					winRateAbove: null,
					winRateBelow: null,
				});
			});

			it('exports the minimum games for showing the split', () => {
				expect(MIN_TEAM_SPLIT_GAMES).toBe(5);
			});
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
					medians: [{ role: 'damage', medianDeaths10: 6 }],
					confidence: 'low',
					lowDeaths: { games: 5, winRate: 100 },
					highDeaths: { games: 5, winRate: 0 },
				});
			});

			describe('per-role split', () => {
				const mk = (role: PlayerGame['role'], d: number, result: PlayerGame['result']) =>
					game({ role, result, ...deaths(d) });

				it('splits at each role median, not the pooled one', () => {
					// Tanks die a lot (10-12), DPS rarely (2-4); pooled median would put
					// every tank in "high" and every DPS in "low" regardless of role.
					// Within role, the lower-death half wins and the other half loses.
					const tank = [
						...results(5, 0).map((r) => mk('tank', 10, r)),
						...results(0, 5).map((r) => mk('tank', 12, r)),
					];
					const dps = [
						...results(5, 0).map((r) => mk('damage', 2, r)),
						...results(0, 5).map((r) => mk('damage', 4, r)),
					];
					const finding = buildFindings([...tank, ...dps]).find(
						(f) => f.kind === 'deathsSplit'
					);
					expect(finding).toMatchObject({
						medians: [
							{ role: 'tank', medianDeaths10: 11 },
							{ role: 'damage', medianDeaths10: 3 },
						],
						lowDeaths: { games: 10, winRate: 100 },
						highDeaths: { games: 10, winRate: 0 },
					});
				});

				it('does not fire when only the role mix explains the wins', () => {
					// Tanks (high deaths) lose, DPS (low deaths) win, but within each role
					// low and high deaths win equally
					const tank = [
						...results(1, 4).map((r) => mk('tank', 10, r)),
						...results(1, 4).map((r) => mk('tank', 12, r)),
					];
					const dps = [
						...results(4, 1).map((r) => mk('damage', 2, r)),
						...results(4, 1).map((r) => mk('damage', 4, r)),
					];
					expect(buildFindings([...tank, ...dps]).map((f) => f.kind)).not.toContain(
						'deathsSplit'
					);
				});

				it('treats unknown as its own role and orders medians stably', () => {
					const unknown = [
						...results(5, 0).map((r) => mk('unknown', 1, r)),
						...results(0, 5).map((r) => mk('unknown', 9, r)),
					];
					const support = [mk('support', 3, 'win'), mk('support', 3, 'loss')];
					const finding = buildFindings([...unknown, ...support]).find(
						(f) => f.kind === 'deathsSplit'
					);
					expect(finding).toMatchObject({
						medians: [
							{ role: 'support', medianDeaths10: 3 },
							{ role: 'unknown', medianDeaths10: 5 },
						],
					});
				});
			});

			describe('game length', () => {
				it('uses deaths per 10 minutes', () => {
					// 10 deaths in 20 minutes is 5 per 10; 4 deaths in 5 minutes is 8 per 10
					const slow = results(5, 0).map((result) =>
						game({ result, lengthSeconds: 1200, ...deaths(10) })
					);
					const fast = results(0, 5).map((result) =>
						game({ result, lengthSeconds: 300, ...deaths(4) })
					);
					const finding = buildFindings([...slow, ...fast]).find(
						(f) => f.kind === 'deathsSplit'
					);
					expect(finding).toMatchObject({
						medians: [{ role: 'damage', medianDeaths10: 6.5 }],
						lowDeaths: { games: 5, winRate: 100 },
					});
				});

				it('skips games without a length', () => {
					const low = results(5, 0).map((result) => game({ result, ...deaths(2) }));
					const high = results(0, 5).map((result) => game({ result, ...deaths(10) }));
					const noLength = results(0, 10).map((result) =>
						game({ result, lengthSeconds: null, ...deaths(2) })
					);
					const finding = buildFindings([...low, ...high, ...noLength]).find(
						(f) => f.kind === 'deathsSplit'
					);
					expect(finding).toMatchObject({
						lowDeaths: { games: 5, winRate: 100 },
						highDeaths: { games: 5, winRate: 0 },
					});
				});

				it('does not fire when too few games have a length', () => {
					const all = [
						...results(5, 0).map((result) =>
							game({ result, lengthSeconds: null, ...deaths(2) })
						),
						...results(0, 5).map((result) =>
							game({ result, lengthSeconds: null, ...deaths(10) })
						),
					];
					expect(buildFindings(all)).toEqual([]);
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
					confidence: 'low',
					hero: 'Ana',
					games: 5,
					winRate: 100,
					restWinRate: 0,
					restGames: 5,
				});
			});

			it('compares against the other games, not overall', () => {
				// Ana 25-0 (100%), Tracer 20-5 (80%): overall is 45/55 = 82%.
				// The gap is 18 points vs overall but 20 vs the rest.
				const findings = buildFindings([...mk('Ana', 25, 0), ...mk('Tracer', 20, 5)]);
				const f = findings.find((x) => x.kind === 'bestHero');
				expect(f).toMatchObject({ restWinRate: 80, restGames: 25 });
			});

			it('excludes the hero itself from the comparison', () => {
				// Ana 5-0 vs overall 5/10 would be 50 points; rest is 0%
				const f = buildFindings([...mk('Ana', 5, 0), ...mk('Tracer', 0, 5)]).find(
					(x) => x.kind === 'bestHero'
				);
				expect(f).toMatchObject({ winRate: 100, restWinRate: 0, restGames: 5 });
			});

			it('does not fire when only the overall gap is large enough', () => {
				// Ana 7-3 (70%) vs Tracer 5-5 (50%) rest: gap 20 vs rest, 10 vs overall,
				// but not significant at this size
				const findings = buildFindings([...mk('Ana', 7, 3), ...mk('Tracer', 5, 5)]);
				expect(findings.map((f) => f.kind)).not.toContain('bestHero');
			});

			it('needs the gap to be significant: same gap, small vs large n', () => {
				const gap = (scale: number) =>
					buildFindings([
						...mk('Ana', 7 * scale, 3 * scale),
						...mk('Tracer', 5 * scale, 5 * scale),
					]).map((f) => f.kind);
				expect(gap(1)).not.toContain('bestHero');
				expect(gap(5)).toContain('bestHero');
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
					confidence: 'low',
					mode: 'CONTROL',
					games: 5,
					winRate: 40,
					restWinRate: 100,
					restGames: 5,
					worstMap: { map: 'B', games: 3, wins: 0, losses: 3, draws: 0, winRate: 0 },
				});
			});

			it('compares against the other modes, not overall', () => {
				// CONTROL 0-5 vs PUSH 20-5 (80%): overall 20/30 = 67%
				const f = buildFindings([
					...mk('PUSH', 'A', 20, 5),
					...mk('CONTROL', 'B', 0, 5),
				]).find((x) => x.kind === 'weakestMode');
				expect(f).toMatchObject({ winRate: 0, restWinRate: 80, restGames: 25 });
			});

			it('needs the gap to be significant: same gap, small vs large n', () => {
				const gap = (scale: number) =>
					buildFindings([
						...mk('PUSH', 'A', 7 * scale, 3 * scale),
						...mk('CONTROL', 'B', 5 * scale, 5 * scale),
					]).map((f) => f.kind);
				expect(gap(1)).not.toContain('weakestMode');
				expect(gap(5)).toContain('weakestMode');
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

	describe('buildSessionStats', () => {
		const at = (day: number, hour: number, minute: number) =>
			new Date(2025, 5, day, hour, minute);
		/** Timed game at the given time; id taken from the clock for stable ordering */
		const timed = (date: Date, result: PlayerGame['result'] = 'win') =>
			game({
				recordId: `t${date.getTime()}`,
				date,
				createdAt: date,
				hasTime: true,
				result,
			});
		/** n consecutive timed games 20 minutes apart starting on the given day */
		const run = (day: number, results: PlayerGame['result'][]) =>
			results.map((r, i) => timed(at(day, 10, i * 20), r));

		it('exports the break length', () => {
			expect(SESSION_BREAK_MINUTES).toBe(60);
		});

		describe('session splitting', () => {
			it('keeps a gap of exactly 60 minutes in one session', () => {
				const stats = buildSessionStats([timed(at(1, 10, 0)), timed(at(1, 11, 0))]);
				expect(stats.sessionCount).toBe(1);
				expect(stats.averageLength).toBe(2);
			});

			it('starts a new session after 61 minutes', () => {
				const stats = buildSessionStats([timed(at(1, 10, 0)), timed(at(1, 11, 1))]);
				expect(stats.sessionCount).toBe(2);
				expect(stats.averageLength).toBe(1);
			});

			it('keeps a session that spans midnight together', () => {
				const stats = buildSessionStats([timed(at(1, 23, 30)), timed(at(2, 0, 15))]);
				expect(stats.sessionCount).toBe(1);
			});

			it('sorts games before splitting', () => {
				const stats = buildSessionStats([timed(at(1, 12, 0)), timed(at(1, 10, 0))]);
				expect(stats.sessionCount).toBe(2);
			});

			it('reports no sessions for no games', () => {
				const stats = buildSessionStats([]);
				expect(stats.sessionCount).toBe(0);
				expect(stats.averageLength).toBeNull();
				expect(stats.timedGames).toBe(0);
				expect(stats.afterWin.games).toBe(0);
				expect(stats.byGameNumber.map((b) => b.games)).toEqual([0, 0, 0, 0, 0]);
			});
		});

		describe('games without a time', () => {
			it('excludes them and counts them as untimed', () => {
				const stats = buildSessionStats([
					timed(at(1, 10, 0)),
					game({ recordId: 'x', date: at(1, 10, 20) }),
					game({ recordId: 'y', date: at(1, 10, 40) }),
				]);
				expect(stats.timedGames).toBe(1);
				expect(stats.untimedGames).toBe(2);
				expect(stats.sessionCount).toBe(1);
			});
		});

		describe('byGameNumber', () => {
			it('buckets by position with 5+ pooling the rest', () => {
				const stats = buildSessionStats([
					...run(1, ['win', 'win', 'loss', 'loss', 'win', 'loss', 'loss']),
					...run(2, ['loss', 'win']),
				]);
				expect(stats.byGameNumber.map((b) => b.label)).toEqual([
					'1',
					'2',
					'3',
					'4',
					'5+',
				]);
				expect(stats.byGameNumber.map((b) => b.games)).toEqual([2, 2, 1, 1, 3]);
				expect(stats.byGameNumber[0]).toMatchObject({ wins: 1, losses: 1, winRate: 50 });
				expect(stats.byGameNumber[4]).toMatchObject({ wins: 1, losses: 2 });
			});

			it('keeps empty buckets with a null win rate', () => {
				const stats = buildSessionStats(run(1, ['win', 'win']));
				expect(stats.byGameNumber[3]).toMatchObject({ games: 0, winRate: null });
			});
		});

		describe('afterWin and afterLoss', () => {
			it('records the next game after each result', () => {
				const stats = buildSessionStats(run(1, ['win', 'win', 'loss', 'win']));
				expect(stats.afterWin).toMatchObject({ games: 2, wins: 1, losses: 1 });
				expect(stats.afterLoss).toMatchObject({ games: 1, wins: 1 });
			});

			it('does not pair games across sessions', () => {
				const stats = buildSessionStats([
					timed(at(1, 10, 0), 'loss'),
					timed(at(1, 15, 0), 'win'),
				]);
				expect(stats.afterLoss.games).toBe(0);
				expect(stats.afterWin.games).toBe(0);
			});

			it('ignores draws and unknown results as the previous game', () => {
				const stats = buildSessionStats(
					run(1, ['draw', 'win', 'unknown', 'loss', 'win'])
				);
				expect(stats.afterWin.games).toBe(1);
				expect(stats.afterLoss.games).toBe(1);
			});
		});
	});

	describe('session findings', () => {
		/** One session per day, 20 minutes apart, with the given result sequence */
		const sessionsOf = (days: PlayerGame['result'][][]) =>
			days.flatMap((results, d) =>
				results.map((result, i) => {
					const date = new Date(2025, 5, 1 + d, 10, i * 20);
					return game({
						recordId: `s${d}-${i}`,
						date,
						createdAt: date,
						hasTime: true,
						result,
					});
				})
			);
		const W = 'win' as const;
		const L = 'loss' as const;
		const kinds = (g: PlayerGame[]) => buildFindings(g).map((f) => f.kind);

		it('exports the gaps', () => {
			expect(MIN_FATIGUE_GAP).toBe(10);
			expect(MIN_TILT_GAP).toBe(10);
		});

		describe('sessionFatigue', () => {
			// 10 sessions of WWW then LL: early 100% (30), late 0% (20)
			const fatigued = sessionsOf(Array.from({ length: 10 }, () => [W, W, W, L, L]));

			it('fires when early games win much more than late ones', () => {
				const found = buildFindings(fatigued).find((f) => f.kind === 'sessionFatigue');
				expect(found).toEqual({
					kind: 'sessionFatigue',
					confidence: 'medium',
					early: { games: 30, winRate: 100 },
					late: { games: 20, winRate: 0 },
				});
			});

			it('does not fire when the gap is too small', () => {
				// early 60%, late 50% in 10 sessions (30 vs 20 games)
				const g = sessionsOf(
					Array.from({ length: 10 }, (_, i) => [i % 5 < 3 ? W : L, W, L, W, L])
				);
				expect(kinds(g)).not.toContain('sessionFatigue');
			});

			it('does not fire when the gap is not significant', () => {
				// early 2/3, late 1/3 over only 6 + 6 games
				const g = sessionsOf([
					[W, W, L, L, W, L],
					[W, W, L, L, L, W],
				]);
				const found = buildFindings(g).find((f) => f.kind === 'sessionFatigue');
				expect(found).toBeUndefined();
			});

			it('does not fire with too few late games', () => {
				const g = sessionsOf(Array.from({ length: 10 }, () => [W, W, W, L]).slice(0, 4));
				expect(kinds(g)).not.toContain('sessionFatigue');
			});

			it('ignores games without a time', () => {
				const untimed = fatigued.map((x) => ({ ...x, hasTime: false }));
				expect(kinds(untimed)).not.toContain('sessionFatigue');
			});
		});

		describe('tilt', () => {
			it('fires when games after a loss win far less than after a win', () => {
				// Session 1 gives 6 after-win games (5W 1L); session 2 gives 5 after-loss games (0W)
				const g = sessionsOf([
					[W, W, W, W, W, W, L],
					[L, L, L, L, L, L],
				]);
				const found = buildFindings(g).find((f) => f.kind === 'tilt');
				expect(found).toMatchObject({
					kind: 'tilt',
					afterWin: { games: 6, winRate: (5 / 6) * 100 },
					afterLoss: { games: 5, winRate: 0 },
				});
				expect(found?.confidence).toBe('low');
			});

			it('does not fire when afterLoss is not lower by the gap', () => {
				const g = sessionsOf(Array.from({ length: 8 }, () => [W, L, W, L, W, L]));
				expect(kinds(g)).not.toContain('tilt');
			});

			it('does not fire with too few games after a loss', () => {
				const g = sessionsOf([[W, W, W, W, W, W, W, W, L, L]]);
				expect(kinds(g)).not.toContain('tilt');
			});

			it('does not pair across sessions', () => {
				// Each session is a single game, so no pairs exist
				const g = sessionsOf(Array.from({ length: 12 }, (_, i) => [i % 2 ? L : W]));
				expect(kinds(g)).not.toContain('tilt');
			});
		});
	});

	describe('buildFindings confidence', () => {
		/** Hero 'Ana' wins every game, 'Tracer' (the rest) loses all of them */
		const tier = (n: number) =>
			buildFindings([
				...games(n, () => ({ hero: 'Ana', result: 'win' as const })),
				...games(n, () => ({ hero: 'Tracer', result: 'loss' as const })),
			]).find((f) => f.kind === 'bestHero')?.confidence;

		it.each([
			[5, 'low'],
			[9, 'low'],
			[10, 'medium'],
			[24, 'medium'],
			[25, 'high'],
		])('uses the smaller group size %i for a %s tier', (n, expected) => {
			expect(tier(n)).toBe(expected);
		});

		it('uses the smaller of the two groups', () => {
			const findings = buildFindings([
				...games(30, () => ({ hero: 'Ana', result: 'win' as const })),
				...games(6, () => ({ hero: 'Tracer', result: 'loss' as const })),
			]);
			expect(findings.find((f) => f.kind === 'bestHero')?.confidence).toBe('low');
		});

		it('gives every finding a confidence', () => {
			const low = games(10, () => ({
				result: 'win' as const,
				...{ stats: { e: 0, a: 0, d: 1, dmg: 0, h: 0, mit: 0 } },
			}));
			const high = games(10, () => ({
				result: 'loss' as const,
				stats: { e: 0, a: 0, d: 9, dmg: 0, h: 0, mit: 0 },
			}));
			const findings = buildFindings([...low, ...high]);
			expect(findings.length).toBeGreaterThan(0);
			for (const f of findings) expect(f.confidence).toBe('medium');
		});
	});

	describe('buildHeroMatchups', () => {
		/** Deaths that vary around `base` so neither side has zero spread */
		const deaths = (i: number, base: number) => base + (i % 3) - 1;
		/** Games where an enemy hero (and a filler seen in every game) may be present */
		const withEnemy = (
			hero: string,
			present: number,
			absent: number,
			o: (i: number, isPresent: boolean) => Partial<PlayerGame> = () => ({})
		) =>
			games(present + absent, (i) => {
				const isPresent = i < present;
				return {
					enemyHeroes: isPresent ? ['Filler', hero] : ['Filler'],
					...o(i, isPresent),
				};
			});
		const find = (rows: ReturnType<typeof buildHeroMatchups>, hero: string) =>
			rows.find((r) => r.hero === hero);

		it('returns nothing without games or heroes', () => {
			expect(buildHeroMatchups([])).toEqual([]);
			expect(buildHeroMatchups(games(20))).toEqual([]);
		});

		describe('present/absent thresholds', () => {
			/** Present games all lost, absent games all won */
			const split = (present: number, absent: number) =>
				withEnemy('Widowmaker', present, absent, (_, isPresent) => ({
					result: isPresent ? 'loss' : 'win',
				}));

			it('exports the threshold', () => {
				expect(MIN_MATCHUP_GAMES).toBe(5);
			});

			it('skips a hero present in fewer than 5 games', () => {
				expect(find(buildHeroMatchups(split(4, 10)), 'Widowmaker')).toBeUndefined();
			});

			it('skips a hero absent from fewer than 5 games', () => {
				expect(find(buildHeroMatchups(split(5, 4)), 'Widowmaker')).toBeUndefined();
			});

			it('includes a hero with 5 games each side when significant', () => {
				const row = find(buildHeroMatchups(split(5, 5)), 'Widowmaker');
				expect(row).toMatchObject({
					side: 'enemy',
					present: 5,
					absent: 5,
					winRate: { present: 0, absent: 100 },
					significant: true,
					confidence: 'low',
				});
			});

			it('skips a hero present in every game', () => {
				expect(find(buildHeroMatchups(split(5, 5)), 'Filler')).toBeUndefined();
			});

			it('counts a hero listed twice in a game once', () => {
				const doubled = split(5, 5).map((g, i) =>
					i < 5 ? { ...g, enemyHeroes: [...g.enemyHeroes, 'Widowmaker'] } : g
				);
				expect(find(buildHeroMatchups(doubled), 'Widowmaker')?.present).toBe(5);
			});

			it('leaves out games where no hero was read on that side', () => {
				const unread = games(5, () => ({ enemyHeroes: [], result: 'loss' }));
				const row = find(buildHeroMatchups([...split(5, 5), ...unread]), 'Widowmaker');
				expect(row?.absent).toBe(5);
			});

			it('counts games with an unreadable result but rates only decided games', () => {
				const unknown = games(3, (i) => ({
					recordId: `u${i}`,
					enemyHeroes: ['Filler', 'Widowmaker'],
					result: 'unknown',
				}));
				const row = find(buildHeroMatchups([...split(5, 5), ...unknown]), 'Widowmaker');
				expect(row?.present).toBe(8);
				expect(row?.winRate.present).toBe(0);
			});
		});

		describe('allies and enemies', () => {
			it('tests the two sides separately', () => {
				const list = games(20, (i) => ({
					allyHeroes: i < 10 ? ['Mercy'] : ['Lucio'],
					enemyHeroes: ['Mercy'],
					result: i < 10 ? 'win' : 'loss',
				}));
				const rows = buildHeroMatchups(list);
				expect(rows.filter((r) => r.hero === 'Mercy').map((r) => r.side)).toEqual([
					'ally',
				]);
				expect(find(rows, 'Mercy')?.winRate).toEqual({ present: 100, absent: 0 });
				expect(find(rows, 'Lucio')).toMatchObject({
					side: 'ally',
					winRate: { present: 0, absent: 100 },
				});
			});
		});

		describe('significance', () => {
			it('detects a counter with a win-rate drop and a deaths rise', () => {
				const list = withEnemy('Widowmaker', 10, 10, (i, isPresent) => ({
					result:
						(
							isPresent ? i < 2 : i < 18
						) ?
							'win'
						:	'loss',
					stats: {
						e: 10,
						a: 5,
						d: deaths(i, isPresent ? 8 : 5),
						dmg: 6000,
						h: 0,
						mit: 0,
					},
				}));
				const row = find(buildHeroMatchups(list), 'Widowmaker')!;
				expect(row.significant).toBe(true);
				expect(row.winRate).toEqual({ present: 20, absent: 80 });
				const d = row.statDeltas.find((s) => s.stat === 'd')!;
				expect(d.delta).toBeCloseTo(2.9);
				expect(d.significant).toBe(true);
			});

			it('keeps a hero with only a significant stat delta', () => {
				const list = withEnemy('Widowmaker', 10, 10, (i, isPresent) => ({
					result: i % 2 ? 'win' : 'loss',
					stats: {
						e: 10,
						a: 5,
						d: deaths(i, isPresent ? 9 : 5),
						dmg: 6000,
						h: 0,
						mit: 0,
					},
				}));
				const row = find(buildHeroMatchups(list), 'Widowmaker')!;
				expect(row.significant).toBe(false);
				expect(row.statDeltas.find((s) => s.stat === 'd')?.significant).toBe(true);
			});

			it('ignores noise', () => {
				// 50% vs 60%, deaths 0.3 higher and damage scattered
				const won = (i: number, isPresent: boolean) =>
					isPresent ? i % 2 === 0 : i % 5 < 3;
				const list = withEnemy('Widowmaker', 10, 10, (i, isPresent) => ({
					result: won(i, isPresent) ? 'win' : 'loss',
					stats: {
						e: 10,
						a: 5,
						d: deaths(i, 5) + (isPresent ? 0.3 : 0),
						dmg: 6000 + ((i * 37) % 11) * 50,
						h: 0,
						mit: 0,
					},
				}));
				expect(find(buildHeroMatchups(list), 'Widowmaker')).toBeUndefined();
			});

			it('does not flag a stat with no spread on either side', () => {
				const list = withEnemy('Widowmaker', 10, 10, (i, isPresent) => ({
					result: i % 2 ? 'win' : 'loss',
					stats: { e: 10, a: 5, d: isPresent ? 9 : 4, dmg: 6000, h: 0, mit: 0 },
				}));
				expect(find(buildHeroMatchups(list), 'Widowmaker')).toBeUndefined();
			});

			it('leaves a stat delta null when either side has too few usable games', () => {
				const list = withEnemy('Widowmaker', 6, 6, (i, isPresent) => ({
					result: isPresent ? 'loss' : 'win',
					lengthSeconds: isPresent && i < 2 ? null : 600,
				}));
				const row = find(buildHeroMatchups(list), 'Widowmaker')!;
				expect(row.statDeltas.map((s) => s.delta)).toEqual([null, null, null]);
				expect(row.statDeltas.every((s) => !s.significant)).toBe(true);
			});
		});

		describe('role baseline', () => {
			/** Tank games (all with Reinhardt as an enemy) die more than support games */
			const list = [
				...games(10, (i) => ({
					recordId: `t${i}`,
					role: 'tank',
					hero: 'D.Va',
					result: i % 2 ? 'win' : 'loss',
					enemyHeroes: ['Filler', 'Reinhardt'],
					stats: { e: 10, a: 5, d: deaths(i, 8), dmg: 6000, h: 0, mit: 0 },
				})),
				...games(10, (i) => ({
					recordId: `s${i}`,
					role: 'support',
					hero: 'Ana',
					result: i % 2 ? 'win' : 'loss',
					enemyHeroes: ['Filler'],
					stats: { e: 10, a: 5, d: deaths(i, 3), dmg: 6000, h: 0, mit: 0 },
				})),
			];

			it('would show a deaths gap without the role adjustment', () => {
				const mean = (gs: PlayerGame[]) =>
					gs.reduce((sum, g) => sum + g.stats.d!, 0) / gs.length;
				expect(mean(list.slice(0, 10)) - mean(list.slice(10))).toBeCloseTo(5);
			});

			it('removes the role-mix effect', () => {
				expect(find(buildHeroMatchups(list), 'Reinhardt')).toBeUndefined();
			});

			it('compares residuals within each role', () => {
				// Within tanks, Reinhardt games now die 3 more than the other tank games
				const mixed = [
					...list,
					...games(10, (i) => ({
						recordId: `o${i}`,
						role: 'tank',
						hero: 'D.Va',
						result: i % 2 ? 'win' : 'loss',
						enemyHeroes: ['Filler'],
						stats: { e: 10, a: 5, d: deaths(i, 5), dmg: 6000, h: 0, mit: 0 },
					})),
				];
				const d = find(buildHeroMatchups(mixed), 'Reinhardt')!.statDeltas[0];
				// Tank baseline 6.4: Reinhardt +1.5; other tank games -1.5, support 0
				expect(d.delta).toBeCloseTo(1.5 - (-1.5 * 10 + 0 * 10) / 20);
				expect(d.significant).toBe(true);
			});
		});

		describe('sort order', () => {
			/** Games 0-9 and 10-14 are losses, 15-29 wins */
			const list = games(30, (i) => ({
				result: i < 15 ? 'loss' : 'win',
				allyHeroes: i < 10 ? ['Ana'] : ['Kiriko'],
				enemyHeroes: [
					'Filler',
					...(i < 10 ? ['Zarya', 'Ana'] : []),
					...(i >= 10 && i < 15 ? ['Sombra'] : []),
				],
			}));

			it('orders by win-rate gap weighted by how often the hero appears', () => {
				const rows = buildHeroMatchups(list);
				// Zarya: 0% vs 75% over 10/30 games = 25; Sombra: 0% vs 60% over 5/30 = 10
				const order = rows.map((r) => `${r.side}:${r.hero}`);
				expect(order.indexOf('enemy:Zarya')).toBeLessThan(order.indexOf('enemy:Sombra'));
				const impacts = rows.map(
					(r) =>
						(Math.abs(r.winRate.present - r.winRate.absent) * r.present)
						/ (r.present + r.absent)
				);
				expect(impacts).toEqual([...impacts].sort((a, b) => b - a));
			});

			it('breaks ties by hero name, then ally before enemy', () => {
				// Kiriko: 75% vs 0% over 20/30 = 50; Ana (both sides) and Zarya tie at 25
				const order = buildHeroMatchups(list).map((r) => `${r.side}:${r.hero}`);
				expect(order).toEqual([
					'ally:Kiriko',
					'ally:Ana',
					'enemy:Ana',
					'enemy:Zarya',
					'enemy:Sombra',
				]);
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
			expect(s.sessions.sessionCount).toBe(0);
			expect(s.matchups).toEqual([]);
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
			expect(s.matchups).toEqual([]);
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
