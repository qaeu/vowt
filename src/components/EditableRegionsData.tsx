import {
	createSignal,
	createEffect,
	createMemo,
	on,
	batch,
	For,
	Show,
	type Component,
	type OnEffectFunction,
} from 'solid-js';

import type { TextRegion, DrawnRegion } from '#types';
import RecordFieldInput from '#c/RecordFieldInput';
import '#styles/EditableRegionsData';

interface EditableRegionsDataProps {
	profileId: string;
	currentRegions: DrawnRegion[];
	savedRegions: DrawnRegion[];
	onChange: (regions: DrawnRegion[]) => void;
}

type OnEffectFnInput = [DrawnRegion[], string, number];
type OnEffectFnValue = { prevProfileId: string; prevRegionsCount: number };

const findRegionIndex = (regionList: DrawnRegion[], regionId: string) => {
	return regionList.findIndex((region) => region.id === regionId);
};
const findRegion = (regionList: DrawnRegion[], regionId: string) => {
	return regionList[findRegionIndex(regionList, regionId)] || undefined;
};

const EditableRegionsData: Component<EditableRegionsDataProps> = (props) => {
	// Track the working state
	const [editableRegions, setEditableRegions] = createSignal<DrawnRegion[]>([]);

	// Track the IDs seperately for For rendering
	const [editableRegionIds, setEditableRegionIds] = createSignal<string[]>([]);

	// Track the last saved regions
	const [savedRegions, setSavedRegions] = createSignal<DrawnRegion[]>([]);

	// Track which fields are currently showing "just-saved" state
	const [justSavedFieldIds, setJustSavedFieldIds] = createSignal(new Set<string>());

	// Registry to track all input fields' modification state and reset functions
	const [fieldRegistry, setFieldRegistry] = createSignal<
		Map<string, { isModified: () => boolean; reset: () => void }>
	>(new Map());

	const handlePropChange: OnEffectFunction<
		OnEffectFnInput,
		OnEffectFnValue | undefined,
		undefined
	> = ([propsSavedRegions, propsProfileId, propsCurrentRegionsCount], prev) => {
		// Sync saved regions on profile save or change
		if (savedRegions() !== propsSavedRegions) {
			setSavedRegions(propsSavedRegions);
			setJustSavedFieldIds(getModifiedFieldIds());
			resetAllModifiedFields();

			// Clear the just-saved state after animation completes
			clearTimeout(justSavedTimeoutId);
			justSavedTimeoutId = setTimeout(() => {
				setJustSavedFieldIds(new Set<string>());
			}, 2000);
		}

		// Sync on profile change
		if (prev?.[1] !== propsProfileId) {
			setFieldRegistry(new Map());
			setJustSavedFieldIds(new Set<string>());
			setEditableRegions(structuredClone(props.currentRegions));
			syncEditableRegionIds();
		}

		// Sync on region added or removed
		else if (propsCurrentRegionsCount !== prev?.[2]) {
			setEditableRegions(structuredClone(props.currentRegions));
			syncEditableRegionIds();
		}
	};

	let justSavedTimeoutId: number;
	createEffect(
		on(
			[
				() => props.savedRegions,
				() => props.profileId,
				() => props.currentRegions.length,
			],
			handlePropChange
		)
	);

	const syncEditableRegionIds = () => {
		setEditableRegionIds(editableRegions().map((region) => region.id));
	};

	const registerField = (
		fieldId: string,
		isModified: () => boolean,
		reset: () => void
	) => {
		setFieldRegistry((prev) =>
			new Map(prev).set(fieldId, {
				isModified: isModified,
				reset: reset,
			})
		);
	};

	const unregisterField = (regionId: string) => {
		const newRegistry = new Map(fieldRegistry());
		const fieldsToDelete: string[] = [];
		newRegistry.forEach((_, fieldId) => {
			if (fieldId.startsWith(`region-${regionId}-`)) {
				fieldsToDelete.push(fieldId);
			}
		});
		fieldsToDelete.forEach((fieldId) => newRegistry.delete(fieldId));
		setFieldRegistry(newRegistry);
	};

	const getModifiedFieldIds = (): Set<string> => {
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

	const handleCancel = () => {
		batch(() => {
			setEditableRegions(structuredClone(savedRegions()));
			syncEditableRegionIds();

			resetAllModifiedFields();
			setJustSavedFieldIds(new Set<string>());
		});

		props.onChange(editableRegions());
	};

	const handleDeleteRegion = (regionId: string) => {
		const regions = [...editableRegions()];
		const index = findRegionIndex(regions, regionId);

		if (index == -1) {
			return;
		}

		regions.splice(index, 1);

		batch(() => {
			unregisterField(regionId);
			setEditableRegions(regions);
			syncEditableRegionIds();
		});

		props.onChange(regions);
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
		// Also check if regions were deleted or added
		return hasChanges || editableRegions().length !== savedRegions().length;
	};

	const updateRegionField = <K extends keyof TextRegion>(
		id: string,
		field: K,
		value: TextRegion[K]
	) => {
		const regions = editableRegions();
		const index = findRegionIndex(regions, id);

		if (index == -1) {
			console.error(`Region with id ${id} not found for update.`);
			return;
		}

		// Modify in place to avoid re-render
		regions[index][field] = value as DrawnRegion[K];

		props.onChange(editableRegions());
	};

	return (
		<div class="editable-regions-container">
			<div class="editable-header">
				<h3>Drawn Regions ({editableRegionIds().length})</h3>

				<div class="action-buttons">
					<Show when={hasUnsavedChanges()}>
						<button onClick={handleCancel} class="cancel-button">
							Cancel Changes
						</button>
					</Show>
				</div>
			</div>

			<Show
				when={editableRegionIds().length > 0}
				fallback={
					<div class="empty-state">
						<p>No regions drawn yet. Use the region editor to draw regions.</p>
					</div>
				}
			>
				{(() => {
					return null;
				})()}
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
								<th>Image Hash</th>
								<th class="delete-column">Delete</th>
							</tr>
						</thead>
						<tbody>
							<For each={editableRegionIds()}>
								{(regionId) => {
									const region = findRegion(editableRegions(), regionId);
									const savedRegion = createMemo(
										() => findRegion(savedRegions(), regionId) || region
									);
									return (
										<tr>
											<td class="name-column">
												<RecordFieldInput
													staticId={`region-${region.id}-name`}
													initialValue={region.name ?? ''}
													baseline={() => savedRegion()?.name ?? ''}
													onInput={(value) => updateRegionField(region.id, 'name', value)}
													initialIsJustSaved={isFieldJustSaved(
														`region-${region.id}-name`
													)}
													staticRegisterField={registerField}
												/>
											</td>
											<td>
												<RecordFieldInput
													staticId={`region-${region.id}-x`}
													initialValue={String(region.x ?? '')}
													baseline={() => String(savedRegion()?.x ?? '')}
													staticInputmode="numeric"
													onInput={(value) =>
														updateRegionField(region.id, 'x', Number(value))
													}
													initialIsJustSaved={isFieldJustSaved(`region-${region.id}-x`)}
													staticRegisterField={registerField}
												/>
											</td>
											<td>
												<RecordFieldInput
													staticId={`region-${region.id}-y`}
													initialValue={String(region.y ?? '')}
													baseline={() => String(savedRegion()?.y ?? '')}
													staticInputmode="numeric"
													onInput={(value) =>
														updateRegionField(region.id, 'y', Number(value))
													}
													initialIsJustSaved={isFieldJustSaved(`region-${region.id}-y`)}
													staticRegisterField={registerField}
												/>
											</td>
											<td>
												<RecordFieldInput
													staticId={`region-${region.id}-width`}
													initialValue={String(region.width ?? '')}
													baseline={() => String(savedRegion()?.width ?? '')}
													staticInputmode="numeric"
													onInput={(value) =>
														updateRegionField(region.id, 'width', Number(value))
													}
													initialIsJustSaved={isFieldJustSaved(
														`region-${region.id}-width`
													)}
													staticRegisterField={registerField}
												/>
											</td>
											<td>
												<RecordFieldInput
													staticId={`region-${region.id}-height`}
													initialValue={String(region.height ?? '')}
													baseline={() => String(savedRegion()?.height ?? '')}
													staticInputmode="numeric"
													onInput={(value) =>
														updateRegionField(region.id, 'height', Number(value))
													}
													initialIsJustSaved={isFieldJustSaved(
														`region-${region.id}-height`
													)}
													staticRegisterField={registerField}
												/>
											</td>
											<td>
												<RecordFieldInput
													staticId={`region-${region.id}-charSet`}
													initialValue={region.charSet ?? ''}
													baseline={() => savedRegion()?.charSet ?? ''}
													onInput={(value) =>
														updateRegionField(region.id, 'charSet', value || undefined)
													}
													initialIsJustSaved={isFieldJustSaved(
														`region-${region.id}-charSet`
													)}
													staticRegisterField={registerField}
												/>
											</td>
											<td>
												<input
													type="checkbox"
													checked={region.isItalic ?? false}
													onChange={(e) =>
														updateRegionField(region.id, 'isItalic', e.target.checked)
													}
													class="italic-checkbox"
												/>
											</td>
											<td>
												<RecordFieldInput
													staticId={`region-${region.id}-imgHash`}
													initialValue={region.imgHash ?? ''}
													baseline={() => savedRegion()?.imgHash ?? ''}
													onInput={(value) =>
														updateRegionField(region.id, 'imgHash', value || undefined)
													}
													initialIsJustSaved={isFieldJustSaved(
														`region-${region.id}-imgHash`
													)}
													staticRegisterField={registerField}
												/>
											</td>
											<td class="delete-column">
												<button
													onClick={() => handleDeleteRegion(region.id)}
													class="delete-button"
													title="Delete region"
												>
													✕
												</button>
											</td>
										</tr>
									);
								}}
							</For>
						</tbody>
					</table>
				</div>
			</Show>
		</div>
	);
};

export default EditableRegionsData;
