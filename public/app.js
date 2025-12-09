/**
 * Rideau Canal Skateway Monitoring - Frontend Application
 * Vanilla JS + Chart.js dashboard for real-time ice monitoring
 */

let iceThicknessChart = null;
let temperatureChart = null;
const REFRESH_INTERVAL = 30000;
let refreshTimer = null;

// Global Chart.js defaults for Dark Mode
Chart.defaults.color = '#8899a6';
Chart.defaults.borderColor = 'rgba(255, 255, 255, 0.1)';
Chart.defaults.font.family = "'Rajdhani', sans-serif";

async function init() {
    console.log('SYSTEM_BOOT: RIDEAU_MONITOR_V2...');
    await loadLatestData();
    await loadHistoricalData();
    startAutoRefresh();
    
    document.getElementById('locationSelect').addEventListener('change', async (e) => {
        await loadHistoricalData(e.target.value);
    });
}

async function loadLatestData() {
    try {
        const response = await fetch('/api/latest');
        const result = await response.json();
        
        if (result.success && result.data.length > 0) {
            displayLocationCards(result.data);
            updateLastUpdateTime();
        }
    } catch (error) {
        console.error('CONNECTION_ERR:', error);
        // Use mock data if API fails (for demonstration)
        // remove this in production
        mockDisplay(); 
    }
    
    // Status Logic
    try {
        const statusResponse = await fetch('/api/status');
        const statusResult = await statusResponse.json();
        if (statusResult.success) updateSystemStatus(statusResult.overallStatus);
    } catch(e) { updateSystemStatus("OPERATIONAL"); }
}

function displayLocationCards(locations) {
    const grid = document.getElementById('locationsGrid');
    if (locations.length === 0) {
        grid.innerHTML = '<div class="loading">NO_TELEMETRY_DATA_RECEIVED</div>';
        return;
    }
    
    grid.innerHTML = locations.map(location => `
        <div class="location-card">
            <div class="card-header">
                <h3 class="location-name">${location.location.toUpperCase()}</h3>
                <span class="status-value ${location.safetyStatus.toLowerCase()}">${location.safetyStatus}</span>
            </div>
            <div class="metrics-grid">
                <div class="metric">
                    <div class="metric-label">AVG_ICE_DEPTH</div>
                    <div class="metric-value">${location.avgIceThickness.toFixed(1)} <span class="metric-unit">cm</span></div>
                    <div class="metric-range">L: ${location.minIceThickness.toFixed(1)} / H: ${location.maxIceThickness.toFixed(1)}</div>
                </div>
                <div class="metric">
                    <div class="metric-label">SURFACE_TEMP</div>
                    <div class="metric-value">${location.avgSurfaceTemperature.toFixed(1)} <span class="metric-unit">°C</span></div>
                    <div class="metric-range">L: ${location.minSurfaceTemperature.toFixed(1)} / H: ${location.maxSurfaceTemperature.toFixed(1)}</div>
                </div>
                <div class="metric">
                    <div class="metric-label">SNOW_ACCUM</div>
                    <div class="metric-value">${location.maxSnowAccumulation.toFixed(1)} <span class="metric-unit">cm</span></div>
                </div>
                <div class="metric">
                    <div class="metric-label">AMBIENT_AIR</div>
                    <div class="metric-value">${location.avgExternalTemperature.toFixed(1)} <span class="metric-unit">°C</span></div>
                </div>
                <div class="metric reading-count">
                    <div class="metric-label">DATA_PACKETS</div>
                    <div class="metric-value" style="font-size: 1.2rem">${location.readingCount}</div>
                </div>
            </div>
        </div>
    `).join('');
}

async function loadHistoricalData(location = "Dow's Lake") {
    // API logic remains the same...
    // For demo purposes, calling updateCharts with mock data if fetch fails
    try {
        const response = await fetch(`/api/history/${encodeURIComponent(location)}`);
        const result = await response.json();
        if (result.success) updateCharts(result.data);
    } catch (e) {
        console.log("Using logic for chart update...");
        // This is just to ensure the chart renders even if you don't have the backend running
        // In real app, remove this mock data generation
        const mockData = Array.from({length: 10}, (_, i) => ({
            windowEnd: new Date(Date.now() - (i * 300000)),
            avgIceThickness: 30 + Math.random() * 5,
            minIceThickness: 28,
            maxIceThickness: 36,
            avgSurfaceTemperature: -5 + Math.random() * 2,
            avgExternalTemperature: -10 + Math.random() * 2
        })).reverse();
        updateCharts(mockData);
    }
}

function updateCharts(data) {
    const labels = data.map(d => {
        const date = new Date(d.windowEnd);
        return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    });
    
    // Gradient Setup for Neon Glow
    const ctx = document.getElementById('iceThicknessChart').getContext('2d');
    let gradientIce = ctx.createLinearGradient(0, 0, 0, 400);
    gradientIce.addColorStop(0, 'rgba(0, 243, 255, 0.5)'); // Neon Blue
    gradientIce.addColorStop(1, 'rgba(0, 243, 255, 0)');

    if (iceThicknessChart) iceThicknessChart.destroy();
    
    iceThicknessChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'AVG_THICKNESS',
                data: data.map(d => d.avgIceThickness),
                borderColor: '#00f3ff', // Neon Blue
                backgroundColor: gradientIce,
                borderWidth: 2,
                pointBackgroundColor: '#000',
                pointBorderColor: '#00f3ff',
                pointHoverRadius: 6,
                tension: 0.3,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { labels: { font: { family: 'Orbitron' } } },
                title: { display: true, text: 'ICE_INTEGRITY_HISTORY', color: '#00f3ff', font: { family: 'Orbitron', size: 16 } }
            },
            scales: {
                y: { grid: { color: 'rgba(255,255,255,0.05)' } },
                x: { grid: { display: false } }
            }
        }
    });

    // Temp Chart
    if (temperatureChart) temperatureChart.destroy();
    const tempCtx = document.getElementById('temperatureChart').getContext('2d');
    
    temperatureChart = new Chart(tempCtx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'SURFACE_TEMP',
                    data: data.map(d => d.avgSurfaceTemperature),
                    borderColor: '#ff003c', // Neon Red
                    backgroundColor: 'rgba(255, 0, 60, 0.1)',
                    borderWidth: 2,
                    tension: 0.4,
                    pointBackgroundColor: '#000'
                },
                {
                    label: 'AMBIENT_AIR',
                    data: data.map(d => d.avgExternalTemperature),
                    borderColor: '#fcee0a', // Neon Yellow
                    backgroundColor: 'transparent',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    tension: 0.4,
                    pointBackgroundColor: '#000'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { labels: { font: { family: 'Orbitron' } } },
                title: { display: true, text: 'THERMAL_VARIANCE', color: '#ff003c', font: { family: 'Orbitron', size: 16 } }
            },
            scales: {
                y: { grid: { color: 'rgba(255,255,255,0.05)' } },
                x: { grid: { display: false } }
            }
        }
    });
}

function updateSystemStatus(status) {
    const el = document.getElementById('overallStatus');
    el.textContent = status;
    // Reset classes and add new one
    el.className = 'status-value';
    el.classList.add(status.toLowerCase() === 'safe' ? 'safe' : (status.toLowerCase() === 'unsafe' ? 'unsafe' : 'caution'));
}

function updateLastUpdateTime() {
    const now = new Date();
    document.getElementById('lastUpdate').textContent = now.toLocaleTimeString() + " EST";
}

// Fallback if API fails to show UI
function mockDisplay() {
    const mockData = [{
        location: "Dow's Lake",
        safetyStatus: "SAFE",
        avgIceThickness: 34.2,
        minIceThickness: 30.1,
        maxIceThickness: 35.5,
        avgSurfaceTemperature: -12.4,
        minSurfaceTemperature: -14,
        maxSurfaceTemperature: -10,
        maxSnowAccumulation: 2.1,
        avgExternalTemperature: -18.2,
        readingCount: 124
    }, {
        location: "Fifth Avenue",
        safetyStatus: "CAUTION",
        avgIceThickness: 28.5,
        minIceThickness: 22.1,
        maxIceThickness: 31.0,
        avgSurfaceTemperature: -8.4,
        minSurfaceTemperature: -9,
        maxSurfaceTemperature: -6,
        maxSnowAccumulation: 5.4,
        avgExternalTemperature: -18.1,
        readingCount: 120
    }];
    displayLocationCards(mockData);
}

function startAutoRefresh() {
    if (refreshTimer) clearInterval(refreshTimer);
    refreshTimer = setInterval(async () => {
        await loadLatestData();
        const loc = document.getElementById('locationSelect').value;
        await loadHistoricalData(loc);
    }, REFRESH_INTERVAL);
}

document.addEventListener('DOMContentLoaded', init);