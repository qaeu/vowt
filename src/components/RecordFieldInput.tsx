import { createSignal, mergeProps, type Component } from 'solid-js';

import '#styles/EditableGameData';

interface RecordFieldInputProps {
    onInput: (value: string) => void;
    staticId: Readonly<string>;
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

const defaultRecordFieldInputProps: Required<
    Pick<RecordFieldInputProps, 'staticInputmode'>
> = {
    staticInputmode: 'text' as const,
};

const RecordFieldInput: Component<RecordFieldInputProps> = (_props) => {
    const props: RecordFieldInputProps = mergeProps(
        defaultRecordFieldInputProps,
        _props
    );

    const [isModified, setIsModified] = createSignal<boolean>(false);

    // Register this field's modification state with parent during component initialization
    if (props.staticRegisterField) {
        props.staticRegisterField(
            props.staticId,
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
            id={props.staticId}
        />
    );
};

export default RecordFieldInput;
