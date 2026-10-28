import type { Component } from 'solid-js';
import { createSignal, onMount, onCleanup, Switch, Match } from 'solid-js';
import { Dynamic } from 'solid-js/web';
import { Sun, Moon } from 'lucide-solid';

import ScoreboardOCR from '#c/ScoreboardOCR';
import RegionProfileManager from '#c/RegionProfileManager';
import GameRecordsTable from '#c/GameRecordsTable';
import Insights from '#c/Insights';
import type { UploadBatch } from '#c/ScoreboardOCR';
import {
	triggerUploadDialog,
	readImageFiles,
	loadSettings,
	saveSettings,
} from '#utils/storage';
import '#styles/App';

type ViewMode = 'ocr' | 'records' | 'regions' | 'insights';

const App: Component = () => {
	const [viewMode, setViewMode] = createSignal<ViewMode>('records');
	const [uploadBatch, setUploadBatch] = createSignal<UploadBatch | null>(null);
	const [isDragging, setIsDragging] = createSignal(false);
	const [openRecordId, setOpenRecordId] = createSignal<string | null>(null);

	const settings = loadSettings();
	const [isDarkMode, setIsDarkMode] = createSignal(settings.darkMode);

	const handleDragOver = (e: DragEvent) => {
		e.preventDefault();
		e.stopPropagation();
		const items = Array.from(e.dataTransfer?.items ?? []);
		if (items.some((item) => item.kind === 'file' && item.type.startsWith('image/'))) {
			setIsDragging(true);
		}
	};

	const handleDragLeave = (e: DragEvent) => {
		e.preventDefault();
		e.stopPropagation();
		setIsDragging(false);
	};

	const handleDrop = async (e: DragEvent) => {
		e.preventDefault();
		e.stopPropagation();
		setIsDragging(false);

		const currentViewMode = viewMode();
		const images = await readImageFiles(e.dataTransfer?.files ?? []);
		if (images.length === 0) return;

		setUploadBatch({ images });
		// If we're in regions view, stay in regions view; otherwise go to OCR
		if (currentViewMode !== 'regions') {
			setViewMode('ocr');
		}
	};

	onMount(() => {
		document.addEventListener('dragover', handleDragOver);
		document.addEventListener('dragleave', handleDragLeave);
		document.addEventListener('drop', handleDrop);

		if (isDarkMode()) {
			document.querySelector('body')?.classList.add('dark-theme');
		}
	});

	onCleanup(() => {
		document.removeEventListener('dragover', handleDragOver);
		document.removeEventListener('dragleave', handleDragLeave);
		document.removeEventListener('drop', handleDrop);
	});

	const handleUploadClick = () => {
		triggerUploadDialog((images) => {
			setUploadBatch({ images });
			setViewMode('ocr');
		});
	};

	const handleOpenRecord = (recordId: string) => {
		setOpenRecordId(recordId);
		setViewMode('records');
	};

	const handleCloseOCR = () => {
		setViewMode('records');
	};

	const handleDarkMode = () => {
		const currentDarkMode = isDarkMode();
		setIsDarkMode(!currentDarkMode);
		saveSettings({ ...loadSettings(), darkMode: !currentDarkMode });
		document.querySelector('body')?.classList.toggle('dark-theme');
	};

	return (
		<div>
			{isDragging() && (
				<div class="drag-overlay">
					<div class="drag-overlay-content">
						<div class="drag-overlay-icon">📤</div>
						<div class="drag-overlay-text">Drop images here to analyze</div>
					</div>
				</div>
			)}
			<Switch>
				<Match when={viewMode() === 'ocr'}>
					{viewMode() === 'ocr' && (
						<ScoreboardOCR
							uploadBatch={uploadBatch()}
							onClose={handleCloseOCR}
							onOpenRegionManager={() => setViewMode('regions')}
						/>
					)}{' '}
				</Match>
				<Match when={viewMode() === 'records'}>
					<GameRecordsTable
						onUploadClick={handleUploadClick}
						onInsightsClick={() => setViewMode('insights')}
						initialExpandedId={openRecordId()}
					/>
				</Match>
				<Match when={viewMode() === 'insights'}>
					<Insights
						onRecordsClick={() => {
							setOpenRecordId(null);
							setViewMode('records');
						}}
						onOpenRecord={handleOpenRecord}
					/>
				</Match>
				<Match when={viewMode() === 'regions'}>
					<RegionProfileManager
						previewImage={uploadBatch()?.images[0] ?? null}
						onClose={() => setViewMode('ocr')}
					/>
				</Match>
			</Switch>

			<button
				title="Toggle dark mode"
				aria-label="Toggle dark mode"
				class="dark-mode-toggle"
				onClick={handleDarkMode}
			>
				<Dynamic component={isDarkMode() ? Moon : Sun} size={18} />
			</button>
		</div>
	);
};

export default App;
