import { ExportedProfile } from '#utils/regionProfiles.js';
import postGame5v5 from './post-game_5v5.json';

/**
 * Default region profiles bundled with the app
 * Each profile should have type: 'vowt-region-profile' to be loaded
 */
export const defaultProfiles = [postGame5v5 as ExportedProfile];
