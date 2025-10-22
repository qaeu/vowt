import { Component, createSignal, onMount } from 'solid-js';
import {
    startRegionEditor,
    DrawnRegion,
    formatRegionForCopy,
} from '#utils/regionEditor';
import '#styles/RegionDebugger';

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
        <div class="region-debugger-container">
            <h1>📍 Region Debugger</h1>

            <div class="info-box">
                <p>
                    <strong>Instructions:</strong> Click the "Start Region
                    Editor" button, then click and drag on the image to draw
                    regions. Each region's coordinates will be logged to the
                    console. Press ESC to close the editor. Copy the region
                    values to update `getScoreboardRegions()`.
                </p>
            </div>

            <div class="button-group">
                <button
                    onClick={startEditor}
                    disabled={isEditing()}
                    class="primary"
                >
                    {isEditing() ? 'Editing...' : 'Start Region Editor'}
                </button>

                <button
                    onClick={clearRegions}
                    disabled={regions().length === 0}
                    class="danger"
                >
                    Clear All
                </button>

                <button
                    onClick={copyRegionsCode}
                    disabled={regions().length === 0}
                    class="success"
                >
                    Copy Code to Clipboard
                </button>
            </div>

            <div class="canvas-wrapper">
                <canvas ref={canvasRef} />
            </div>

            {regions().length > 0 && (
                <div class="regions-display">
                    <h2>Drawn Regions ({regions().length})</h2>
                    <pre>
                        {regions()
                            .map(
                                (r, i) =>
                                    `${i}. ${r.name} (${r.color})\n  x: ${r.x}, y: ${r.y}, width: ${r.width}, height: ${r.height}`
                            )
                            .join('\n\n')}
                    </pre>

                    <h3>Copy-Ready Code:</h3>
                    <pre class="code-output">
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
