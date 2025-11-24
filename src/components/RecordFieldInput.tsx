import { createSignal, onMount, mergeProps, type Component } from 'solid-js';

import '#styles/EditableGameData';

interface RecordFieldInputProps {
	staticId: Readonly<string>;
	staticInputmode?: Readonly<'text' | 'numeric' | 'none'>;
	initialValue: Readonly<string>;
	baseline: () => Readonly<string>; // For comparison to detect modifications
	initialIsJustSaved: Readonly<boolean>;
	staticRegisterField?: (
		fieldId: string,
		isModifiedGetter: () => boolean,
		resetModified: () => void
	) => void;
	onInput: (value: string) => void;
}

const defaultRecordFieldInputProps: Required<
	Pick<RecordFieldInputProps, 'staticInputmode'>
> = {
	staticInputmode: 'text' as const,
};

const RecordFieldInput: Component<RecordFieldInputProps> = (_props) => {
	const props: RecordFieldInputProps = mergeProps(defaultRecordFieldInputProps, _props);

	const [isModified, setIsModified] = createSignal<boolean>(false);
	const [value, setValue] = createSignal<string>(props.initialValue);

	// Register this field's modification state with parent during component initialization
	onMount(() => {
		if (props.staticRegisterField) {
			props.staticRegisterField(props.staticId, isModified, () => {
				setIsModified(false);
				setValue(props.baseline);
			});
		}
	});

	const validityPattern = props.staticInputmode === 'numeric' ? '[0-9]*' : undefined;

	const getClassName = () => {
		const classes = [];
		if (isModified()) {
			classes.push('modified');
		}
		if (props.initialIsJustSaved) {
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

		// Sync the internal value signal
		setValue(inputValue);

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
			value={value()}
			onInput={handleInput}
			onFocus={(e) => e.target.select()}
			class={getClassName()}
			id={props.staticId}
		/>
	);
};

export default RecordFieldInput;
