import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { render, screen, fireEvent } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';

import type { DrawnRegion } from '#types';
import RegionInspector from '#c/ui/RegionInspector';

describe('RegionInspector', () => {
	const mockRegions: DrawnRegion[] = [
		{
			name: 'player_name',
			x: 100,
			y: 200,
			width: 150,
			height: 30,
			charSet: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
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
			group: 'blue',
			row: 2,
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
			imgHashSet: 'heroes',
			colour: '#0000FF',
			id: 'mock-2',
		},
	];

	let onChange: Mock<(regions: DrawnRegion[]) => void>;
	let onSelect: Mock<(id: string | null) => void>;

	/** Renders the inspector wired to signals, as the region profile manager does */
	const renderInspector = (
		options: { selectedId?: string | null; regions?: DrawnRegion[] } = {}
	) => {
		const regions = options.regions ?? mockRegions;
		const [current, setCurrent] = createSignal(regions);
		const [saved, setSaved] = createSignal(regions);
		const [selectedId, setSelectedId] = createSignal(options.selectedId ?? null);
		const [profileId, setProfileId] = createSignal('test-profile');

		onChange.mockImplementation((next) => setCurrent(next));
		onSelect.mockImplementation((id) => setSelectedId(id));

		const result = render(() => (
			<RegionInspector
				profileId={profileId()}
				currentRegions={current()}
				savedRegions={saved()}
				selectedId={selectedId()}
				groupNames={['blue', 'red']}
				onSelect={onSelect}
				onChange={onChange}
			/>
		));

		return { ...result, current, setCurrent, setSaved, setSelectedId, setProfileId };
	};

	const listItem = (name: string) =>
		screen.getByRole('button', { name: new RegExp(`^${name}`) });

	const listNames = () =>
		Array.from(document.querySelectorAll('.region-inspector__item-name')).map(
			(el) => el.textContent
		);

	const field = (label: string) => screen.getByLabelText(label) as HTMLInputElement;

	beforeEach(() => {
		onChange = vi.fn();
		onSelect = vi.fn();
	});

	describe('Region list', () => {
		it('should list every region with its size and position', () => {
			renderInspector();

			expect(listNames()).toEqual(['player_name', 'score_blue', 'hero_name']);
			expect(screen.getByText('150×30 at (100, 200)')).toBeTruthy();
		});

		it('should show an empty state without regions', () => {
			renderInspector({ regions: [] });
			expect(screen.getByText(/No regions yet/)).toBeTruthy();
		});

		it('should mark the selected region as pressed', () => {
			renderInspector({ selectedId: 'mock-1' });

			expect(listItem('score_blue').getAttribute('aria-pressed')).toBe('true');
			expect(listItem('player_name').getAttribute('aria-pressed')).toBe('false');
		});

		it('should select a region when clicked', () => {
			renderInspector();
			fireEvent.click(listItem('hero_name'));
			expect(onSelect).toHaveBeenCalledWith('mock-2');
		});

		it('should suggest alignment group names', () => {
			renderInspector();
			const options = document.querySelectorAll('#region-inspector-groups option');
			expect(Array.from(options).map((o) => o.getAttribute('value'))).toEqual([
				'blue',
				'red',
			]);
		});

		describe('filtering', () => {
			const search = (value: string) =>
				fireEvent.input(screen.getByLabelText('Search regions'), { target: { value } });

			it('should filter by name, ignoring case', () => {
				renderInspector();
				search('NAME');
				expect(listNames()).toEqual(['player_name', 'hero_name']);
			});

			it('should filter by alignment group', () => {
				renderInspector();
				search('blue');
				expect(listNames()).toEqual(['score_blue']);
			});

			it('should show a message when nothing matches', () => {
				renderInspector();
				search('kills');
				expect(listNames()).toEqual([]);
				expect(screen.getByText("No regions match 'kills'.")).toBeTruthy();
			});

			it('should show every region again when cleared', () => {
				renderInspector();
				search('hero');
				search('');
				expect(listNames()).toHaveLength(3);
			});

			it('should keep the selected region editable when filtered out', () => {
				renderInspector({ selectedId: 'mock-0' });
				search('hero');
				expect(field('Name').value).toBe('player_name');
			});
		});
	});

	describe('Selected region fields', () => {
		it('should prompt for a selection when nothing is selected', () => {
			renderInspector();
			expect(screen.getByText(/Select a region on the image/)).toBeTruthy();
			expect(screen.queryByLabelText('Name')).toBeNull();
		});

		it('should show the selected region in its fields', () => {
			renderInspector({ selectedId: 'mock-1' });

			expect(field('Name').value).toBe('score_blue');
			expect(field('X').value).toBe('50');
			expect(field('Y').value).toBe('100');
			expect(field('W').value).toBe('80');
			expect(field('H').value).toBe('40');
			expect(field('Characters').value).toBe('0123456789');
			expect(field('Alignment group').value).toBe('blue');
			expect(field('Row').value).toBe('2');
			expect(field('Image hash set').value).toBe('');
			expect(field('Italic').checked).toBe(false);
		});

		it('should switch fields when another region is selected', () => {
			const { setSelectedId } = renderInspector({ selectedId: 'mock-0' });
			setSelectedId('mock-2');

			expect(field('Name').value).toBe('hero_name');
			expect(field('Image hash set').value).toBe('heroes');
			expect(field('Italic').checked).toBe(true);
		});

		describe('editing', () => {
			it('should update only the edited field of the selected region', () => {
				renderInspector({ selectedId: 'mock-0' });

				fireEvent.input(field('Name'), { target: { value: 'new_name' } });

				const updated = onChange.mock.lastCall![0];
				expect(updated[0]).toEqual({ ...mockRegions[0], name: 'new_name' });
				expect(updated[1]).toBe(mockRegions[1]);
				expect(updated[2]).toBe(mockRegions[2]);
			});

			it('should keep the input mounted while typing', () => {
				renderInspector({ selectedId: 'mock-0' });
				const input = field('Name');

				fireEvent.input(input, { target: { value: 'a' } });
				fireEvent.input(input, { target: { value: 'ab' } });

				expect(field('Name')).toBe(input);
			});

			it('should store positions as numbers', () => {
				renderInspector({ selectedId: 'mock-0' });
				fireEvent.input(field('W'), { target: { value: '175' } });
				expect(onChange.mock.lastCall![0][0].width).toBe(175);
			});

			it('should update the group and clear it when emptied', () => {
				renderInspector({ selectedId: 'mock-1' });

				fireEvent.input(field('Alignment group'), { target: { value: 'red' } });
				expect(onChange.mock.lastCall![0][1].group).toBe('red');

				fireEvent.input(field('Alignment group'), { target: { value: '' } });
				expect(onChange.mock.lastCall![0][1].group).toBeUndefined();
			});

			it('should update the row as a number and clear it when emptied', () => {
				renderInspector({ selectedId: 'mock-1' });

				fireEvent.input(field('Row'), { target: { value: '4' } });
				expect(onChange.mock.lastCall![0][1].row).toBe(4);

				fireEvent.input(field('Row'), { target: { value: '' } });
				expect(onChange.mock.lastCall![0][1].row).toBeUndefined();
			});

			it('should clear the character set when emptied', () => {
				renderInspector({ selectedId: 'mock-0' });
				fireEvent.input(field('Characters'), { target: { value: '' } });
				expect(onChange.mock.lastCall![0][0].charSet).toBeUndefined();
			});

			it('should toggle italic', () => {
				renderInspector({ selectedId: 'mock-0' });

				fireEvent.click(field('Italic'));

				expect(field('Italic').checked).toBe(true);
				expect(onChange.mock.lastCall![0][0].isItalic).toBe(true);
			});

			it('should delete the selected region and clear the selection', () => {
				renderInspector({ selectedId: 'mock-1' });

				fireEvent.click(screen.getByRole('button', { name: 'Delete Region' }));

				expect(onChange.mock.lastCall![0].map((r) => r.id)).toEqual(['mock-0', 'mock-2']);
				expect(onSelect).toHaveBeenCalledWith(null);
				expect(screen.queryByLabelText('Name')).toBeNull();
				expect(listNames()).toEqual(['player_name', 'hero_name']);
			});
		});
	});

	describe('Changed state', () => {
		it('should mark an edited field as modified', () => {
			renderInspector({ selectedId: 'mock-0' });

			fireEvent.input(field('Name'), { target: { value: 'new_name' } });

			expect(field('Name').classList.contains('modified')).toBe(true);
		});

		it('should mark edited regions in the list', () => {
			renderInspector({ selectedId: 'mock-0' });
			expect(listItem('player_name').classList).not.toContain(
				'region-inspector__item--changed'
			);

			fireEvent.input(field('Name'), { target: { value: 'new_name' } });

			expect(listItem('new_name').classList).toContain('region-inspector__item--changed');
			expect(screen.getByText('Changed')).toBeTruthy();
			expect(listItem('score_blue').classList).not.toContain(
				'region-inspector__item--changed'
			);
		});

		it('should clear the marker when a value is changed back', () => {
			renderInspector({ selectedId: 'mock-0' });

			fireEvent.input(field('X'), { target: { value: '101' } });
			fireEvent.input(field('X'), { target: { value: '100' } });

			expect(field('X').classList.contains('modified')).toBe(false);
			expect(screen.queryByText('Changed')).toBeNull();
		});

		it('should mark regions that have not been saved yet', () => {
			const { setCurrent } = renderInspector();
			setCurrent([
				...mockRegions,
				{ id: 'drawn-0', name: 'region_0', x: 0, y: 0, width: 9, height: 9, colour: '' },
			]);

			expect(listItem('region_0').classList).toContain('region-inspector__item--changed');
		});

		it('should mark a modified italic checkbox', () => {
			renderInspector({ selectedId: 'mock-0' });

			fireEvent.click(field('Italic'));

			expect(field('Italic').closest('label')?.classList).toContain(
				'region-inspector__check--modified'
			);
		});

		describe('saving', () => {
			beforeEach(() => vi.useFakeTimers());
			afterEach(() => vi.useRealTimers());

			it('should flash saved fields and clear the modified state', () => {
				const { current, setSaved } = renderInspector({ selectedId: 'mock-0' });
				fireEvent.input(field('Name'), { target: { value: 'new_name' } });

				setSaved(current());

				expect(field('Name').classList.contains('modified')).toBe(false);
				expect(field('Name').classList.contains('just-saved')).toBe(true);
				expect(field('X').classList.contains('just-saved')).toBe(false);
				expect(screen.queryByText('Changed')).toBeNull();

				vi.advanceTimersByTime(2000);
				expect(field('Name').classList.contains('just-saved')).toBe(false);
			});
		});

		describe('discarding', () => {
			it('should reset edited fields when the regions return to the saved ones', () => {
				const { setCurrent } = renderInspector({ selectedId: 'mock-0' });
				fireEvent.input(field('Name'), { target: { value: 'new_name' } });

				setCurrent(mockRegions);

				expect(field('Name').value).toBe('player_name');
				expect(field('Name').classList.contains('modified')).toBe(false);
				expect(field('Name').classList.contains('just-saved')).toBe(false);
			});
		});
	});

	describe('Profile changes', () => {
		it('should show the new profile regions', () => {
			const { setCurrent, setSaved, setProfileId, setSelectedId } = renderInspector({
				selectedId: 'mock-0',
			});

			setProfileId('other-profile');
			setSelectedId(null);
			setSaved([mockRegions[2]]);
			setCurrent([mockRegions[2]]);

			expect(listNames()).toEqual(['hero_name']);
			expect(screen.queryByLabelText('Name')).toBeNull();
		});
	});
});
