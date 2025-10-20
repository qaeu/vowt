import type { Component } from 'solid-js';
import { createSignal, onMount, onCleanup } from 'solid-js';
import ScoreboardOCR from './components/ScoreboardOCR';
import RegionDebugger from './components/RegionDebugger';
import GameRecordsTable from './components/GameRecordsTable';

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
                setViewMode('ocr');
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
                <div
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        'background-color': 'rgba(25, 118, 210, 0.2)',
                        'z-index': 9999,
                        display: 'flex',
                        'align-items': 'center',
                        'justify-content': 'center',
                        border: '4px dashed #1976d2',
                        'pointer-events': 'none',
                    }}
                >
                    <div
                        style={{
                            'background-color': 'white',
                            padding: '40px 60px',
                            'border-radius': '12px',
                            'box-shadow': '0 8px 24px rgba(0,0,0,0.3)',
                            'text-align': 'center',
                        }}
                    >
                        <div style={{ 'font-size': '48px', 'margin-bottom': '16px' }}>
                            📤
                        </div>
                        <div
                            style={{
                                'font-size': '24px',
                                'font-weight': 'bold',
                                color: '#1976d2',
                            }}
                        >
                            Drop image here to analyze
                        </div>
                    </div>
                </div>
            )}
            <div
                style={{
                    position: 'fixed',
                    top: '10px',
                    right: '10px',
                    'z-index': 1000,
                    display: 'flex',
                    gap: '10px',
                }}
            >
                {viewMode() !== 'ocr' && (
                    <button
                        onClick={() => {
                            setUploadedImage(null);
                            setViewMode('ocr');
                        }}
                        style={{
                            padding: '8px 16px',
                            'background-color': '#1976d2',
                            color: 'white',
                            border: 'none',
                            'border-radius': '4px',
                            cursor: 'pointer',
                            'font-size': '12px',
                            'font-weight': 'bold',
                            'box-shadow': '0 2px 4px rgba(0,0,0,0.2)',
                        }}
                    >
                        🔍 OCR
                    </button>
                )}
                {viewMode() !== 'records' && (
                    <button
                        onClick={() => setViewMode('records')}
                        style={{
                            padding: '8px 16px',
                            'background-color': '#4caf50',
                            color: 'white',
                            border: 'none',
                            'border-radius': '4px',
                            cursor: 'pointer',
                            'font-size': '12px',
                            'font-weight': 'bold',
                            'box-shadow': '0 2px 4px rgba(0,0,0,0.2)',
                        }}
                    >
                        📊 Records
                    </button>
                )}
                {viewMode() !== 'debugger' && (
                    <button
                        onClick={() => setViewMode('debugger')}
                        style={{
                            padding: '8px 16px',
                            'background-color': '#ff9800',
                            color: 'white',
                            border: 'none',
                            'border-radius': '4px',
                            cursor: 'pointer',
                            'font-size': '12px',
                            'font-weight': 'bold',
                            'box-shadow': '0 2px 4px rgba(0,0,0,0.2)',
                        }}
                    >
                        📍 Debugger
                    </button>
                )}
            </div>

            {viewMode() === 'ocr' && <ScoreboardOCR uploadedImage={uploadedImage()} />}
            {viewMode() === 'records' && <GameRecordsTable />}
            {viewMode() === 'debugger' && <RegionDebugger />}
        </div>
    );
};

export default App;
