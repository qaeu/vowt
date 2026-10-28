import type { Component } from 'solid-js';
import { createSignal, For, Show } from 'solid-js';
import { X } from 'lucide-solid';

import type { AlignmentDrawTarget, AlignmentGroup, RegionAnchor, RowBands } from '#types';
import { ALIGN_SCALE } from '#utils/regionAlignment';

interface AlignmentGroupsEditorProps {
	groups: AlignmentGroup[];
	regionCounts: Record<string, number>;
	drawTarget: AlignmentDrawTarget | null;
	onChange: (groups: AlignmentGroup[]) => void;
	onRequestDraw: (target: AlignmentDrawTarget) => void;
	onCancelDraw: () => void;
}

type AnchorField = 'searchX' | 'searchY';
type RowsField = keyof RowBands;

const ROWS_FIELDS: { field: RowsField; label: string }[] = [
	{ field: 'x', label: 'X' },
	{ field: 'width', label: 'Width' },
	{ field: 'y', label: 'Y' },
	{ field: 'rowHeight', label: 'Row Height' },
	{ field: 'count', label: 'Count' },
];

const describeAnchor = (anchor: RegionAnchor) =>
	`${anchor.template.width * ALIGN_SCALE}×${anchor.template.height * ALIGN_SCALE} at (${anchor.x}, ${anchor.y})`;

const AlignmentGroupsEditor: Component<AlignmentGroupsEditorProps> = (props) => {
	const [newGroupName, setNewGroupName] = createSignal('');

	const trimmedName = () => newGroupName().trim();
	const canAddGroup = () =>
		trimmedName().length > 0 && !props.groups.some((g) => g.name === trimmedName());

	const updateGroup = (
		name: string,
		update: (group: AlignmentGroup) => AlignmentGroup
	) => {
		props.onChange(props.groups.map((g) => (g.name === name ? update(g) : g)));
	};

	const handleAddGroup = () => {
		if (!canAddGroup()) return;
		props.onChange([...props.groups, { name: trimmedName() }]);
		setNewGroupName('');
	};

	const handleDeleteGroup = (name: string) => {
		if (props.drawTarget?.group === name) props.onCancelDraw();
		props.onChange(props.groups.filter((g) => g.name !== name));
	};

	const setAnchorField = (name: string, field: AnchorField, value: number) => {
		if (!Number.isFinite(value) || value < 0) return;
		updateGroup(name, (g) =>
			g.anchor ? { ...g, anchor: { ...g.anchor, [field]: value } } : g
		);
	};

	const setRowsField = (name: string, field: RowsField, value: number) => {
		const min = field === 'count' || field === 'rowHeight' ? 1 : 0;
		if (!Number.isFinite(value) || value < min) return;
		updateGroup(name, (g) =>
			g.rows ? { ...g, rows: { ...g.rows, [field]: Math.round(value) } } : g
		);
	};

	const isDrawing = (name: string, kind: AlignmentDrawTarget['kind']) =>
		props.drawTarget?.group === name && props.drawTarget.kind === kind;

	return (
		<div class="alignment-groups-container">
			<div class="alignment-header">
				<h3>Alignment Groups ({props.groups.length})</h3>

				<div class="add-group">
					<input
						type="text"
						value={newGroupName()}
						onInput={(e) => setNewGroupName(e.target.value)}
						onKeyDown={(e) => e.key === 'Enter' && handleAddGroup()}
						placeholder="New group name"
						aria-label="New group name"
						class="group-name-input"
					/>
					<button onClick={handleAddGroup} disabled={!canAddGroup()}>
						Add Group
					</button>
				</div>
			</div>

			<p class="alignment-help">
				Regions with a matching Group move together. Draw an anchor around static UI near
				the group (labels, headers, borders) to follow layout shifts; draw rows over a
				text-free part of a table to snap each Row to the separator lines.
			</p>

			<Show when={props.drawTarget}>
				{(target) => (
					<div class="draw-prompt">
						<span>
							Draw a rectangle on the image to set the{' '}
							{target().kind === 'anchor' ? 'anchor' : 'rows'} for '{target().group}'.
						</span>
						<button onClick={() => props.onCancelDraw()}>Cancel</button>
					</div>
				)}
			</Show>

			<Show
				when={props.groups.length > 0}
				fallback={
					<div class="empty-state">
						<p>No alignment groups. Regions keep their exact profile positions.</p>
					</div>
				}
			>
				<div class="alignment-groups-list">
					<For each={props.groups}>
						{(group) => (
							<div class="alignment-group">
								<div class="group-header">
									<h4>{group.name}</h4>
									<span class="region-count">
										{props.regionCounts[group.name] ?? 0} regions
									</span>
									<button
										onClick={() => handleDeleteGroup(group.name)}
										class="delete-button"
										title={`Delete group ${group.name}`}
									>
										<X size={14} />
									</button>
								</div>

								<div class="group-feature">
									<span class="feature-label">Anchor</span>
									<span class="feature-summary">
										{group.anchor ? describeAnchor(group.anchor) : 'None'}
									</span>
									<div class="button-group">
										<button
											onClick={() =>
												props.onRequestDraw({ group: group.name, kind: 'anchor' })
											}
											classList={{ active: isDrawing(group.name, 'anchor') }}
										>
											{group.anchor ? 'Redraw Anchor' : 'Draw Anchor'}
										</button>
										<Show when={group.anchor}>
											<button
												onClick={() =>
													updateGroup(group.name, (g) => ({ ...g, anchor: undefined }))
												}
												class="remove-feature"
											>
												Remove Anchor
											</button>
										</Show>
									</div>
									<Show when={group.anchor}>
										{(anchor) => (
											<div class="feature-fields">
												<label>
													Search X
													<input
														type="number"
														min="0"
														value={anchor().searchX}
														onChange={(e) =>
															setAnchorField(
																group.name,
																'searchX',
																e.target.valueAsNumber
															)
														}
													/>
												</label>
												<label>
													Search Y
													<input
														type="number"
														min="0"
														value={anchor().searchY}
														onChange={(e) =>
															setAnchorField(
																group.name,
																'searchY',
																e.target.valueAsNumber
															)
														}
													/>
												</label>
											</div>
										)}
									</Show>
								</div>

								<div class="group-feature">
									<span class="feature-label">Rows</span>
									<span class="feature-summary">
										{group.rows ? `${group.rows.count} rows` : 'None'}
									</span>
									<div class="button-group">
										<button
											onClick={() =>
												props.onRequestDraw({ group: group.name, kind: 'rows' })
											}
											classList={{ active: isDrawing(group.name, 'rows') }}
										>
											{group.rows ? 'Redraw Rows' : 'Draw Rows'}
										</button>
										<Show when={group.rows}>
											<button
												onClick={() =>
													updateGroup(group.name, (g) => ({ ...g, rows: undefined }))
												}
												class="remove-feature"
											>
												Remove Rows
											</button>
										</Show>
									</div>
									<Show when={group.rows}>
										{(rows) => (
											<div class="feature-fields">
												<For each={ROWS_FIELDS}>
													{({ field, label }) => (
														<label>
															{label}
															<input
																type="number"
																min={
																	field === 'count' || field === 'rowHeight' ? '1' : '0'
																}
																value={rows()[field]}
																onChange={(e) =>
																	setRowsField(group.name, field, e.target.valueAsNumber)
																}
															/>
														</label>
													)}
												</For>
											</div>
										)}
									</Show>
								</div>
							</div>
						)}
					</For>
				</div>
			</Show>
		</div>
	);
};

export default AlignmentGroupsEditor;
