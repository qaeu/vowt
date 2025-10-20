import type { Component } from 'solid-js';
import { createSignal } from 'solid-js';
import ScoreboardOCR from './components/ScoreboardOCR';
import RegionDebugger from './components/RegionDebugger';
import GameRecordsTable from './components/GameRecordsTable';

type ViewMode = 'ocr' | 'records' | 'debugger';

const App: Component = () => {
    const [viewMode, setViewMode] = createSignal<ViewMode>('records');

    return (
        <div>
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
                        onClick={() => setViewMode('ocr')}
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

            {viewMode() === 'ocr' && <ScoreboardOCR />}
            {viewMode() === 'records' && <GameRecordsTable />}
            {viewMode() === 'debugger' && <RegionDebugger />}
        </div>
    );
};

export default App;
