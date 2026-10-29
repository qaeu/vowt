import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@solidjs/testing-library';

import type { PlayerStats } from '#types';
import TeamScoreboard from '#c/ui/TeamScoreboard';

const players: PlayerStats[] = [
	{
		name: 'Alice',
		team: 'blue',
		hero: 'Tracer',
		e: '10',
		a: '5',
		d: '2',
		dmg: '15000',
		h: '800',
		mit: '1200',
	},
	{
		name: 'Bob',
		team: 'red',
		e: '8',
		a: '6',
		d: '3',
		dmg: '12000',
		h: '700',
		mit: '1000',
	},
	{
		name: 'Carol',
		team: 'blue',
		hero: 'Mercy',
		e: '1',
		a: '2',
		d: '3',
		dmg: '4',
		h: '5',
		mit: '6',
	},
];

describe('TeamScoreboard', () => {
	describe('tables', () => {
		it('should render a Blue and a Red table', () => {
			render(() => <TeamScoreboard players={players} />);
			const tables = screen.getAllByRole('table');
			expect(tables).toHaveLength(2);
			expect(screen.getByText('Blue team')).toBeDefined();
			expect(screen.getByText('Red team')).toBeDefined();
		});

		it('should list the column headings', () => {
			render(() => <TeamScoreboard players={players} />);
			const [blue] = screen.getAllByRole('table');
			const headings = within(blue)
				.getAllByRole('columnheader')
				.map((h) => h.textContent);
			expect(headings).toEqual(['Player', 'Hero', 'E', 'A', 'D', 'DMG', 'H', 'MIT']);
		});
	});

	describe('players', () => {
		it('should put each player in their own team table', () => {
			render(() => <TeamScoreboard players={players} />);
			const [blue, red] = screen.getAllByRole('table');
			expect(within(blue).getByText('Alice')).toBeDefined();
			expect(within(blue).getByText('Carol')).toBeDefined();
			expect(within(blue).queryByText('Bob')).toBeNull();
			expect(within(red).getByText('Bob')).toBeDefined();
		});

		it('should show stats and a dash for a missing hero', () => {
			render(() => <TeamScoreboard players={players} />);
			const red = screen.getAllByRole('table')[1];
			const cells = within(red).getAllByRole('row')[1].querySelectorAll('td').values();
			expect(Array.from(cells).map((c) => c.textContent)).toEqual([
				'-',
				'8',
				'6',
				'3',
				'12000',
				'700',
				'1000',
			]);
		});

		it('should render empty tables when there are no players', () => {
			render(() => <TeamScoreboard players={[]} />);
			expect(screen.getAllByRole('table')).toHaveLength(2);
			expect(screen.getAllByRole('row')).toHaveLength(2);
		});
	});
});
