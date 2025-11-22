import { createSignal, mergeProps, For, Show, type Component } from 'solid-js';

import type { PlayerStats, MatchInfo } from '#types';
import { PLAYER_STATS_NUMBER_FIELD_NAMES } from '#utils/gameStorage';
import '#styles/EditableGameData';

interface RecordFieldInputProps {
    onInput: (value: string) => void;
    id: string;
    staticInputmode?: Readonly<'text' | 'numeric' | 'none'>;
    value: () => Readonly<string>;
    initialIsJustSaved: () => Readonly<boolean>;
    staticRegisterField?: (
        fieldId: string,
        isModifiedGetter: () => boolean,
        resetModified: () => void
    ) => void;
}

const defaultRecordFieldInputProps: Partial<RecordFieldInputProps> = {
    staticInputmode: 'text' as const,
};

const RecordFieldInput: Component<RecordFieldInputProps> = (_props) => {
    const props = mergeProps(
        defaultRecordFieldInputProps,
        _props
    ) as Partial<RecordFieldInputProps> & {
        onInput: (value: string) => void;
        id: string;
        value: () => string;
        initialIsJustSaved: () => boolean;
    };

    const [isModified, setIsModified] = createSignal<boolean>(false);

    // Register this field's modification state with parent during component initialization
    if (props.staticRegisterField) {
        props.staticRegisterField(
            // eslint-disable-next-line solid/reactivity
            props.id,
            // eslint-disable-next-line solid/reactivity
            () => isModified(),
            () => setIsModified(false)
        );
    }

    const validityPattern =
        props.staticInputmode === 'numeric' ? '[0-9]*' : undefined;

    const getClassName = () => {
        const classes = [];
        if (isModified()) {
            classes.push('modified');
        }
        if (props.initialIsJustSaved()) {
            classes.push('just-saved');
        }
        return classes.join(' ');
    };

    const handleInput = (
        e: InputEvent & {
            currentTarget: HTMLInputElement;
            target: HTMLInputElement;
        }
    ) => {
        const inputValue = e.currentTarget.value;
        // Compare against the baseline value to detect modifications
        if (inputValue !== props.value()) {
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
            value={props.value()}
            onInput={handleInput}
            onFocus={(e) => e.target.select()}
            class={getClassName()}
            id={props.id}
        />
    );
};

interface TeamDataTable {
    players: () => PlayerStats[];
    savedPlayers: () => PlayerStats[];
    team: PlayerStats['team'];
    isNewRecord?: boolean;
    onPlayerUpdate: <K extends keyof PlayerStats>(
        index: number,
        field: K,
        value: PlayerStats[K]
    ) => void;
    isFieldJustSaved: (fieldId: string) => boolean;
    registerField: (
        fieldId: string,
        isModifiedGetter: () => boolean,
        resetModified: () => void
    ) => void;
}

const TeamDataTable: Component<TeamDataTable> = (props) => {
    return (
        <table>
            <thead>
                <tr>
                    <th>Name</th>
                    <th>Hero</th>
                    <th>E</th>
                    <th>A</th>
                    <th>D</th>
                    <th>DMG</th>
                    <th>H</th>
                    <th>MIT</th>
                </tr>
            </thead>
            <tbody>
                <For each={props.players()}>
                    {(player, index) => (
                        <tr>
                            <td>
                                <RecordFieldInput
                                    id={`${props.team}-player-${index()}-name`}
                                    value={() =>
                                        props.savedPlayers()[index()]?.name ??
                                        ''
                                    }
                                    onInput={(value) =>
                                        props.onPlayerUpdate(
                                            index(),
                                            'name',
                                            value
                                        )
                                    }
                                    initialIsJustSaved={() =>
                                        props.isFieldJustSaved(
                                            `${
                                                props.team
                                            }-player-${index()}-name`
                                        )
                                    }
                                    staticRegisterField={props.registerField}
                                />
                            </td>
                            <td>
                                <RecordFieldInput
                                    id={`${props.team}-player-${index()}-hero`}
                                    value={() =>
                                        props.savedPlayers()[index()]?.hero ??
                                        ''
                                    }
                                    onInput={(value) =>
                                        props.onPlayerUpdate(
                                            index(),
                                            'hero',
                                            value
                                        )
                                    }
                                    initialIsJustSaved={() =>
                                        props.isFieldJustSaved(
                                            `${
                                                props.team
                                            }-player-${index()}-hero`
                                        )
                                    }
                                    staticRegisterField={props.registerField}
                                />
                            </td>
                            <For each={PLAYER_STATS_NUMBER_FIELD_NAMES}>
                                {(numericField) => (
                                    <td>
                                        <RecordFieldInput
                                            id={`${
                                                props.team
                                            }-player-${index()}-${numericField}`}
                                            value={() =>
                                                String(
                                                    props.savedPlayers()[
                                                        index()
                                                    ]?.[
                                                        numericField as keyof PlayerStats
                                                    ] ?? ''
                                                )
                                            }
                                            staticInputmode="numeric"
                                            onInput={(value) =>
                                                props.onPlayerUpdate(
                                                    index(),
                                                    numericField as keyof PlayerStats,
                                                    value
                                                )
                                            }
                                            initialIsJustSaved={() =>
                                                props.isFieldJustSaved(
                                                    `${
                                                        props.team
                                                    }-player-${index()}-${numericField}`
                                                )
                                            }
                                            staticRegisterField={
                                                props.registerField
                                            }
                                        />
                                    </td>
                                )}
                            </For>
                        </tr>
                    )}
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
    initialPlayers: PlayerStats[];
    initialMatchInfo: MatchInfo;
    showActions?: boolean;
    onSave: (players: PlayerStats[], matchInfo: MatchInfo) => void;
}

const EditableGameData: Component<EditableGameDataProps> = (props) => {
    // Track the working state
    const [editablePlayers, setEditablePlayers] = createSignal<PlayerStats[]>(
        structuredClone(props.initialPlayers)
    );
    const [editableMatchInfo, setEditableMatchInfo] = createSignal<MatchInfo>(
        structuredClone(props.initialMatchInfo)
    );

    // Track the last saved state
    const [lastSavedPlayers, setLastSavedPlayers] = createSignal<PlayerStats[]>(
        structuredClone(props.initialPlayers)
    );
    const [lastSavedMatchInfo, setLastSavedMatchInfo] = createSignal<MatchInfo>(
        structuredClone(props.initialMatchInfo)
    );

    // Track which fields are currently showing "just-saved" state
    const [justSavedFieldIds, setJustSavedFieldIds] = createSignal<Set<string>>(
        new Set()
    );

    // Registry to track all input fields' modification state and reset functions
    const [fieldRegistry, setFieldRegistry] = createSignal<
        Map<string, { isModified: () => boolean; reset: () => void }>
    >(new Map());

    const registerField = (
        fieldId: string,
        isModifiedGetter: () => boolean,
        resetModified: () => void
    ) => {
        setFieldRegistry((prev) =>
            new Map(prev).set(fieldId, {
                isModified: isModifiedGetter,
                reset: resetModified,
            })
        );
    };

    const getModifiedFieldIds = () => {
        const modified = new Set<string>();
        fieldRegistry().forEach((field, fieldId) => {
            if (field.isModified()) {
                modified.add(fieldId);
            }
        });
        return modified;
    };

    const resetAllModifiedFields = () => {
        fieldRegistry().forEach((field) => {
            field.reset();
        });
    };

    const handleSave = () => {
        props.onSave(editablePlayers(), editableMatchInfo());

        setLastSavedPlayers(structuredClone(editablePlayers()));
        setLastSavedMatchInfo({ ...editableMatchInfo() });

        const modifiedFieldIds = getModifiedFieldIds();
        resetAllModifiedFields();
        setJustSavedFieldIds(modifiedFieldIds);

        // Clear the saved state after animation completes
        setTimeout(() => {
            setJustSavedFieldIds(new Set<string>());
        }, 2000);
    };

    const handleReset = () => {
        setEditablePlayers(structuredClone(lastSavedPlayers()));
        setEditableMatchInfo({ ...lastSavedMatchInfo() });

        resetAllModifiedFields();
        setJustSavedFieldIds(new Set<string>());
    };

    const isFieldJustSaved = (fieldId: string) => {
        return justSavedFieldIds().has(fieldId);
    };

    // Derive unsaved state from fieldRegistry
    const hasUnsavedChanges = () => {
        let hasChanges = false;
        fieldRegistry().forEach((field) => {
            if (field.isModified()) {
                hasChanges = true;
            }
        });
        return hasChanges;
    };

    const updatePlayerField = <K extends keyof PlayerStats>(
        index: number,
        field: K,
        value: PlayerStats[K]
    ) => {
        // Mutate in place without triggering re-renders
        const players = editablePlayers();
        if (players[index]) {
            players[index][field] = value;
        }
    };

    const updateMatchInfoField = <K extends keyof MatchInfo>(
        field: K,
        value: MatchInfo[K]
    ) => {
        // Mutate in place without triggering re-renders
        const current = editableMatchInfo();
        current[field] = value;
    };

    return (
        <div class="editable-data-container">
            <Show when={props.showActions !== false}>
                <div class="editable-header">
                    <h2>Match Information</h2>

                    <div class="action-buttons">
                        <Show when={hasUnsavedChanges()}>
                            <button onClick={handleSave} class="save-button">
                                💾 Save to Records
                            </button>
                            <button onClick={handleReset} class="cancel-button">
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
                            id="matchinfo-result"
                            value={() => editableMatchInfo().result}
                            onInput={(value) =>
                                updateMatchInfoField('result', value)
                            }
                            initialIsJustSaved={() =>
                                isFieldJustSaved('matchinfo-result')
                            }
                            staticRegisterField={registerField}
                        />
                    </div>
                    <div class="form-group">
                        <label>Score (Blue):</label>
                        <RecordFieldInput
                            id="matchinfo-finalscore-blue"
                            value={() => editableMatchInfo().final_score.blue}
                            onInput={(value) =>
                                updateMatchInfoField('final_score', {
                                    ...editableMatchInfo().final_score,
                                    blue: value,
                                })
                            }
                            initialIsJustSaved={() =>
                                isFieldJustSaved('matchinfo-finalscore-blue')
                            }
                            staticRegisterField={registerField}
                        />
                    </div>
                    <div class="form-group">
                        <label>Score (Red):</label>
                        <RecordFieldInput
                            id="matchinfo-finalscore-red"
                            value={() => editableMatchInfo().final_score.red}
                            onInput={(value) =>
                                updateMatchInfoField('final_score', {
                                    ...editableMatchInfo().final_score,
                                    red: value,
                                })
                            }
                            initialIsJustSaved={() =>
                                isFieldJustSaved('matchinfo-finalscore-red')
                            }
                            staticRegisterField={registerField}
                        />
                    </div>
                    <div class="form-group">
                        <label>Date:</label>
                        <RecordFieldInput
                            id="matchinfo-date"
                            value={() => editableMatchInfo().date}
                            onInput={(value) =>
                                updateMatchInfoField('date', value)
                            }
                            initialIsJustSaved={() =>
                                isFieldJustSaved('matchinfo-date')
                            }
                            staticRegisterField={registerField}
                        />
                    </div>
                    <div class="form-group">
                        <label>Game Mode:</label>
                        <RecordFieldInput
                            id="matchinfo-gamemode"
                            value={() => editableMatchInfo().game_mode}
                            onInput={(value) =>
                                updateMatchInfoField('game_mode', value)
                            }
                            initialIsJustSaved={() =>
                                isFieldJustSaved('matchinfo-gamemode')
                            }
                            staticRegisterField={registerField}
                        />
                    </div>
                    <div class="form-group">
                        <label>Length:</label>
                        <RecordFieldInput
                            id="matchinfo-gamelength"
                            value={() => editableMatchInfo().game_length}
                            onInput={(value) =>
                                updateMatchInfoField('game_length', value)
                            }
                            initialIsJustSaved={() =>
                                isFieldJustSaved('matchinfo-gamelength')
                            }
                            staticRegisterField={registerField}
                        />
                    </div>
                    <div class="form-group">
                        <label>Map:</label>
                        <RecordFieldInput
                            id="matchinfo-map"
                            value={() => editableMatchInfo().map ?? ''}
                            onInput={(value) =>
                                updateMatchInfoField('map', value)
                            }
                            initialIsJustSaved={() =>
                                isFieldJustSaved('matchinfo-map')
                            }
                            staticRegisterField={registerField}
                        />
                    </div>
                </div>
            </div>

            <div class="players-edit">
                <div class="team-section">
                    <h4 class="blue-team">Blue Team</h4>
                    <div class="table-wrapper">
                        <TeamDataTable
                            players={() =>
                                editablePlayers().filter(
                                    (player) => player.team === 'blue'
                                )
                            }
                            savedPlayers={() =>
                                editablePlayers().filter(
                                    (player) => player.team === 'blue'
                                )
                            }
                            team="blue"
                            onPlayerUpdate={updatePlayerField}
                            isFieldJustSaved={isFieldJustSaved}
                            registerField={registerField}
                        />
                    </div>
                </div>

                <div class="team-section">
                    <h4 class="red-team">Red Team</h4>
                    <div class="table-wrapper">
                        <TeamDataTable
                            players={() =>
                                editablePlayers().filter(
                                    (player) => player.team === 'red'
                                )
                            }
                            savedPlayers={() =>
                                editablePlayers().filter(
                                    (player) => player.team === 'red'
                                )
                            }
                            team="red"
                            onPlayerUpdate={(index, ...args) => {
                                updatePlayerField(index + 5, ...args);
                            }}
                            isFieldJustSaved={isFieldJustSaved}
                            registerField={registerField}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default EditableGameData;
