import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { render, screen, fireEvent } from '@solidjs/testing-library';

import type { AlignmentDrawTarget, AlignmentGroup } from '#types';
import AlignmentGroupsEditor from '#c/ui/AlignmentGroupsEditor';

describe('AlignmentGroupsEditor', () => {
	const anchoredGroup: AlignmentGroup = {
		name: 'blue',
		anchor: {
			x: 830,
			y: 386,
			searchX: 48,
			searchY: 160,
			template: { width: 305, height: 25, data: '' },
		},
		rows: { x: 840, width: 596, y: 436, rowHeight: 84, count: 5 },
	};
	const emptyGroup: AlignmentGroup = { name: 'match_info' };

	let onChange: Mock<(groups: AlignmentGroup[]) => void>;
	let onRequestDraw: Mock<(target: AlignmentDrawTarget) => void>;
	let onCancelDraw: Mock<() => void>;

	const renderEditor = (
		groups: AlignmentGroup[] = [anchoredGroup, emptyGroup],
		drawTarget: AlignmentDrawTarget | null = null
	) =>
		render(() => (
			<AlignmentGroupsEditor
				groups={groups}
				regionCounts={{ blue: 40 }}
				drawTarget={drawTarget}
				onChange={onChange}
				onRequestDraw={onRequestDraw}
				onCancelDraw={onCancelDraw}
			/>
		));

	beforeEach(() => {
		onChange = vi.fn();
		onRequestDraw = vi.fn();
		onCancelDraw = vi.fn();
	});

	describe('Rendering', () => {
		it('should show the group count and an empty state', () => {
			renderEditor([]);

			expect(screen.getByText('Alignment Groups (0)')).toBeTruthy();
			expect(screen.getByText(/No alignment groups/)).toBeTruthy();
		});

		it('should summarise anchors, rows, and region counts', () => {
			renderEditor();

			expect(screen.getByText('610×50 at (830, 386)')).toBeTruthy();
			expect(screen.getByText('5 rows')).toBeTruthy();
			expect(screen.getByText('40 regions')).toBeTruthy();
			expect(screen.getByText('0 regions')).toBeTruthy();
			expect(screen.getAllByText('None')).toHaveLength(2);
		});

		it('should label draw buttons by whether the feature exists', () => {
			renderEditor();

			expect(screen.getByRole('button', { name: 'Redraw Anchor' })).toBeTruthy();
			expect(screen.getByRole('button', { name: 'Draw Anchor' })).toBeTruthy();
			expect(screen.getByRole('button', { name: 'Redraw Rows' })).toBeTruthy();
			expect(screen.getByRole('button', { name: 'Draw Rows' })).toBeTruthy();
		});

		it('should show a prompt while drawing and cancel it', () => {
			renderEditor(undefined, { group: 'blue', kind: 'rows' });

			expect(screen.getByText(/set the rows for 'blue'/)).toBeTruthy();
			expect(
				screen.getByRole('button', { name: 'Redraw Rows' }).classList.contains('active')
			).toBe(true);

			fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
			expect(onCancelDraw).toHaveBeenCalled();
		});
	});

	describe('Groups', () => {
		it('should add a group with a trimmed name', () => {
			renderEditor();

			fireEvent.input(screen.getByLabelText('New group name'), {
				target: { value: '  red  ' },
			});
			fireEvent.click(screen.getByRole('button', { name: 'Add Group' }));

			expect(onChange).toHaveBeenCalledWith([anchoredGroup, emptyGroup, { name: 'red' }]);
		});

		it('should add a group with the Enter key', () => {
			renderEditor();
			const input = screen.getByLabelText('New group name');

			fireEvent.input(input, { target: { value: 'red' } });
			fireEvent.keyDown(input, { key: 'Enter' });

			expect(onChange).toHaveBeenCalledWith([anchoredGroup, emptyGroup, { name: 'red' }]);
		});

		it.each([
			['empty', '   '],
			['duplicate', 'blue'],
		])('should not add a group with a %s name', (_label, name) => {
			renderEditor();

			fireEvent.input(screen.getByLabelText('New group name'), {
				target: { value: name },
			});
			const button = screen.getByRole('button', {
				name: 'Add Group',
			}) as HTMLButtonElement;

			expect(button.disabled).toBe(true);
		});

		it('should delete a group', () => {
			renderEditor();

			fireEvent.click(screen.getByTitle('Delete group match_info'));

			expect(onChange).toHaveBeenCalledWith([anchoredGroup]);
			expect(onCancelDraw).not.toHaveBeenCalled();
		});

		it('should cancel drawing when deleting the target group', () => {
			renderEditor(undefined, { group: 'blue', kind: 'anchor' });

			fireEvent.click(screen.getByTitle('Delete group blue'));

			expect(onCancelDraw).toHaveBeenCalled();
		});
	});

	describe('Features', () => {
		it('should request drawing an anchor or rows', () => {
			renderEditor();

			fireEvent.click(screen.getByRole('button', { name: 'Draw Anchor' }));
			fireEvent.click(screen.getByRole('button', { name: 'Redraw Rows' }));

			expect(onRequestDraw).toHaveBeenNthCalledWith(1, {
				group: 'match_info',
				kind: 'anchor',
			});
			expect(onRequestDraw).toHaveBeenNthCalledWith(2, { group: 'blue', kind: 'rows' });
		});

		it('should remove an anchor and rows', () => {
			renderEditor();

			fireEvent.click(screen.getByRole('button', { name: 'Remove Anchor' }));
			expect(onChange).toHaveBeenLastCalledWith([
				{ ...anchoredGroup, anchor: undefined },
				emptyGroup,
			]);

			fireEvent.click(screen.getByRole('button', { name: 'Remove Rows' }));
			expect(onChange).toHaveBeenLastCalledWith([
				{ ...anchoredGroup, rows: undefined },
				emptyGroup,
			]);
		});

		it('should update the anchor search range', () => {
			renderEditor();

			fireEvent.change(screen.getByLabelText('Search Y'), { target: { value: '200' } });

			expect(onChange).toHaveBeenCalledWith([
				{ ...anchoredGroup, anchor: { ...anchoredGroup.anchor!, searchY: 200 } },
				emptyGroup,
			]);
		});

		it('should update row fields as rounded numbers', () => {
			renderEditor();

			fireEvent.change(screen.getByLabelText('Row Height'), {
				target: { value: '82.6' },
			});

			expect(onChange).toHaveBeenCalledWith([
				{ ...anchoredGroup, rows: { ...anchoredGroup.rows!, rowHeight: 83 } },
				emptyGroup,
			]);
		});

		it.each([
			['Search X', '-5'],
			['Count', '0'],
			['Row Height', ''],
		])('should ignore an invalid %s value', (label, value) => {
			renderEditor();

			fireEvent.change(screen.getByLabelText(label), { target: { value } });

			expect(onChange).not.toHaveBeenCalled();
		});
	});
});
