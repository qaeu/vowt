import type { Component } from 'solid-js';
import { createSignal, onMount, For, Show, batch } from 'solid-js';
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
	const [collapsingIds, setCollapsingIds] = createSignal<Set<string>>(new Set());

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
				setTimeout(() => removeFromCollapsing(currentExpanded), 240);
				setCollapsingIds((prev) => new Set([...prev, currentExpanded]));
			}
			setExpandedRecordId(currentExpanded === recordId ? null : recordId);
		});
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
					<div class="records-list" role="table">
						<div class="records-header" role="row">
							<div role="columnheader">Date/Time</div>
							<div role="columnheader">Result</div>
							<div role="columnheader">Score</div>
							<div role="columnheader">Mode</div>
							<div role="columnheader">Map</div>
							<div class="center" role="columnheader" />
						</div>
						<For each={records()}>
							{(record) => (
								<div
									class={`record-group${expandedRecordId() === record.id ? ' expanded' : ''}`}
								>
									<div
										class="record-row"
										role="row"
										onClick={() => toggleExpanded(record)}
									>
										<div class="record-cell" role="cell">
											{formatDate(record.createdAt)}
										</div>
										<div class="record-cell" role="cell">
											<span
												class={`result-badge ${getClassForResult(
													record.matchInfo.result
												)}`}
											>
												{record.matchInfo.result}
											</span>
										</div>
										<div class="record-cell" role="cell">
											{record.matchInfo.final_score.blue} -{' '}
											{record.matchInfo.final_score.red}
										</div>
										<div class="record-cell" role="cell">
											{record.matchInfo.game_mode}
										</div>
										<div class="record-cell" role="cell">
											{record.matchInfo.map ?? '-'}
										</div>
										<div class="record-cell center" role="cell">
											<button
												type="button"
												class="delete-button"
												onClick={(e) => handleDeleteClick(e, record.id)}
											>
												<X size={14} />
											</button>
										</div>
									</div>

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
												<EditableGameData
													initialPlayers={record.players}
													initialMatchInfo={record.matchInfo}
													onSave={(players, matchInfo) =>
														handleSaveEdits(players, matchInfo)
													}
												/>
											</Show>
										</div>
									</div>
								</div>
							)}
						</For>
					</div>
				</div>
			</Show>

			<Toaster />
			<AlertDialog openDialog={(fn) => (openDialog = fn)} />
		</Screen>
	);
};

export default GameRecordsTable;
