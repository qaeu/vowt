/**
 * Insights screen: aggregate stats and trends across the saved game records
 */

import type { Component } from 'solid-js';
import { For, Show, createMemo, createSignal } from 'solid-js';
import { Dynamic } from 'solid-js/web';
import type { LucideIcon } from 'lucide-solid';
import {
	Download,
	Flame,
	Hourglass,
	RotateCcw,
	Skull,
	Star,
	TriangleAlert,
} from 'lucide-solid';

import type {
	GameRecord,
	FindingConfidence,
	InsightFinding,
	InsightsFilters,
	InsightsHeadline,
	InsightsPeriod,
	LobbyComparisonRow,
	PersonalBest,
	PersonalBests,
	RoleDeathsMedian,
	TrendMetric,
} from '#types';
import Screen from '#c/ui/Screen';
import BarMeter from '#c/ui/BarMeter';
import TrendChart from '#c/ui/TrendChart';
import * as Store from '#utils/storage';
import { loadOverFastData } from '#utils/overfastApi';
import { getHeroDisplayName } from '#utils/gameData';
import {
	MIN_TEAM_SPLIT_GAMES,
	buildInsightsSummary,
	getPlayerNameCounts,
} from '#utils/insights';
import { normaliseName } from '#utils/playerNames';

interface InsightsProps {
	/** Called with a record id when a personal best is clicked */
	onOpenRecord: (recordId: string) => void;
}

interface ChipGroupProps {
	label: string;
	value: string;
	options: { value: string; text: string }[];
	onSelect: (value: string) => void;
}

interface HeadlineCardConfig {
	key: 'games' | 'winRate' | 'kda' | 'dmg10' | 'heal10' | 'deaths10';
	label: string;
	format: (value: number | null) => string;
	digits: number;
	deltaSuffix: string;
	lowerIsBetter?: boolean;
}

interface DeltaDisplay {
	text: string;
	tone: 'good' | 'bad' | 'neutral';
}

const PERIOD_OPTIONS: { value: InsightsPeriod; text: string }[] = [
	{ value: 'last30', text: 'Last 30 days' },
	{ value: 'last90', text: 'Last 90 days' },
	{ value: 'all', text: 'All time' },
];

const COMPARE_OPTIONS: { value: InsightsFilters['compare']; text: string }[] = [
	{ value: 'previous', text: 'Previous period' },
	{ value: 'none', text: 'None' },
];

const ROLE_OPTIONS = [
	{ value: 'all', text: 'All' },
	{ value: 'tank', text: 'Tank' },
	{ value: 'damage', text: 'Damage' },
	{ value: 'support', text: 'Support' },
];

const MINUS = '−';
const EN_DASH = '–';
const NO_VALUE = '—';
const UP_ARROW = '▲';
const DOWN_ARROW = '▼';
const MAPS_COLLAPSED_COUNT = 8;

const _formatNumber = (value: number | null, digits = 0): string =>
	value === null ? NO_VALUE : (
		value.toLocaleString('en-US', {
			minimumFractionDigits: digits,
			maximumFractionDigits: digits,
		})
	);

const _formatPercent = (value: number | null): string =>
	value === null ? NO_VALUE : `${Math.round(value)}%`;

const HEADLINE_CARDS: HeadlineCardConfig[] = [
	{
		key: 'games',
		label: 'Games',
		format: (v) => _formatNumber(v),
		digits: 0,
		deltaSuffix: '',
	},
	{
		key: 'winRate',
		label: 'Win rate',
		format: _formatPercent,
		digits: 1,
		deltaSuffix: ' pts',
	},
	{
		key: 'kda',
		label: 'KDA',
		format: (v) => _formatNumber(v, 2),
		digits: 2,
		deltaSuffix: '',
	},
	{
		key: 'dmg10',
		label: 'Damage /10',
		format: (v) => _formatNumber(v),
		digits: 0,
		deltaSuffix: '',
	},
	{
		key: 'heal10',
		label: 'Healing /10',
		format: (v) => _formatNumber(v),
		digits: 0,
		deltaSuffix: '',
	},
	{
		key: 'deaths10',
		label: 'Deaths /10',
		format: (v) => _formatNumber(v, 1),
		digits: 1,
		deltaSuffix: '',
		lowerIsBetter: true,
	},
];

const TREND_METRICS: {
	key: TrendMetric;
	label: string;
	format: (value: number) => string;
	domain?: [number, number];
	referenceLine?: number;
}[] = [
	{
		key: 'winRate',
		label: 'Win rate',
		format: _formatPercent,
		domain: [0, 100],
		referenceLine: 50,
	},
	{ key: 'kda', label: 'KDA', format: (v) => _formatNumber(v, 2) },
	{ key: 'dmg10', label: 'Damage /10', format: (v) => _formatNumber(v) },
	{ key: 'heal10', label: 'Healing /10', format: (v) => _formatNumber(v) },
];

const LOBBY_LABELS: Record<LobbyComparisonRow['stat'], string> = {
	e: 'Eliminations',
	a: 'Assists',
	d: 'Deaths',
	h: 'Healing',
	dmg: 'Damage',
};

const PERSONAL_BEST_CARDS: { key: keyof PersonalBests; label: string }[] = [
	{ key: 'kills', label: 'Most eliminations' },
	{ key: 'damage', label: 'Most damage' },
	{ key: 'healing', label: 'Most healing' },
	{ key: 'fewestDeathsInWin', label: 'Fewest deaths in a win' },
];

const FORM_LETTERS = { win: 'W', loss: 'L', draw: 'D' } as const;

/** Title-cases an upper-case mode or map name for display */
const _titleCase = (text: string): string =>
	text
		.toLowerCase()
		.split(' ')
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(' ');

const _describeDelta = (
	delta: number | null,
	digits: number,
	suffix: string,
	lowerIsBetter = false
): DeltaDisplay | null => {
	if (delta === null) return null;
	const rounded = Number(delta.toFixed(digits));
	if (rounded === 0) return { text: `0${suffix}`, tone: 'neutral' };
	const sign = rounded > 0 ? '+' : MINUS;
	const arrow = rounded > 0 ? UP_ARROW : DOWN_ARROW;
	return {
		text: `${arrow} ${sign}${_formatNumber(Math.abs(rounded), digits)}${suffix}`,
		tone: rounded > 0 !== lowerIsBetter ? 'good' : 'bad',
	};
};

const _formatDate = (date: Date): string =>
	date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

const _formatRecordLine = (wins: number, losses: number, draws: number): string =>
	draws ? `${wins}${EN_DASH}${losses}${EN_DASH}${draws}` : `${wins}${EN_DASH}${losses}`;

const _pickSeedPlayer = (names: string[], saved: string | null): string => {
	const normalised = saved ? normaliseName(saved) : '';
	return names.includes(normalised) ? normalised : (names[0] ?? '');
};

const _downloadJson = (data: string, filename: string) => {
	const blob = new Blob([data], { type: 'application/json' });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = filename;
	a.click();
	URL.revokeObjectURL(url);
};

const CONFIDENCE_LABELS: Record<FindingConfidence, string> = {
	low: 'Low confidence',
	medium: 'Medium confidence',
	high: 'High confidence',
};

const FINDING_ICONS: Record<InsightFinding['kind'], LucideIcon> = {
	deathsSplit: Skull,
	bestHero: Star,
	weakestMode: TriangleAlert,
	sessionFatigue: Hourglass,
	tilt: Flame,
};

const ROLE_LABELS: Record<RoleDeathsMedian['role'], string> = {
	tank: 'Tank',
	damage: 'Damage',
	support: 'Support',
	unknown: 'Unknown role',
};

const _formatMedians = (medians: RoleDeathsMedian[]): string =>
	medians.map((m) => `${ROLE_LABELS[m.role]} ${m.medianDeaths10.toFixed(1)}`).join(', ');

const _findingContent = (finding: InsightFinding): { title: string; text: string } => {
	switch (finding.kind) {
		case 'deathsSplit':
			return {
				title: 'Staying alive wins games',
				text:
					`You win ${Math.round(finding.lowDeaths.winRate)}% of games with `
					+ `deaths per 10 minutes at or below your role's typical level, but only `
					+ `${Math.round(finding.highDeaths.winRate)}% above it. `
					+ `Typical: ${_formatMedians(finding.medians)}.`,
			};
		case 'bestHero': {
			const gap = Math.round(finding.winRate - finding.restWinRate);
			return {
				title: `${finding.hero} is your best pick`,
				text:
					`${Math.round(finding.winRate)}% over ${finding.games} games, `
					+ `${gap} points above your other games.`,
			};
		}
		case 'weakestMode': {
			const gap = Math.round(finding.restWinRate - finding.winRate);
			const map = finding.worstMap;
			const mapText =
				map ?
					`; ${_titleCase(map.map)} alone is ${_formatRecordLine(map.wins, map.losses, map.draws)}`
				:	'';
			return {
				title: `${_titleCase(finding.mode)} is holding you back`,
				text:
					`${Math.round(finding.winRate)}% across ${finding.games} games, `
					+ `${gap} points below your other games${mapText}.`,
			};
		}
		case 'sessionFatigue':
			return {
				title: 'You tire over a long session',
				text:
					`You win ${Math.round(finding.early.winRate)}% in your first 3 games but `
					+ `${Math.round(finding.late.winRate)}% after. Consider stopping after 3.`,
			};
		case 'tilt':
			return {
				title: 'Losses carry over',
				text:
					`After a loss you win ${Math.round(finding.afterLoss.winRate)}%, vs `
					+ `${Math.round(finding.afterWin.winRate)}% after a win. `
					+ `Take a break before re-queueing.`,
			};
	}
};

const ChipGroup: Component<ChipGroupProps> = (props) => (
	<div class="insights-filter">
		<span class="insights-filter__label">{props.label}</span>
		<div class="insights-filter__chips" role="group" aria-label={props.label}>
			<For each={props.options}>
				{(option) => (
					<button
						type="button"
						class="insights-chip"
						aria-pressed={props.value === option.value}
						onClick={() => props.onSelect(option.value)}
					>
						{option.text}
					</button>
				)}
			</For>
		</div>
	</div>
);

const Insights: Component<InsightsProps> = (props) => {
	const records: GameRecord[] = Store.loadGameRecords();
	const heroes = loadOverFastData()?.heroes ?? [];
	const names = getPlayerNameCounts(records).map((n) => n.name);
	const now = new Date();

	const [player, setPlayer] = createSignal(
		_pickSeedPlayer(names, Store.loadSettings().trackedPlayer)
	);
	const [period, setPeriod] = createSignal<InsightsPeriod>('last90');
	const [compare, setCompare] = createSignal<InsightsFilters['compare']>('previous');
	const [role, setRole] = createSignal<InsightsFilters['role']>('all');
	const [mode, setMode] = createSignal('all');
	const [trendMetric, setTrendMetric] = createSignal<TrendMetric>('winRate');
	const [showAllMaps, setShowAllMaps] = createSignal(false);

	const summary = createMemo(() =>
		buildInsightsSummary(
			records,
			{
				player: player(),
				period: period(),
				compare: compare(),
				role: role(),
				mode: mode(),
			},
			heroes,
			now
		)
	);

	const headline = (): InsightsHeadline => summary().headline;
	const hasGames = () => headline().games.value! > 0;
	const trend = () => TREND_METRICS.find((m) => m.key === trendMetric())!;
	const visibleMaps = () =>
		showAllMaps() ? summary().maps : summary().maps.slice(0, MAPS_COLLAPSED_COUNT);
	const maxHeroGames = () => Math.max(1, ...summary().heroPool.map((h) => h.games));

	const modeOptions = () => [
		{ value: 'all', text: 'All' },
		...summary().availableModes.map((m) => ({ value: m, text: _titleCase(m) })),
	];

	const recordsById = createMemo(() => new Map(records.map((r) => [r.id, r])));

	const handlePlayerChange = (name: string) => {
		setPlayer(name);
		setRole('all');
		setMode('all');
		Store.saveSettings({ ...Store.loadSettings(), trackedPlayer: name });
	};

	const handleResetFilters = () => {
		setPeriod('last90');
		setCompare('previous');
		setRole('all');
		setMode('all');
	};

	const handleExport = () => {
		_downloadJson(
			Store.exportInsightsSummary(summary()),
			`vowt-insights-${new Date().toISOString()}.json`
		);
	};

	const personalBestContext = (best: PersonalBest): string => {
		const record = recordsById().get(best.recordId);
		const me = record?.players.find((p) => normaliseName(p.name) === player());
		const parts = [
			me?.hero ? getHeroDisplayName(me.hero, heroes) : '',
			record?.matchInfo.map ? _titleCase(record.matchInfo.map.trim()) : '',
			_formatDate(best.date),
		];
		return parts.filter(Boolean).join(' · ');
	};

	const showTeamSplit = (row: LobbyComparisonRow): boolean =>
		row.gamesAbove >= MIN_TEAM_SPLIT_GAMES && row.gamesBelow >= MIN_TEAM_SPLIT_GAMES;

	const lobbyLabel = (row: LobbyComparisonRow): string =>
		`${LOBBY_LABELS[row.stat]} per 10 minutes: you ${_formatNumber(row.you, 1)}, `
		+ `team average ${_formatNumber(row.team, 1)}, `
		+ `enemy average ${_formatNumber(row.enemy, 1)}`;

	return (
		<Screen
			id="insights-screen"
			title={
				<>
					Insights for{' '}
					<Show when={names.length > 0}>
						<label for="insights-player" class="visually-hidden">
							Tracked player
						</label>
						<select
							id="insights-player"
							class="insights-title-select"
							onChange={(e) => handlePlayerChange(e.currentTarget.value)}
						>
							<For each={names}>
								{(name) => (
									<option value={name} selected={name === player()}>
										{name}
									</option>
								)}
							</For>
						</select>
					</Show>
				</>
			}
			subtitle={
				records.length > 0 && names.length > 0 ?
					`Aggregated from ${headline().games.value} of your ${records.length} stored game records`
				:	undefined
			}
		>
			<Show
				when={records.length > 0 && names.length > 0}
				fallback={
					<div class="insights-empty">
						<p>No game records to analyse yet</p>
						<p>Upload a scoreboard screenshot to start tracking your progress.</p>
					</div>
				}
			>
				<section class="insights-filters" aria-label="Filters">
					<div class="insights-filters__row">
						<div class="insights-select">
							<label for="insights-period">Period</label>
							<select
								id="insights-period"
								onChange={(e) => setPeriod(e.currentTarget.value as InsightsPeriod)}
							>
								<For each={PERIOD_OPTIONS}>
									{(option) => (
										<option value={option.value} selected={option.value === period()}>
											{option.text}
										</option>
									)}
								</For>
							</select>
						</div>
						<div class="insights-select">
							<label for="insights-compare">Compare to</label>
							<select
								id="insights-compare"
								onChange={(e) =>
									setCompare(e.currentTarget.value as InsightsFilters['compare'])
								}
							>
								<For each={COMPARE_OPTIONS}>
									{(option) => (
										<option value={option.value} selected={option.value === compare()}>
											{option.text}
										</option>
									)}
								</For>
							</select>
						</div>
						<ChipGroup
							label="Role"
							value={role()}
							options={ROLE_OPTIONS}
							onSelect={(v) => setRole(v as InsightsFilters['role'])}
						/>
						<ChipGroup
							label="Mode"
							value={mode()}
							options={modeOptions()}
							onSelect={setMode}
						/>
					</div>
					<button type="button" id="reset-insights-filters" onClick={handleResetFilters}>
						<RotateCcw size={14} /> Reset Filters
					</button>
				</section>

				<Show
					when={hasGames()}
					fallback={
						<div class="insights-empty">
							<p>No games match these filters</p>
							<p>Try a longer period or clear the role and mode filters.</p>
						</div>
					}
				>
					<section class="insights-headline" aria-label="Headline numbers">
						<For each={HEADLINE_CARDS}>
							{(card) => {
								const metric = () => headline()[card.key];
								const delta = () =>
									_describeDelta(
										metric().delta,
										card.digits,
										card.deltaSuffix,
										card.lowerIsBetter
									);
								return (
									<div class="insights-stat-card" data-stat={card.key}>
										<span class="insights-stat-card__label">{card.label}</span>
										<span class="insights-stat-card__value">
											{card.format(metric().value)}
										</span>
										<Show when={card.key === 'winRate'}>
											<span class="insights-stat-card__sub">
												{headline().wins}W {EN_DASH} {headline().losses}L {EN_DASH}{' '}
												{headline().draws}D
											</span>
										</Show>
										<Show when={delta()}>
											{(d) => (
												<span
													class={`insights-delta insights-delta--${d().tone}`}
													title="Change against the comparison period"
												>
													{d().text}
												</span>
											)}
										</Show>
									</div>
								);
							}}
						</For>
					</section>

					<div class="insights-row">
						<section
							class="insights-panel insights-panel--wide"
							aria-labelledby="trend-h"
						>
							<div class="insights-panel__header">
								<h2 id="trend-h">Trend</h2>
								<div class="insights-segmented" role="group" aria-label="Trend metric">
									<For each={TREND_METRICS}>
										{(metric) => (
											<button
												type="button"
												aria-pressed={trendMetric() === metric.key}
												onClick={() => setTrendMetric(metric.key)}
											>
												{metric.label}
											</button>
										)}
									</For>
								</div>
							</div>
							<TrendChart
								points={summary().trend[trendMetric()]}
								label={trend().label}
								format={trend().format}
								domain={trend().domain}
								referenceLine={trend().referenceLine}
							/>
						</section>

						<section class="insights-panel" aria-labelledby="form-h">
							<h2 id="form-h">Recent form</h2>
							<ol class="insights-form" aria-label="Most recent results, oldest first">
								<For each={summary().recentForm.results}>
									{(entry) => (
										<li
											class={`insights-form__tile insights-form__tile--${entry.result}`}
										>
											{FORM_LETTERS[entry.result]}
										</li>
									)}
								</For>
							</ol>
							<ul class="insights-legend" aria-hidden="true">
								<li>
									<span class="insights-form__tile insights-form__tile--win" />
									Win
								</li>
								<li>
									<span class="insights-form__tile insights-form__tile--loss" />
									Loss
								</li>
								<li>
									<span class="insights-form__tile insights-form__tile--draw" />
									Draw
								</li>
							</ul>
							<dl class="insights-mini-stats">
								<div>
									<dt>Current streak</dt>
									<dd>
										{summary().recentForm.currentStreak.result ?
											`${FORM_LETTERS[summary().recentForm.currentStreak.result!]}${
												summary().recentForm.currentStreak.length
											}`
										:	NO_VALUE}
									</dd>
								</div>
								<div>
									<dt>Best win streak</dt>
									<dd>{summary().recentForm.bestWinStreak}</dd>
								</div>
								<div>
									<dt>Record</dt>
									<dd>
										{summary().recentForm.wins}
										{EN_DASH}
										{summary().recentForm.losses}
										{EN_DASH}
										{summary().recentForm.draws}
									</dd>
								</div>
							</dl>
						</section>
					</div>

					<Show when={summary().findings.length > 0}>
						<section class="insights-findings" aria-labelledby="findings-h">
							<h2 id="findings-h">What stands out</h2>
							<ul class="insights-findings__list">
								<For each={summary().findings}>
									{(finding) => {
										const content = () => _findingContent(finding);
										return (
											<li class={`insights-finding insights-finding--${finding.kind}`}>
												<span class="insights-finding__icon" aria-hidden="true">
													<Dynamic<LucideIcon>
														component={FINDING_ICONS[finding.kind]}
														size={20}
													/>
												</span>
												<div class="insights-finding__body">
													<p>
														<strong>{content().title}</strong>
														<br />
														{content().text}
													</p>
													<span
														class={`insights-finding__confidence insights-finding__confidence--${finding.confidence}`}
													>
														{CONFIDENCE_LABELS[finding.confidence]}
													</span>
												</div>
											</li>
										);
									}}
								</For>
							</ul>
						</section>
					</Show>

					<div class="insights-row">
						<section
							class="insights-panel insights-panel--wide"
							aria-labelledby="heroes-h"
						>
							<h2 id="heroes-h">Hero pool</h2>
							<Show
								when={summary().heroPool.length > 0}
								fallback={
									<p class="insights-note">No heroes were read for these games.</p>
								}
							>
								<div
									class="insights-table-scroll"
									role="region"
									aria-label="Hero pool table"
									tabindex="0"
								>
									<table class="insights-table">
										<thead>
											<tr>
												<th scope="col">Hero</th>
												<th scope="col">Games</th>
												<th scope="col">Win %</th>
												<th scope="col">KDA</th>
												<th scope="col">Dmg /10</th>
												<th scope="col">Heal /10</th>
												<th scope="col">Mit /10</th>
											</tr>
										</thead>
										<tbody>
											<For each={summary().heroPool}>
												{(row) => {
													const delta = () => _describeDelta(row.winRateDelta, 0, ' pts');
													return (
														<tr>
															<th scope="row">{row.hero}</th>
															<td>
																<div class="insights-table__games">
																	<span>{row.games}</span>
																	<BarMeter
																		segments={[{ value: row.games, tone: 'primary' }]}
																		max={maxHeroGames()}
																	/>
																</div>
															</td>
															<td>
																{_formatPercent(row.winRate)}
																<Show when={delta()}>
																	{(d) => (
																		<span
																			class={`insights-delta insights-delta--${d().tone}`}
																		>
																			{d().text}
																		</span>
																	)}
																</Show>
															</td>
															<td>{_formatNumber(row.kda, 2)}</td>
															<td>{_formatNumber(row.dmg10)}</td>
															<td>{_formatNumber(row.heal10)}</td>
															<td>{_formatNumber(row.mit10)}</td>
														</tr>
													);
												}}
											</For>
										</tbody>
									</table>
								</div>
							</Show>
						</section>

						<section class="insights-panel" aria-labelledby="lobby-h">
							<h2 id="lobby-h">You vs the lobby</h2>
							<For each={summary().lobby}>
								{(group) => (
									<div class="insights-lobby__group">
										<h3 class="insights-lobby__role">{ROLE_LABELS[group.role]}</h3>
										<ul class="insights-lobby">
											<For each={group.rows}>
												{(row) => {
													const max = () =>
														Math.max(row.you ?? 0, row.team ?? 0, row.enemy ?? 0);
													return (
														<li class="insights-lobby__row" aria-label={lobbyLabel(row)}>
															<span class="insights-lobby__stat">
																{LOBBY_LABELS[row.stat]}
															</span>
															<For
																each={
																	[
																		['You', row.you, 'primary'],
																		['Team avg', row.team, 'neutral'],
																		['Enemy avg', row.enemy, 'error'],
																	] as const
																}
															>
																{([text, value, tone]) => (
																	<div class="insights-lobby__line" aria-hidden="true">
																		<span>{text}</span>
																		<BarMeter
																			segments={[{ value: value ?? 0, tone }]}
																			max={max()}
																		/>
																		<span>{_formatNumber(value, 1)}</span>
																	</div>
																)}
															</For>
															<Show when={showTeamSplit(row)}>
																<p class="insights-lobby__split">
																	Above team avg: {_formatPercent(row.winRateAbove)} (
																	{row.gamesAbove}) · Below:{' '}
																	{_formatPercent(row.winRateBelow)} ({row.gamesBelow})
																</p>
															</Show>
														</li>
													);
												}}
											</For>
										</ul>
									</div>
								)}
							</For>
							<p class="insights-note">
								Per 10 minutes. Above/below: win rate in games where you were above or
								below your team's average.
							</p>
						</section>
					</div>

					<div class="insights-row">
						<section class="insights-panel" aria-labelledby="maps-h">
							<h2 id="maps-h">Maps</h2>
							<Show
								when={summary().maps.length > 0}
								fallback={
									<p class="insights-note">Not enough games on any single map yet.</p>
								}
							>
								<ul class="insights-bars">
									<For each={visibleMaps()}>
										{(row) => (
											<li class="insights-bars__row">
												<span class="insights-bars__name">{_titleCase(row.map)}</span>
												<BarMeter
													segments={[
														{
															value: row.winRate ?? 0,
															tone: (row.winRate ?? 0) >= 50 ? 'success' : 'error',
														},
													]}
													max={100}
													marker={50}
													label={`${_titleCase(row.map)} win rate ${_formatPercent(row.winRate)}`}
												/>
												<span class="insights-bars__value">
													{_formatPercent(row.winRate)} (
													{_formatRecordLine(row.wins, row.losses, row.draws)})
												</span>
											</li>
										)}
									</For>
								</ul>
								<Show when={summary().maps.length > MAPS_COLLAPSED_COUNT}>
									<button
										type="button"
										class="insights-link-button"
										aria-expanded={showAllMaps()}
										onClick={() => setShowAllMaps(!showAllMaps())}
									>
										{showAllMaps() ?
											'Show fewer maps'
										:	`Show all ${summary().maps.length} maps`}
									</button>
								</Show>
							</Show>
						</section>

						<section class="insights-panel" aria-labelledby="modes-h">
							<h2 id="modes-h">Game modes</h2>
							<ul class="insights-bars">
								<For each={summary().modes}>
									{(row) => (
										<li class="insights-bars__row">
											<span class="insights-bars__name">{_titleCase(row.mode)}</span>
											<BarMeter
												segments={[
													{ value: row.wins, tone: 'success' },
													{ value: row.draws, tone: 'neutral' },
													{ value: row.losses, tone: 'error' },
												]}
												label={`${_titleCase(row.mode)}: ${row.wins} wins, ${row.draws} draws, ${row.losses} losses`}
											/>
											<span class="insights-bars__value">
												{row.wins}W {row.draws}D {row.losses}L
											</span>
										</li>
									)}
								</For>
							</ul>
						</section>
					</div>

					<div class="insights-row">
						<section class="insights-panel" aria-labelledby="sessions-h">
							<h2 id="sessions-h">Sessions</h2>
							<Show
								when={summary().sessions.timedGames > 0}
								fallback={
									<p class="insights-note">
										No games have a readable time, so sessions can't be built.
									</p>
								}
							>
								<div class="insights-sessions">
									<ul class="insights-bars" aria-label="Win rate by game number">
										<For each={summary().sessions.byGameNumber}>
											{(row) => (
												<li class="insights-bars__row">
													<span class="insights-bars__name">Game {row.label}</span>
													<BarMeter
														segments={[
															{
																value: row.winRate ?? 0,
																tone: (row.winRate ?? 0) >= 50 ? 'success' : 'error',
															},
														]}
														max={100}
														marker={50}
														label={`Game ${row.label} win rate ${_formatPercent(row.winRate)}`}
													/>
													<span class="insights-bars__value">
														{_formatPercent(row.winRate)} ({row.games})
													</span>
												</li>
											)}
										</For>
									</ul>
									<dl class="insights-mini-stats">
										<div>
											<dt>After a win</dt>
											<dd>
												{_formatPercent(summary().sessions.afterWin.winRate)} (
												{summary().sessions.afterWin.games})
											</dd>
										</div>
										<div>
											<dt>After a loss</dt>
											<dd>
												{_formatPercent(summary().sessions.afterLoss.winRate)} (
												{summary().sessions.afterLoss.games})
											</dd>
										</div>
										<div>
											<dt>Sessions</dt>
											<dd>{summary().sessions.sessionCount}</dd>
										</div>
										<div>
											<dt>Average length</dt>
											<dd>{_formatNumber(summary().sessions.averageLength, 1)} games</dd>
										</div>
									</dl>
								</div>
								<p class="insights-note">
									Win rate by game number within a session; a break of over an hour starts
									a new one. After a win/loss: the next game in the same session.
								</p>
							</Show>
							<Show when={summary().sessions.untimedGames > 0}>
								<p class="insights-note insights-sessions__untimed">
									{summary().sessions.untimedGames}{' '}
									{summary().sessions.untimedGames === 1 ? 'game' : 'games'} had no
									readable time and {summary().sessions.untimedGames === 1 ? 'is' : 'are'}{' '}
									left out.
								</p>
							</Show>
						</section>
					</div>

					<section class="insights-bests" aria-labelledby="bests-h">
						<h2 id="bests-h">Personal bests</h2>
						<div class="insights-bests__list">
							<For each={PERSONAL_BEST_CARDS}>
								{(card) => {
									const best = () => summary().personalBests[card.key];
									return (
										<Show
											when={best()}
											fallback={
												<div class="insights-best insights-best--empty">
													<span class="insights-best__label">{card.label}</span>
													<span class="insights-best__value">{NO_VALUE}</span>
												</div>
											}
										>
											{(b) => (
												<button
													type="button"
													class="insights-best"
													onClick={() => props.onOpenRecord(b().recordId)}
												>
													<span class="insights-best__label">{card.label}</span>
													<span class="insights-best__value">
														{_formatNumber(b().value)}
													</span>
													<span class="insights-best__context">
														{personalBestContext(b())}
													</span>
												</button>
											)}
										</Show>
									);
								}}
							</For>
						</div>
					</section>
				</Show>

				<footer class="insights-footer">
					<button type="button" id="export-insights" onClick={handleExport}>
						<Download size={16} /> Export summary JSON
					</button>
				</footer>
			</Show>
		</Screen>
	);
};

export default Insights;
