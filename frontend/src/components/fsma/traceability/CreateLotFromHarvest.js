import React, { useState, useEffect } from 'react';
import {
  ChevronLeft, Plus, CheckCircle2, XCircle, Clock,
  Search, Package,
} from 'lucide-react';
import { traceabilityAPI } from '../../../services/api';

const PRODUCT_DESCRIPTIONS = [
  'Fresh Navel Oranges',
  'Fresh Lemons',
  'Fresh Tangerines',
  'Fresh Mandarins',
  'Fresh Cara Cara Oranges',
  'Fresh Valencia Oranges',
  'Fresh Grapefruit',
  'Fresh Avocados (Hass)',
  'Fresh Avocados (Lamb Hass)',
  'Fresh Pixie Tangerines',
];

const CreateLotFromHarvest = ({ onCreated, onCancel }) => {
  const [harvests, setHarvests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(null);
  const [selectedHarvest, setSelectedHarvest] = useState(null);
  const [productDescription, setProductDescription] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadHarvests();
  }, []);

  const loadHarvests = async () => {
    try {
      setLoading(true);
      const { data } = await traceabilityAPI.getUnlinkedHarvests();
      setHarvests(data);
    } catch (err) {
      setError('Failed to load unlinked harvests');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!selectedHarvest || !productDescription.trim()) return;

    try {
      setCreating(true);
      setError(null);
      await traceabilityAPI.createFromHarvest({
        harvest_id: selectedHarvest.id,
        product_description: productDescription.trim(),
      });
      onCreated();
    } catch (err) {
      const detail = err.response?.data;
      setError(
        typeof detail === 'string' ? detail :
        detail?.harvest_id?.[0] || detail?.detail || 'Failed to create lot'
      );
    } finally {
      setCreating(false);
    }
  };

  const filteredHarvests = harvests.filter((h) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      h.lot_number.toLowerCase().includes(s) ||
      h.field_name.toLowerCase().includes(s) ||
      h.farm_name.toLowerCase().includes(s) ||
      h.crop_variety.toLowerCase().includes(s)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={onCancel}
          className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Link Harvest to Traceability Lot
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Select a harvest record to create an FDA Rule 204 traceability lot
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Step 1: Select Harvest */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <h3 className="font-medium text-gray-900 dark:text-white mb-3">
          Step 1: Select Harvest
        </h3>

        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by lot number, field, farm..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white"
          />
        </div>

        {loading ? (
          <div className="text-center py-6 text-gray-500">Loading harvests...</div>
        ) : filteredHarvests.length === 0 ? (
          <div className="text-center py-6 text-gray-500">
            <Package className="w-8 h-8 mx-auto mb-2 text-gray-300" />
            <p>No unlinked harvests found</p>
            <p className="text-xs mt-1">All harvests are already linked to traceability lots</p>
          </div>
        ) : (
          <div className="max-h-64 overflow-y-auto space-y-1">
            {filteredHarvests.map((h) => (
              <button
                key={h.id}
                onClick={() => {
                  setSelectedHarvest(h);
                  // Auto-suggest product description from crop variety
                  const variety = h.crop_variety.replace(/_/g, ' ');
                  const suggestion = PRODUCT_DESCRIPTIONS.find(
                    (d) => d.toLowerCase().includes(variety.toLowerCase())
                  );
                  if (suggestion && !productDescription) {
                    setProductDescription(suggestion);
                  }
                }}
                className={`w-full text-left p-3 rounded-lg border transition-colors ${
                  selectedHarvest?.id === h.id
                    ? 'border-primary bg-primary/5 dark:bg-primary/10'
                    : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-mono text-xs font-medium text-gray-900 dark:text-white">
                      {h.lot_number}
                    </span>
                    <span className="text-xs text-gray-500 ml-2">{h.harvest_date}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {h.phi_compliant === true ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                    ) : h.phi_compliant === false ? (
                      <XCircle className="w-3.5 h-3.5 text-red-500" />
                    ) : null}
                    <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 px-2 py-0.5 rounded">
                      {h.total_bins} bins
                    </span>
                  </div>
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {h.farm_name} / {h.field_name} &mdash; {h.crop_variety.replace(/_/g, ' ')}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Step 2: Product Description */}
      {selectedHarvest && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <h3 className="font-medium text-gray-900 dark:text-white mb-3">
            Step 2: FDA Product Description
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
            The FDA requires a standardized product description for traceability records
          </p>
          <input
            type="text"
            value={productDescription}
            onChange={(e) => setProductDescription(e.target.value)}
            placeholder="e.g., Fresh Navel Oranges"
            list="product-suggestions"
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white"
          />
          <datalist id="product-suggestions">
            {PRODUCT_DESCRIPTIONS.map((d) => (
              <option key={d} value={d} />
            ))}
          </datalist>
        </div>
      )}

      {/* Create Button */}
      {selectedHarvest && productDescription.trim() && (
        <div className="flex justify-end">
          <button
            onClick={handleCreate}
            disabled={creating}
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors disabled:opacity-50"
          >
            {creating ? (
              <>Creating...</>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                Create Traceability Lot
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
};

export default CreateLotFromHarvest;
