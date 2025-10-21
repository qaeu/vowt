import type { Component } from 'solid-js';
import { createSignal } from 'solid-js';
import ScoreboardOCR from './components/ScoreboardOCR';
import RegionDebugger from './components/RegionDebugger';
import GameRecordsTable from './components/GameRecordsTable';
import './App.scss';

type ViewMode = 'ocr' | 'records' | 'debugger';

const App: Component = () => {
    const [viewMode, setViewMode] = createSignal<ViewMode>('records');

    return (
        <div>
            <div class="nav-container">
                {viewMode() !== 'ocr' && (
                    <button
                        onClick={() => setViewMode('ocr')}
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

            {viewMode() === 'ocr' && <ScoreboardOCR />}
            {viewMode() === 'records' && <GameRecordsTable />}
            {viewMode() === 'debugger' && <RegionDebugger />}
        </div>
    );
};

export default App;
