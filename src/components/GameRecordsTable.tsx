import type { Component } from 'solid-js';
import { createSignal, createMemo, onMount, For, Show, batch } from 'solid-js';
import { Portal } from 'solid-js/web';
import { Menu } from '@ark-ui/solid/menu';
import { ChevronDown, Ellipsis, Search } from 'lucide-solid';

import type {
	ScreenAction,
	AlertDialogOptions,
	GameRecord,
	PlayerStats,
	MatchInfo,
} from '#types';
import Screen from '#c/ui/Screen';
import EditableGameData from '#c/ui/EditableGameData';
import TeamScoreboard from '#c/ui/TeamScoreboard';
import DropZone from '#c/ui/DropZone';
import AlertDialog from '#c/ui/AlertDialog';
import Toaster, { toast } from '#c/ui/Toaster';
import * as Store from '#utils/storage';
import { updateOverFastData } from '#utils/overfastApi';
import { parseMatchDate } from '#utils/insights';

interface GameRecordsTableProps {
	/** Opens the screenshot file picker (also used by the empty-state Choose Files) */
	onUploadClick: () => void;
	/** Record to expand and scroll into view when the table first renders */
	initialExpandedId?: string | null;
}

type ResultFilter = 'all' | 'victory' | 'defeat';

const RECORD_TOGGLE_ANIM_DUR_MS = 240;

const RESULT_FILTERS: { value: ResultFilter; text: string }[] = [
	{ value: 'all', text: 'All' },
	{ value: 'victory', text: 'Victories' },
	{ value: 'defeat', text: 'Defeats' },
];

const RELATIVE_TIME_UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
	['year', 365 * 24 * 60 * 60 * 1000],
	['month', 30 * 24 * 60 * 60 * 1000],
	['day', 24 * 60 * 60 * 1000],
	['hour', 60 * 60 * 1000],
	['minute', 60 * 1000],
];

/** Formats an ISO timestamp as relative time, e.g. "3 days ago" */
const formatRelativeTime = (iso: string, now = Date.now()): string => {
	const elapsed = Date.parse(iso) - now;
	const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
	for (const [unit, ms] of RELATIVE_TIME_UNITS) {
		if (Math.abs(elapsed) >= ms) {
			return formatter.format(Math.round(elapsed / ms), unit);
		}
	}
	return formatter.format(0, 'minute');
};

/** Returns a css class for the result */
const getClassForResult = (resultText: string): 'victory' | 'defeat' | 'empty' => {
	return (
		resultText === 'VICTORY' ? 'victory'
		: resultText === 'DEFEAT' ? 'defeat'
		: 'empty'
	);
};

const GameRecordsTable: Component<GameRecordsTableProps> = (props) => {
	const [records, setRecords] = createSignal<GameRecord[]>([]);
	const [expandedRecordId, setExpandedRecordId] = createSignal<string | null>(null);
	const [editingRecordId, setEditingRecordId] = createSignal<string | null>(null);
	const [collapsingIds, setCollapsingIds] = createSignal<Set<string>>(new Set());
	const [isUpdatingGameData, setIsUpdatingGameData] = createSignal(false);
	const [lastExportedAt, setLastExportedAt] = createSignal<string | null>(
		Store.loadSettings().lastExportedAt
	);
	const [searchQuery, setSearchQuery] = createSignal('');
	const [resultFilter, setResultFilter] = createSignal<ResultFilter>('all');
	const [modeFilter, setModeFilter] = createSignal('all');

	let openDialog: ((options: AlertDialogOptions) => void) | null = null;

	const modes = createMemo(() => [
		...new Set(
			records()
				.map((r) => r.matchInfo.game_mode)
				.filter(Boolean)
		),
	]);

	const filteredRecords = createMemo(() => {
		const query = searchQuery().trim().toLowerCase();
		const result = resultFilter();
		const mode = modeFilter();

		return records().filter((record) => {
			const info = record.matchInfo;
			if (result !== 'all' && info.result.toLowerCase() !== result) return false;
			if (mode !== 'all' && info.game_mode !== mode) return false;
			if (!query) return true;

			return [
				info.map,
				info.game_mode,
				...record.players.flatMap((p) => [p.name, p.hero]),
			].some((value) => value?.toLowerCase().includes(query));
		});
	});

	const hasActiveFilters = () =>
		searchQuery() !== '' || resultFilter() !== 'all' || modeFilter() !== 'all';

	const clearFilters = () => {
		batch(() => {
			setSearchQuery('');
			setResultFilter('all');
			setModeFilter('all');
		});
	};

	const subtitle = () => {
		const total = records().length;
		const shown = filteredRecords().length;
		const backup = lastExportedAt();
		const noun = (hasActiveFilters() ? total : shown) === 1 ? 'record' : 'records';
		return [
			hasActiveFilters() ? `${shown} of ${total} ${noun}` : `${total} ${noun}`,
			'stored in this browser',
			backup ? `last backup ${formatRelativeTime(backup)}` : 'no backup yet',
		].join(' · ');
	};

	const screenActions: ScreenAction[] = [
		{
			id: 'import-records',
			text: 'Import Records',
			onClick: () => handleImport(),
		},
		{
			id: 'export-records',
			text: 'Export Records',
			onClick: () => handleExport(),
			disabled: () => records().length === 0,
		},
	];

	onMount(() => {
		loadRecords();

		const initialId = props.initialExpandedId;
		if (initialId && records().some((r) => r.id === initialId)) {
			setExpandedRecordId(initialId);
			// Wait for the rows to render before scrolling
			setTimeout(
				() =>
					document
						.getElementById(`record-${initialId}`)
						?.scrollIntoView?.({ block: 'center' }),
				0
			);
		}
	});

	const loadRecords = () => {
		setRecords(Store.loadGameRecords());
	};

	const openDeleteDialog = (id: string) => {
		openDialog?.({
			title: 'Delete this record?',
			description: 'This game record will be permanently removed from this browser.',
			actionText: 'Delete Record',
			tone: 'danger',
			onConfirm: () => handleDelete(id),
		});
	};

	const handleDelete = (id: string) => {
		Store.deleteGameRecord(id);
		setExpandedRecordId(null);
		setEditingRecordId(null);
		loadRecords();
		toast('Record deleted', '1 game record deleted.');
	};
	const handleClearAll = () => {
		Store.clearAllGameRecords();
		setExpandedRecordId(null);
		setEditingRecordId(null);
		loadRecords();
		toast('All records deleted', 'All game records deleted.');
	};

	const handleExport = () => {
		const data = Store.exportGameRecords();
		const blob = new Blob([data], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `vowt-games-${new Date().toISOString()}.json`;
		a.click();
		URL.revokeObjectURL(url);

		const exportedAt = new Date().toISOString();
		Store.saveSettings({ ...Store.loadSettings(), lastExportedAt: exportedAt });
		setLastExportedAt(exportedAt);
	};

	const handleImport = () => {
		const input = document.createElement('input');
		input.type = 'file';
		input.accept = 'application/json';
		input.onchange = (e) => {
			const file = (e.target as HTMLInputElement).files?.[0];
			if (file) {
				const reader = new FileReader();
				reader.onload = (event) => {
					try {
						const data = event.target?.result as string;
						const count = Store.importGameRecords(data);
						toast(
							`${count} ${count === 1 ? 'record' : 'records'} imported`,
							`${count} new game record(s) created.`
						);
						loadRecords();
					} catch (error) {
						openDialog?.({
							title: "Couldn't import records",
							description: 'Error importing game records. Please check the file format.',
							actionText: 'Close',
						});
						console.error('Import error:', error);
					}
				};
				reader.readAsText(file);
			}
		};
		input.click();
	};

	const handleUpdateGameData = async () => {
		setIsUpdatingGameData(true);
		try {
			const { heroes, maps } = await updateOverFastData();
			toast(
				'Game data updated',
				`${heroes.length} heroes and ${maps.length} maps updated.`
			);
		} catch (error) {
			toast(
				"Couldn't update game data",
				'Could not fetch game data from OverFast. Please try again later.'
			);
			console.error('Game data update error:', error);
		} finally {
			setIsUpdatingGameData(false);
		}
	};

	const handleMenuSelect = (details: { value: string }) => {
		if (details.value === 'update-game-data') {
			handleUpdateGameData();
		} else if (details.value === 'delete-all-records') {
			openDialog?.({
				title: `Delete all ${records().length} records?`,
				description:
					'All game records will be permanently removed from this browser. This cannot be undone.',
				actionText: `Delete ${records().length} Records`,
				tone: 'danger',
				onConfirm: handleClearAll,
			});
		}
	};

	const removeFromCollapsing = (id: string) => {
		setCollapsingIds((prev) => {
			const next = new Set(prev);
			next.delete(id);
			return next;
		});
	};

	const toggleExpanded = (record: GameRecord) => {
		const recordId = record.id;
		const currentExpanded = expandedRecordId();

		batch(() => {
			if (currentExpanded) {
				setTimeout(
					() => removeFromCollapsing(currentExpanded),
					RECORD_TOGGLE_ANIM_DUR_MS
				);
				setCollapsingIds((prev) => new Set([...prev, currentExpanded]));
			}
			setEditingRecordId(null);
			setExpandedRecordId(currentExpanded === recordId ? null : recordId);
		});
	};

	const handleSaveEdits = (players: PlayerStats[], matchInfo: MatchInfo) => {
		const recordId = expandedRecordId();
		if (!recordId) return;

		try {
			Store.updateGameRecord(recordId, players, matchInfo);
			setEditingRecordId(null);
			loadRecords();
			toast('Record saved', 'Game record updated.');
		} catch (err) {
			openDialog?.({
				title: "Couldn't update record",
				description: err instanceof Error ? err.message : 'Failed to update game record',
				actionText: 'Close',
			});
		}
	};

	const moreActions = (
		<Menu.Root positioning={{ placement: 'bottom-end' }} onSelect={handleMenuSelect}>
			<Menu.Trigger class="more-actions-trigger" aria-label="More actions">
				<Ellipsis size={16} />
			</Menu.Trigger>
			<Portal>
				<Menu.Positioner>
					<Menu.Content class="more-actions-menu">
						<Menu.Item
							value="update-game-data"
							class="more-actions-menu__item"
							disabled={isUpdatingGameData()}
						>
							Update game data
						</Menu.Item>
						<Menu.Item
							value="delete-all-records"
							class="more-actions-menu__item more-actions-menu__item--danger"
							disabled={records().length === 0}
						>
							Delete all records…
						</Menu.Item>
					</Menu.Content>
				</Menu.Positioner>
			</Portal>
		</Menu.Root>
	);

	return (
		<Screen
			id="game-records-screen"
			title="Game History"
			subtitle={subtitle()}
			screenActions={() => screenActions}
			extraActions={moreActions}
		>
			<Show when={records().length === 0}>
				<DropZone
					onChooseFiles={() => props.onUploadClick()}
					onImportClick={handleImport}
				/>
			</Show>

			<Show when={records().length > 0}>
				<div class="records-toolbar">
					<label class="records-toolbar__search">
						<Search size={16} aria-hidden="true" />
						<span class="visually-hidden">Search records</span>
						<input
							type="search"
							placeholder="Search map, hero or player"
							value={searchQuery()}
							onInput={(e) => setSearchQuery(e.currentTarget.value)}
						/>
					</label>
					<div class="records-toolbar__results" role="group" aria-label="Result">
						<For each={RESULT_FILTERS}>
							{(filter) => (
								<button
									type="button"
									aria-pressed={resultFilter() === filter.value}
									onClick={() => setResultFilter(filter.value)}
								>
									{filter.text}
								</button>
							)}
						</For>
					</div>
					<label class="records-toolbar__mode">
						Mode
						<select
							value={modeFilter()}
							onChange={(e) => setModeFilter(e.currentTarget.value)}
						>
							<option value="all">All modes</option>
							<For each={modes()}>{(mode) => <option value={mode}>{mode}</option>}</For>
						</select>
					</label>
				</div>

				<Show
					when={filteredRecords().length > 0}
					fallback={
						<div class="empty-state">
							<p>No records match</p>
							<Show when={hasActiveFilters()}>
								<button type="button" onClick={clearFilters}>
									Clear filters
								</button>
							</Show>
						</div>
					}
				>
					<div class="records-table-wrapper">
						<div class="records-list">
							<div class="records-header">
								<div>Played</div>
								<div>Result</div>
								<div>Score</div>
								<div>Mode</div>
								<div>Map</div>
								<div>Length</div>
								<div />
							</div>
							<For each={filteredRecords()}>
								{(record) => (
									<div
										id={`record-${record.id}`}
										class={`record-group${expandedRecordId() === record.id ? ' expanded' : ''}`}
									>
										<button
											type="button"
											class="record-row"
											aria-expanded={expandedRecordId() === record.id}
											onClick={() => toggleExpanded(record)}
										>
											<span class="record-cell">
												{parseMatchDate(record).toLocaleDateString()}
											</span>
											<span class="record-cell">
												<span
													class={`result-badge ${getClassForResult(
														record.matchInfo.result
													)}`}
												>
													{record.matchInfo.result}
												</span>
											</span>
											<span class="record-cell">
												{record.matchInfo.final_score.blue} -{' '}
												{record.matchInfo.final_score.red}
											</span>
											<span class="record-cell">{record.matchInfo.game_mode}</span>
											<span class="record-cell">{record.matchInfo.map ?? '-'}</span>
											<span class="record-cell">
												{record.matchInfo.game_length || '-'}
											</span>
											<span class="record-cell record-cell--chevron">
												<ChevronDown size={16} />
											</span>
										</button>

										<div
											class={`record-expanded-row${
												expandedRecordId() === record.id ? ' expanded' : ''
											}`}
										>
											<div class="expanded-details">
												<Show
													when={
														expandedRecordId() === record.id
														|| collapsingIds().has(record.id)
													}
												>
													<Show
														when={editingRecordId() === record.id}
														fallback={
															<>
																<TeamScoreboard players={record.players} />
																<div class="expanded-details__actions">
																	<span class="expanded-details__uploaded">
																		Uploaded {new Date(record.createdAt).toLocaleString()}
																	</span>
																	<button
																		type="button"
																		class="danger"
																		onClick={() => openDeleteDialog(record.id)}
																	>
																		Delete Record
																	</button>
																	<button
																		type="button"
																		class="primary"
																		onClick={() => setEditingRecordId(record.id)}
																	>
																		Edit Record
																	</button>
																</div>
															</>
														}
													>
														<EditableGameData
															initialPlayers={record.players}
															initialMatchInfo={record.matchInfo}
															onSave={(players, matchInfo) =>
																handleSaveEdits(players, matchInfo)
															}
														/>
														<div class="expanded-details__actions">
															<button
																type="button"
																onClick={() => setEditingRecordId(null)}
															>
																Cancel
															</button>
														</div>
													</Show>
												</Show>
											</div>
										</div>
									</div>
								)}
							</For>
						</div>
					</div>
				</Show>
			</Show>

			<Toaster />
			<AlertDialog openDialog={(fn) => (openDialog = fn)} />
		</Screen>
	);
};

export default GameRecordsTable;
