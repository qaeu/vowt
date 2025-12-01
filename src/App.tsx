import {
	createSignal,
	onMount,
	onCleanup,
	Switch,
	Match,
	type Component,
} from 'solid-js';

import ScoreboardOCR from '#c/ScoreboardOCR';
import RegionProfileManager from '#c/RegionProfileManager';
import GameRecordsTable from '#c/GameRecordsTable';
import { triggerUploadDialog, handleFileUpload } from '#utils/gameStorage';
import '#styles/App';

type ViewMode = 'ocr' | 'records' | 'regions';

const App: Component = () => {
	const [viewMode, setViewMode] = createSignal<ViewMode>('records');
	const [uploadedImage, setUploadedImage] = createSignal<string | null>(null);
	const [isDragging, setIsDragging] = createSignal(false);

	const handleDragOver = (e: DragEvent) => {
		e.preventDefault();
		e.stopPropagation();
		if (
			e.dataTransfer?.items[0]?.kind === 'file' &&
			e.dataTransfer.items[0].type.startsWith('image/')
		) {
			setIsDragging(true);
		}
	};

	const handleDragLeave = (e: DragEvent) => {
		e.preventDefault();
		e.stopPropagation();
		setIsDragging(false);
	};

	const handleDrop = (e: DragEvent) => {
		e.preventDefault();
		e.stopPropagation();
		setIsDragging(false);

		const file = e.dataTransfer?.files[0] as File;
		const currentViewMode = viewMode();
		handleFileUpload(file, (imageData) => {
			setUploadedImage(imageData);
			// If we're in regions view, stay in regions view; otherwise go to OCR
			if (currentViewMode !== 'regions') {
				setViewMode('ocr');
			}
		});
	};

	onMount(() => {
		document.addEventListener('dragover', handleDragOver);
		document.addEventListener('dragleave', handleDragLeave);
		document.addEventListener('drop', handleDrop);
	});

	onCleanup(() => {
		document.removeEventListener('dragover', handleDragOver);
		document.removeEventListener('dragleave', handleDragLeave);
		document.removeEventListener('drop', handleDrop);
	});

	const handleUploadClick = () => {
		triggerUploadDialog((imageData) => {
			setUploadedImage(imageData);
			setViewMode('ocr');
		});
	};

	const handleCloseOCR = () => {
		setViewMode('records');
	};

	return (
		<div>
			{isDragging() && (
				<div class="drag-overlay">
					<div class="drag-overlay-content">
						<div class="drag-overlay-icon">📤</div>
						<div class="drag-overlay-text">Drop image here to analyze</div>
					</div>
				</div>
			)}
			<Switch>
				<Match when={viewMode() === 'ocr'}>
					{viewMode() === 'ocr' && (
						<ScoreboardOCR
							uploadedImage={uploadedImage()}
							onClose={handleCloseOCR}
							onOpenRegionManager={() => setViewMode('regions')}
						/>
					)}{' '}
				</Match>
				<Match when={viewMode() === 'records'}>
					<GameRecordsTable onUploadClick={handleUploadClick} />
				</Match>
				<Match when={viewMode() === 'regions'}>
					<RegionProfileManager
						previewImage={uploadedImage()}
						onClose={() => setViewMode('ocr')}
					/>
				</Match>
			</Switch>
		</div>
	);
};

export default App;
