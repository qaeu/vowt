import { Component, createSignal, For, Show, onMount } from 'solid-js';
import {
    loadGameRecords,
    deleteGameRecord,
    clearAllGameRecords,
    exportGameRecords,
    importGameRecords,
    type GameRecord,
} from '../utils/gameStorage';

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

    const toggleExpanded = (id: string) => {
        setExpandedRecordId(expandedRecordId() === id ? null : id);
    };

    const formatDate = (timestamp: number) => {
        return new Date(timestamp).toLocaleString();
    };

    return (
        <div
            style={{
                padding: '20px',
                'font-family': 'Arial, sans-serif',
                'max-width': '1400px',
                margin: '0 auto',
            }}
        >
            <h1 style={{ color: '#1976d2' }}>Stored Game Records</h1>

            <div
                style={{
                    'margin-bottom': '20px',
                    display: 'flex',
                    gap: '10px',
                    'flex-wrap': 'wrap',
                }}
            >
                <button
                    onClick={loadRecords}
                    style={{
                        padding: '10px 20px',
                        'background-color': '#1976d2',
                        color: 'white',
                        border: 'none',
                        'border-radius': '4px',
                        cursor: 'pointer',
                        'font-size': '14px',
                        'font-weight': 'bold',
                    }}
                >
                    🔄 Refresh
                </button>
                <button
                    onClick={handleExport}
                    style={{
                        padding: '10px 20px',
                        'background-color': '#4caf50',
                        color: 'white',
                        border: 'none',
                        'border-radius': '4px',
                        cursor: 'pointer',
                        'font-size': '14px',
                        'font-weight': 'bold',
                    }}
                    disabled={records().length === 0}
                >
                    📥 Export
                </button>
                <button
                    onClick={handleImport}
                    style={{
                        padding: '10px 20px',
                        'background-color': '#ff9800',
                        color: 'white',
                        border: 'none',
                        'border-radius': '4px',
                        cursor: 'pointer',
                        'font-size': '14px',
                        'font-weight': 'bold',
                    }}
                >
                    📤 Import
                </button>
                <button
                    onClick={handleClearAll}
                    style={{
                        padding: '10px 20px',
                        'background-color': '#f44336',
                        color: 'white',
                        border: 'none',
                        'border-radius': '4px',
                        cursor: 'pointer',
                        'font-size': '14px',
                        'font-weight': 'bold',
                    }}
                    disabled={records().length === 0}
                >
                    🗑️ Clear All
                </button>
            </div>

            <Show when={records().length === 0}>
                <div
                    style={{
                        padding: '40px',
                        'text-align': 'center',
                        'background-color': '#f5f5f5',
                        'border-radius': '8px',
                        color: '#666',
                    }}
                >
                    <p style={{ 'font-size': '18px', margin: '0' }}>
                        No game records found. Process a scoreboard to create your
                        first record!
                    </p>
                </div>
            </Show>

            <Show when={records().length > 0}>
                <div
                    style={{
                        'background-color': '#fff',
                        'border-radius': '8px',
                        'box-shadow': '0 2px 4px rgba(0,0,0,0.1)',
                        overflow: 'hidden',
                    }}
                >
                    <table
                        style={{
                            width: '100%',
                            'border-collapse': 'collapse',
                        }}
                    >
                        <thead>
                            <tr
                                style={{
                                    'background-color': '#1976d2',
                                    color: 'white',
                                }}
                            >
                                <th
                                    style={{
                                        padding: '12px',
                                        'text-align': 'left',
                                        'font-weight': 'bold',
                                    }}
                                >
                                    Date/Time
                                </th>
                                <th
                                    style={{
                                        padding: '12px',
                                        'text-align': 'left',
                                        'font-weight': 'bold',
                                    }}
                                >
                                    Result
                                </th>
                                <th
                                    style={{
                                        padding: '12px',
                                        'text-align': 'left',
                                        'font-weight': 'bold',
                                    }}
                                >
                                    Score
                                </th>
                                <th
                                    style={{
                                        padding: '12px',
                                        'text-align': 'left',
                                        'font-weight': 'bold',
                                    }}
                                >
                                    Mode
                                </th>
                                <th
                                    style={{
                                        padding: '12px',
                                        'text-align': 'left',
                                        'font-weight': 'bold',
                                    }}
                                >
                                    Players
                                </th>
                                <th
                                    style={{
                                        padding: '12px',
                                        'text-align': 'center',
                                        'font-weight': 'bold',
                                    }}
                                >
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            <For each={records()}>
                                {(record) => (
                                    <>
                                        <tr
                                            style={{
                                                'border-bottom': '1px solid #e0e0e0',
                                                cursor: 'pointer',
                                                'background-color':
                                                    expandedRecordId() === record.id
                                                        ? '#f5f5f5'
                                                        : 'white',
                                            }}
                                            onClick={() => toggleExpanded(record.id)}
                                        >
                                            <td style={{ padding: '12px' }}>
                                                {formatDate(record.timestamp)}
                                            </td>
                                            <td style={{ padding: '12px' }}>
                                                <span
                                                    style={{
                                                        padding: '4px 8px',
                                                        'border-radius': '4px',
                                                        'background-color':
                                                            record.matchInfo.result ===
                                                            'VICTORY'
                                                                ? '#4caf50'
                                                                : '#f44336',
                                                        color: 'white',
                                                        'font-size': '12px',
                                                        'font-weight': 'bold',
                                                    }}
                                                >
                                                    {record.matchInfo.result}
                                                </span>
                                            </td>
                                            <td style={{ padding: '12px' }}>
                                                {record.matchInfo.final_score.blue} -{' '}
                                                {record.matchInfo.final_score.red}
                                            </td>
                                            <td style={{ padding: '12px' }}>
                                                {record.matchInfo.game_mode}
                                            </td>
                                            <td style={{ padding: '12px' }}>
                                                {record.players.length}
                                            </td>
                                            <td
                                                style={{
                                                    padding: '12px',
                                                    'text-align': 'center',
                                                }}
                                            >
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleDelete(record.id);
                                                    }}
                                                    style={{
                                                        padding: '6px 12px',
                                                        'background-color': '#f44336',
                                                        color: 'white',
                                                        border: 'none',
                                                        'border-radius': '4px',
                                                        cursor: 'pointer',
                                                        'font-size': '12px',
                                                    }}
                                                >
                                                    Delete
                                                </button>
                                            </td>
                                        </tr>
                                        <Show when={expandedRecordId() === record.id}>
                                            <tr
                                                style={{
                                                    'border-bottom':
                                                        '1px solid #e0e0e0',
                                                }}
                                            >
                                                <td
                                                    colspan="6"
                                                    style={{
                                                        padding: '20px',
                                                        'background-color': '#f9f9f9',
                                                    }}
                                                >
                                                    <h3
                                                        style={{
                                                            'margin-top': '0',
                                                            color: '#424242',
                                                        }}
                                                    >
                                                        Game Details
                                                    </h3>
                                                    <div
                                                        style={{
                                                            'margin-bottom': '15px',
                                                        }}
                                                    >
                                                        <strong>Game Date:</strong>{' '}
                                                        {record.matchInfo.date}
                                                        <br />
                                                        <strong>Length:</strong>{' '}
                                                        {record.matchInfo.game_length}
                                                    </div>
                                                    <h4
                                                        style={{
                                                            color: '#424242',
                                                            'margin-bottom': '10px',
                                                        }}
                                                    >
                                                        Players
                                                    </h4>
                                                    <div
                                                        style={{
                                                            display: 'grid',
                                                            'grid-template-columns':
                                                                '1fr 1fr',
                                                            gap: '20px',
                                                        }}
                                                    >
                                                        <div>
                                                            <h5
                                                                style={{
                                                                    color: '#1976d2',
                                                                    'margin-bottom':
                                                                        '10px',
                                                                }}
                                                            >
                                                                Blue Team
                                                            </h5>
                                                            <table
                                                                style={{
                                                                    width: '100%',
                                                                    'font-size':
                                                                        '13px',
                                                                }}
                                                            >
                                                                <thead>
                                                                    <tr>
                                                                        <th
                                                                            style={{
                                                                                'text-align':
                                                                                    'left',
                                                                                padding:
                                                                                    '4px',
                                                                            }}
                                                                        >
                                                                            Name
                                                                        </th>
                                                                        <th
                                                                            style={{
                                                                                'text-align':
                                                                                    'right',
                                                                                padding:
                                                                                    '4px',
                                                                            }}
                                                                        >
                                                                            E
                                                                        </th>
                                                                        <th
                                                                            style={{
                                                                                'text-align':
                                                                                    'right',
                                                                                padding:
                                                                                    '4px',
                                                                            }}
                                                                        >
                                                                            A
                                                                        </th>
                                                                        <th
                                                                            style={{
                                                                                'text-align':
                                                                                    'right',
                                                                                padding:
                                                                                    '4px',
                                                                            }}
                                                                        >
                                                                            D
                                                                        </th>
                                                                        <th
                                                                            style={{
                                                                                'text-align':
                                                                                    'right',
                                                                                padding:
                                                                                    '4px',
                                                                            }}
                                                                        >
                                                                            DMG
                                                                        </th>
                                                                        <th
                                                                            style={{
                                                                                'text-align':
                                                                                    'right',
                                                                                padding:
                                                                                    '4px',
                                                                            }}
                                                                        >
                                                                            H
                                                                        </th>
                                                                        <th
                                                                            style={{
                                                                                'text-align':
                                                                                    'right',
                                                                                padding:
                                                                                    '4px',
                                                                            }}
                                                                        >
                                                                            MIT
                                                                        </th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody>
                                                                    <For
                                                                        each={record.players.filter(
                                                                            (p) =>
                                                                                p.team ===
                                                                                'blue'
                                                                        )}
                                                                    >
                                                                        {(player) => (
                                                                            <tr>
                                                                                <td
                                                                                    style={{
                                                                                        padding:
                                                                                            '4px',
                                                                                    }}
                                                                                >
                                                                                    {
                                                                                        player.name
                                                                                    }
                                                                                </td>
                                                                                <td
                                                                                    style={{
                                                                                        'text-align':
                                                                                            'right',
                                                                                        padding:
                                                                                            '4px',
                                                                                    }}
                                                                                >
                                                                                    {
                                                                                        player.e
                                                                                    }
                                                                                </td>
                                                                                <td
                                                                                    style={{
                                                                                        'text-align':
                                                                                            'right',
                                                                                        padding:
                                                                                            '4px',
                                                                                    }}
                                                                                >
                                                                                    {
                                                                                        player.a
                                                                                    }
                                                                                </td>
                                                                                <td
                                                                                    style={{
                                                                                        'text-align':
                                                                                            'right',
                                                                                        padding:
                                                                                            '4px',
                                                                                    }}
                                                                                >
                                                                                    {
                                                                                        player.d
                                                                                    }
                                                                                </td>
                                                                                <td
                                                                                    style={{
                                                                                        'text-align':
                                                                                            'right',
                                                                                        padding:
                                                                                            '4px',
                                                                                    }}
                                                                                >
                                                                                    {
                                                                                        player.dmg
                                                                                    }
                                                                                </td>
                                                                                <td
                                                                                    style={{
                                                                                        'text-align':
                                                                                            'right',
                                                                                        padding:
                                                                                            '4px',
                                                                                    }}
                                                                                >
                                                                                    {
                                                                                        player.h
                                                                                    }
                                                                                </td>
                                                                                <td
                                                                                    style={{
                                                                                        'text-align':
                                                                                            'right',
                                                                                        padding:
                                                                                            '4px',
                                                                                    }}
                                                                                >
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
                                                            <h5
                                                                style={{
                                                                    color: '#f44336',
                                                                    'margin-bottom':
                                                                        '10px',
                                                                }}
                                                            >
                                                                Red Team
                                                            </h5>
                                                            <table
                                                                style={{
                                                                    width: '100%',
                                                                    'font-size':
                                                                        '13px',
                                                                }}
                                                            >
                                                                <thead>
                                                                    <tr>
                                                                        <th
                                                                            style={{
                                                                                'text-align':
                                                                                    'left',
                                                                                padding:
                                                                                    '4px',
                                                                            }}
                                                                        >
                                                                            Name
                                                                        </th>
                                                                        <th
                                                                            style={{
                                                                                'text-align':
                                                                                    'right',
                                                                                padding:
                                                                                    '4px',
                                                                            }}
                                                                        >
                                                                            E
                                                                        </th>
                                                                        <th
                                                                            style={{
                                                                                'text-align':
                                                                                    'right',
                                                                                padding:
                                                                                    '4px',
                                                                            }}
                                                                        >
                                                                            A
                                                                        </th>
                                                                        <th
                                                                            style={{
                                                                                'text-align':
                                                                                    'right',
                                                                                padding:
                                                                                    '4px',
                                                                            }}
                                                                        >
                                                                            D
                                                                        </th>
                                                                        <th
                                                                            style={{
                                                                                'text-align':
                                                                                    'right',
                                                                                padding:
                                                                                    '4px',
                                                                            }}
                                                                        >
                                                                            DMG
                                                                        </th>
                                                                        <th
                                                                            style={{
                                                                                'text-align':
                                                                                    'right',
                                                                                padding:
                                                                                    '4px',
                                                                            }}
                                                                        >
                                                                            H
                                                                        </th>
                                                                        <th
                                                                            style={{
                                                                                'text-align':
                                                                                    'right',
                                                                                padding:
                                                                                    '4px',
                                                                            }}
                                                                        >
                                                                            MIT
                                                                        </th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody>
                                                                    <For
                                                                        each={record.players.filter(
                                                                            (p) =>
                                                                                p.team ===
                                                                                'red'
                                                                        )}
                                                                    >
                                                                        {(player) => (
                                                                            <tr>
                                                                                <td
                                                                                    style={{
                                                                                        padding:
                                                                                            '4px',
                                                                                    }}
                                                                                >
                                                                                    {
                                                                                        player.name
                                                                                    }
                                                                                </td>
                                                                                <td
                                                                                    style={{
                                                                                        'text-align':
                                                                                            'right',
                                                                                        padding:
                                                                                            '4px',
                                                                                    }}
                                                                                >
                                                                                    {
                                                                                        player.e
                                                                                    }
                                                                                </td>
                                                                                <td
                                                                                    style={{
                                                                                        'text-align':
                                                                                            'right',
                                                                                        padding:
                                                                                            '4px',
                                                                                    }}
                                                                                >
                                                                                    {
                                                                                        player.a
                                                                                    }
                                                                                </td>
                                                                                <td
                                                                                    style={{
                                                                                        'text-align':
                                                                                            'right',
                                                                                        padding:
                                                                                            '4px',
                                                                                    }}
                                                                                >
                                                                                    {
                                                                                        player.d
                                                                                    }
                                                                                </td>
                                                                                <td
                                                                                    style={{
                                                                                        'text-align':
                                                                                            'right',
                                                                                        padding:
                                                                                            '4px',
                                                                                    }}
                                                                                >
                                                                                    {
                                                                                        player.dmg
                                                                                    }
                                                                                </td>
                                                                                <td
                                                                                    style={{
                                                                                        'text-align':
                                                                                            'right',
                                                                                        padding:
                                                                                            '4px',
                                                                                    }}
                                                                                >
                                                                                    {
                                                                                        player.h
                                                                                    }
                                                                                </td>
                                                                                <td
                                                                                    style={{
                                                                                        'text-align':
                                                                                            'right',
                                                                                        padding:
                                                                                            '4px',
                                                                                    }}
                                                                                >
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
