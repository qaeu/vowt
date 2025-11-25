import type { ExportedProfile } from '#types';
import postGame5v5 from './post-game_5v5.json';
import inGame5v5 from './in-game_5v5.json';

/**
 * Default region profiles bundled with the app
 * Each profile should have type: 'vowt-region-profile' to be loaded
 */

export const DEFAULT_PROFILES = [
	postGame5v5 as ExportedProfile,
	inGame5v5 as ExportedProfile,
];
