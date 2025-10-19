import type { Component } from 'solid-js';
import { createSignal } from 'solid-js';
import ScoreboardOCR from './components/ScoreboardOCR';
import RegionDebugger from './components/RegionDebugger';

const App: Component = () => {
    const [showDebugger, setShowDebugger] = createSignal(false);

    return (
        <div>
            {!showDebugger() && (
                <div
                    style={{
                        position: 'fixed',
                        top: '10px',
                        right: '10px',
                        'z-index': 1000,
                    }}
                >
                    <button
                        onClick={() => setShowDebugger(true)}
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
                        📍 Region Debugger
                    </button>
                </div>
            )}

            {showDebugger() ? (
                <div>
                    <div
                        style={{
                            position: 'fixed',
                            top: '10px',
                            right: '10px',
                            'z-index': 1001,
                        }}
                    >
                        <button
                            onClick={() => setShowDebugger(false)}
                            style={{
                                padding: '8px 16px',
                                'background-color': '#f44336',
                                color: 'white',
                                border: 'none',
                                'border-radius': '4px',
                                cursor: 'pointer',
                                'font-size': '12px',
                                'font-weight': 'bold',
                                'box-shadow': '0 2px 4px rgba(0,0,0,0.2)',
                            }}
                        >
                            ✕ Back to App
                        </button>
                    </div>
                    <RegionDebugger />
                </div>
            ) : (
                <ScoreboardOCR />
            )}
        </div>
    );
};

export default App;
