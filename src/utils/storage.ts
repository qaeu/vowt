import type { Settings } from '#/types';

const STORAGE_KEY = 'vowt_settings';
const DEFAULT_SETTINGS: Settings = {
	darkMode: false,
};

export function loadSettings(): Settings {
	const settings = localStorage.getItem(STORAGE_KEY);

	if (!settings) {
		return DEFAULT_SETTINGS;
	}
	return JSON.parse(settings);
}

export function saveSettings(settings: Settings): void {
	localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}
