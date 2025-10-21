import { Component, createSignal, For, Show, onMount } from 'solid-js';
import {
    loadGameRecords,
    deleteGameRecord,
    updateGameRecord,
    clearAllGameRecords,
    exportGameRecords,
    importGameRecords,
    type GameRecord,
    type PlayerStats,
    type MatchInfo,
} from '../utils/gameStorage';
import EditableGameData from './EditableGameData';
import './GameRecordsTable.scss';

const GameRecordsTable: Component = () => {
    const [records, setRecords] = createSignal<GameRecord[]>([]);
    const [expandedRecordId, setExpandedRecordId] = createSignal<string | null>(
        null
    );
    const [editablePlayers, setEditablePlayers] = createSignal<PlayerStats[]>(
        []
    );
    const [editableMatchInfo, setEditableMatchInfo] = createSignal<MatchInfo>({
        result: '',
        final_score: { blue: '', red: '' },
        date: '',
        game_mode: '',
        game_length: '',
    });
    const [hasUnsavedChanges, setHasUnsavedChanges] = createSignal(false);
    const [saveSuccess, setSaveSuccess] = createSignal(false);

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
                setHasUnsavedChanges(false);
            }
            // If this record is expanded, collapse it
            if (expandedRecordId() === id) {
                setExpandedRecordId(null);
            }
            loadRecords();
        }
    };

    const handleClearAll = () => {
        if (
            confirm(
                'Are you sure you want to delete all game records? This cannot be undone.'
            )
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
                        alert(
                            `Successfully imported ${count} new game record(s)`
                        );
                        loadRecords();
                    } catch (error) {
                        alert(
                            'Error importing game records. Please check the file format.'
                        );
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
            setHasUnsavedChanges(false);
            setSaveSuccess(false);
        } else {
            // Otherwise, open it for editing
            setExpandedRecordId(recordId);
            setEditablePlayers(structuredClone(record.players));
            setEditableMatchInfo({ ...record.matchInfo });
            setHasUnsavedChanges(false);
            setSaveSuccess(false);
        }
    };

    const handleCancelEdit = () => {
        setExpandedRecordId(null);
        setHasUnsavedChanges(false);
        setSaveSuccess(false);
    };

    const handleSaveEdit = () => {
        const recordId = expandedRecordId();
        if (!recordId) return;

        try {
            updateGameRecord(recordId, editablePlayers(), editableMatchInfo());
            setHasUnsavedChanges(false);
            setSaveSuccess(true);
            // Reload records to show updated data
            loadRecords();
            // Clear success message after 3 seconds and close edit mode
            setTimeout(() => {
                setSaveSuccess(false);
                setExpandedRecordId(null);
            }, 3000);
        } catch (err) {
            alert(
                err instanceof Error
                    ? err.message
                    : 'Failed to update game record'
            );
        }
    };

    const updatePlayerField = <K extends keyof PlayerStats>(
        index: number,
        field: K,
        value: PlayerStats[K]
    ) => {
        const players = editablePlayers();
        if (players[index]) {
            setEditablePlayers((cur) => {
                cur[index] = { ...cur[index], [field]: value };
                return cur;
            });
            setHasUnsavedChanges(true);
            setSaveSuccess(false);
        }
    };

    const updateMatchInfoField = <K extends keyof MatchInfo>(
        field: K,
        value: MatchInfo[K]
    ) => {
        setEditableMatchInfo((cur) => {
            cur[field] = value;
            return cur;
        });
        setHasUnsavedChanges(true);
        setSaveSuccess(false);
    };

    const formatDate = (timestamp: number) => {
        return new Date(timestamp).toLocaleString();
    };

    return (
        <div class="records-container">
            <h1 class="records-title">Stored Game Records</h1>

            <div class="button-group">
                <button onClick={loadRecords} class="primary">
                    🔄 Refresh
                </button>
                <button
                    onClick={handleExport}
                    class="success"
                    disabled={records().length === 0}
                >
                    📥 Export
                </button>
                <button onClick={handleImport} class="warning">
                    📤 Import
                </button>
                <button
                    onClick={handleClearAll}
                    class="danger"
                    disabled={records().length === 0}
                >
                    🗑️ Clear All
                </button>
            </div>

            <Show when={records().length === 0}>
                <div class="empty-state">
                    <p>
                        No game records found. Process a scoreboard to create
                        your first record!
                    </p>
                </div>
            </Show>

            <Show when={records().length > 0}>
                <div class="records-table-wrapper">
                    <table>
                        <thead>
                            <tr>
                                <th>Date/Time</th>
                                <th>Result</th>
                                <th>Score</th>
                                <th>Mode</th>
                                <th>Players</th>
                                <th class="center">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            <For each={records()}>
                                {(record) => (
                                    <>
                                        <tr
                                            class={
                                                expandedRecordId() === record.id
                                                    ? 'expanded'
                                                    : ''
                                            }
                                            onClick={() =>
                                                toggleExpanded(record)
                                            }
                                        >
                                            <td>
                                                {formatDate(record.timestamp)}
                                            </td>
                                            <td>
                                                <span
                                                    class={`result-badge ${
                                                        record.matchInfo
                                                            .result ===
                                                        'VICTORY'
                                                            ? 'victory'
                                                            : 'defeat'
                                                    }`}
                                                >
                                                    {record.matchInfo.result}
                                                </span>
                                            </td>
                                            <td>
                                                {
                                                    record.matchInfo.final_score
                                                        .blue
                                                }{' '}
                                                -{' '}
                                                {
                                                    record.matchInfo.final_score
                                                        .red
                                                }
                                            </td>
                                            <td>
                                                {record.matchInfo.game_mode}
                                            </td>
                                            <td>{record.players.length}</td>
                                            <td class="center">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleDelete(record.id);
                                                    }}
                                                    class="delete-button"
                                                >
                                                    Delete
                                                </button>
                                            </td>
                                        </tr>
                                        <Show
                                            when={
                                                expandedRecordId() === record.id
                                            }
                                        >
                                            <tr>
                                                <td
                                                    colspan="6"
                                                    class="expanded-details"
                                                >
                                                    <EditableGameData
                                                        players={editablePlayers()}
                                                        matchInfo={editableMatchInfo()}
                                                        hasUnsavedChanges={hasUnsavedChanges()}
                                                        saveSuccess={saveSuccess()}
                                                        onPlayerUpdate={
                                                            updatePlayerField
                                                        }
                                                        onMatchInfoUpdate={
                                                            updateMatchInfoField
                                                        }
                                                        onSave={handleSaveEdit}
                                                        onCancel={
                                                            handleCancelEdit
                                                        }
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
