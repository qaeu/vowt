import type { Component } from 'solid-js';
import { createSignal, onMount, For, Show } from 'solid-js';
import { X } from 'lucide-solid';

import type {
	ScreenAction,
	AlertDialogOptions,
	GameRecord,
	PlayerStats,
	MatchInfo,
} from '#types';
import Screen from '#c/ui/Screen';
import EditableGameData from '#c/ui/EditableGameData';
import AlertDialog from '#c/ui/AlertDialog';
import Toaster, { toast } from '#c/ui/Toaster';
import * as Store from '#utils/gameStorage';

interface GameRecordsTableProps {
	onUploadClick: () => void;
}

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
	const [collapsingId, setCollapsingId] = createSignal<string | null>(null);
	const [pendingCollapseId, setPendingCollapseId] = createSignal<string | null>(null);
	const [openingId, setOpeningId] = createSignal<string | null>(null);

	let openDialog: ((options: AlertDialogOptions) => void) | null = null;

	const screenActions: ScreenAction[] = [
		{
			id: 'upload-screenshot',
			text: 'Upload Screenshot',
			onClick: () => props.onUploadClick(),
		},
		{
			id: 'export-records',
			text: 'Export Records',
			onClick: () => handleExport(),
			disabled: () => records().length === 0,
		},
		{
			id: 'import-records',
			text: 'Import Records',
			onClick: () => handleImport(),
		},
		{
			id: 'delete-all-records',
			text: 'Delete All',
			class: 'highlight',
			disabled: () => records().length === 0,
			onClick: () => {
				openDialog?.({
					title: 'Clear All Records',
					description:
						'Are you sure you want to delete all game records? This cannot be undone.',
					onConfirm: handleClearAll,
				});
			},
		},
	];

	onMount(() => {
		loadRecords();
	});

	const loadRecords = () => {
		setRecords(Store.loadGameRecords());
	};

	const openDeleteDialog = (id: string) => {
		openDialog?.({
			title: 'Delete Record',
			description: `Are you sure you want to delete this game record?`,
			onConfirm: () => handleDelete(id),
		});
	};

	const handleDeleteClick = (e: MouseEvent, id: string) => {
		e.stopPropagation();
		openDeleteDialog(id);
	};

	const handleDelete = (id: string) => {
		Store.deleteGameRecord(id);
		setExpandedRecordId(null);
		loadRecords();
		toast('Delete Success', '1 game record deleted.');
	};
	const handleClearAll = () => {
		Store.clearAllGameRecords();
		setExpandedRecordId(null);
		loadRecords();
		toast('Delete Success', 'All game records deleted.');
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
						toast('Import Success', `${count} new game record(s) created.`);
						loadRecords();
					} catch (error) {
						openDialog?.({
							title: 'Import Error',
							description: 'Error importing game records. Please check the file format.',
							actionText: 'OK',
						});
						console.error('Import error:', error);
					}
				};
				reader.readAsText(file);
			}
		};
		input.click();
	};

	const toggleExpanded = (record: GameRecord) => {
		const recordId = record.id;
		const currentExpanded = expandedRecordId();

		// If this record is already being edited, close it with animation
		if (currentExpanded === recordId) {
			setCollapsingId(recordId);
			setTimeout(() => {
				setExpandedRecordId(null);
				setCollapsingId(null);
				setOpeningId(null);
			}, 2400);
		} else {
			// Switching to a different record
			if (currentExpanded) {
				// Keep the old row in the DOM without starting its collapse yet
				setPendingCollapseId(currentExpanded);
			}
			// Open the new one (don't reload records - it breaks animation)
			setExpandedRecordId(recordId);
			// Start both animations on the same frame so they stay in sync
			requestAnimationFrame(() => {
				if (currentExpanded) {
					setCollapsingId(currentExpanded);
					setPendingCollapseId(null);
					setTimeout(() => {
						setCollapsingId(null);
					}, 2400);
				}
				setOpeningId(recordId);
			});
		}
	};

	const handleSaveEdits = (players: PlayerStats[], matchInfo: MatchInfo) => {
		const recordId = expandedRecordId();
		if (!recordId) return;

		try {
			Store.updateGameRecord(recordId, players, matchInfo);
			toast('Save Success', 'Game record updated.');
		} catch (err) {
			openDialog?.({
				title: 'Update Error',
				description: err instanceof Error ? err.message : 'Failed to update game record',
				actionText: 'OK',
			});
		}
	};

	const formatDate = (date: Date) => {
		return date.toLocaleString();
	};

	return (
		<Screen
			id="game-records-screen"
			title="Game History"
			screenActions={() => screenActions}
		>
			<Show when={!records() || records().length === 0}>
				<div class="empty-state">
					<p>No game records found</p>
					<p>To create a record, upload a fullscreen scoreboard screenshot.</p>
				</div>
			</Show>

			<Show when={records()?.length > 0}>
				<div class="records-table-wrapper">
					<table>
						<thead>
							<tr>
								<th>Date/Time</th>
								<th>Result</th>
								<th>Score</th>
								<th>Mode</th>
								<th>Map</th>
								<th class="center" />
							</tr>
						</thead>
						<tbody>
							<For each={records()}>
								{(record) => (
									<>
										<tr
											class={expandedRecordId() === record.id ? 'expanded' : ''}
											onClick={() => toggleExpanded(record)}
										>
											<td>{formatDate(record.createdAt)}</td>
											<td>
												<span
													class={`result-badge ${getClassForResult(
														record.matchInfo.result
													)}`}
												>
													{record.matchInfo.result}
												</span>
											</td>

											<td>
												{record.matchInfo.final_score.blue} -{' '}
												{record.matchInfo.final_score.red}
											</td>
											<td>{record.matchInfo.game_mode}</td>
											<td>{record.matchInfo.map ?? '-'}</td>
											<td class="center">
												<button
													type="button"
													class="delete-button"
													onClick={(e) => handleDeleteClick(e, record.id)}
												>
													<X size={14} />
												</button>
											</td>
										</tr>

										<Show
											when={
												expandedRecordId() === record.id
												|| collapsingId() === record.id
												|| pendingCollapseId() === record.id
											}
										>
											<tr class="expanded-row">
												<td colspan="7" class="expanded-details-wrapper">
													<div
														class={
															collapsingId() === record.id ? 'collapsing'
															: (
																openingId() === record.id
																|| pendingCollapseId() === record.id
															) ?
																''
															:	'opening'
														}
													>
														<div class="expanded-details">
															<div class="expanded-details-inner">
																<EditableGameData
																	initialPlayers={record.players}
																	initialMatchInfo={record.matchInfo}
																	onSave={handleSaveEdits}
																/>
															</div>
														</div>
													</div>
												</td>
											</tr>
										</Show>
									</>
								)}
							</For>
						</tbody>
					</table>
				</div>
			</Show>

			<Toaster />
			<AlertDialog openDialog={(fn) => (openDialog = fn)} />
		</Screen>
	);
};

export default GameRecordsTable;
