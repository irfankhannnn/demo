import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Plus, Home } from 'lucide-react';
import { api } from '../services/api';
import type { BuildingWithFlats, Flat } from '../types/admin';

export default function BuildingDetail() {
  const { buildingId } = useParams<{ buildingId: string }>();
  const navigate = useNavigate();
  const [building, setBuilding] = useState<BuildingWithFlats | null>(null);
  const [showFlatModal, setShowFlatModal] = useState(false);
  const [flatForm, setFlatForm] = useState({
    flatNumber: '',
    floorNumber: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (buildingId) {
      loadBuilding();
    }
  }, [buildingId]);

  useEffect(() => {
    if (!showFlatModal) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowFlatModal(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showFlatModal]);

  const loadBuilding = async () => {
    if (!buildingId) return;
    try {
      const data = await api.getBuilding(buildingId);
      setBuilding(data);
    } catch (error) {
      console.error('Error loading building:', error);
      alert('Failed to load building details');
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  const handleAddFlat = async () => {
    if (!buildingId || !flatForm.flatNumber) {
      alert('Please enter flat number');
      return;
    }
    try {
      await api.createFlat({
        buildingId,
        flatNumber: flatForm.flatNumber,
        floorNumber: flatForm.floorNumber,
      });
      setFlatForm({ flatNumber: '', floorNumber: 0 });
      setShowFlatModal(false);
      loadBuilding();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to add flat');
    }
  };

  const handleDeleteFlat = async (flatId: string) => {
    if (!confirm('Are you sure? This will delete all flat data.')) return;
    try {
      await api.deleteFlat(flatId);
      loadBuilding();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to delete flat');
    }
  };

  const handleViewFlat = (flatId: string) => {
    navigate(`/flat/${flatId}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  if (!building) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-xl">Building not found</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/dashboard')}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-gray-900">{building.name}</h1>
              <p className="text-sm text-gray-500 mt-1">{building.areaName}</p>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {/* Building Info */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6 border border-gray-100">
          <h2 className="text-lg font-semibold mb-4">Building Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-gray-600">Building Name</p>
              <p className="font-medium text-gray-900">{building.name}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Area</p>
              <p className="font-medium text-gray-900">{building.areaName}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Flats</p>
              <p className="font-medium text-gray-900">{building.flats?.length || 0}</p>
            </div>
          </div>
        </div>

        {/* Flats Section */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Home className="w-6 h-6 text-green-600" />
              Flats ({building.flats?.length || 0})
            </h2>
            <button
              onClick={() => setShowFlatModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-5 h-5" />
              Add Flat
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {building.flats?.map((flat: Flat) => (
              <div
                key={flat.flatId}
                className="border-2 border-gray-200 rounded-lg p-4 hover:border-blue-400 hover:shadow-lg transition-all cursor-pointer group relative"
                onClick={() => handleViewFlat(flat.flatId)}
              >
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-900 mb-1">
                    {flat.flatNumber}
                  </div>
                  <div className="text-xs text-gray-500">Floor {flat.floorNumber}</div>
                </div>
              </div>
            ))}
          </div>

          {(!building.flats || building.flats.length === 0) && (
            <div className="text-center py-12 text-gray-500">
              <Home className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>No flats added yet</p>
              <button
                onClick={() => setShowFlatModal(true)}
                className="mt-4 text-blue-600 hover:text-blue-700 font-medium"
              >
                Add your first flat
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Add Flat Modal */}
      {showFlatModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-xl font-semibold mb-4">Add New Flat</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Flat Number *
                </label>
                <input
                  type="text"
                  value={flatForm.flatNumber}
                  onChange={(e) => setFlatForm({ ...flatForm, flatNumber: e.target.value })}
                  placeholder="e.g., 101, A-201"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Floor Number
                </label>
                <input
                  type="number"
                  value={flatForm.floorNumber}
                  onChange={(e) => setFlatForm({ ...flatForm, floorNumber: parseInt(e.target.value) || 0 })}
                  placeholder="0"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={handleAddFlat}
                className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 font-medium"
              >
                Add Flat
              </button>
              <button
                onClick={() => setShowFlatModal(false)}
                className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg hover:bg-gray-300 font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
