/**
 * Dropdown counterpart of RecordFieldInput: picks from grouped options and tracks
 * modified and just-saved state against a baseline value
 */

import type { Component } from 'solid-js';
import { createSignal, createMemo, onMount, For, Show } from 'solid-js';

import type { RegionNameGroup } from '#types';

interface RecordFieldSelectProps {
	staticId: Readonly<string>;
	groups: RegionNameGroup[];
	initialValue: Readonly<string>;
	baseline: () => Readonly<string>; // For comparison to detect modifications
	initialIsJustSaved: Readonly<boolean>;
	staticRegisterField?: (
		fieldId: string,
		isModified: () => boolean,
		reset: () => void
	) => void;
	onChange: (value: string) => void;
}

const RecordFieldSelect: Component<RecordFieldSelectProps> = (props) => {
	const [value, setValue] = createSignal<string>(props.initialValue);
	const [isModified, setIsModified] = createSignal<boolean>(false);

	// Register this field's modification state with parent during component initialization
	onMount(() => {
		if (props.staticRegisterField) {
			// eslint-disable-next-line solid/reactivity
			props.staticRegisterField(props.staticId, isModified, () => {
				setIsModified(false);
				setValue(props.baseline());
			});
		}
	});

	const knownValues = createMemo(
		() => new Set(props.groups.flatMap((group) => group.names))
	);

	// Values outside the groups (e.g. a freshly drawn region's placeholder name) are
	// still shown so the select never misrepresents the current value
	const otherValues = createMemo(() =>
		[value(), props.baseline()].filter(
			(v, i, all) => v && !knownValues().has(v) && all.indexOf(v) === i
		)
	);

	const getClassName = () => {
		const classes = [];
		if (isModified()) classes.push('modified');
		if (props.initialIsJustSaved) classes.push('just-saved');
		return classes.join(' ');
	};

	const handleChange = (e: Event & { currentTarget: HTMLSelectElement }) => {
		const selected = e.currentTarget.value;
		setValue(selected);
		setIsModified(selected !== props.baseline());
		props.onChange(selected);
	};

	const option = (name: string) => (
		<option value={name} selected={name === value()}>
			{name}
		</option>
	);

	return (
		<select id={props.staticId} class={getClassName()} onChange={handleChange}>
			<Show when={otherValues().length > 0}>
				<optgroup label="Other">
					<For each={otherValues()}>{option}</For>
				</optgroup>
			</Show>
			<For each={props.groups}>
				{(group) => (
					<optgroup label={group.label}>
						<For each={group.names}>{option}</For>
					</optgroup>
				)}
			</For>
		</select>
	);
};

export default RecordFieldSelect;
