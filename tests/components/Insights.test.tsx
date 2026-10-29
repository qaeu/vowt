import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, within } from '@solidjs/testing-library';

import type { GameRecord, OverFastHero, OverFastStore } from '#types';
import Insights from '#c/Insights';
import * as Store from '#utils/storage';
import { loadOverFastData } from '#utils/overfastApi';

vi.mock('#utils/storage', () => ({
	loadGameRecords: vi.fn(),
	loadSettings: vi.fn(),
	saveSettings: vi.fn(),
	exportInsightsSummary: vi.fn(),
}));

vi.mock('#utils/overfastApi', () => ({
	loadOverFastData: vi.fn(),
}));

const HEROES: OverFastHero[] = [
	{
		key: 'tracer',
		name: 'Tracer',
		portrait: '',
		role: 'damage',
		subrole: '',
		gamemodes: [],
	},
	{
		key: 'reinhardt',
		name: 'Reinhardt',
		portrait: '',
		role: 'tank',
		subrole: '',
		gamemodes: [],
	},
];

interface RecordOptions {
	id: string;
	result?: string;
	date?: string;
	mode?: string;
	map?: string;
	hero?: string;
	kills?: string;
	deaths?: string;
	withBob?: boolean;
	/** Adds a blue teammate with 5 eliminations, 5 assists, 5 deaths, 3000 damage */
	withMate?: boolean;
}

const makeRecord = (o: RecordOptions): GameRecord => ({
	id: o.id,
	players: [
		{
			name: 'ALICE',
			team: 'blue',
			e: o.kills ?? '10',
			a: '5',
			d: o.deaths ?? '4',
			dmg: '6000',
			h: '0',
			mit: '0',
			hero: o.hero ?? 'Tracer',
		},
		{
			name: 'FOE',
			team: 'red',
			e: '6',
			a: '2',
			d: '8',
			dmg: '4000',
			h: '0',
			mit: '0',
			hero: 'Winston',
		},
		...(o.withMate ?
			[
				{
					name: 'MATE',
					team: 'blue' as const,
					e: '5',
					a: '5',
					d: '5',
					dmg: '3000',
					h: '0',
					mit: '0',
					hero: 'Tracer',
				},
			]
		:	[]),
		...(o.withBob ?
			[
				{
					name: 'BOB',
					team: 'red' as const,
					e: '3',
					a: '3',
					d: '3',
					dmg: '3000',
					h: '0',
					mit: '0',
					hero: 'Tracer',
				},
			]
		:	[]),
	],
	matchInfo: {
		result: o.result ?? 'VICTORY',
		final_score: { blue: '3', red: '1' },
		date: o.date ?? '06/10/2025',
		game_mode: o.mode ?? 'ESCORT',
		game_length: '10:00',
		map: o.map ?? 'HOLLYWOOD',
	},
	createdAt: new Date(2025, 5, 10),
	updatedAt: new Date(2025, 5, 10),
});

/** Six games: four on Tracer (three wins) and two losses on Reinhardt */
const RECORDS: GameRecord[] = [
	makeRecord({ id: 'g1', date: '06/01/2025' }),
	makeRecord({ id: 'g2', date: '06/02/2025' }),
	makeRecord({ id: 'g3', date: '06/03/2025', kills: '25' }),
	makeRecord({ id: 'g4', date: '06/04/2025', result: 'DEFEAT' }),
	makeRecord({
		id: 'g5',
		date: '06/05/2025',
		result: 'DEFEAT',
		hero: 'Reinhardt',
		mode: 'PAYLOAD',
		map: "KING'S ROW",
		withBob: true,
	}),
	makeRecord({
		id: 'g6',
		date: '06/06/2025',
		result: 'DEFEAT',
		hero: 'Reinhardt',
		mode: 'PAYLOAD',
		map: "KING'S ROW",
		withBob: true,
	}),
];

const SETTINGS = { darkMode: false, trackedPlayer: null, lastExportedAt: null };

const statValue = (container: HTMLElement, key: string) =>
	container.querySelector(`[data-stat="${key}"] .insights-stat-card__value`)?.textContent;

describe('Insights', () => {
	const onOpenRecord = vi.fn();

	const renderInsights = () => render(() => <Insights onOpenRecord={onOpenRecord} />);

	beforeEach(() => {
		vi.clearAllMocks();
		vi.useFakeTimers({ toFake: ['Date'] });
		vi.setSystemTime(new Date(2025, 5, 15, 12));
		vi.mocked(Store.loadGameRecords).mockReturnValue(RECORDS);
		vi.mocked(Store.loadSettings).mockReturnValue({ ...SETTINGS });
		vi.mocked(Store.exportInsightsSummary).mockReturnValue('{}');
		vi.mocked(loadOverFastData).mockReturnValue({
			heroes: HEROES,
			maps: [],
			schemaVersion: 1,
			updatedAt: new Date(),
		} satisfies OverFastStore);
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	describe('empty state', () => {
		it('should explain that there is nothing to analyse without records', () => {
			vi.mocked(Store.loadGameRecords).mockReturnValue([]);
			renderInsights();

			expect(screen.getByText('No game records to analyse yet')).toBeDefined();
			expect(screen.queryByText('Hero pool')).toBeNull();
		});

		it('should say when no games match the filters', () => {
			renderInsights();

			fireEvent.click(screen.getByRole('button', { name: 'Support' }));

			expect(screen.getByText('No games match these filters')).toBeDefined();
			expect(screen.queryByText('Hero pool')).toBeNull();
			// Filters stay available so they can be cleared
			expect(screen.getByRole('button', { name: 'All', pressed: false })).toBeDefined();
		});
	});

	describe('sections', () => {
		it('should render the title, subtitle and labelled selects', () => {
			renderInsights();

			expect(screen.getByRole('heading', { name: /Insights for/ })).toBeDefined();
			expect(
				screen.getByText('Aggregated from 6 of your 6 stored game records')
			).toBeDefined();
			expect(screen.getByLabelText('Tracked player')).toBeDefined();
			expect(screen.getByLabelText('Period')).toBeDefined();
			expect(screen.getByLabelText('Compare to')).toBeDefined();
		});

		it('should render every section from the records', () => {
			renderInsights();

			for (const name of [
				'Trend',
				'Recent form',
				'Hero pool',
				'You vs the lobby',
				'Maps',
				'Game modes',
				'Sessions',
				'Personal bests',
			]) {
				expect(screen.getByRole('heading', { name })).toBeDefined();
			}
			expect(screen.getByRole('button', { name: /Export summary JSON/ })).toBeDefined();
		});

		it('should show the headline numbers', () => {
			const { container } = renderInsights();

			expect(statValue(container, 'games')).toBe('6');
			expect(statValue(container, 'winRate')).toBe('50%');
			expect(container.querySelector('[data-stat="winRate"]')?.textContent).toContain(
				'3W'
			);
			expect(statValue(container, 'deaths10')).toBe('4.0');
			expect(container.querySelectorAll('.insights-stat-card')).toHaveLength(6);
		});

		it('should hide change figures when there is nothing to compare', () => {
			const { container } = renderInsights();

			expect(container.querySelector('.insights-stat-card .insights-delta')).toBeNull();
		});

		it('should list recent results as W, L and D tiles', () => {
			renderInsights();

			const tiles = within(screen.getByRole('list', { name: /Most recent results/ }))
				.getAllByRole('listitem')
				.map((tile) => tile.textContent);
			expect(tiles).toEqual(['W', 'W', 'W', 'L', 'L', 'L']);
		});

		it('should list heroes in the hero pool', () => {
			renderInsights();

			const table = screen.getByRole('table');
			expect(within(table).getByRole('rowheader', { name: 'Tracer' })).toBeDefined();
			expect(within(table).getByRole('rowheader', { name: 'Reinhardt' })).toBeDefined();
		});

		it('should list game modes in title case', () => {
			renderInsights();

			const names = Array.from(document.querySelectorAll('.insights-bars__name')).map(
				(el) => el.textContent
			);
			expect(names).toEqual(expect.arrayContaining(['Escort', 'Payload']));
		});

		it('should show up to eight maps and let the rest be revealed', () => {
			const records = Array.from({ length: 10 }, (_, m) =>
				Array.from({ length: 4 }, (_, g) =>
					makeRecord({ id: `m${m}g${g}`, map: `MAP ${m}` })
				)
			).flat();
			vi.mocked(Store.loadGameRecords).mockReturnValue(records);
			renderInsights();

			const list = () => screen.getByRole('heading', { name: 'Maps' }).parentElement!;
			expect(list().querySelectorAll('.insights-bars__row')).toHaveLength(8);

			fireEvent.click(screen.getByRole('button', { name: 'Show all 10 maps' }));
			expect(list().querySelectorAll('.insights-bars__row')).toHaveLength(10);

			fireEvent.click(screen.getByRole('button', { name: 'Show fewer maps' }));
			expect(list().querySelectorAll('.insights-bars__row')).toHaveLength(8);
		});

		it('should write findings in plain language', () => {
			const records = [
				...Array.from({ length: 6 }, (_, i) =>
					makeRecord({ id: `low${i}`, deaths: '2', date: `06/0${i + 1}/2025` })
				),
				...Array.from({ length: 6 }, (_, i) =>
					makeRecord({
						id: `high${i}`,
						deaths: '9',
						result: 'DEFEAT',
						date: `06/1${i}/2025`,
					})
				),
			];
			vi.mocked(Store.loadGameRecords).mockReturnValue(records);
			renderInsights();

			expect(screen.getByText('What stands out')).toBeDefined();
			expect(screen.getByText('Staying alive wins games')).toBeDefined();
			expect(
				screen.getByText(
					/You win 100% of games with deaths per 10 minutes at or below your role's typical level, but only 0% above it\. Typical: Damage 5\.5\./
				)
			).toBeDefined();
		});

		it('should show a confidence badge on each finding', () => {
			const records = [
				...Array.from({ length: 6 }, (_, i) =>
					makeRecord({ id: `low${i}`, deaths: '2', date: `06/0${i + 1}/2025` })
				),
				...Array.from({ length: 6 }, (_, i) =>
					makeRecord({
						id: `high${i}`,
						deaths: '9',
						result: 'DEFEAT',
						date: `06/1${i}/2025`,
					})
				),
			];
			vi.mocked(Store.loadGameRecords).mockReturnValue(records);
			const { container } = renderInsights();

			const badge = container.querySelector('.insights-finding__confidence');
			expect(badge?.textContent).toBe('Low confidence');
			expect(badge?.classList.contains('insights-finding__confidence--low')).toBe(true);
		});

		it('should omit the findings section when there are none', () => {
			renderInsights();

			expect(screen.queryByText('What stands out')).toBeNull();
		});

		it('should show signed changes against the previous period', () => {
			const earlier = [
				makeRecord({ id: 'p1', date: '02/05/2025', result: 'DEFEAT', deaths: '8' }),
				makeRecord({ id: 'p2', date: '02/06/2025', result: 'DEFEAT', deaths: '8' }),
			];
			vi.mocked(Store.loadGameRecords).mockReturnValue([...RECORDS, ...earlier]);
			const { container } = renderInsights();

			const winRateDelta = container.querySelector(
				'[data-stat="winRate"] .insights-delta'
			)!;
			expect(winRateDelta.textContent).toBe('▲ +50.0 pts');
			expect(winRateDelta.classList.contains('insights-delta--good')).toBe(true);

			// Fewer deaths is an improvement even though the number went down
			const deathsDelta = container.querySelector(
				'[data-stat="deaths10"] .insights-delta'
			)!;
			expect(deathsDelta.textContent?.startsWith('▼ −')).toBe(true);
			expect(deathsDelta.classList.contains('insights-delta--good')).toBe(true);

			fireEvent.change(screen.getByLabelText('Compare to'), {
				target: { value: 'none' },
			});
			expect(container.querySelector('.insights-stat-card .insights-delta')).toBeNull();
		});
	});

	describe('trend metric', () => {
		it('should switch the metric shown on the chart', () => {
			renderInsights();

			const chart = () => screen.getByRole('img', { name: /by week/ });
			expect(chart().getAttribute('aria-label')).toContain('Win rate');

			fireEvent.click(screen.getByRole('button', { name: 'KDA' }));

			expect(chart().getAttribute('aria-label')).toContain('KDA');
			expect(
				screen.getByRole('button', { name: 'KDA' }).getAttribute('aria-pressed')
			).toBe('true');
		});
	});

	describe('tracked player', () => {
		it('should default to the most frequent name', () => {
			renderInsights();

			expect((screen.getByLabelText('Tracked player') as HTMLSelectElement).value).toBe(
				'ALICE'
			);
		});

		it('should use the saved player when it is still present', () => {
			vi.mocked(Store.loadSettings).mockReturnValue({
				...SETTINGS,
				trackedPlayer: 'bob',
			});
			renderInsights();

			expect((screen.getByLabelText('Tracked player') as HTMLSelectElement).value).toBe(
				'BOB'
			);
		});

		it('should fall back to the most frequent name when the saved one is gone', () => {
			vi.mocked(Store.loadSettings).mockReturnValue({
				...SETTINGS,
				trackedPlayer: 'GONE',
			});
			renderInsights();

			expect((screen.getByLabelText('Tracked player') as HTMLSelectElement).value).toBe(
				'ALICE'
			);
		});

		it('should save the choice without losing other settings', () => {
			vi.mocked(Store.loadSettings).mockReturnValue({
				darkMode: true,
				trackedPlayer: null,
				lastExportedAt: null,
			});
			const { container } = renderInsights();

			fireEvent.change(screen.getByLabelText('Tracked player'), {
				target: { value: 'BOB' },
			});

			expect(Store.saveSettings).toHaveBeenCalledWith({
				darkMode: true,
				trackedPlayer: 'BOB',
				lastExportedAt: null,
			});
			// BOB played two of the six games
			expect(statValue(container, 'games')).toBe('2');
		});
	});

	describe('filter chips', () => {
		it('should change the numbers when a role is chosen', () => {
			const { container } = renderInsights();
			expect(statValue(container, 'games')).toBe('6');

			const tank = screen.getByRole('button', { name: 'Tank' });
			fireEvent.click(tank);

			expect(tank.getAttribute('aria-pressed')).toBe('true');
			expect(
				screen.getAllByRole('button', { name: 'All' })[0].getAttribute('aria-pressed')
			).toBe('false');
			expect(statValue(container, 'games')).toBe('2');
			expect(statValue(container, 'winRate')).toBe('0%');
		});

		it('should build mode chips from the data and filter by mode', () => {
			const { container } = renderInsights();

			expect(screen.getByRole('button', { name: 'Escort' })).toBeDefined();
			fireEvent.click(screen.getByRole('button', { name: 'Payload' }));

			expect(statValue(container, 'games')).toBe('2');
			// Mode chips stay available after filtering
			expect(screen.getByRole('button', { name: 'Escort' })).toBeDefined();
		});

		it('should widen the period', () => {
			const old = makeRecord({ id: 'old', date: '01/05/2025' });
			vi.mocked(Store.loadGameRecords).mockReturnValue([...RECORDS, old]);
			const { container } = renderInsights();
			expect(statValue(container, 'games')).toBe('6');

			fireEvent.change(screen.getByLabelText('Period'), { target: { value: 'all' } });

			expect(statValue(container, 'games')).toBe('7');
		});
	});

	describe('delta prefix', () => {
		const deltaText = (container: HTMLElement, key: string) =>
			container.querySelector(`[data-stat="${key}"] .insights-delta`)?.textContent;

		it('should prefix improvements and declines with arrows', () => {
			const earlier = [
				makeRecord({ id: 'p1', date: '02/05/2025', result: 'DEFEAT', deaths: '8' }),
				makeRecord({ id: 'p2', date: '02/06/2025', result: 'DEFEAT', deaths: '8' }),
			];
			vi.mocked(Store.loadGameRecords).mockReturnValue([...RECORDS, ...earlier]);
			const { container } = renderInsights();

			expect(deltaText(container, 'winRate')).toBe('▲ +50.0 pts');
			expect(deltaText(container, 'deaths10')?.startsWith('▼ −')).toBe(true);
		});

		it('should use the down arrow for a drop in win rate', () => {
			const earlier = [
				makeRecord({ id: 'p1', date: '02/05/2025' }),
				makeRecord({ id: 'p2', date: '02/06/2025' }),
			];
			vi.mocked(Store.loadGameRecords).mockReturnValue([...RECORDS, ...earlier]);
			const { container } = renderInsights();

			expect(deltaText(container, 'winRate')).toBe('▼ −50.0 pts');
		});
	});

	describe('reset filters', () => {
		it('should restore the default filters', () => {
			const old = makeRecord({ id: 'old', date: '01/05/2025' });
			vi.mocked(Store.loadGameRecords).mockReturnValue([...RECORDS, old]);
			const { container } = renderInsights();

			fireEvent.change(screen.getByLabelText('Period'), { target: { value: 'all' } });
			fireEvent.change(screen.getByLabelText('Compare to'), {
				target: { value: 'none' },
			});
			fireEvent.click(screen.getByRole('button', { name: 'Tank' }));
			expect(statValue(container, 'games')).toBe('2');

			fireEvent.click(screen.getByRole('button', { name: /Reset Filters/ }));

			expect(statValue(container, 'games')).toBe('6');
			expect((screen.getByLabelText('Period') as HTMLSelectElement).value).toBe('last90');
			expect((screen.getByLabelText('Compare to') as HTMLSelectElement).value).toBe(
				'previous'
			);
			expect(
				screen.getAllByRole('button', { name: 'All' })[0].getAttribute('aria-pressed')
			).toBe('true');
		});
	});

	describe('personal bests', () => {
		it('should open the record behind a personal best', () => {
			renderInsights();

			const best = screen.getByRole('button', { name: /Most eliminations/ });
			expect(best.textContent).toContain('25');
			expect(best.textContent).toContain('Tracer');
			expect(best.textContent).toContain('Hollywood');

			fireEvent.click(best);

			expect(onOpenRecord).toHaveBeenCalledWith('g3');
		});
	});

	describe('sessions', () => {
		/** One game per 5 minutes on 06/01/2025 starting at 10:00 */
		const timedRecords = (results: string[], dayStart = 1): GameRecord[] =>
			results.map((result, i) =>
				makeRecord({
					id: `s${dayStart}-${i}`,
					result,
					date: `06/0${dayStart}/2025 10:${String(i * 5).padStart(2, '0')}`,
				})
			);

		it('should render bars by game number with counts', () => {
			vi.mocked(Store.loadGameRecords).mockReturnValue(
				timedRecords(['VICTORY', 'DEFEAT', 'VICTORY'])
			);
			renderInsights();

			expect(screen.getByRole('heading', { name: 'Sessions' })).toBeDefined();
			const list = screen.getByRole('list', { name: 'Win rate by game number' });
			const rows = list.querySelectorAll('.insights-bars__row');
			expect(rows).toHaveLength(5);
			expect(rows[0].textContent).toContain('Game 1');
			expect(rows[0].textContent).toContain('100% (1)');
			expect(rows[1].textContent).toContain('0% (1)');
			expect(rows[4].textContent).toContain('Game 5+');
			expect(rows[4].textContent).toContain('— (0)');
		});

		it('should show after-win and after-loss rates, session count and length', () => {
			vi.mocked(Store.loadGameRecords).mockReturnValue(
				timedRecords(['VICTORY', 'DEFEAT', 'VICTORY'])
			);
			renderInsights();

			const stat = (name: string) =>
				screen.getByText(name, { selector: 'dt' }).parentElement?.querySelector('dd')
					?.textContent;
			expect(stat('After a win')).toMatch(/^0%/);
			expect(stat('After a loss')).toMatch(/^100%/);
			expect(stat('Sessions')).toBe('1');
			expect(stat('Average length')).toBe('3.0 games');
		});

		it('should note games without a readable time', () => {
			vi.mocked(Store.loadGameRecords).mockReturnValue([
				...timedRecords(['VICTORY', 'DEFEAT']),
				makeRecord({ id: 'no-time', date: '06/05/2025' }),
				makeRecord({ id: 'no-time2', date: '06/06/2025' }),
			]);
			renderInsights();

			expect(
				screen.getByText('2 games had no readable time and are left out.')
			).toBeDefined();
		});

		it('should use the singular for one untimed game', () => {
			vi.mocked(Store.loadGameRecords).mockReturnValue([
				...timedRecords(['VICTORY', 'DEFEAT']),
				makeRecord({ id: 'no-time', date: '06/05/2025' }),
			]);
			renderInsights();

			expect(
				screen.getByText('1 game had no readable time and is left out.')
			).toBeDefined();
		});

		it('should show a hint instead of bars when no game has a time', () => {
			renderInsights();

			expect(screen.getByRole('heading', { name: 'Sessions' })).toBeDefined();
			expect(screen.getByText(/No games have a readable time/)).toBeDefined();
			expect(screen.queryByRole('list', { name: 'Win rate by game number' })).toBeNull();
		});

		it('should write the session fatigue finding', () => {
			const records = Array.from({ length: 10 }, (_, d) =>
				timedRecords(['VICTORY', 'VICTORY', 'VICTORY', 'DEFEAT', 'DEFEAT'], 1).map(
					(r, i) => ({
						...r,
						id: `f${d}-${i}`,
						matchInfo: {
							...r.matchInfo,
							date: `06/${String(d + 1).padStart(2, '0')}/2025 10:${String(i * 5).padStart(2, '0')}`,
						},
					})
				)
			).flat();
			vi.mocked(Store.loadGameRecords).mockReturnValue(records);
			renderInsights();

			expect(screen.getByText('You tire over a long session')).toBeDefined();
			expect(
				screen.getByText(
					'You win 100% in your first 3 games but 0% after. Consider stopping after 3.'
				)
			).toBeDefined();
		});

		it('should write the tilt finding', () => {
			const at = (d: number, i: number) =>
				`06/${String(d).padStart(2, '0')}/2025 10:${String(i * 5).padStart(2, '0')}`;
			const records = [
				...[
					'VICTORY',
					'VICTORY',
					'VICTORY',
					'VICTORY',
					'VICTORY',
					'VICTORY',
					'DEFEAT',
				].map((result, i) => makeRecord({ id: `a${i}`, result, date: at(1, i) })),
				...Array.from({ length: 6 }, (_, i) =>
					makeRecord({ id: `b${i}`, result: 'DEFEAT', date: at(2, i) })
				),
			];
			vi.mocked(Store.loadGameRecords).mockReturnValue(records);
			renderInsights();

			expect(screen.getByText('Losses carry over')).toBeDefined();
			expect(
				screen.getByText(
					'After a loss you win 0%, vs 83% after a win. Take a break before re-queueing.'
				)
			).toBeDefined();
		});
	});

	describe('lobby comparison', () => {
		/** Tracer games: `damageAbove` above and `damageBelow` below the team on kills */
		const lobbyRecords = (above: number, below: number): GameRecord[] => [
			...Array.from({ length: above }, (_, i) =>
				makeRecord({ id: `a${i}`, kills: '9', withMate: true })
			),
			...Array.from({ length: below }, (_, i) =>
				makeRecord({ id: `b${i}`, kills: '1', result: 'DEFEAT', withMate: true })
			),
			makeRecord({ id: 't1', hero: 'Reinhardt', withMate: true }),
		];

		it('should render one headed group per role with games', () => {
			vi.mocked(Store.loadGameRecords).mockReturnValue(lobbyRecords(5, 5));
			const { container } = renderInsights();

			const headings = [...container.querySelectorAll('.insights-lobby__role')];
			expect(headings.map((h) => h.textContent)).toEqual(['Tank', 'Damage']);
			expect(container.querySelectorAll('.insights-lobby__group')).toHaveLength(2);
		});

		it('should show the above/below line with win rates and counts', () => {
			vi.mocked(Store.loadGameRecords).mockReturnValue(lobbyRecords(5, 5));
			const { container } = renderInsights();

			const lines = [...container.querySelectorAll('.insights-lobby__split')];
			expect(lines).toHaveLength(1);
			expect(lines[0].textContent?.replace(/\s+/g, ' ')).toBe(
				'Above team avg: 100% (5) · Below: 0% (5)'
			);
		});

		it('should hide the line when either side has fewer than 5 games', () => {
			vi.mocked(Store.loadGameRecords).mockReturnValue(lobbyRecords(5, 4));
			const { container } = renderInsights();

			expect(container.querySelectorAll('.insights-lobby__split')).toHaveLength(0);
			// The stat rows themselves stay
			expect(screen.getAllByText('Eliminations').length).toBeGreaterThan(0);
		});
	});

	describe('export', () => {
		it('should download the summary as JSON', () => {
			const createObjectURL = vi.fn(() => 'blob:insights');
			const revokeObjectURL = vi.fn();
			vi.stubGlobal('URL', { createObjectURL, revokeObjectURL });
			const downloads: string[] = [];
			const click = vi
				.spyOn(HTMLAnchorElement.prototype, 'click')
				.mockImplementation(function (this: HTMLAnchorElement) {
					downloads.push(this.download);
				});
			renderInsights();

			fireEvent.click(screen.getByRole('button', { name: /Export summary JSON/ }));

			expect(Store.exportInsightsSummary).toHaveBeenCalledTimes(1);
			expect(vi.mocked(Store.exportInsightsSummary).mock.calls[0][0].filters.player).toBe(
				'ALICE'
			);
			expect(createObjectURL).toHaveBeenCalledTimes(1);
			expect(downloads).toHaveLength(1);
			expect(downloads[0]).toMatch(/^vowt-insights-.+\.json$/);
			expect(revokeObjectURL).toHaveBeenCalledWith('blob:insights');

			click.mockRestore();
			vi.unstubAllGlobals();
		});
	});
});
