/**
 - Rideau Canal Skateway Monitoring Dashboard - Backend Server
 - Node.js + Express server with Azure Cosmos DB integration
 */

const express = require('express');
const { CosmosClient } = require('@azure/cosmos');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Cosmos DB Configuration
const cosmosEndpoint = process.env.COSMOS_ENDPOINT;
const cosmosKey = process.env.COSMOS_KEY;
const databaseId = 'RideauCanalDB';
const containerId = 'SensorAggregations';

// Initialize Cosmos DB Client
const client = new CosmosClient({ endpoint: cosmosEndpoint, key: cosmosKey });
const database = client.database(databaseId);
const container = database.container(containerId);

// Middleware
app.use(express.json());
app.use(express.static('public'));

/**
 - API Endpoint: Get latest data for all locations
 - Returns the most recent aggregated data for each location
 */
app.get('/api/latest', async (req, res) => {
    try {
        const locations = ['Dow\'s Lake', 'Fifth Avenue', 'NAC'];
        const latestData = [];

        for (const location of locations) {
            const querySpec = {
                query: 'SELECT TOP 1 * FROM c WHERE c.location = @location ORDER BY c.windowEnd DESC',
                parameters: [{ name: '@location', value: location }]
            };

            const { resources } = await container.items.query(querySpec).fetchAll();
            
            if (resources.length > 0) {
                latestData.push(resources[0]);
            }
        }

        res.json({
            success: true,
            timestamp: new Date().toISOString(),
            data: latestData
        });
    } catch (error) {
        console.error('Error fetching latest data:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch latest data',
            message: error.message
        });
    }
});

/**
 - API Endpoint: Get historical data for a specific location
 - Returns data from the last hour (12 x 5-minute windows)
 */
app.get('/api/history/:location', async (req, res) => {
    try {
        const location = decodeURIComponent(req.params.location);
        const limit = parseInt(req.query.limit) || 12; // Default: last hour (12 x 5min)

        const querySpec = {
            query: `SELECT TOP ${limit} * FROM c WHERE c.location = @location ORDER BY c.windowEnd DESC`,
            parameters: [{ name: '@location', value: location }]
        };

        const { resources } = await container.items.query(querySpec).fetchAll();
        
        // Reverse to get chronological order
        resources.reverse();

        res.json({
            success: true,
            location: location,
            dataPoints: resources.length,
            data: resources
        });
    } catch (error) {
        console.error('Error fetching history:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch historical data',
            message: error.message
        });
    }
});

/**
 - API Endpoint: Get system status
 - Returns overall system health and aggregated safety status
 */
app.get('/api/status', async (req, res) => {
    try {
        const locations = ['Dow\'s Lake', 'Fifth Avenue', 'NAC'];
        let safeCount = 0;
        let cautionCount = 0;
        let unsafeCount = 0;

        for (const location of locations) {
            const querySpec = {
                query: 'SELECT TOP 1 c.safetyStatus FROM c WHERE c.location = @location ORDER BY c.windowEnd DESC',
                parameters: [{ name: '@location', value: location }]
            };

            const { resources } = await container.items.query(querySpec).fetchAll();
            
            if (resources.length > 0) {
                const status = resources[0].safetyStatus;
                if (status === 'Safe') safeCount++;
                else if (status === 'Caution') cautionCount++;
                else unsafeCount++;
            }
        }

        const overallStatus = unsafeCount > 0 ? 'Unsafe' : 
                              cautionCount > 0 ? 'Caution' : 'Safe';

        res.json({
            success: true,
            timestamp: new Date().toISOString(),
            overallStatus,
            breakdown: {
                safe: safeCount,
                caution: cautionCount,
                unsafe: unsafeCount,
                total: locations.length
            }
        });
    } catch (error) {
        console.error('Error fetching status:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch system status',
            message: error.message
        });
    }
});

/**
 - API Endpoint: Health check
 */
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        status: 'healthy',
        timestamp: new Date().toISOString()
    });
});

/**
 * Serve the main dashboard page
 */
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

/**
 - Start the server
 */
app.listen(PORT, () => {
    console.log('='.repeat(60));
    console.log('Rideau Canal Skateway Monitoring Dashboard');
    console.log('='.repeat(60));
    console.log(`Server running on port ${PORT}`);
    console.log(`Dashboard: http://localhost:${PORT}`);
    console.log(`API endpoints:`);
    console.log(`  - GET /api/latest - Latest data from all locations`);
    console.log(`  - GET /api/history/:location - Historical data`);
    console.log(`  - GET /api/status - Overall system status`);
    console.log(`  - GET /api/health - Health check`);
    console.log('='.repeat(60));
});