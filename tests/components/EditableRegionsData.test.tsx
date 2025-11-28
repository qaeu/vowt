import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@solidjs/testing-library';

import type { DrawnRegion } from '#types';
import EditableRegionsData from '#c/EditableRegionsData';

describe('EditableRegionsData', () => {
	const mockRegions: DrawnRegion[] = [
		{
			name: 'player_name',
			x: 100,
			y: 200,
			width: 150,
			height: 30,
			charSet: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz',
			isItalic: false,
			colour: '#FF0000',
			id: 'mock-0',
		},
		{
			name: 'score_blue',
			x: 50,
			y: 100,
			width: 80,
			height: 40,
			charSet: '0123456789',
			isItalic: false,
			colour: '#00FF00',
			id: 'mock-1',
		},
		{
			name: 'hero_name',
			x: 300,
			y: 150,
			width: 120,
			height: 25,
			isItalic: true,
			colour: '#0000FF',
			id: 'mock-2',
		},
	];

	let onChangeMock: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		onChangeMock = vi.fn();
	});

	describe('Rendering', () => {
		it('should render the header with region count', () => {
			render(() => (
				<EditableRegionsData
					profileId="test-profile"
					currentRegions={mockRegions}
					savedRegions={mockRegions}
					onChange={onChangeMock}
				/>
			));

			expect(screen.getByText(`Drawn Regions (${mockRegions.length})`)).toBeTruthy();
		});

		it('should render table headers', () => {
			render(() => (
				<EditableRegionsData
					profileId="test-profile"
					currentRegions={mockRegions}
					savedRegions={mockRegions}
					onChange={onChangeMock}
				/>
			));

			expect(screen.getByText('Name')).toBeTruthy();
			expect(screen.getByText('X')).toBeTruthy();
			expect(screen.getByText('Y')).toBeTruthy();
			expect(screen.getByText('Width')).toBeTruthy();
			expect(screen.getByText('Height')).toBeTruthy();
			expect(screen.getByText('Char Set')).toBeTruthy();
			expect(screen.getByText('Italic')).toBeTruthy();
			expect(screen.getByText('Delete')).toBeTruthy();
		});

		it('should render all regions as table rows', () => {
			const { container } = render(() => (
				<EditableRegionsData
					profileId="test-profile"
					currentRegions={mockRegions}
					savedRegions={mockRegions}
					onChange={onChangeMock}
				/>
			));

			const rows = container.querySelectorAll('tbody tr');
			expect(rows.length).toBe(mockRegions.length);
		});

		it('should display empty state when no regions', () => {
			render(() => (
				<EditableRegionsData
					profileId="test-profile"
					currentRegions={[]}
					savedRegions={[]}
					onChange={onChangeMock}
				/>
			));

			expect(screen.getByText(/No regions drawn yet/i)).toBeTruthy();
		});

		it('should render region data in input fields', () => {
			const { container } = render(() => (
				<EditableRegionsData
					profileId="test-profile"
					currentRegions={mockRegions}
					savedRegions={mockRegions}
					onChange={onChangeMock}
				/>
			));

			const nameInput = container.querySelector(
				'input[id="region-mock-0-name"]'
			) as HTMLInputElement;
			expect(nameInput).toBeTruthy();
			expect(nameInput.value).toBe('player_name');

			const xInput = container.querySelector(
				'input[id="region-mock-0-x"]'
			) as HTMLInputElement;
			expect(xInput).toBeTruthy();
			expect(xInput.value).toBe('100');
		});

		it('should render delete button for each region', () => {
			const { container } = render(() => (
				<EditableRegionsData
					profileId="test-profile"
					currentRegions={mockRegions}
					savedRegions={mockRegions}
					onChange={onChangeMock}
				/>
			));

			const deleteButtons = container.querySelectorAll('.delete-button');
			expect(deleteButtons.length).toBe(mockRegions.length);
		});

		it('should render italic checkbox correctly', () => {
			const { container } = render(() => (
				<EditableRegionsData
					profileId="test-profile"
					currentRegions={mockRegions}
					savedRegions={mockRegions}
					onChange={onChangeMock}
				/>
			));

			const checkboxes = container.querySelectorAll(
				'.italic-checkbox'
			) as NodeListOf<HTMLInputElement>;
			expect(checkboxes.length).toBe(mockRegions.length);
			expect(checkboxes[0].checked).toBe(false);
			expect(checkboxes[2].checked).toBe(true);
		});
	});

	describe('Field Modification', () => {
		it('should show cancel button when fields are modified', () => {
			const { container } = render(() => (
				<EditableRegionsData
					profileId="test-profile"
					currentRegions={mockRegions}
					savedRegions={mockRegions}
					onChange={onChangeMock}
				/>
			));

			const nameInput = container.querySelector(
				'input[id="region-mock-0-name"]'
			) as HTMLInputElement;
			fireEvent.input(nameInput, { target: { value: 'new_name' } });

			expect(screen.getByText(/Cancel Changes/)).toBeTruthy();
		});
	});

	describe('Cancel Changes', () => {
		it('should show cancel button when a field is modified via input', () => {
			const { container } = render(() => (
				<EditableRegionsData
					profileId="test-profile"
					currentRegions={mockRegions}
					savedRegions={mockRegions}
					onChange={onChangeMock}
				/>
			));

			expect(screen.queryByText(/Cancel Changes/)).toBeFalsy();

			const nameInput = container.querySelector(
				'input[id="region-mock-0-name"]'
			) as HTMLInputElement;
			fireEvent.input(nameInput, { target: { value: 'updated_name' } });

			expect(screen.getByText(/Cancel Changes/)).toBeTruthy();
		});

		it('should call onChange with original regions when cancel button is clicked', () => {
			const { container } = render(() => (
				<EditableRegionsData
					profileId="test-profile"
					currentRegions={mockRegions}
					savedRegions={mockRegions}
					onChange={onChangeMock}
				/>
			));

			const nameInput = container.querySelector(
				'input[id="region-mock-0-name"]'
			) as HTMLInputElement;
			fireEvent.input(nameInput, { target: { value: 'updated_name' } });

			const cancelButton = screen.getByText(/Cancel Changes/);
			fireEvent.click(cancelButton);

			// Should call onChange with the regions reset to saved state
			expect(onChangeMock).toHaveBeenCalled();
		});

		it('should not show cancel button when no changes have been made', () => {
			render(() => (
				<EditableRegionsData
					profileId="test-profile"
					currentRegions={mockRegions}
					savedRegions={mockRegions}
					onChange={onChangeMock}
				/>
			));

			expect(screen.queryByText(/Cancel Changes/)).toBeFalsy();
		});

		it('should show cancel button when a region is deleted', () => {
			const { container } = render(() => (
				<EditableRegionsData
					profileId="test-profile"
					currentRegions={mockRegions}
					savedRegions={mockRegions}
					onChange={onChangeMock}
				/>
			));

			expect(screen.queryByText(/Cancel Changes/)).toBeFalsy();

			const deleteButtons = container.querySelectorAll('.delete-button');
			fireEvent.click(deleteButtons[0]);

			expect(screen.getByText(/Cancel Changes/)).toBeTruthy();
		});
	});

	describe('Delete Region', () => {
		it('should call onChange when delete button is clicked', () => {
			const { container } = render(() => (
				<EditableRegionsData
					profileId="test-profile"
					currentRegions={mockRegions}
					savedRegions={mockRegions}
					onChange={onChangeMock}
				/>
			));

			const deleteButtons = container.querySelectorAll('.delete-button');
			fireEvent.click(deleteButtons[0]);

			// Should call onChange with updated regions
			expect(onChangeMock).toHaveBeenCalled();
			const updatedRegions = onChangeMock.mock.calls[0][0];
			expect(updatedRegions.length).toBe(mockRegions.length - 1);
		});

		it('should show unsaved changes after deleting a region', () => {
			const { container } = render(() => (
				<EditableRegionsData
					profileId="test-profile"
					currentRegions={mockRegions}
					savedRegions={mockRegions}
					onChange={onChangeMock}
				/>
			));

			expect(screen.queryByText(/Cancel Changes/)).toBeFalsy();

			const deleteButtons = container.querySelectorAll('.delete-button');
			fireEvent.click(deleteButtons[0]);

			expect(screen.getByText(/Cancel Changes/)).toBeTruthy();
		});

		it('should remove region from table after deletion', () => {
			const { container } = render(() => (
				<EditableRegionsData
					profileId="test-profile"
					currentRegions={mockRegions}
					savedRegions={mockRegions}
					onChange={onChangeMock}
				/>
			));

			const rows = container.querySelectorAll('tbody tr');
			expect(rows.length).toBe(mockRegions.length);

			const deleteButtons = container.querySelectorAll('.delete-button');
			fireEvent.click(deleteButtons[0]);

			// Verify onChange was called with one less region
			expect(onChangeMock).toHaveBeenCalled();
			const updatedRegions = onChangeMock.mock.calls[0][0];
			expect(updatedRegions.length).toBe(mockRegions.length - 1);
		});
	});

	describe('Checkbox Interaction', () => {
		it('should toggle italic checkbox', () => {
			const { container } = render(() => (
				<EditableRegionsData
					profileId="test-profile"
					currentRegions={mockRegions}
					savedRegions={mockRegions}
					onChange={onChangeMock}
				/>
			));

			const checkbox = container.querySelector(
				'tbody tr:first-child .italic-checkbox'
			) as HTMLInputElement;
			expect(checkbox.checked).toBe(false);

			fireEvent.click(checkbox);
			expect(checkbox.checked).toBe(true);
		});

		it('should update isItalic when checkbox is toggled', () => {
			const { container } = render(() => (
				<EditableRegionsData
					profileId="test-profile"
					currentRegions={mockRegions}
					savedRegions={mockRegions}
					onChange={onChangeMock}
				/>
			));

			const checkbox = container.querySelector(
				'tbody tr:first-child .italic-checkbox'
			) as HTMLInputElement;
			fireEvent.click(checkbox);

			expect(onChangeMock).toHaveBeenCalled();
			const updatedRegions = onChangeMock.mock.calls[0][0];
			expect(updatedRegions[0].isItalic).toBe(true);
		});
	});

	describe('Region Updates', () => {
		it.skip('should sync regions when profile changes', () => {
			const firstProfile = 'profile-1';
			const secondProfile = 'profile-2';

			const { container } = render(() => (
				<EditableRegionsData
					profileId={firstProfile}
					currentRegions={mockRegions}
					savedRegions={mockRegions}
					onChange={onChangeMock}
				/>
			));

			let rows = container.querySelectorAll('tbody tr');
			expect(rows.length).toBe(mockRegions.length);

			// Simulate profile change with different regions
			const { container: container2 } = render(() => (
				<EditableRegionsData
					profileId={secondProfile}
					currentRegions={[mockRegions[0]]}
					savedRegions={[mockRegions[0]]}
					onChange={onChangeMock}
				/>
			));

			rows = container2.querySelectorAll('tbody tr');
			expect(rows.length).toBe(1);
		});

		it('should handle empty region list gracefully', () => {
			render(() => (
				<EditableRegionsData
					profileId="test-profile"
					currentRegions={[]}
					savedRegions={[]}
					onChange={onChangeMock}
				/>
			));

			expect(screen.getByText(/No regions drawn yet/i)).toBeTruthy();
			expect(screen.getByText('Drawn Regions (0)')).toBeTruthy();
		});
	});
});
