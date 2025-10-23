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
    isModified?: boolean;
    isJustSaved?: boolean;
}

const RecordFieldInput: Component<RecordFieldInputProps> = (props) => {
    const validityPattern =
        props.staticInputmode === 'numeric' ? '[0-9]*' : undefined;
    
    const getClassName = () => {
        const classes = [];
        if (props.isModified) classes.push('modified');
        if (props.isJustSaved) classes.push('just-saved');
        return classes.join(' ');
    };
    
    return (
        <input
            type="text"
            inputmode={props.staticInputmode || 'text'}
            pattern={validityPattern}
            value={props.value}
            onInput={(e) => props.onInput(e.currentTarget.value)}
            onFocus={(e) => e.target.select()}
            class={getClassName()}
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
    modifiedFields: Set<string>;
    justSavedFields: Set<string>;
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
                        const fieldKey = (field: string) => `${index()}:${field}`;
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
                                        isModified={props.modifiedFields.has(fieldKey('name'))}
                                        isJustSaved={props.justSavedFields.has(fieldKey('name'))}
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
                                                isModified={props.modifiedFields.has(fieldKey(numericField))}
                                                isJustSaved={props.justSavedFields.has(fieldKey(numericField))}
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

type ModifiedFields = {
    players: Set<string>; // Format: "playerIndex:fieldName"
    matchInfo: Set<keyof MatchInfo>; // Field names like 'result', 'date', etc.
};

interface EditableGameDataProps {
    players: PlayerStats[];
    matchInfo: MatchInfo;
    modifiedFields?: ModifiedFields;
    justSavedFields?: ModifiedFields;
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
    const hasUnsavedChanges = () => {
        const modified = props.modifiedFields;
        return modified ? (modified.players.size > 0 || modified.matchInfo.size > 0) : false;
    };
    
    return (
        <div class="editable-data-container">
            <Show when={props.showActions !== false}>
                <div class="editable-header">
                    <h2>Match Information</h2>

                    <div class="action-buttons">
                        <Show when={hasUnsavedChanges()}>
                            <button
                                onClick={() => props.onSave?.()}
                                class="save-button"
                            >
                                💾 Save to Records
                            </button>
                            <button
                                onClick={() => props.onCancel?.()}
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
                            isModified={props.modifiedFields?.matchInfo.has('result')}
                            isJustSaved={props.justSavedFields?.matchInfo.has('result')}
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
                            isModified={props.modifiedFields?.matchInfo.has('final_score')}
                            isJustSaved={props.justSavedFields?.matchInfo.has('final_score')}
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
                            isModified={props.modifiedFields?.matchInfo.has('final_score')}
                            isJustSaved={props.justSavedFields?.matchInfo.has('final_score')}
                        />
                    </div>
                    <div class="form-group">
                        <label>Date:</label>
                        <RecordFieldInput
                            value={props.matchInfo.date}
                            onInput={(value) =>
                                props.onMatchInfoUpdate('date', value)
                            }
                            isModified={props.modifiedFields?.matchInfo.has('date')}
                            isJustSaved={props.justSavedFields?.matchInfo.has('date')}
                        />
                    </div>
                    <div class="form-group">
                        <label>Game Mode:</label>
                        <RecordFieldInput
                            value={props.matchInfo.game_mode}
                            onInput={(value) =>
                                props.onMatchInfoUpdate('game_mode', value)
                            }
                            isModified={props.modifiedFields?.matchInfo.has('game_mode')}
                            isJustSaved={props.justSavedFields?.matchInfo.has('game_mode')}
                        />
                    </div>
                    <div class="form-group">
                        <label>Length:</label>
                        <RecordFieldInput
                            value={props.matchInfo.game_length}
                            onInput={(value) =>
                                props.onMatchInfoUpdate('game_length', value)
                            }
                            isModified={props.modifiedFields?.matchInfo.has('game_length')}
                            isJustSaved={props.justSavedFields?.matchInfo.has('game_length')}
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
                            modifiedFields={props.modifiedFields?.players || new Set()}
                            justSavedFields={props.justSavedFields?.players || new Set()}
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
                            modifiedFields={props.modifiedFields?.players || new Set()}
                            justSavedFields={props.justSavedFields?.players || new Set()}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default EditableGameData;
