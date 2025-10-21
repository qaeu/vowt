import { Component, createSignal, For, Show, onMount } from 'solid-js';
import {
    loadGameRecords,
    deleteGameRecord,
    clearAllGameRecords,
    exportGameRecords,
    importGameRecords,
    type GameRecord,
} from '../utils/gameStorage';
import './GameRecordsTable.scss';

const GameRecordsTable: Component = () => {
    const [records, setRecords] = createSignal<GameRecord[]>([]);
    const [expandedRecordId, setExpandedRecordId] = createSignal<string | null>(
        null
    );

    const loadRecords = () => {
        setRecords(loadGameRecords());
    };

    onMount(() => {
        loadRecords();
    });

    const handleDelete = (id: string) => {
        if (confirm('Are you sure you want to delete this game record?')) {
            deleteGameRecord(id);
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

    const toggleExpanded = (id: string) => {
        setExpandedRecordId(expandedRecordId() === id ? null : id);
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
                                                toggleExpanded(record.id)
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
                                                    <h3>Game Details</h3>
                                                    <div class="game-info">
                                                        <strong>
                                                            Game Date:
                                                        </strong>{' '}
                                                        {record.matchInfo.date}
                                                        <br />
                                                        <strong>
                                                            Length:
                                                        </strong>{' '}
                                                        {
                                                            record.matchInfo
                                                                .game_length
                                                        }
                                                    </div>
                                                    <h4>Players</h4>
                                                    <div class="teams-grid">
                                                        <div>
                                                            <h5 class="blue-team">
                                                                Blue Team
                                                            </h5>
                                                            <table>
                                                                <thead>
                                                                    <tr>
                                                                        <th>
                                                                            Name
                                                                        </th>
                                                                        <th class="right">
                                                                            E
                                                                        </th>
                                                                        <th class="right">
                                                                            A
                                                                        </th>
                                                                        <th class="right">
                                                                            D
                                                                        </th>
                                                                        <th class="right">
                                                                            DMG
                                                                        </th>
                                                                        <th class="right">
                                                                            H
                                                                        </th>
                                                                        <th class="right">
                                                                            MIT
                                                                        </th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody>
                                                                    <For
                                                                        each={record.players.filter(
                                                                            (
                                                                                p
                                                                            ) =>
                                                                                p.team ===
                                                                                'blue'
                                                                        )}
                                                                    >
                                                                        {(
                                                                            player
                                                                        ) => (
                                                                            <tr>
                                                                                <td>
                                                                                    {
                                                                                        player.name
                                                                                    }
                                                                                </td>
                                                                                <td class="right">
                                                                                    {
                                                                                        player.e
                                                                                    }
                                                                                </td>
                                                                                <td class="right">
                                                                                    {
                                                                                        player.a
                                                                                    }
                                                                                </td>
                                                                                <td class="right">
                                                                                    {
                                                                                        player.d
                                                                                    }
                                                                                </td>
                                                                                <td class="right">
                                                                                    {
                                                                                        player.dmg
                                                                                    }
                                                                                </td>
                                                                                <td class="right">
                                                                                    {
                                                                                        player.h
                                                                                    }
                                                                                </td>
                                                                                <td class="right">
                                                                                    {
                                                                                        player.mit
                                                                                    }
                                                                                </td>
                                                                            </tr>
                                                                        )}
                                                                    </For>
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                        <div>
                                                            <h5 class="red-team">
                                                                Red Team
                                                            </h5>
                                                            <table>
                                                                <thead>
                                                                    <tr>
                                                                        <th>
                                                                            Name
                                                                        </th>
                                                                        <th class="right">
                                                                            E
                                                                        </th>
                                                                        <th class="right">
                                                                            A
                                                                        </th>
                                                                        <th class="right">
                                                                            D
                                                                        </th>
                                                                        <th class="right">
                                                                            DMG
                                                                        </th>
                                                                        <th class="right">
                                                                            H
                                                                        </th>
                                                                        <th class="right">
                                                                            MIT
                                                                        </th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody>
                                                                    <For
                                                                        each={record.players.filter(
                                                                            (
                                                                                p
                                                                            ) =>
                                                                                p.team ===
                                                                                'red'
                                                                        )}
                                                                    >
                                                                        {(
                                                                            player
                                                                        ) => (
                                                                            <tr>
                                                                                <td>
                                                                                    {
                                                                                        player.name
                                                                                    }
                                                                                </td>
                                                                                <td class="right">
                                                                                    {
                                                                                        player.e
                                                                                    }
                                                                                </td>
                                                                                <td class="right">
                                                                                    {
                                                                                        player.a
                                                                                    }
                                                                                </td>
                                                                                <td class="right">
                                                                                    {
                                                                                        player.d
                                                                                    }
                                                                                </td>
                                                                                <td class="right">
                                                                                    {
                                                                                        player.dmg
                                                                                    }
                                                                                </td>
                                                                                <td class="right">
                                                                                    {
                                                                                        player.h
                                                                                    }
                                                                                </td>
                                                                                <td class="right">
                                                                                    {
                                                                                        player.mit
                                                                                    }
                                                                                </td>
                                                                            </tr>
                                                                        )}
                                                                    </For>
                                                                </tbody>
                                                            </table>
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
        </div>
    );
};

export default GameRecordsTable;
