import { Component, For, Show, createSignal, mergeProps } from 'solid-js';
import {
    PLAYER_STATS_NUMBER_FIELD_NAMES,
    PlayerStats,
    MatchInfo,
} from '#utils/gameStorage';
import '#styles/EditableGameData';

interface RecordFieldInputProps {
    onInput: (value: string) => void;
    staticInputmode?: Readonly<'text' | 'numeric' | 'none'>;
    initialValue?: Readonly<string>;
    isJustSaved?: boolean;
}

const defaultRecordFieldInputProps: Partial<RecordFieldInputProps> = {
    staticInputmode: 'text' as const,
    initialValue: '',
    isJustSaved: false,
};

const RecordFieldInput: Component<RecordFieldInputProps> = (_props) => {
    const props = mergeProps(
        defaultRecordFieldInputProps,
        _props
    ) as Required<RecordFieldInputProps>;

    const [isModified, setIsModified] = createSignal<boolean>(false);

    const validityPattern =
        props.staticInputmode === 'numeric' ? '[0-9]*' : undefined;

    const getClassName = () => {
        const classes = [];
        if (isModified()) classes.push('modified');
        if (props.isJustSaved) classes.push('just-saved');
        return classes.join(' ');
    };

    const handleInput = (
        e: InputEvent & {
            currentTarget: HTMLInputElement;
            target: HTMLInputElement;
        }
    ) => {
        const inputValue = e.currentTarget.value;
        if (inputValue !== props.initialValue) {
            setIsModified(true);
        } else {
            setIsModified(false);
        }
        props.onInput(inputValue);
    };

    return (
        <input
            type="text"
            inputmode={props.staticInputmode || 'text'}
            pattern={validityPattern}
            value={props.initialValue}
            onInput={handleInput}
            onFocus={(e) => e.target.select()}
            class={getClassName()}
        />
    );
};

interface TeamDataTable {
    players: PlayerStats[];
    isNewRecord?: boolean;
    justSavedFields: Set<string>;
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
                        const fieldKey = (field: string) =>
                            `${index()}:${field}`;
                        return (
                            <tr>
                                <td>
                                    <RecordFieldInput
                                        initialValue={player.name}
                                        onInput={(value) =>
                                            props.onPlayerUpdate(
                                                index(),
                                                'name',
                                                value
                                            )
                                        }
                                        isJustSaved={props.justSavedFields.has(
                                            fieldKey('name')
                                        )}
                                    />
                                </td>
                                <For each={PLAYER_STATS_NUMBER_FIELD_NAMES}>
                                    {(numericField) => (
                                        <td>
                                            <RecordFieldInput
                                                initialValue={
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
                                                isJustSaved={props.justSavedFields.has(
                                                    fieldKey(numericField)
                                                )}
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

export interface ModifiedFields {
    players: Set<string>; // Format: "playerIndex:fieldName"
    matchInfo: Set<keyof MatchInfo>; // Field names like 'result', 'date', etc.
}

interface EditableGameDataProps {
    players: PlayerStats[];
    matchInfo: MatchInfo;
    justSavedFields: ModifiedFields;
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
    let containerRef!: HTMLDivElement;

    const [hasUnsavedChanges, setHasUnsavedChanges] = createSignal(false);

    const inputModified = () => {
        const modifiedFields = containerRef.querySelectorAll('input.modified');
        setHasUnsavedChanges(modifiedFields.length > 0);
    };

    const onPlayerUpdate: typeof props.onPlayerUpdate = (...args) => {
        inputModified();
        props.onPlayerUpdate(...args);
    };

    const onMatchInfoUpdate: typeof props.onMatchInfoUpdate = (...args) => {
        inputModified();
        props.onMatchInfoUpdate(...args);
    };

    return (
        <div class="editable-data-container" ref={containerRef}>
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
                            initialValue={props.matchInfo.result}
                            onInput={(value) =>
                                onMatchInfoUpdate('result', value)
                            }
                            isJustSaved={props.justSavedFields.matchInfo.has(
                                'result'
                            )}
                        />
                    </div>
                    <div class="form-group">
                        <label>Score (Blue):</label>
                        <RecordFieldInput
                            initialValue={props.matchInfo.final_score.blue}
                            onInput={(value) =>
                                onMatchInfoUpdate('final_score', {
                                    ...props.matchInfo.final_score,
                                    blue: value,
                                })
                            }
                            isJustSaved={props.justSavedFields.matchInfo.has(
                                'final_score'
                            )}
                        />
                    </div>
                    <div class="form-group">
                        <label>Score (Red):</label>
                        <RecordFieldInput
                            initialValue={props.matchInfo.final_score.red}
                            onInput={(value) =>
                                onMatchInfoUpdate('final_score', {
                                    ...props.matchInfo.final_score,
                                    red: value,
                                })
                            }
                            isJustSaved={props.justSavedFields.matchInfo.has(
                                'final_score'
                            )}
                        />
                    </div>
                    <div class="form-group">
                        <label>Date:</label>
                        <RecordFieldInput
                            initialValue={props.matchInfo.date}
                            onInput={(value) =>
                                onMatchInfoUpdate('date', value)
                            }
                            isJustSaved={props.justSavedFields.matchInfo.has(
                                'date'
                            )}
                        />
                    </div>
                    <div class="form-group">
                        <label>Game Mode:</label>
                        <RecordFieldInput
                            initialValue={props.matchInfo.game_mode}
                            onInput={(value) =>
                                onMatchInfoUpdate('game_mode', value)
                            }
                            isJustSaved={props.justSavedFields.matchInfo.has(
                                'game_mode'
                            )}
                        />
                    </div>
                    <div class="form-group">
                        <label>Length:</label>
                        <RecordFieldInput
                            initialValue={props.matchInfo.game_length}
                            onInput={(value) =>
                                onMatchInfoUpdate('game_length', value)
                            }
                            isJustSaved={props.justSavedFields.matchInfo.has(
                                'game_length'
                            )}
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
                            justSavedFields={props.justSavedFields.players}
                            onPlayerUpdate={onPlayerUpdate}
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
                            justSavedFields={props.justSavedFields.players}
                            onPlayerUpdate={(index, ...args) => {
                                onPlayerUpdate(index + 5, ...args);
                            }}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default EditableGameData;
