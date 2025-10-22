import { Component, For, Show } from 'solid-js';
import {
    PLAYER_STATS_NUMBER_FIELD_NAMES,
    PlayerStats,
    MatchInfo,
} from '#utils/gameStorage';
import '#styles/EditableGameData';

interface RecordFieldInputProps {
    value?: string;
    staticInputmode?: Readonly<'text' | 'numeric' | 'none'>;
    onInput: (value: string) => void;
}

const RecordFieldInput: Component<RecordFieldInputProps> = (props) => {
    const validityPattern =
        props.staticInputmode === 'numeric' ? '[0-9]*' : undefined;
    return (
        <input
            type="text"
            inputmode={props.staticInputmode || 'text'}
            pattern={validityPattern}
            value={props.value}
            onInput={(e) => props.onInput(e.currentTarget.value)}
            onFocus={(e) => e.target.select()}
        />
    );
};

interface TeamDataTable {
    players: PlayerStats[];
    onPlayerUpdate: <K extends keyof PlayerStats>(
        index: number,
        field: K,
        value: PlayerStats[K]
    ) => void;
}

const TeamDataTable: Component<TeamDataTable> = (props) => {
    return (
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
                <For each={props.players}>
                    {(player, index) => {
                        return (
                            <tr>
                                <td>
                                    <RecordFieldInput
                                        value={player.name}
                                        onInput={(value) =>
                                            props.onPlayerUpdate(
                                                index(),
                                                'name',
                                                value
                                            )
                                        }
                                    />
                                </td>
                                <For each={PLAYER_STATS_NUMBER_FIELD_NAMES}>
                                    {(numericField) => (
                                        <td>
                                            <RecordFieldInput
                                                value={
                                                    player[
                                                        numericField as keyof PlayerStats
                                                    ]
                                                }
                                                staticInputmode="numeric"
                                                onInput={(value) =>
                                                    props.onPlayerUpdate(
                                                        index(),
                                                        numericField as keyof PlayerStats,
                                                        value
                                                    )
                                                }
                                            />
                                        </td>
                                    )}
                                </For>
                            </tr>
                        );
                    }}
                </For>
            </tbody>
        </table>
    );
};

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
    onSave: () => void;
    onCancel: () => void;
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
                                onClick={() => props.onSave()}
                                disabled={!props.hasUnsavedChanges}
                                class="save-button"
                            >
                                💾 Save to Records
                            </button>
                            <button
                                onClick={() => props.onCancel()}
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
                        <RecordFieldInput
                            value={props.matchInfo.result}
                            onInput={(value) =>
                                props.onMatchInfoUpdate('result', value)
                            }
                        />
                    </div>
                    <div class="form-group">
                        <label>Score (Blue):</label>
                        <RecordFieldInput
                            value={props.matchInfo.final_score.blue}
                            onInput={(value) =>
                                props.onMatchInfoUpdate('final_score', {
                                    ...props.matchInfo.final_score,
                                    blue: value,
                                })
                            }
                        />
                    </div>
                    <div class="form-group">
                        <label>Score (Red):</label>
                        <RecordFieldInput
                            value={props.matchInfo.final_score.red}
                            onInput={(value) =>
                                props.onMatchInfoUpdate('final_score', {
                                    ...props.matchInfo.final_score,
                                    red: value,
                                })
                            }
                        />
                    </div>
                    <div class="form-group">
                        <label>Date:</label>
                        <RecordFieldInput
                            value={props.matchInfo.date}
                            onInput={(value) =>
                                props.onMatchInfoUpdate('date', value)
                            }
                        />
                    </div>
                    <div class="form-group">
                        <label>Game Mode:</label>
                        <RecordFieldInput
                            value={props.matchInfo.game_mode}
                            onInput={(value) =>
                                props.onMatchInfoUpdate('game_mode', value)
                            }
                        />
                    </div>
                    <div class="form-group">
                        <label>Length:</label>
                        <RecordFieldInput
                            value={props.matchInfo.game_length}
                            onInput={(value) =>
                                props.onMatchInfoUpdate('game_length', value)
                            }
                        />
                    </div>
                </div>
            </div>

            <div class="players-edit">
                <div class="team-section">
                    <h4 class="blue-team">Blue Team</h4>
                    <div class="table-wrapper">
                        <TeamDataTable
                            players={props.players.filter(
                                (player) => player.team === 'blue'
                            )}
                            onPlayerUpdate={props.onPlayerUpdate}
                        />
                    </div>
                </div>

                <div class="team-section">
                    <h4 class="red-team">Red Team</h4>
                    <div class="table-wrapper">
                        <TeamDataTable
                            players={props.players.filter(
                                (player) => player.team === 'red'
                            )}
                            onPlayerUpdate={(index, ...args) => {
                                props.onPlayerUpdate(index + 5, ...args);
                            }}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default EditableGameData;
