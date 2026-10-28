/**
 * Searchable list of a profile's regions with fields for editing the selected one
 */

import type { Component } from 'solid-js';
import {
	createSignal,
	createEffect,
	createMemo,
	on,
	untrack,
	For,
	Show,
	onCleanup,
} from 'solid-js';
import { Search, Trash2 } from 'lucide-solid';

import type { TextRegion, DrawnRegion } from '#types';
import RecordFieldInput from '#c/ui/RecordFieldInput';
import { isSameRegion } from '#utils/regionEditor';

interface RegionInspectorProps {
	profileId: string;
	currentRegions: DrawnRegion[];
	savedRegions: DrawnRegion[];
	selectedId: string | null;
	/** Alignment group names suggested for the Alignment group field */
	groupNames?: string[];
	onSelect: (id: string | null) => void;
	onChange: (regions: DrawnRegion[]) => void;
}

interface RegisteredField {
	isModified: () => boolean;
	reset: () => void;
}

interface TextFieldSpec {
	key: 'name' | 'charSet' | 'imgHashSet' | 'group';
	label: string;
	listId?: string;
}

interface NumberFieldSpec {
	key: 'x' | 'y' | 'width' | 'height' | 'row';
	label: string;
	title: string;
	/** Empty input clears the field instead of setting 0 */
	optional?: boolean;
}

const JUST_SAVED_MS = 2000;
const GROUP_LIST_ID = 'region-inspector-groups';

const POSITION_FIELDS: NumberFieldSpec[] = [
	{ key: 'x', label: 'X', title: 'Left edge in pixels' },
	{ key: 'y', label: 'Y', title: 'Top edge in pixels' },
	{ key: 'width', label: 'W', title: 'Width in pixels' },
	{ key: 'height', label: 'H', title: 'Height in pixels' },
];

const ROW_FIELD: NumberFieldSpec = {
	key: 'row',
	label: 'Row',
	title: 'Row index within the group',
	optional: true,
};

const fieldId = (regionId: string, key: keyof TextRegion) => `region-${regionId}-${key}`;

const describeRegion = (r: DrawnRegion) => `${r.width}×${r.height} at (${r.x}, ${r.y})`;

const matchesQuery = (r: DrawnRegion, query: string) =>
	r.name.toLowerCase().includes(query)
	|| (r.group?.toLowerCase().includes(query) ?? false);

const RegionInspector: Component<RegionInspectorProps> = (props) => {
	const [query, setQuery] = createSignal('');

	// Bumped to remount the fields when the selected region changes from outside
	const [fieldsVersion, setFieldsVersion] = createSignal(0);

	// Fields currently showing the "just-saved" state
	const [justSavedFieldIds, setJustSavedFieldIds] = createSignal(new Set<string>());

	// Mounted input fields' modification state and reset functions
	const fieldRegistry = new Map<string, RegisteredField>();

	// The selected region as its inputs last reported it
	let working: DrawnRegion | undefined;
	let justSavedTimeoutId: ReturnType<typeof setTimeout> | undefined;

	onCleanup(() => clearTimeout(justSavedTimeoutId));

	const selectedRegion = createMemo(() =>
		props.selectedId ?
			props.currentRegions.find((r) => r.id === props.selectedId)
		:	undefined
	);

	const savedById = createMemo(
		() => new Map(props.savedRegions.map((r) => [r.id, r] as const))
	);

	const isChanged = (region: DrawnRegion) => {
		const saved = savedById().get(region.id);
		return !saved || !isSameRegion(region, saved);
	};

	const filteredRegions = createMemo(() => {
		const q = query().trim().toLowerCase();
		return q ?
				props.currentRegions.filter((r) => matchesQuery(r, q))
			:	props.currentRegions;
	});

	// A snapshot of the region whose fields are shown. A new snapshot (copied, so it never
	// equals the last one) is made only when the selection changes or the fields need
	// remounting; the keyed Show below remounts the fields for each snapshot.
	const shownRegionId = createMemo(() => selectedRegion()?.id);
	const fieldsRegion = createMemo(
		on([shownRegionId, fieldsVersion], ([id]) => {
			const region = id ? untrack(selectedRegion) : undefined;
			return region ? { ...region } : undefined;
		})
	);

	const registerField = (id: string, isModified: () => boolean, reset: () => void) => {
		fieldRegistry.set(id, { isModified, reset });
	};

	const unregisterRegionFields = (regionId: string) => {
		for (const id of [...fieldRegistry.keys()]) {
			if (id.startsWith(`region-${regionId}-`)) fieldRegistry.delete(id);
		}
	};

	const getModifiedFieldIds = () => {
		const modified = new Set<string>();
		fieldRegistry.forEach((field, id) => field.isModified() && modified.add(id));
		return modified;
	};

	const isFieldJustSaved = (id: string) => justSavedFieldIds().has(id);

	// Fields of a deselected region unmount, so drop them from the registry
	createEffect(
		on(
			() => props.selectedId,
			(_id, prevId) => {
				if (prevId) unregisterRegionFields(prevId);
			},
			{ defer: true }
		)
	);

	// Remount the fields when the selected region changes other than through them,
	// e.g. a discard or a profile load
	createEffect(
		on(selectedRegion, (region) => {
			if (!region) {
				working = undefined;
				return;
			}
			if (working?.id === region.id && isSameRegion(working, region)) return;

			const wasShowing = working?.id === region.id;
			working = { ...region };
			if (wasShowing) {
				unregisterRegionFields(region.id);
				setFieldsVersion((v) => v + 1);
			}
		})
	);

	// On save, flash the fields that were modified; on profile change, start fresh
	createEffect(
		on(
			[() => props.savedRegions, () => props.profileId],
			([, profileId], prev) => {
				clearTimeout(justSavedTimeoutId);

				if (prev && prev[1] !== profileId) {
					fieldRegistry.clear();
					setJustSavedFieldIds(new Set<string>());
					return;
				}

				setJustSavedFieldIds(getModifiedFieldIds());
				fieldRegistry.forEach((field) => field.reset());
				justSavedTimeoutId = setTimeout(
					() => setJustSavedFieldIds(new Set<string>()),
					JUST_SAVED_MS
				);
			},
			{ defer: true }
		)
	);

	const updateField = <K extends keyof TextRegion>(key: K, value: TextRegion[K]) => {
		const region = working;
		if (!region) return;

		working = { ...region, [key]: value };
		props.onChange(
			props.currentRegions.map((r) => (r.id === region.id ? { ...r, [key]: value } : r))
		);
	};

	const handleDeleteRegion = (regionId: string) => {
		unregisterRegionFields(regionId);
		props.onSelect(null);
		props.onChange(props.currentRegions.filter((r) => r.id !== regionId));
	};

	/** Inputs take their initial values once; external changes remount them */
	const renderFields = (region: DrawnRegion) => {
		const baselineRegion = () => savedById().get(region.id) ?? region;
		const isItalicModified = () =>
			(selectedRegion()?.isItalic ?? false) !== (baselineRegion().isItalic ?? false);

		const textField = (spec: TextFieldSpec) => (
			<div class="region-inspector__field">
				<label for={fieldId(region.id, spec.key)}>{spec.label}</label>
				<RecordFieldInput
					staticId={fieldId(region.id, spec.key)}
					staticListId={spec.listId}
					initialValue={region[spec.key] ?? ''}
					baseline={() => baselineRegion()[spec.key] ?? ''}
					onInput={(value) =>
						updateField(spec.key, spec.key === 'name' ? value : value || undefined)
					}
					initialIsJustSaved={isFieldJustSaved(fieldId(region.id, spec.key))}
					staticRegisterField={registerField}
				/>
			</div>
		);

		const numberField = (spec: NumberFieldSpec) => (
			<div class="region-inspector__field">
				<label for={fieldId(region.id, spec.key)} title={spec.title}>
					{spec.label}
				</label>
				<RecordFieldInput
					staticId={fieldId(region.id, spec.key)}
					staticInputmode="numeric"
					initialValue={String(region[spec.key] ?? '')}
					baseline={() => String(baselineRegion()[spec.key] ?? '')}
					onInput={(value) =>
						updateField(
							spec.key,
							spec.optional && value === '' ? undefined : Number(value)
						)
					}
					initialIsJustSaved={isFieldJustSaved(fieldId(region.id, spec.key))}
					staticRegisterField={registerField}
				/>
			</div>
		);

		return (
			<div class="region-inspector__fields">
				{textField({ key: 'name', label: 'Name' })}

				<div class="region-inspector__row region-inspector__row--position">
					<For each={POSITION_FIELDS}>{numberField}</For>
				</div>

				{textField({ key: 'charSet', label: 'Characters' })}

				<div class="region-inspector__row">
					{textField({ key: 'group', label: 'Alignment group', listId: GROUP_LIST_ID })}
					{numberField(ROW_FIELD)}
				</div>

				{textField({ key: 'imgHashSet', label: 'Image hash set' })}

				<label
					class="region-inspector__check"
					classList={{ 'region-inspector__check--modified': isItalicModified() }}
				>
					<input
						type="checkbox"
						checked={region.isItalic ?? false}
						onChange={(e) => updateField('isItalic', e.currentTarget.checked)}
					/>
					Italic
				</label>

				<div class="region-inspector__actions">
					<button class="danger" onClick={() => handleDeleteRegion(region.id)}>
						<Trash2 size={14} />
						Delete Region
					</button>
				</div>
			</div>
		);
	};

	return (
		<div class="region-inspector">
			<div class="region-inspector__list-panel">
				<div class="region-inspector__search">
					<Search size={14} />
					<input
						type="search"
						value={query()}
						onInput={(e) => setQuery(e.currentTarget.value)}
						placeholder="Search regions"
						aria-label="Search regions"
					/>
				</div>

				<Show
					when={props.currentRegions.length > 0}
					fallback={
						<p class="region-inspector__empty">
							No regions yet. Choose Draw Region and drag on the image.
						</p>
					}
				>
					<Show
						when={filteredRegions().length > 0}
						fallback={
							<p class="region-inspector__empty">No regions match '{query().trim()}'.</p>
						}
					>
						<ul class="region-inspector__list" aria-label="Regions">
							<For each={filteredRegions()}>
								{(region) => (
									<li>
										<button
											class="region-inspector__item"
											classList={{ 'region-inspector__item--changed': isChanged(region) }}
											aria-pressed={props.selectedId === region.id}
											onClick={() => props.onSelect(region.id)}
										>
											<span class="region-inspector__item-name">{region.name}</span>
											<span class="region-inspector__item-meta">
												{describeRegion(region)}
											</span>
											<Show when={region.group}>
												<span class="region-inspector__item-group">{region.group}</span>
											</Show>
											<Show when={isChanged(region)}>
												<span class="region-inspector__changed" title="Unsaved changes">
													Changed
												</span>
											</Show>
										</button>
									</li>
								)}
							</For>
						</ul>
					</Show>
				</Show>
			</div>

			<div class="region-inspector__detail">
				<Show
					when={fieldsRegion()}
					keyed
					fallback={
						<p class="region-inspector__empty">
							Select a region on the image or in the list to edit it.
						</p>
					}
				>
					{renderFields}
				</Show>
			</div>

			<datalist id={GROUP_LIST_ID}>
				<For each={props.groupNames ?? []}>{(name) => <option value={name} />}</For>
			</datalist>
		</div>
	);
};

export default RegionInspector;
