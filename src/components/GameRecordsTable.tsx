import { createSignal, onMount, For, Show, type Component } from 'solid-js';

import type { GameRecord, PlayerStats, MatchInfo } from '#types';
import EditableGameData from '#c/EditableGameData';
import {
	loadGameRecords,
	deleteGameRecord,
	updateGameRecord,
	clearAllGameRecords,
	exportGameRecords,
	importGameRecords,
} from '#utils/gameStorage';
import '#styles/GameRecordsTable';

interface GameRecordsTableProps {
	onUploadClick: () => void;
}

const GameRecordsTable: Component<GameRecordsTableProps> = (props) => {
	const [records, setRecords] = createSignal<GameRecord[]>([]);
	const [expandedRecordId, setExpandedRecordId] = createSignal<string | null>(null);

	const loadRecords = () => {
		setRecords(loadGameRecords());
	};

	onMount(() => {
		loadRecords();
	});

	const handleDelete = (id: string) => {
		if (confirm('Are you sure you want to delete this game record?')) {
			deleteGameRecord(id);
			// If we're editing this record, stop editing
			if (expandedRecordId() === id) {
				setExpandedRecordId(null);
			}
			loadRecords();
		}
	};

	const handleClearAll = () => {
		if (
			confirm('Are you sure you want to delete all game records? This cannot be undone.')
		) {
			clearAllGameRecords();
			loadRecords();
		}
	};

	const handleExport = () => {
		const data = exportGameRecords();
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
						const count = importGameRecords(data);
						alert(`Successfully imported ${count} new game record(s)`);
						loadRecords();
					} catch (error) {
						alert('Error importing game records. Please check the file format.');
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
		// If this record is already being edited, close it
		if (expandedRecordId() === recordId) {
			setExpandedRecordId(null);
		} else {
			// Otherwise, open it for editing
			loadRecords();
			setExpandedRecordId(recordId);
		}
	};

	const handleSaveEdits = (players: PlayerStats[], matchInfo: MatchInfo) => {
		const recordId = expandedRecordId();
		if (!recordId) return;

		try {
			updateGameRecord(recordId, players, matchInfo);
		} catch (err) {
			alert(err instanceof Error ? err.message : 'Failed to update game record');
		}
	};

	const formatDate = (date: Date) => {
		return date.toLocaleString();
	};

	return (
		<div class="records-container">
			<header>
				<h1>Game History</h1>
			</header>

			<div class="button-group">
				<button onClick={() => props.onUploadClick()} class="primary">
					Upload Image
				</button>
				<button onClick={handleExport} class="primary" disabled={!records()}>
					Export
				</button>
				<button onClick={handleImport} class="primary">
					Import
				</button>
				<button onClick={handleClearAll} class="danger" disabled={!records()}>
					Clear All
				</button>
			</div>

			<Show when={!records() || records().length === 0}>
				<div class="empty-state">
					<p>No game records found. Process a scoreboard to create your first record!</p>
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
													class={`result-badge ${
														record.matchInfo.result === 'VICTORY' ? 'victory' : 'defeat'
													}`}
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
													onClick={(e) => {
														e.stopPropagation();
														handleDelete(record.id);
													}}
													class="delete-button"
													title="Delete record"
												>
													x
												</button>
											</td>
										</tr>
										<Show when={expandedRecordId() === record.id}>
											<tr>
												<td colspan="7" class="expanded-details">
													<EditableGameData
														initialPlayers={record.players}
														initialMatchInfo={record.matchInfo}
														onSave={handleSaveEdits}
													/>
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
		</div>
	);
};

export default GameRecordsTable;
