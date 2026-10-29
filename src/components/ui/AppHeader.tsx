import type { Component } from 'solid-js';
import type { LucideIcon } from 'lucide-solid';
import { For } from 'solid-js';
import { Dynamic } from 'solid-js/web';
import { History, ChartLine, ScanSearch, Sun, Moon, Upload } from 'lucide-solid';

import '#styles/ui/AppHeader';

/** Screens that can be reached from the header navigation */
export type NavView = 'records' | 'insights' | 'regions';

/** Every screen the app can show; `ocr` (review) has no nav item */
export type ViewMode = NavView | 'ocr';

interface AppHeaderProps {
	/** The screen currently shown; its nav item is marked as the current page */
	viewMode: ViewMode;
	onNavigate: (view: NavView) => void;
	onUploadClick: () => void;
	isDarkMode: boolean;
	onToggleDarkMode: () => void;
}

interface NavItem {
	view: NavView;
	text: string;
	icon: LucideIcon;
}

const NAV_ITEMS: NavItem[] = [
	{ view: 'records', text: 'History', icon: History },
	{ view: 'insights', text: 'Insights', icon: ChartLine },
	{ view: 'regions', text: 'Region profiles', icon: ScanSearch },
];

const AppHeader: Component<AppHeaderProps> = (props) => {
	return (
		<header class="app-header">
			<span class="app-header__wordmark">VOWT</span>

			<nav class="app-header__nav" aria-label="Main">
				<For each={NAV_ITEMS}>
					{(item) => (
						<button
							class="app-header__nav-item"
							aria-current={props.viewMode === item.view ? 'page' : undefined}
							onClick={() => props.onNavigate(item.view)}
						>
							<Dynamic<LucideIcon> component={item.icon} size={16} /> {item.text}
						</button>
					)}
				</For>
			</nav>

			<div class="app-header__actions">
				<button
					class="app-header__theme-toggle"
					title="Toggle dark mode"
					aria-label="Toggle dark mode"
					onClick={() => props.onToggleDarkMode()}
				>
					<Dynamic<LucideIcon> component={props.isDarkMode ? Moon : Sun} size={18} />
				</button>
				<button class="primary" onClick={() => props.onUploadClick()}>
					<Upload size={16} /> Upload Screenshots
				</button>
			</div>
		</header>
	);
};

export default AppHeader;
