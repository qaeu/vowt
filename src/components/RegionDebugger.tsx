import { Component, createSignal, onMount } from 'solid-js';
import {
    startRegionEditor,
    DrawnRegion,
    formatRegionForCopy,
} from '../utils/regionEditor';

const RegionDebugger: Component = () => {
    const [regions, setRegions] = createSignal<DrawnRegion[]>([]);
    const [isEditing, setIsEditing] = createSignal(false);
    let canvasRef: HTMLCanvasElement | undefined;

    const startEditor = async () => {
        if (!canvasRef) return;
        setIsEditing(true);

        try {
            await startRegionEditor(canvasRef, '/scoreboard.png', (region) => {
                setRegions((prev) => [...prev, region]);
            });
        } catch (err) {
            console.error('Region editor error:', err);
        }

        setIsEditing(false);
    };

    const clearRegions = () => {
        setRegions([]);
        if (canvasRef) {
            const ctx = canvasRef.getContext('2d');
            if (ctx) {
                const img = new Image();
                img.onload = () => {
                    ctx.drawImage(img, 0, 0);
                };
                img.src = '/scoreboard.png';
            }
        }
    };

    const copyRegionsCode = () => {
        const code = regions()
            .map(
                (r, i) =>
                    `{ name: 'region_${i}', x: ${r.x}, y: ${r.y}, width: ${r.width}, height: ${r.height} },`
            )
            .join('\n');
        navigator.clipboard.writeText(code);
        alert('Regions copied to clipboard!');
    };

    return (
        <div
            style={{
                padding: '20px',
                'font-family': 'Arial, sans-serif',
                'max-width': '1400px',
                margin: '0 auto',
            }}
        >
            <h1>📍 Region Debugger</h1>

            <div
                style={{
                    padding: '15px',
                    'background-color': '#e3f2fd',
                    'border-left': '4px solid #1976d2',
                    'margin-bottom': '20px',
                    'border-radius': '4px',
                }}
            >
                <p style={{ margin: '0', 'font-size': '14px' }}>
                    <strong>Instructions:</strong> Click the "Start Region
                    Editor" button, then click and drag on the image to draw
                    regions. Each region's coordinates will be logged to the
                    console. Press ESC to close the editor. Copy the region
                    values to update `getScoreboardRegions()`.
                </p>
            </div>

            <div style={{ 'margin-bottom': '20px' }}>
                <button
                    onClick={startEditor}
                    disabled={isEditing()}
                    style={{
                        padding: '10px 20px',
                        'background-color': '#1976d2',
                        color: 'white',
                        border: 'none',
                        'border-radius': '4px',
                        cursor: isEditing() ? 'not-allowed' : 'pointer',
                        'font-size': '14px',
                        'margin-right': '10px',
                    }}
                >
                    {isEditing() ? 'Editing...' : 'Start Region Editor'}
                </button>

                <button
                    onClick={clearRegions}
                    disabled={regions().length === 0}
                    style={{
                        padding: '10px 20px',
                        'background-color': '#f44336',
                        color: 'white',
                        border: 'none',
                        'border-radius': '4px',
                        cursor:
                            regions().length === 0 ? 'not-allowed' : 'pointer',
                        'font-size': '14px',
                        'margin-right': '10px',
                    }}
                >
                    Clear All
                </button>

                <button
                    onClick={copyRegionsCode}
                    disabled={regions().length === 0}
                    style={{
                        padding: '10px 20px',
                        'background-color': '#4caf50',
                        color: 'white',
                        border: 'none',
                        'border-radius': '4px',
                        cursor:
                            regions().length === 0 ? 'not-allowed' : 'pointer',
                        'font-size': '14px',
                    }}
                >
                    Copy Code to Clipboard
                </button>
            </div>

            <div
                style={{
                    'background-color': '#f5f5f5',
                    padding: '20px',
                    'border-radius': '8px',
                    'margin-bottom': '20px',
                    border: '2px solid #1976d2',
                }}
            >
                <canvas
                    ref={canvasRef}
                    style={{
                        display: 'block',
                        'max-width': '100%',
                        border: '1px solid #ddd',
                        'border-radius': '4px',
                    }}
                />
            </div>

            {regions().length > 0 && (
                <div
                    style={{
                        padding: '20px',
                        'background-color': '#e8f5e9',
                        'border-radius': '8px',
                        border: '1px solid #a5d6a7',
                    }}
                >
                    <h2 style={{ 'margin-top': '0', color: '#2e7d32' }}>
                        Drawn Regions ({regions().length})
                    </h2>
                    <pre
                        style={{
                            'background-color': '#fff',
                            padding: '15px',
                            'border-radius': '4px',
                            'white-space': 'pre-wrap',
                            'word-wrap': 'break-word',
                            border: '1px solid #a5d6a7',
                            'font-family': 'monospace',
                            'font-size': '12px',
                            'line-height': '1.5',
                        }}
                    >
                        {regions()
                            .map(
                                (r, i) =>
                                    `${i}. ${r.name} (${r.color})\n  x: ${r.x}, y: ${r.y}, width: ${r.width}, height: ${r.height}`
                            )
                            .join('\n\n')}
                    </pre>

                    <h3 style={{ color: '#2e7d32' }}>Copy-Ready Code:</h3>
                    <pre
                        style={{
                            'background-color': '#fff',
                            padding: '15px',
                            'border-radius': '4px',
                            'white-space': 'pre-wrap',
                            'word-wrap': 'break-word',
                            border: '1px solid #a5d6a7',
                            'font-family': 'monospace',
                            'font-size': '11px',
                            'line-height': '1.4',
                        }}
                    >
                        {regions()
                            .map(
                                (r, i) =>
                                    `{ name: 'region_${i}_name', x: ${r.x}, y: ${r.y}, width: ${r.width}, height: ${r.height} },`
                            )
                            .join('\n')}
                    </pre>
                </div>
            )}
        </div>
    );
};

export default RegionDebugger;
