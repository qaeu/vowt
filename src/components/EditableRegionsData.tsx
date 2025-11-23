import { createSignal, createEffect, createMemo, Index, Show, type Component } from 'solid-js';

import type { TextRegion } from '#types';
import '#styles/EditableRegionsData';

interface RegionFieldInputProps {
    onInput: (value: string) => void;
    id: string;
    staticInputmode?: Readonly<'text' | 'numeric' | 'none'>;
    value: () => Readonly<string>;
    baseline: () => Readonly<string>; // For comparison to detect modifications
    initialIsJustSaved: () => Readonly<boolean>;
    staticRegisterField?: (
        fieldId: string,
        isModifiedGetter: () => boolean,
        resetModified: () => void
    ) => void;
}

const defaultRegionFieldInputProps: Partial<RegionFieldInputProps> = {
    staticInputmode: 'text' as const,
};

const RegionFieldInput: Component<RegionFieldInputProps> = (_props) => {
    const props = {
        ...defaultRegionFieldInputProps,
        ..._props,
    } as Partial<RegionFieldInputProps> & {
        onInput: (value: string) => void;
        id: string;
        value: () => string;
        baseline: () => string;
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
        if (inputValue !== props.baseline()) {
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

interface EditableRegionsDataProps {
    initialRegions: TextRegion[];
    onSave: (regions: TextRegion[]) => void;
    onCancel?: () => void;
}

const EditableRegionsData: Component<EditableRegionsDataProps> = (props) => {
    // Track the working state
    const [editableRegions, setEditableRegions] = createSignal<TextRegion[]>(
        structuredClone(props.initialRegions)
    );

    // Track the last saved state
    const [lastSavedRegions, setLastSavedRegions] = createSignal<TextRegion[]>(
        structuredClone(props.initialRegions)
    );

    // Track which fields are currently showing "just-saved" state
    const [justSavedFieldIds, setJustSavedFieldIds] = createSignal<Set<string>>(
        new Set()
    );

    // Registry to track all input fields' modification state and reset functions
    const [fieldRegistry, setFieldRegistry] = createSignal<
        Map<string, { isModified: () => boolean; reset: () => void }>
    >(new Map());

    // Sync with parent when initialRegions changes (e.g., new region drawn or profile switched)
    createEffect(() => {
        const newRegions = props.initialRegions;
        // Only update if the length changed (new region added/removed)
        if (newRegions.length !== editableRegions().length) {
            setEditableRegions(structuredClone(newRegions));
            setLastSavedRegions(structuredClone(newRegions));
            setFieldRegistry(new Map());
            setJustSavedFieldIds(new Set());
        }
    });

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

    const validateRegionName = (name: string): boolean => {
        // Region name should not be empty and should be a valid identifier
        return name.trim().length > 0;
    };

    const handleSave = () => {
        // Validate all region names
        const regions = editableRegions();
        for (let i = 0; i < regions.length; i++) {
            if (!validateRegionName(regions[i].name)) {
                alert(
                    `Invalid region name at row ${i + 1}. Region name cannot be empty.`
                );
                return;
            }
        }

        props.onSave(editableRegions());

        setLastSavedRegions(structuredClone(editableRegions()));

        const modifiedFieldIds = getModifiedFieldIds();
        resetAllModifiedFields();
        setJustSavedFieldIds(modifiedFieldIds);

        // Clear the saved state after animation completes
        setTimeout(() => {
            setJustSavedFieldIds(new Set<string>());
        }, 2000);
    };

    const handleCancel = () => {
        setEditableRegions(structuredClone(lastSavedRegions()));

        resetAllModifiedFields();
        setJustSavedFieldIds(new Set<string>());

        if (props.onCancel) {
            props.onCancel();
        }
    };

    const handleDeleteRegion = (index: number) => {
        const regions = [...editableRegions()];
        regions.splice(index, 1);
        setEditableRegions(regions);
        setLastSavedRegions(structuredClone(regions));

        // Reset field registry for deleted region
        const newRegistry = new Map(fieldRegistry());
        const fieldsToDelete: string[] = [];
        newRegistry.forEach((_, fieldId) => {
            if (fieldId.startsWith(`region-${index}-`)) {
                fieldsToDelete.push(fieldId);
            }
        });
        fieldsToDelete.forEach((fieldId) => newRegistry.delete(fieldId));
        setFieldRegistry(newRegistry);

        // Immediately save the deletion
        props.onSave(regions);
    };

    const isFieldJustSaved = (fieldId: string) => {
        return justSavedFieldIds().has(fieldId);
    };

    // Derive unsaved state from fieldRegistry
    const hasUnsavedChanges = createMemo(() => {
        let hasChanges = false;
        fieldRegistry().forEach((field) => {
            if (field.isModified()) {
                hasChanges = true;
            }
        });
        // Also check if regions were deleted or added
        return hasChanges || editableRegions().length !== lastSavedRegions().length;
    });

    const updateRegionField = <K extends keyof TextRegion>(
        index: number,
        field: K,
        value: TextRegion[K]
    ) => {
        // Create a new array to properly trigger reactivity
        setEditableRegions((prev) => {
            const newRegions = structuredClone(prev);
            if (newRegions[index]) {
                newRegions[index][field] = value;
            }
            return newRegions;
        });
    };

    return (
        <div class="editable-regions-container">
            <div class="editable-header">
                <h3>Drawn Regions ({editableRegions().length})</h3>

                <div class="action-buttons">
                    <Show when={hasUnsavedChanges()}>
                        <button onClick={handleSave} class="save-button">
                            💾 Save Regions
                        </button>
                        <button onClick={handleCancel} class="cancel-button">
                            ↺ Cancel Changes
                        </button>
                    </Show>
                </div>
            </div>

            <Show
                when={editableRegions().length > 0}
                fallback={
                    <div class="empty-state">
                        <p>No regions drawn yet. Use the region editor to draw regions.</p>
                    </div>
                }
            >
                <div class="table-wrapper">
                    <table>
                        <thead>
                            <tr>
                                <th class="name-column">Name</th>
                                <th>X</th>
                                <th>Y</th>
                                <th>Width</th>
                                <th>Height</th>
                                <th>Char Set</th>
                                <th>Italic</th>
                                <th class="delete-column">Delete</th>
                            </tr>
                        </thead>
                        <tbody>
                            <Index each={editableRegions()}>
                                {(region, index) => {
                                    const savedRegion = () => lastSavedRegions()[index] || region();
                                    return (
                                        <tr>
                                            <td class="name-column">
                                                <RegionFieldInput
                                                    id={`region-${index}-name`}
                                                    value={() => region().name ?? ''}
                                                    baseline={() => savedRegion().name ?? ''}
                                                    onInput={(value) =>
                                                        updateRegionField(
                                                            index,
                                                            'name',
                                                            value
                                                        )
                                                    }
                                                    initialIsJustSaved={() =>
                                                        isFieldJustSaved(
                                                            `region-${index}-name`
                                                        )
                                                    }
                                                    staticRegisterField={
                                                        registerField
                                                    }
                                                />
                                            </td>
                                            <td>
                                                <RegionFieldInput
                                                    id={`region-${index}-x`}
                                                    value={() =>
                                                        String(region().x ?? '')
                                                    }
                                                    baseline={() =>
                                                        String(savedRegion().x ?? '')
                                                    }
                                                    staticInputmode="numeric"
                                                    onInput={(value) =>
                                                        updateRegionField(
                                                            index,
                                                            'x',
                                                            Number(value)
                                                        )
                                                    }
                                                    initialIsJustSaved={() =>
                                                        isFieldJustSaved(
                                                            `region-${index}-x`
                                                        )
                                                    }
                                                    staticRegisterField={
                                                        registerField
                                                    }
                                                />
                                            </td>
                                            <td>
                                                <RegionFieldInput
                                                    id={`region-${index}-y`}
                                                    value={() =>
                                                        String(region().y ?? '')
                                                    }
                                                    baseline={() =>
                                                        String(savedRegion().y ?? '')
                                                    }
                                                    staticInputmode="numeric"
                                                    onInput={(value) =>
                                                        updateRegionField(
                                                            index,
                                                            'y',
                                                            Number(value)
                                                        )
                                                    }
                                                    initialIsJustSaved={() =>
                                                        isFieldJustSaved(
                                                            `region-${index}-y`
                                                        )
                                                    }
                                                    staticRegisterField={
                                                        registerField
                                                    }
                                                />
                                            </td>
                                            <td>
                                                <RegionFieldInput
                                                    id={`region-${index}-width`}
                                                    value={() =>
                                                        String(region().width ?? '')
                                                    }
                                                    baseline={() =>
                                                        String(savedRegion().width ?? '')
                                                    }
                                                    staticInputmode="numeric"
                                                    onInput={(value) =>
                                                        updateRegionField(
                                                            index,
                                                            'width',
                                                            Number(value)
                                                        )
                                                    }
                                                    initialIsJustSaved={() =>
                                                        isFieldJustSaved(
                                                            `region-${index}-width`
                                                        )
                                                    }
                                                    staticRegisterField={
                                                        registerField
                                                    }
                                                />
                                            </td>
                                            <td>
                                                <RegionFieldInput
                                                    id={`region-${index}-height`}
                                                    value={() =>
                                                        String(region().height ?? '')
                                                    }
                                                    baseline={() =>
                                                        String(savedRegion().height ?? '')
                                                    }
                                                    staticInputmode="numeric"
                                                    onInput={(value) =>
                                                        updateRegionField(
                                                            index,
                                                            'height',
                                                            Number(value)
                                                        )
                                                    }
                                                    initialIsJustSaved={() =>
                                                        isFieldJustSaved(
                                                            `region-${index}-height`
                                                        )
                                                    }
                                                    staticRegisterField={
                                                        registerField
                                                    }
                                                />
                                            </td>
                                            <td>
                                                <RegionFieldInput
                                                    id={`region-${index}-charSet`}
                                                    value={() => region().charSet ?? ''}
                                                    baseline={() => savedRegion().charSet ?? ''}
                                                    onInput={(value) =>
                                                        updateRegionField(
                                                            index,
                                                            'charSet',
                                                            value || undefined
                                                        )
                                                    }
                                                    initialIsJustSaved={() =>
                                                        isFieldJustSaved(
                                                            `region-${index}-charSet`
                                                        )
                                                    }
                                                    staticRegisterField={
                                                        registerField
                                                    }
                                                />
                                            </td>
                                            <td>
                                                <input
                                                    type="checkbox"
                                                    checked={region().isItalic ?? false}
                                                    onChange={(e) =>
                                                        updateRegionField(
                                                            index,
                                                            'isItalic',
                                                            e.target.checked
                                                        )
                                                    }
                                                    class="italic-checkbox"
                                                />
                                            </td>
                                            <td class="delete-column">
                                                <button
                                                    onClick={() =>
                                                        handleDeleteRegion(index)
                                                    }
                                                    class="delete-button"
                                                    title="Delete region"
                                                >
                                                    ✕
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                }}
                            </Index>
                        </tbody>
                    </table>
                </div>
            </Show>
        </div>
    );
};

export default EditableRegionsData;
