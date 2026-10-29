import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@solidjs/testing-library';

import DropZone from '#c/ui/DropZone';

describe('DropZone', () => {
	describe('content', () => {
		it('should show the heading, privacy line and three steps', () => {
			render(() => <DropZone onChooseFiles={vi.fn()} onImportClick={vi.fn()} />);
			expect(screen.getByText('Drop scoreboard screenshots here')).toBeDefined();
			expect(screen.getByText(/never leave your browser/)).toBeDefined();
			expect(screen.getAllByRole('listitem')).toHaveLength(3);
		});
	});

	describe('buttons', () => {
		it('should call onChooseFiles from Choose Files', () => {
			const onChooseFiles = vi.fn();
			render(() => <DropZone onChooseFiles={onChooseFiles} onImportClick={vi.fn()} />);
			fireEvent.click(screen.getByText('Choose Files'));
			expect(onChooseFiles).toHaveBeenCalledTimes(1);
		});

		it('should call onImportClick from Import Records', () => {
			const onImportClick = vi.fn();
			render(() => <DropZone onChooseFiles={vi.fn()} onImportClick={onImportClick} />);
			fireEvent.click(screen.getByText('Import Records'));
			expect(onImportClick).toHaveBeenCalledTimes(1);
		});
	});
});
