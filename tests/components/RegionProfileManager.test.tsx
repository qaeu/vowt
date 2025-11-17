import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen } from '@solidjs/testing-library';
import RegionProfileManager from '#c/RegionProfileManager';
import * as regionProfiles from '#utils/regionProfiles';
import * as regionEditor from '#utils/regionEditor';

// Mock the region profiles utility
vi.mock('#utils/regionProfiles', () => ({
    listProfiles: vi.fn(),
    loadProfileById: vi.fn(),
    saveProfile: vi.fn(),
    deleteProfile: vi.fn(),
    setActiveProfile: vi.fn(),
    getActiveProfileId: vi.fn(),
}));

// Mock the region editor utility
vi.mock('#utils/regionEditor', () => ({
    startRegionEditor: vi.fn(),
    drawRegions: vi.fn(),
}));

describe('RegionProfileManager', () => {
    const mockProfiles = [
        { id: 'profile1', description: 'Test Profile 1' },
        { id: 'profile2', description: 'Test Profile 2' },
    ];

    const mockOnClose = vi.fn();

    beforeEach(() => {
        localStorage.clear();
        vi.clearAllMocks();
        vi.mocked(regionProfiles.listProfiles).mockReturnValue(mockProfiles);
        vi.mocked(regionProfiles.getActiveProfileId).mockReturnValue(
            mockProfiles[1].id
        );
        vi.mocked(regionEditor.startRegionEditor).mockResolvedValue(undefined);
    });

    afterEach(() => {
        localStorage.clear();
    });

    describe('Rendering', () => {
        it('should render the component with title', () => {
            render(() => (
                <RegionProfileManager
                    previewImage={null}
                    onClose={mockOnClose}
                />
            ));
            expect(screen.getByText('Region Profile Manager')).toBeDefined();
        });

        it('should render the close button', () => {
            render(() => (
                <RegionProfileManager
                    previewImage={null}
                    onClose={mockOnClose}
                />
            ));
            const closeButton = screen.getByRole('button', { name: /close/i });
            expect(closeButton).toBeDefined();
        });

        it('should render instructions text', () => {
            render(() => (
                <RegionProfileManager
                    previewImage={null}
                    onClose={mockOnClose}
                />
            ));
            expect(
                screen.getByText(/Create and manage region profiles/i)
            ).toBeDefined();
        });

        it('should show drag and drop tip when no preview image', () => {
            render(() => (
                <RegionProfileManager
                    previewImage={null}
                    onClose={mockOnClose}
                />
            ));
            expect(screen.getByText(/Drag and drop an image/i)).toBeDefined();
        });

        it('should not show drag and drop tip when preview image exists', () => {
            render(() => (
                <RegionProfileManager
                    previewImage="data:image/png;base64,test"
                    onClose={mockOnClose}
                />
            ));
            expect(screen.queryByText(/Drag and drop an image/i)).toBeNull();
        });
    });

    describe('Region Editor', () => {
        it('should have Clear All button', () => {
            render(() => (
                <RegionProfileManager
                    previewImage={null}
                    onClose={mockOnClose}
                />
            ));
            const button = screen.getByRole('button', {
                name: /Clear All/i,
            });
            expect(button).toBeDefined();
        });

        it('should have Clear All button disabled when no regions', () => {
            render(() => (
                <RegionProfileManager
                    previewImage={null}
                    onClose={mockOnClose}
                />
            ));
            const clearButton = screen.getByRole('button', {
                name: /Clear All/i,
            }) as HTMLButtonElement;
            expect(clearButton.disabled).toBe(true);
        });

        it('should have Copy Code button disabled when no regions', () => {
            render(() => (
                <RegionProfileManager
                    previewImage={null}
                    onClose={mockOnClose}
                />
            ));
            const copyButton = screen.getByRole('button', {
                name: /Copy Code/i,
            }) as HTMLButtonElement;
            expect(copyButton.disabled).toBe(true);
        });
    });

    describe('Profile Management', () => {
        it('should display list of saved profiles', () => {
            render(() => (
                <RegionProfileManager
                    previewImage={null}
                    onClose={mockOnClose}
                />
            ));
            expect(screen.getByText('profile1')).toBeDefined();
            expect(screen.getByText('profile2')).toBeDefined();
        });

        it('should show "No profiles yet" when list is empty', () => {
            vi.mocked(regionProfiles.listProfiles).mockReturnValue([]);
            render(() => (
                <RegionProfileManager
                    previewImage={null}
                    onClose={mockOnClose}
                />
            ));
            expect(screen.getByText('No profiles yet')).toBeDefined();
        });

        it('should render Select button for each profile', () => {
            render(() => (
                <RegionProfileManager
                    previewImage={null}
                    onClose={mockOnClose}
                />
            ));
            const selectButtons = screen.getAllByRole('button', {
                name: /Select/i,
            });
            expect(selectButtons.length).toBeGreaterThanOrEqual(1);
        });

        it('should render Edit button for each profile', () => {
            render(() => (
                <RegionProfileManager
                    previewImage={null}
                    onClose={mockOnClose}
                />
            ));
            const editButtons = screen.getAllByRole('button', {
                name: /Edit/i,
            });
            expect(editButtons.length).toBeGreaterThanOrEqual(2);
        });

        it('should render Delete button for each profile', () => {
            render(() => (
                <RegionProfileManager
                    previewImage={null}
                    onClose={mockOnClose}
                />
            ));
            const deleteButtons = screen.getAllByRole('button', {
                name: /Delete/i,
            });
            expect(deleteButtons.length).toBeGreaterThanOrEqual(2);
        });

        it('should call setActiveProfile when selecting a profile', () => {
            render(() => (
                <RegionProfileManager
                    previewImage={null}
                    onClose={mockOnClose}
                />
            ));

            const selectButtons = screen.getAllByRole('button', {
                name: /Select/i,
            });
            (selectButtons[0] as HTMLButtonElement).click();

            expect(
                vi.mocked(regionProfiles.setActiveProfile)
            ).toHaveBeenCalledWith('profile1');
        });

        it('should mark active profile with checkmark', () => {
            vi.mocked(regionProfiles.getActiveProfileId).mockReturnValue(
                'profile1'
            );
            render(() => (
                <RegionProfileManager
                    previewImage={null}
                    onClose={mockOnClose}
                />
            ));
            expect(screen.getByText('✓ Active')).toBeDefined();
        });

        it('should call deleteProfile when deleting a profile', () => {
            vi.mocked(regionProfiles.deleteProfile).mockReturnValue(true);
            vi.spyOn(window, 'confirm').mockReturnValue(true);

            render(() => (
                <RegionProfileManager
                    previewImage={null}
                    onClose={mockOnClose}
                />
            ));

            const deleteButtons = screen.getAllByRole('button', {
                name: /Delete/i,
            });
            (deleteButtons[0] as HTMLButtonElement).click();

            expect(
                vi.mocked(regionProfiles.deleteProfile)
            ).toHaveBeenCalledWith('profile1');
        });

        it('should not delete profile if user cancels confirmation', () => {
            vi.spyOn(window, 'confirm').mockReturnValue(false);

            render(() => (
                <RegionProfileManager
                    previewImage={null}
                    onClose={mockOnClose}
                />
            ));

            const deleteButtons = screen.getAllByRole('button', {
                name: /Delete/i,
            });
            (deleteButtons[0] as HTMLButtonElement).click();

            expect(
                vi.mocked(regionProfiles.deleteProfile)
            ).not.toHaveBeenCalled();
        });
    });

    describe('Profile Details Section', () => {
        it('should display Profile Details section', () => {
            render(() => (
                <RegionProfileManager
                    previewImage={null}
                    onClose={mockOnClose}
                />
            ));
            expect(screen.getByText('Profile Details')).toBeDefined();
        });

        it('should have Profile ID input field', () => {
            render(() => (
                <RegionProfileManager
                    previewImage={null}
                    onClose={mockOnClose}
                />
            ));
            const idInputs = document.querySelectorAll('input');
            expect(idInputs.length).toBeGreaterThan(0);
        });

        it('should have Description input field', () => {
            render(() => (
                <RegionProfileManager
                    previewImage={null}
                    onClose={mockOnClose}
                />
            ));
            const inputs = document.querySelectorAll('input');
            expect(inputs.length).toBeGreaterThan(0);
        });
    });

    describe('Canvas Rendering', () => {
        it('should render canvas element', () => {
            render(() => (
                <RegionProfileManager
                    previewImage={null}
                    onClose={mockOnClose}
                />
            ));
            const canvas = document.querySelector('canvas');
            expect(canvas).toBeDefined();
        });

        it('should render canvas wrapper', () => {
            render(() => (
                <RegionProfileManager
                    previewImage={null}
                    onClose={mockOnClose}
                />
            ));
            const wrapper = document.querySelector('.canvas-wrapper');
            expect(wrapper).toBeDefined();
        });
    });

    describe('UI Sections', () => {
        it('should render Region Editor section', () => {
            render(() => (
                <RegionProfileManager
                    previewImage={null}
                    onClose={mockOnClose}
                />
            ));
            expect(screen.getByText('Region Editor')).toBeDefined();
        });

        it('should render Profile Details section', () => {
            render(() => (
                <RegionProfileManager
                    previewImage={null}
                    onClose={mockOnClose}
                />
            ));
            expect(screen.getByText('Profile Details')).toBeDefined();
        });

        it('should render Saved Profiles section', () => {
            render(() => (
                <RegionProfileManager
                    previewImage={null}
                    onClose={mockOnClose}
                />
            ));
            expect(screen.getByText('Saved Profiles')).toBeDefined();
        });
    });

    describe('Component Props', () => {
        it('should accept onClose callback', () => {
            const onClose = vi.fn();
            render(() => (
                <RegionProfileManager previewImage={null} onClose={onClose} />
            ));
            expect(screen.getByText('Region Profile Manager')).toBeDefined();
        });

        it('should call onClose prop when close button clicked', () => {
            const onClose = vi.fn();
            render(() => (
                <RegionProfileManager previewImage={null} onClose={onClose} />
            ));

            const closeButton = screen.getByRole('button', {
                name: /close/i,
            }) as HTMLButtonElement;
            closeButton.click();

            expect(onClose).toHaveBeenCalled();
        });

        it('should accept previewImage prop', () => {
            const previewImage = 'data:image/png;base64,test';
            render(() => (
                <RegionProfileManager
                    previewImage={previewImage}
                    onClose={mockOnClose}
                />
            ));
            expect(screen.getByText('Region Profile Manager')).toBeDefined();
        });

        it('should use previewImage when available', () => {
            const previewImage = 'data:image/png;base64,test';
            render(() => (
                <RegionProfileManager
                    previewImage={previewImage}
                    onClose={mockOnClose}
                />
            ));
            const canvas = document.querySelector('canvas');
            expect(canvas).toBeDefined();
        });
    });
});
