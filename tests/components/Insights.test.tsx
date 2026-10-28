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

const SETTINGS = { darkMode: false, trackedPlayer: null };

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

			expect(screen.getByRole('heading', { name: 'Your progress' })).toBeDefined();
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
				screen.getByText(/You win 100% of games with 5.5 or fewer deaths, but only 0%/)
			).toBeDefined();
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
			expect(winRateDelta.textContent).toBe('+50.0 pts');
			expect(winRateDelta.classList.contains('insights-delta--good')).toBe(true);

			// Fewer deaths is an improvement even though the number went down
			const deathsDelta = container.querySelector(
				'[data-stat="deaths10"] .insights-delta'
			)!;
			expect(deathsDelta.textContent?.startsWith('−')).toBe(true);
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
			});
			const { container } = renderInsights();

			fireEvent.change(screen.getByLabelText('Tracked player'), {
				target: { value: 'BOB' },
			});

			expect(Store.saveSettings).toHaveBeenCalledWith({
				darkMode: true,
				trackedPlayer: 'BOB',
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
