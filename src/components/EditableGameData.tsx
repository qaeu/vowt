import { Component, For, Show } from 'solid-js';
import { PlayerStats, MatchInfo } from '#utils/gameStorage';
import '#styles/EditableGameData';

interface EditableGameDataProps {
    players: PlayerStats[];
    matchInfo: MatchInfo;
    hasUnsavedChanges?: boolean;
    saveSuccess?: boolean;
    showActions?: boolean;
    onPlayerUpdate: <K extends keyof PlayerStats>(
        index: number,
        field: K,
        value: PlayerStats[K]
    ) => void;
    onMatchInfoUpdate: <K extends keyof MatchInfo>(
        field: K,
        value: MatchInfo[K]
    ) => void;
    onSave?: () => void;
    onCancel?: () => void;
}

const EditableGameData: Component<EditableGameDataProps> = (props) => {
    return (
        <div class="editable-data-container">
            <Show when={props.showActions !== false}>
                <div class="editable-header">
                    <h2>Match Information</h2>

                    <Show when={props.saveSuccess}>
                        <div class="success-message">
                            ✓ Game record saved successfully!
                        </div>
                    </Show>
                    <Show when={props.hasUnsavedChanges}>
                        <div class="unsaved-message">
                            ⚠ You have unsaved changes
                        </div>
                    </Show>

                    <div class="action-buttons">
                        <Show when={props.hasUnsavedChanges}>
                            <button
                                onClick={props.onSave}
                                disabled={!props.hasUnsavedChanges}
                                class="save-button"
                            >
                                💾 Save to Records
                            </button>
                            <button
                                onClick={props.onCancel}
                                disabled={!props.hasUnsavedChanges}
                                class="cancel-button"
                            >
                                ↺ Reset Changes
                            </button>
                        </Show>
                    </div>
                </div>
            </Show>

            <div class="match-info-edit">
                <div class="form-grid">
                    <div class="form-group">
                        <label>Result:</label>
                        <input
                            type="text"
                            value={props.matchInfo.result}
                            onInput={(e) =>
                                props.onMatchInfoUpdate(
                                    'result',
                                    e.currentTarget.value
                                )
                            }
                        />
                    </div>
                    <div class="form-group">
                        <label>Score (Blue):</label>
                        <input
                            type="text"
                            value={props.matchInfo.final_score.blue}
                            onInput={(e) =>
                                props.onMatchInfoUpdate('final_score', {
                                    ...props.matchInfo.final_score,
                                    blue: e.currentTarget.value,
                                })
                            }
                        />
                    </div>
                    <div class="form-group">
                        <label>Score (Red):</label>
                        <input
                            type="text"
                            value={props.matchInfo.final_score.red}
                            onInput={(e) =>
                                props.onMatchInfoUpdate('final_score', {
                                    ...props.matchInfo.final_score,
                                    red: e.currentTarget.value,
                                })
                            }
                        />
                    </div>
                    <div class="form-group">
                        <label>Date:</label>
                        <input
                            type="text"
                            value={props.matchInfo.date}
                            onInput={(e) =>
                                props.onMatchInfoUpdate(
                                    'date',
                                    e.currentTarget.value
                                )
                            }
                        />
                    </div>
                    <div class="form-group">
                        <label>Game Mode:</label>
                        <input
                            type="text"
                            value={props.matchInfo.game_mode}
                            onInput={(e) =>
                                props.onMatchInfoUpdate(
                                    'game_mode',
                                    e.currentTarget.value
                                )
                            }
                        />
                    </div>
                    <div class="form-group">
                        <label>Length:</label>
                        <input
                            type="text"
                            value={props.matchInfo.game_length}
                            onInput={(e) =>
                                props.onMatchInfoUpdate(
                                    'game_length',
                                    e.currentTarget.value
                                )
                            }
                        />
                    </div>
                </div>
            </div>

            <div class="players-edit">
                <div class="teams-container">
                    <div class="team-section">
                        <h4 class="blue-team">Blue Team</h4>
                        <div class="table-wrapper">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Name</th>
                                        <th>E</th>
                                        <th>A</th>
                                        <th>D</th>
                                        <th>DMG</th>
                                        <th>H</th>
                                        <th>MIT</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <For
                                        each={props.players.filter(
                                            (p) => p.team === 'blue'
                                        )}
                                    >
                                        {(player) => {
                                            const globalIndex =
                                                props.players.indexOf(player);
                                            return (
                                                <tr>
                                                    <td>
                                                        <input
                                                            type="text"
                                                            value={player.name}
                                                            onInput={(e) =>
                                                                props.onPlayerUpdate(
                                                                    globalIndex,
                                                                    'name',
                                                                    e
                                                                        .currentTarget
                                                                        .value
                                                                )
                                                            }
                                                        />
                                                    </td>
                                                    <td>
                                                        <input
                                                            type="text"
                                                            inputmode="numeric"
                                                            pattern="[0-9]*"
                                                            value={player.e}
                                                            onInput={(e) =>
                                                                props.onPlayerUpdate(
                                                                    globalIndex,
                                                                    'e',
                                                                    e
                                                                        .currentTarget
                                                                        .value
                                                                )
                                                            }
                                                        />
                                                    </td>
                                                    <td>
                                                        <input
                                                            type="text"
                                                            inputmode="numeric"
                                                            pattern="[0-9]*"
                                                            value={player.a}
                                                            onInput={(e) =>
                                                                props.onPlayerUpdate(
                                                                    globalIndex,
                                                                    'a',
                                                                    e
                                                                        .currentTarget
                                                                        .value
                                                                )
                                                            }
                                                        />
                                                    </td>
                                                    <td>
                                                        <input
                                                            type="text"
                                                            inputmode="numeric"
                                                            pattern="[0-9]*"
                                                            value={player.d}
                                                            onInput={(e) =>
                                                                props.onPlayerUpdate(
                                                                    globalIndex,
                                                                    'd',
                                                                    e
                                                                        .currentTarget
                                                                        .value
                                                                )
                                                            }
                                                        />
                                                    </td>
                                                    <td>
                                                        <input
                                                            type="text"
                                                            inputmode="numeric"
                                                            pattern="[0-9]*"
                                                            value={player.dmg}
                                                            onInput={(e) =>
                                                                props.onPlayerUpdate(
                                                                    globalIndex,
                                                                    'dmg',
                                                                    e
                                                                        .currentTarget
                                                                        .value
                                                                )
                                                            }
                                                        />
                                                    </td>
                                                    <td>
                                                        <input
                                                            type="text"
                                                            inputmode="numeric"
                                                            pattern="[0-9]*"
                                                            value={player.h}
                                                            onInput={(e) =>
                                                                props.onPlayerUpdate(
                                                                    globalIndex,
                                                                    'h',
                                                                    e
                                                                        .currentTarget
                                                                        .value
                                                                )
                                                            }
                                                        />
                                                    </td>
                                                    <td>
                                                        <input
                                                            type="text"
                                                            inputmode="numeric"
                                                            pattern="[0-9]*"
                                                            value={player.mit}
                                                            onInput={(e) =>
                                                                props.onPlayerUpdate(
                                                                    globalIndex,
                                                                    'mit',
                                                                    e
                                                                        .currentTarget
                                                                        .value
                                                                )
                                                            }
                                                        />
                                                    </td>
                                                </tr>
                                            );
                                        }}
                                    </For>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div class="team-section">
                        <h4 class="red-team">Red Team</h4>
                        <div class="table-wrapper">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Name</th>
                                        <th>E</th>
                                        <th>A</th>
                                        <th>D</th>
                                        <th>DMG</th>
                                        <th>H</th>
                                        <th>MIT</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <For
                                        each={props.players.filter(
                                            (p) => p.team === 'red'
                                        )}
                                    >
                                        {(player) => {
                                            const globalIndex =
                                                props.players.indexOf(player);
                                            return (
                                                <tr>
                                                    <td>
                                                        <input
                                                            type="text"
                                                            value={player.name}
                                                            onInput={(e) =>
                                                                props.onPlayerUpdate(
                                                                    globalIndex,
                                                                    'name',
                                                                    e
                                                                        .currentTarget
                                                                        .value
                                                                )
                                                            }
                                                        />
                                                    </td>
                                                    <td>
                                                        <input
                                                            type="text"
                                                            inputmode="numeric"
                                                            pattern="[0-9]*"
                                                            value={player.e}
                                                            onInput={(e) =>
                                                                props.onPlayerUpdate(
                                                                    globalIndex,
                                                                    'e',
                                                                    e
                                                                        .currentTarget
                                                                        .value
                                                                )
                                                            }
                                                        />
                                                    </td>
                                                    <td>
                                                        <input
                                                            type="text"
                                                            inputmode="numeric"
                                                            pattern="[0-9]*"
                                                            value={player.a}
                                                            onInput={(e) =>
                                                                props.onPlayerUpdate(
                                                                    globalIndex,
                                                                    'a',
                                                                    e
                                                                        .currentTarget
                                                                        .value
                                                                )
                                                            }
                                                        />
                                                    </td>
                                                    <td>
                                                        <input
                                                            type="text"
                                                            inputmode="numeric"
                                                            pattern="[0-9]*"
                                                            value={player.d}
                                                            onInput={(e) =>
                                                                props.onPlayerUpdate(
                                                                    globalIndex,
                                                                    'd',
                                                                    e
                                                                        .currentTarget
                                                                        .value
                                                                )
                                                            }
                                                        />
                                                    </td>
                                                    <td>
                                                        <input
                                                            type="text"
                                                            inputmode="numeric"
                                                            pattern="[0-9]*"
                                                            value={player.dmg}
                                                            onInput={(e) =>
                                                                props.onPlayerUpdate(
                                                                    globalIndex,
                                                                    'dmg',
                                                                    e
                                                                        .currentTarget
                                                                        .value
                                                                )
                                                            }
                                                        />
                                                    </td>
                                                    <td>
                                                        <input
                                                            type="text"
                                                            inputmode="numeric"
                                                            pattern="[0-9]*"
                                                            value={player.h}
                                                            onInput={(e) =>
                                                                props.onPlayerUpdate(
                                                                    globalIndex,
                                                                    'h',
                                                                    e
                                                                        .currentTarget
                                                                        .value
                                                                )
                                                            }
                                                        />
                                                    </td>
                                                    <td>
                                                        <input
                                                            type="text"
                                                            inputmode="numeric"
                                                            pattern="[0-9]*"
                                                            value={player.mit}
                                                            onInput={(e) =>
                                                                props.onPlayerUpdate(
                                                                    globalIndex,
                                                                    'mit',
                                                                    e
                                                                        .currentTarget
                                                                        .value
                                                                )
                                                            }
                                                        />
                                                    </td>
                                                </tr>
                                            );
                                        }}
                                    </For>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default EditableGameData;
