import React, { useState, useEffect, useCallback } from 'react';
import {
  Package,
  Plus,
  Search,
  AlertTriangle,
  TrendingDown,
  TrendingUp,
  ArrowRightLeft,
  ShoppingCart,
  Minus,
  History,
  X,
  ChevronDown,
  ChevronUp,
  Edit2,
  RefreshCw,
} from 'lucide-react';
import { fsmaAPI } from '../../services/api';

/**
 * FertilizerInventoryManager Component
 *
 * Manages fertilizer inventory with:
 * - Current stock levels
 * - Purchase recording
 * - Usage tracking (auto-deducted from applications)
 * - Low stock alerts
 * - Transaction history
 */
const FertilizerInventoryManager = () => {
  const [inventory, setInventory] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [selectedInventory, setSelectedInventory] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);
  const [expandedId, setExpandedId] = useState(null);

  // Purchase form state
  const [purchaseFormData, setPurchaseFormData] = useState({
    product: '',
    quantity: '',
    unit_cost: '',
    supplier: '',
    purchase_date: new Date().toISOString().split('T')[0],
    lot_number: '',
    notes: '',
  });

  // Adjustment form state
  const [adjustFormData, setAdjustFormData] = useState({
    quantity: '',
    reason: 'correction',
    notes: '',
  });

  const adjustmentReasons = [
    { value: 'correction', label: 'Inventory Correction' },
    { value: 'damage', label: 'Damage/Spoilage' },
    { value: 'transfer', label: 'Transfer to Another Location' },
    { value: 'return', label: 'Return to Supplier' },
    { value: 'other', label: 'Other' },
  ];

  const fetchInventory = useCallback(async () => {
    try {
      setLoading(true);
      const params = {};
      if (searchTerm) params.search = searchTerm;
      if (showLowStockOnly) params.low_stock = true;

      const response = await fsmaAPI.getFertilizerInventory(params);
      setInventory(response.data.results || response.data || []);
    } catch (error) {
      console.error('Error fetching inventory:', error);
    } finally {
      setLoading(false);
    }
  }, [searchTerm, showLowStockOnly]);

  const fetchProducts = async () => {
    try {
      const response = await fsmaAPI.getFertilizerProducts();
      setProducts(response.data.results || response.data || []);
    } catch (error) {
      console.error('Error fetching products:', error);
    }
  };

  const fetchTransactions = async (inventoryId) => {
    try {
      const response = await fsmaAPI.getInventoryTransactions(inventoryId);
      setTransactions(response.data.results || response.data || []);
    } catch (error) {
      console.error('Error fetching transactions:', error);
    }
  };

  useEffect(() => {
    fetchInventory();
    fetchProducts();
  }, [fetchInventory]);

  const handlePurchaseSubmit = async (e) => {
    e.preventDefault();
    try {
      await fsmaAPI.recordInventoryPurchase(purchaseFormData);
      setShowPurchaseModal(false);
      resetPurchaseForm();
      fetchInventory();
    } catch (error) {
      console.error('Error recording purchase:', error);
      alert('Failed to record purchase');
    }
  };

  const handleAdjustSubmit = async (e) => {
    e.preventDefault();
    if (!selectedInventory) return;

    try {
      await fsmaAPI.adjustInventory(selectedInventory.id, adjustFormData);
      setShowAdjustModal(false);
      resetAdjustForm();
      fetchInventory();
    } catch (error) {
      console.error('Error adjusting inventory:', error);
      alert('Failed to adjust inventory');
    }
  };

  const resetPurchaseForm = () => {
    setPurchaseFormData({
      product: '',
      quantity: '',
      unit_cost: '',
      supplier: '',
      purchase_date: new Date().toISOString().split('T')[0],
      lot_number: '',
      notes: '',
    });
  };

  const resetAdjustForm = () => {
    setAdjustFormData({
      quantity: '',
      reason: 'correction',
      notes: '',
    });
    setSelectedInventory(null);
  };

  const openAdjustModal = (inv) => {
    setSelectedInventory(inv);
    setAdjustFormData({
      quantity: '',
      reason: 'correction',
      notes: '',
    });
    setShowAdjustModal(true);
  };

  const openHistoryModal = async (inv) => {
    setSelectedInventory(inv);
    await fetchTransactions(inv.id);
    setShowHistoryModal(true);
  };

  const getStockStatus = (item) => {
    if (!item.reorder_point || item.reorder_point === 0) return 'normal';
    if (item.quantity_on_hand <= 0) return 'out';
    if (item.quantity_on_hand <= item.reorder_point) return 'low';
    return 'normal';
  };

  const getStockStatusColor = (status) => {
    switch (status) {
      case 'out':
        return 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30';
      case 'low':
        return 'text-yellow-600 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/30';
      default:
        return 'text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30';
    }
  };

  const getTransactionIcon = (type) => {
    switch (type) {
      case 'purchase':
        return ShoppingCart;
      case 'usage':
        return Minus;
      case 'adjustment':
        return ArrowRightLeft;
      default:
        return RefreshCw;
    }
  };

  const getTransactionColor = (type) => {
    switch (type) {
      case 'purchase':
        return 'text-green-600 dark:text-green-400';
      case 'usage':
        return 'text-red-600 dark:text-red-400';
      case 'adjustment':
        return 'text-blue-600 dark:text-blue-400';
      default:
        return 'text-gray-600 dark:text-gray-400';
    }
  };

  const lowStockCount = inventory.filter(
    (item) => getStockStatus(item) === 'low' || getStockStatus(item) === 'out'
  ).length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <Package className="w-6 h-6" />
          Fertilizer Inventory
        </h2>
        <button
          onClick={() => {
            resetPurchaseForm();
            setShowPurchaseModal(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <ShoppingCart className="w-4 h-4" />
          Record Purchase
        </button>
      </div>

      {/* Low Stock Alert */}
      {lowStockCount > 0 && (
        <div className="flex items-center gap-3 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
          <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
          <div className="flex-1">
            <p className="text-sm font-medium text-yellow-800 dark:text-yellow-300">
              {lowStockCount} product{lowStockCount !== 1 ? 's' : ''} low or out of stock
            </p>
          </div>
          <button
            onClick={() => setShowLowStockOnly(!showLowStockOnly)}
            className="text-sm text-yellow-700 dark:text-yellow-400 underline hover:no-underline"
          >
            {showLowStockOnly ? 'Show All' : 'Show Only Low Stock'}
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search products..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          />
        </div>
        <button
          onClick={() => {
            setSearchTerm('');
            setShowLowStockOnly(false);
          }}
          className="px-4 py-2 text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
        >
          Clear
        </button>
      </div>

      {/* Inventory List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : inventory.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <Package className="w-12 h-12 mx-auto text-gray-400 mb-4" />
          <p className="text-gray-500 dark:text-gray-400">No inventory records found</p>
          <button
            onClick={() => {
              resetPurchaseForm();
              setShowPurchaseModal(true);
            }}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            Add First Product
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {inventory.map((item) => {
            const status = getStockStatus(item);
            const isExpanded = expandedId === item.id;

            return (
              <div
                key={item.id}
                className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
              >
                {/* Main row */}
                <div
                  className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50"
                  onClick={() => setExpandedId(isExpanded ? null : item.id)}
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={`p-2 rounded-lg ${
                        status === 'out'
                          ? 'bg-red-100 dark:bg-red-900/30'
                          : status === 'low'
                          ? 'bg-yellow-100 dark:bg-yellow-900/30'
                          : 'bg-green-100 dark:bg-green-900/30'
                      }`}
                    >
                      <Package
                        className={`w-5 h-5 ${
                          status === 'out'
                            ? 'text-red-600 dark:text-red-400'
                            : status === 'low'
                            ? 'text-yellow-600 dark:text-yellow-400'
                            : 'text-green-600 dark:text-green-400'
                        }`}
                      />
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-900 dark:text-white">
                        {item.product?.name || 'Unknown Product'}
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {item.product?.manufacturer}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-lg font-semibold text-gray-900 dark:text-white">
                        {item.quantity_on_hand} {item.product?.unit || 'units'}
                      </p>
                      <p
                        className={`text-xs px-2 py-0.5 rounded ${getStockStatusColor(status)}`}
                      >
                        {status === 'out'
                          ? 'Out of Stock'
                          : status === 'low'
                          ? 'Low Stock'
                          : 'In Stock'}
                      </p>
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                </div>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-gray-200 dark:border-gray-700 pt-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                      <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Reorder Point</p>
                        <p className="text-gray-900 dark:text-white font-medium">
                          {item.reorder_point || 'Not set'} {item.product?.unit}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">NPK Ratio</p>
                        <p className="text-gray-900 dark:text-white font-medium">
                          {item.product?.nitrogen_percent || 0}-
                          {item.product?.phosphorus_percent || 0}-
                          {item.product?.potassium_percent || 0}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Last Purchase</p>
                        <p className="text-gray-900 dark:text-white font-medium">
                          {item.last_purchase_date
                            ? new Date(item.last_purchase_date).toLocaleDateString()
                            : 'Never'}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          Avg Monthly Usage
                        </p>
                        <p className="text-gray-900 dark:text-white font-medium">
                          {item.avg_monthly_usage || 0} {item.product?.unit}
                        </p>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setPurchaseFormData((prev) => ({
                            ...prev,
                            product: item.product?.id || '',
                          }));
                          setShowPurchaseModal(true);
                        }}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 rounded"
                      >
                        <TrendingUp className="w-4 h-4" />
                        Add Stock
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openAdjustModal(item);
                        }}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded"
                      >
                        <ArrowRightLeft className="w-4 h-4" />
                        Adjust
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openHistoryModal(item);
                        }}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 rounded"
                      >
                        <History className="w-4 h-4" />
                        History
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Purchase Modal */}
      {showPurchaseModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white dark:bg-gray-800 px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Record Purchase
              </h3>
              <button
                onClick={() => {
                  setShowPurchaseModal(false);
                  resetPurchaseForm();
                }}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <form onSubmit={handlePurchaseSubmit} className="p-6 space-y-6">
              {/* Product Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Product *
                </label>
                <select
                  value={purchaseFormData.product}
                  onChange={(e) =>
                    setPurchaseFormData((prev) => ({ ...prev, product: e.target.value }))
                  }
                  required
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="">Select product...</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name} ({product.manufacturer})
                    </option>
                  ))}
                </select>
              </div>

              {/* Quantity and Cost */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Quantity *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={purchaseFormData.quantity}
                    onChange={(e) =>
                      setPurchaseFormData((prev) => ({ ...prev, quantity: e.target.value }))
                    }
                    required
                    placeholder="0.00"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Unit Cost ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={purchaseFormData.unit_cost}
                    onChange={(e) =>
                      setPurchaseFormData((prev) => ({ ...prev, unit_cost: e.target.value }))
                    }
                    placeholder="0.00"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Supplier and Date */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Supplier
                  </label>
                  <input
                    type="text"
                    value={purchaseFormData.supplier}
                    onChange={(e) =>
                      setPurchaseFormData((prev) => ({ ...prev, supplier: e.target.value }))
                    }
                    placeholder="Supplier name"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Purchase Date *
                  </label>
                  <input
                    type="date"
                    value={purchaseFormData.purchase_date}
                    onChange={(e) =>
                      setPurchaseFormData((prev) => ({ ...prev, purchase_date: e.target.value }))
                    }
                    required
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Lot Number */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Lot Number
                </label>
                <input
                  type="text"
                  value={purchaseFormData.lot_number}
                  onChange={(e) =>
                    setPurchaseFormData((prev) => ({ ...prev, lot_number: e.target.value }))
                  }
                  placeholder="Optional lot/batch number"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Notes
                </label>
                <textarea
                  value={purchaseFormData.notes}
                  onChange={(e) =>
                    setPurchaseFormData((prev) => ({ ...prev, notes: e.target.value }))
                  }
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => {
                    setShowPurchaseModal(false);
                    resetPurchaseForm();
                  }}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  Record Purchase
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Adjustment Modal */}
      {showAdjustModal && selectedInventory && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Adjust Inventory
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {selectedInventory.product?.name} - Current: {selectedInventory.quantity_on_hand}{' '}
                  {selectedInventory.product?.unit}
                </p>
              </div>
              <button
                onClick={() => {
                  setShowAdjustModal(false);
                  resetAdjustForm();
                }}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <form onSubmit={handleAdjustSubmit} className="p-6 space-y-6">
              {/* Adjustment Amount */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Adjustment Amount *
                </label>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                  Use negative numbers to reduce inventory
                </p>
                <input
                  type="number"
                  step="0.01"
                  value={adjustFormData.quantity}
                  onChange={(e) =>
                    setAdjustFormData((prev) => ({ ...prev, quantity: e.target.value }))
                  }
                  required
                  placeholder="e.g., -5.00 or 10.00"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              {/* Reason */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Reason *
                </label>
                <select
                  value={adjustFormData.reason}
                  onChange={(e) =>
                    setAdjustFormData((prev) => ({ ...prev, reason: e.target.value }))
                  }
                  required
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  {adjustmentReasons.map((reason) => (
                    <option key={reason.value} value={reason.value}>
                      {reason.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Notes
                </label>
                <textarea
                  value={adjustFormData.notes}
                  onChange={(e) =>
                    setAdjustFormData((prev) => ({ ...prev, notes: e.target.value }))
                  }
                  rows={3}
                  placeholder="Explain the reason for this adjustment..."
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              {/* Preview */}
              {adjustFormData.quantity && (
                <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <p className="text-sm text-gray-500 dark:text-gray-400">New Balance</p>
                  <p className="text-lg font-semibold text-gray-900 dark:text-white">
                    {(
                      parseFloat(selectedInventory.quantity_on_hand) +
                      parseFloat(adjustFormData.quantity || 0)
                    ).toFixed(2)}{' '}
                    {selectedInventory.product?.unit}
                  </p>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => {
                    setShowAdjustModal(false);
                    resetAdjustForm();
                  }}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Apply Adjustment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* History Modal */}
      {showHistoryModal && selectedInventory && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Transaction History
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {selectedInventory.product?.name}
                </p>
              </div>
              <button
                onClick={() => setShowHistoryModal(false)}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[calc(80vh-80px)]">
              {transactions.length === 0 ? (
                <p className="text-center text-gray-500 dark:text-gray-400 py-8">
                  No transactions recorded
                </p>
              ) : (
                <div className="space-y-3">
                  {transactions.map((tx) => {
                    const Icon = getTransactionIcon(tx.transaction_type);
                    const colorClass = getTransactionColor(tx.transaction_type);

                    return (
                      <div
                        key={tx.id}
                        className="flex items-start gap-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                      >
                        <div className={`p-2 rounded ${colorClass} bg-opacity-10`}>
                          <Icon className={`w-4 h-4 ${colorClass}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <p className="font-medium text-gray-900 dark:text-white capitalize">
                              {tx.transaction_type}
                            </p>
                            <p className={`font-semibold ${colorClass}`}>
                              {tx.quantity > 0 ? '+' : ''}
                              {tx.quantity} {selectedInventory.product?.unit}
                            </p>
                          </div>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {new Date(tx.created_at).toLocaleString()}
                          </p>
                          {tx.notes && (
                            <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                              {tx.notes}
                            </p>
                          )}
                          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                            Balance after: {tx.balance_after} {selectedInventory.product?.unit}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FertilizerInventoryManager;
