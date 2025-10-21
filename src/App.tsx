import type { Component } from 'solid-js';
import { createSignal, onMount, onCleanup } from 'solid-js';
import ScoreboardOCR from './components/ScoreboardOCR';
import RegionDebugger from './components/RegionDebugger';
import GameRecordsTable from './components/GameRecordsTable';
import './App.scss';

type ViewMode = 'ocr' | 'records' | 'debugger';

const App: Component = () => {
    const [viewMode, setViewMode] = createSignal<ViewMode>('records');
    const [uploadedImage, setUploadedImage] = createSignal<string | null>(null);
    const [isDragging, setIsDragging] = createSignal(false);

    const handleDragOver = (e: DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
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

        const file = e.dataTransfer?.files[0];
        if (file && file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (event) => {
                const imageData = event.target?.result as string;
                setUploadedImage(imageData);
                // Switch to OCR view if not already there
                if (viewMode() !== 'ocr') {
                    setViewMode('ocr');
                }
            };
            reader.readAsDataURL(file);
        }
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

    return (
        <div>
            {isDragging() && (
                <div class="drag-overlay">
                    <div class="drag-overlay-content">
                        <div class="drag-overlay-icon">📤</div>
                        <div class="drag-overlay-text">
                            Drop image here to analyze
                        </div>
                    </div>
                </div>
            )}
            <div class="nav-container">
                {viewMode() !== 'ocr' && (
                    <button
                        onClick={() => {
                            setUploadedImage(null);
                            setViewMode('ocr');
                        }}
                        class="nav-button ocr-button"
                    >
                        🔍 OCR
                    </button>
                )}
                {viewMode() !== 'records' && (
                    <button
                        onClick={() => setViewMode('records')}
                        class="nav-button records-button"
                    >
                        📊 Records
                    </button>
                )}
                {viewMode() !== 'debugger' && (
                    <button
                        onClick={() => setViewMode('debugger')}
                        class="nav-button debugger-button"
                    >
                        📍 Debugger
                    </button>
                )}
            </div>

            {viewMode() === 'ocr' && (
                <ScoreboardOCR uploadedImage={uploadedImage()} />
            )}
            {viewMode() === 'records' && <GameRecordsTable />}
            {viewMode() === 'debugger' && <RegionDebugger />}
        </div>
    );
};

export default App;
