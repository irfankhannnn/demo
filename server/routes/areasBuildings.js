import express from 'express';
import * as dynamodb from '../dynamodbService.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// ============== Dashboard Metrics ==============

router.get('/dashboard/metrics', async (req, res) => {
  try {
    const metrics = await dynamodb.getDashboardMetrics();
    res.json(metrics);
  } catch (error) {
    console.error('Error getting metrics:', error);
    res.status(500).json({ error: 'Failed to get metrics' });
  }
});

// ============== Area Operations ==============

// Get all areas
router.get('/areas', async (req, res) => {
  try {
    const areas = await dynamodb.getAreas();
    res.json(areas);
  } catch (error) {
    console.error('Error getting areas:', error);
    res.status(500).json({ error: 'Failed to get areas' });
  }
});

// Get single area
router.get('/areas/:id', async (req, res) => {
  try {
    const area = await dynamodb.getArea(req.params.id);
    if (!area) {
      return res.status(404).json({ error: 'Area not found' });
    }
    res.json(area);
  } catch (error) {
    console.error('Error getting area:', error);
    res.status(500).json({ error: 'Failed to get area' });
  }
});

// Create area
router.post('/areas', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Area name is required' });
    }

    const area = await dynamodb.createArea(name.trim());
    res.json(area);
  } catch (error) {
    console.error('Error creating area:', error);
    res.status(500).json({ error: 'Failed to create area' });
  }
});

// Update area
router.put('/areas/:id', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Area name is required' });
    }

    const area = await dynamodb.updateArea(req.params.id, name.trim());
    res.json(area);
  } catch (error) {
    console.error('Error updating area:', error);
    res.status(500).json({ error: 'Failed to update area' });
  }
});

// Delete area - DISABLED: Delete operations are not allowed
// router.delete('/areas/:id', async (req, res) => {
//   res.status(403).json({ error: 'Delete operations are not allowed' });
// });

// ============== Building Operations ==============

// Get all buildings
router.get('/buildings', async (req, res) => {
  try {
    const buildings = await dynamodb.getBuildings();
    
    // Enrich with area names
    const buildingsWithAreas = await Promise.all(
      buildings.map(async (building) => {
        const area = await dynamodb.getArea(building.areaId);
        return {
          ...building,
          areaName: area?.name || 'Unknown',
        };
      })
    );

    res.json(buildingsWithAreas);
  } catch (error) {
    console.error('Error getting buildings:', error);
    res.status(500).json({ error: 'Failed to get buildings' });
  }
});

// Get buildings by area
router.get('/areas/:areaId/buildings', async (req, res) => {
  try {
    const buildings = await dynamodb.getBuildingsByArea(req.params.areaId);
    res.json(buildings);
  } catch (error) {
    console.error('Error getting buildings:', error);
    res.status(500).json({ error: 'Failed to get buildings' });
  }
});

// Get single building with flats
router.get('/buildings/:id', async (req, res) => {
  try {
    const building = await dynamodb.getBuilding(req.params.id);
    if (!building) {
      return res.status(404).json({ error: 'Building not found' });
    }

    // Get area and flats
    const [area, flats] = await Promise.all([
      dynamodb.getArea(building.areaId),
      dynamodb.getFlatsByBuilding(req.params.id),
    ]);

    res.json({
      ...building,
      areaName: area?.name || 'Unknown',
      flats,
    });
  } catch (error) {
    console.error('Error getting building:', error);
    res.status(500).json({ error: 'Failed to get building' });
  }
});

// Create building
router.post('/buildings', async (req, res) => {
  try {
    const { name, areaId } = req.body;
    if (!name || !name.trim() || !areaId) {
      return res.status(400).json({ error: 'Building name and area are required' });
    }

    // Verify area exists
    const area = await dynamodb.getArea(areaId);
    if (!area) {
      return res.status(404).json({ error: 'Area not found' });
    }

    const building = await dynamodb.createBuilding(name.trim(), areaId);
    res.json({
      ...building,
      areaName: area.name,
    });
  } catch (error) {
    console.error('Error creating building:', error);
    res.status(500).json({ error: 'Failed to create building' });
  }
});

// Update building
router.put('/buildings/:id', async (req, res) => {
  try {
    const { name, areaId } = req.body;
    if (!name || !name.trim() || !areaId) {
      return res.status(400).json({ error: 'Building name and area are required' });
    }

    // Verify area exists
    const area = await dynamodb.getArea(areaId);
    if (!area) {
      return res.status(404).json({ error: 'Area not found' });
    }

    const building = await dynamodb.updateBuilding(req.params.id, name.trim(), areaId);
    res.json({
      ...building,
      areaName: area.name,
    });
  } catch (error) {
    console.error('Error updating building:', error);
    res.status(500).json({ error: 'Failed to update building' });
  }
});

// Delete building - DISABLED: Delete operations are not allowed
// router.delete('/buildings/:id', async (req, res) => {
//   res.status(403).json({ error: 'Delete operations are not allowed' });
// });

// Get comprehensive rental list (includes both traditional flats AND CRM properties)
router.get('/rentals', async (req, res) => {
  try {
    const rentalList = await dynamodb.getRentalList();
    res.json(rentalList);
  } catch (error) {
    console.error('Error getting rental list:', error);
    res.status(500).json({ error: 'Failed to get rental list' });
  }
});

// Search buildings and areas
router.get('/search', async (req, res) => {
  try {
    const { query } = req.query;
    if (!query || !query.trim()) {
      return res.json({ buildings: [], areas: [] });
    }

    const searchQuery = query.toLowerCase().trim();

    // Search buildings by name
    const buildings = await dynamodb.searchBuildings(searchQuery);
    
    // Search areas by name
    const allAreas = await dynamodb.getAreas();
    const matchingAreas = allAreas.filter(area => 
      area.name.toLowerCase().includes(searchQuery)
    );

    // Get all buildings to search by area name
    const allBuildings = await dynamodb.getBuildings();
    
    // Find buildings in matching areas
    const buildingsInMatchingAreas = allBuildings.filter(building => 
      matchingAreas.some(area => area.areaId === building.areaId)
    );

    // Combine and deduplicate buildings
    const combinedBuildingsMap = new Map();
    [...buildings, ...buildingsInMatchingAreas].forEach(building => {
      combinedBuildingsMap.set(building.buildingId, building);
    });

    // Enrich buildings with area names
    const buildingsWithAreas = await Promise.all(
      Array.from(combinedBuildingsMap.values()).map(async (building) => {
        const area = await dynamodb.getArea(building.areaId);
        return {
          ...building,
          areaName: area?.name || 'Unknown',
        };
      })
    );

    res.json({
      buildings: buildingsWithAreas,
      areas: matchingAreas,
    });
  } catch (error) {
    console.error('Error searching:', error);
    res.status(500).json({ error: 'Failed to search' });
  }
});

export default router;
