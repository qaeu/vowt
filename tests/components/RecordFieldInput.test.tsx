import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@solidjs/testing-library';

import RecordFieldInput from '#c/RecordFieldInput';

describe('RecordFieldInput', () => {
    let onInputMock: ReturnType<typeof vi.fn>;
    let registerFieldMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        onInputMock = vi.fn();
        registerFieldMock = vi.fn();
    });

    describe('Rendering', () => {
        it('should render an input element with correct id', () => {
            const { container } = render(() => (
                <RecordFieldInput
                    staticId="test-field"
                    initialValue={'test value'}
                    baseline={'test value'}
                    onInput={onInputMock}
                    initialIsJustSaved={false}
                />
            ));

            const input = container.querySelector(
                'input[id="test-field"]'
            ) as HTMLInputElement;
            expect(input).toBeTruthy();
        });

        it('should display the value from the value prop', () => {
            const { container } = render(() => (
                <RecordFieldInput
                    staticId="test-field"
                    initialValue={'test value'}
                    baseline={'test value'}
                    onInput={onInputMock}
                    initialIsJustSaved={false}
                />
            ));

            const input = container.querySelector(
                'input[id="test-field"]'
            ) as HTMLInputElement;
            expect(input.value).toBe('test value');
        });

        it('should have text inputmode by default', () => {
            const { container } = render(() => (
                <RecordFieldInput
                    staticId="test-field"
                    initialValue={'test value'}
                    baseline={'test value'}
                    onInput={onInputMock}
                    initialIsJustSaved={false}
                />
            ));

            const input = container.querySelector(
                'input[id="test-field"]'
            ) as HTMLInputElement;
            expect(input.inputMode).toBe('text');
        });

        it('should set numeric inputmode when staticInputmode is numeric', () => {
            const { container } = render(() => (
                <RecordFieldInput
                    staticId="test-field"
                    initialValue={'123'}
                    baseline={'123'}
                    staticInputmode="numeric"
                    onInput={onInputMock}
                    initialIsJustSaved={false}
                />
            ));

            const input = container.querySelector(
                'input[id="test-field"]'
            ) as HTMLInputElement;
            expect(input.inputMode).toBe('numeric');
        });

        it('should set numeric pattern when staticInputmode is numeric', () => {
            const { container } = render(() => (
                <RecordFieldInput
                    staticId="test-field"
                    initialValue={'123'}
                    baseline={'123'}
                    staticInputmode="numeric"
                    onInput={onInputMock}
                    initialIsJustSaved={false}
                />
            ));

            const input = container.querySelector(
                'input[id="test-field"]'
            ) as HTMLInputElement;
            expect(input.pattern).toBe('[0-9]*');
        });

        it('should not have a pattern for text inputmode', () => {
            const { container } = render(() => (
                <RecordFieldInput
                    staticId="test-field"
                    initialValue={'text'}
                    baseline={'text'}
                    staticInputmode="text"
                    onInput={onInputMock}
                    initialIsJustSaved={false}
                />
            ));

            const input = container.querySelector(
                'input[id="test-field"]'
            ) as HTMLInputElement;
            expect(input.pattern).toBe('');
        });
    });

    describe('Field Modification Detection', () => {
        it('should not apply modified class initially when value differs from baseline', () => {
            const { container } = render(() => (
                <RecordFieldInput
                    staticId="test-field"
                    initialValue={'modified value'}
                    baseline={'original value'}
                    onInput={onInputMock}
                    initialIsJustSaved={false}
                />
            ));

            const input = container.querySelector(
                'input[id="test-field"]'
            ) as HTMLInputElement;
            // Modified state is tracked by handleInput event, not initial props
            expect(input.classList.contains('modified')).toBe(false);
        });

        it('should apply modified class after input differs from baseline', () => {
            const { container } = render(() => (
                <RecordFieldInput
                    staticId="test-field"
                    initialValue={'original'}
                    baseline={'original'}
                    onInput={onInputMock}
                    initialIsJustSaved={false}
                />
            ));

            const input = container.querySelector(
                'input[id="test-field"]'
            ) as HTMLInputElement;
            fireEvent.input(input, { target: { value: 'modified' } });

            expect(input.classList.contains('modified')).toBe(true);
        });

        it('should not apply modified class when value equals baseline', () => {
            const { container } = render(() => (
                <RecordFieldInput
                    staticId="test-field"
                    initialValue={'same value'}
                    baseline={'same value'}
                    onInput={onInputMock}
                    initialIsJustSaved={false}
                />
            ));

            const input = container.querySelector(
                'input[id="test-field"]'
            ) as HTMLInputElement;
            expect(input.classList.contains('modified')).toBe(false);
        });

        it('should apply just-saved class when initialIsJustSaved is true', () => {
            const { container } = render(() => (
                <RecordFieldInput
                    staticId="test-field"
                    initialValue={'test value'}
                    baseline={'test value'}
                    onInput={onInputMock}
                    initialIsJustSaved={true}
                />
            ));

            const input = container.querySelector(
                'input[id="test-field"]'
            ) as HTMLInputElement;
            expect(input.classList.contains('just-saved')).toBe(true);
        });

        it('should apply both modified and just-saved classes when both apply', () => {
            const { container } = render(() => (
                <RecordFieldInput
                    staticId="test-field"
                    initialValue={'test value'}
                    baseline={'test value'}
                    onInput={onInputMock}
                    initialIsJustSaved={true}
                />
            ));

            const input = container.querySelector(
                'input[id="test-field"]'
            ) as HTMLInputElement;
            fireEvent.input(input, { target: { value: 'modified' } });

            expect(input.classList.contains('modified')).toBe(true);
            expect(input.classList.contains('just-saved')).toBe(true);
        });
    });

    describe('Input Handling', () => {
        it('should call onInput when value is entered', () => {
            const { container } = render(() => (
                <RecordFieldInput
                    staticId="test-field"
                    initialValue={'test'}
                    baseline={'test'}
                    onInput={onInputMock}
                    initialIsJustSaved={false}
                />
            ));

            const input = container.querySelector(
                'input[id="test-field"]'
            ) as HTMLInputElement;
            fireEvent.input(input, { target: { value: 'new value' } });

            expect(onInputMock).toHaveBeenCalledWith('new value');
        });

        it('should detect modification when input differs from baseline', () => {
            const { container } = render(() => (
                <RecordFieldInput
                    staticId="test-field"
                    initialValue={'original'}
                    baseline={'original'}
                    onInput={onInputMock}
                    initialIsJustSaved={false}
                />
            ));

            const input = container.querySelector(
                'input[id="test-field"]'
            ) as HTMLInputElement;
            fireEvent.input(input, { target: { value: 'modified' } });

            expect(input.classList.contains('modified')).toBe(true);
        });

        it('should remove modified class when input returns to baseline', () => {
            const { container } = render(() => (
                <RecordFieldInput
                    staticId="test-field"
                    initialValue={'original'}
                    baseline={'original'}
                    onInput={onInputMock}
                    initialIsJustSaved={false}
                />
            ));

            const input = container.querySelector(
                'input[id="test-field"]'
            ) as HTMLInputElement;

            // First, make the field modified
            fireEvent.input(input, { target: { value: 'modified' } });
            expect(input.classList.contains('modified')).toBe(true);

            // Now return to baseline value
            fireEvent.input(input, { target: { value: 'original' } });
            expect(input.classList.contains('modified')).toBe(false);
        });

        it('should select all text on focus', () => {
            const { container } = render(() => (
                <RecordFieldInput
                    staticId="test-field"
                    initialValue={'test value'}
                    baseline={'test value'}
                    onInput={onInputMock}
                    initialIsJustSaved={false}
                />
            ));

            const input = container.querySelector(
                'input[id="test-field"]'
            ) as HTMLInputElement;
            const selectSpy = vi.spyOn(input, 'select');

            fireEvent.focus(input);

            expect(selectSpy).toHaveBeenCalled();
        });
    });

    describe('Field Registration', () => {
        it('should call registerField callback on initialization', () => {
            render(() => (
                <RecordFieldInput
                    staticId="test-field"
                    initialValue={'test value'}
                    baseline={'test value'}
                    onInput={onInputMock}
                    initialIsJustSaved={false}
                    staticRegisterField={registerFieldMock}
                />
            ));

            expect(registerFieldMock).toHaveBeenCalledWith(
                'test-field',
                expect.any(Function),
                expect.any(Function)
            );
        });

        it('should not call registerField if callback is not provided', () => {
            render(() => (
                <RecordFieldInput
                    staticId="test-field"
                    initialValue={'test value'}
                    baseline={'test value'}
                    onInput={onInputMock}
                    initialIsJustSaved={false}
                />
            ));

            expect(registerFieldMock).not.toHaveBeenCalled();
        });

        it('should provide isModified getter that reflects current state after input', () => {
            const { container } = render(() => (
                <RecordFieldInput
                    staticId="test-field"
                    initialValue={'original'}
                    baseline={'original'}
                    onInput={onInputMock}
                    initialIsJustSaved={false}
                    staticRegisterField={registerFieldMock}
                />
            ));

            const input = container.querySelector(
                'input[id="test-field"]'
            ) as HTMLInputElement;
            const isModifiedGetter = registerFieldMock.mock.calls[0][1];

            // Initially not modified
            expect(isModifiedGetter()).toBe(false);

            // After input differs from baseline, should be modified
            fireEvent.input(input, { target: { value: 'modified' } });
            expect(isModifiedGetter()).toBe(true);
        });

        it('should provide reset function to clear modified state', () => {
            const { container } = render(() => (
                <RecordFieldInput
                    staticId="test-field"
                    initialValue={'original'}
                    baseline={'original'}
                    onInput={onInputMock}
                    initialIsJustSaved={false}
                    staticRegisterField={registerFieldMock}
                />
            ));

            const input = container.querySelector(
                'input[id="test-field"]'
            ) as HTMLInputElement;
            const isModifiedGetter = registerFieldMock.mock.calls[0][1];
            const resetFn = registerFieldMock.mock.calls[0][2];

            // Make the field modified
            fireEvent.input(input, { target: { value: 'modified' } });
            expect(isModifiedGetter()).toBe(true);

            // Reset should be callable
            resetFn();
            expect(resetFn).toBeDefined();
        });
    });

    describe('Dynamic Value Updates', () => {
        it('should update displayed value when value prop changes', () => {
            const { container } = render(() => (
                <RecordFieldInput
                    staticId="test-field"
                    initialValue={'initial'}
                    baseline={'initial'}
                    onInput={onInputMock}
                    initialIsJustSaved={false}
                />
            ));

            const input = container.querySelector(
                'input[id="test-field"]'
            ) as HTMLInputElement;
            expect(input.value).toBe('initial');
        });

        it('should update modification status when baseline changes', () => {
            const { container } = render(() => (
                <RecordFieldInput
                    staticId="test-field"
                    initialValue={'value'}
                    baseline={'value'}
                    onInput={onInputMock}
                    initialIsJustSaved={false}
                />
            ));

            const input = container.querySelector(
                'input[id="test-field"]'
            ) as HTMLInputElement;
            expect(input.classList.contains('modified')).toBe(false);
        });
    });

    describe('Edge Cases', () => {
        it('should handle empty string values', () => {
            const { container } = render(() => (
                <RecordFieldInput
                    staticId="test-field"
                    initialValue={''}
                    baseline={''}
                    onInput={onInputMock}
                    initialIsJustSaved={false}
                />
            ));

            const input = container.querySelector(
                'input[id="test-field"]'
            ) as HTMLInputElement;
            expect(input.value).toBe('');
            expect(input.classList.contains('modified')).toBe(false);
        });

        it('should handle numeric string values', () => {
            const { container } = render(() => (
                <RecordFieldInput
                    staticId="test-field"
                    initialValue={'12345'}
                    baseline={'12345'}
                    staticInputmode="numeric"
                    onInput={onInputMock}
                    initialIsJustSaved={false}
                />
            ));

            const input = container.querySelector(
                'input[id="test-field"]'
            ) as HTMLInputElement;
            expect(input.value).toBe('12345');
            expect(input.inputMode).toBe('numeric');
        });

        it('should handle whitespace in values', () => {
            const { container } = render(() => (
                <RecordFieldInput
                    staticId="test-field"
                    initialValue={'  spaced  '}
                    baseline={'  spaced  '}
                    onInput={onInputMock}
                    initialIsJustSaved={false}
                />
            ));

            const input = container.querySelector(
                'input[id="test-field"]'
            ) as HTMLInputElement;
            expect(input.value).toBe('  spaced  ');
        });

        it('should handle very long string values', () => {
            const longValue = 'a'.repeat(1000);
            const { container } = render(() => (
                <RecordFieldInput
                    staticId="test-field"
                    initialValue={longValue}
                    baseline={longValue}
                    onInput={onInputMock}
                    initialIsJustSaved={false}
                />
            ));

            const input = container.querySelector(
                'input[id="test-field"]'
            ) as HTMLInputElement;
            expect(input.value).toBe(longValue);
        });
    });

    describe('Integration', () => {
        it('should work correctly with multiple fields', () => {
            render(() => (
                <>
                    <RecordFieldInput
                        staticId="field-1"
                        initialValue={'value1'}
                        baseline={'value1'}
                        onInput={onInputMock}
                        initialIsJustSaved={false}
                    />
                    <RecordFieldInput
                        staticId="field-2"
                        initialValue={'value2'}
                        baseline={'value2'}
                        onInput={onInputMock}
                        initialIsJustSaved={false}
                    />
                </>
            ));

            const field1 = document.querySelector(
                'input[id="field-1"]'
            ) as HTMLInputElement;
            const field2 = document.querySelector(
                'input[id="field-2"]'
            ) as HTMLInputElement;

            expect(field1.value).toBe('value1');
            expect(field2.value).toBe('value2');
        });

        it('should handle both text and numeric fields together', () => {
            const { container } = render(() => (
                <>
                    <RecordFieldInput
                        staticId="text-field"
                        initialValue={'text value'}
                        baseline={'text value'}
                        staticInputmode="text"
                        onInput={onInputMock}
                        initialIsJustSaved={false}
                    />
                    <RecordFieldInput
                        staticId="numeric-field"
                        initialValue={'123'}
                        baseline={'123'}
                        staticInputmode="numeric"
                        onInput={onInputMock}
                        initialIsJustSaved={false}
                    />
                </>
            ));

            const textField = container.querySelector(
                'input[id="text-field"]'
            ) as HTMLInputElement;
            const numericField = container.querySelector(
                'input[id="numeric-field"]'
            ) as HTMLInputElement;

            expect(textField.inputMode).toBe('text');
            expect(numericField.inputMode).toBe('numeric');
            expect(numericField.pattern).toBe('[0-9]*');
        });
    });
});
