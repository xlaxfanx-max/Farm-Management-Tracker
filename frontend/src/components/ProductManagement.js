import React, { useState, useEffect } from 'react';
import { Package, Upload, Download, Search, Plus, Edit2, Trash2, AlertTriangle, CheckCircle, X, FileText } from 'lucide-react';
import axios from 'axios';
import { useConfirm } from '../contexts/ConfirmContext';
import { useToast } from '../contexts/ToastContext';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';

/**
 * Product Management Component
 * 
 * Features:
 * - View all pesticide products
 * - Search and filter products
 * - Add/edit products manually
 * - Bulk import from CSV
 * - Export current products
 * - Download CSV template
 */
function ProductManagement() {
  const confirm = useConfirm();
  const toast = useToast();
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterRestrictedUse, setFilterRestrictedUse] = useState('all');
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importResult, setImportResult] = useState(null);

  // Load products on mount
  useEffect(() => {
    loadProducts();
  }, []);

  // Filter products when search/filter changes
  useEffect(() => {
    filterProducts();
  }, [searchTerm, filterType, filterRestrictedUse, products]);

  const loadProducts = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_BASE_URL}/products/`);
      setProducts(response.data.results || response.data);
    } catch (error) {
      console.error('Error loading products:', error);
      toast.error('Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  const filterProducts = () => {
    let filtered = [...products];

    // Search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(p =>
        p.product_name?.toLowerCase().includes(search) ||
        p.epa_registration_number?.toLowerCase().includes(search) ||
        p.manufacturer?.toLowerCase().includes(search) ||
        p.active_ingredients?.toLowerCase().includes(search)
      );
    }

    // Type filter
    if (filterType !== 'all') {
      filtered = filtered.filter(p => p.product_type === filterType);
    }

    // Restricted use filter
    if (filterRestrictedUse === 'restricted') {
      filtered = filtered.filter(p => p.restricted_use);
    } else if (filterRestrictedUse === 'general') {
      filtered = filtered.filter(p => !p.restricted_use);
    }

    setFilteredProducts(filtered);
  };

  const handleDeleteProduct = async (productId) => {
    const ok = await confirm({ title: 'Are you sure?', message: 'Are you sure you want to delete this product?', confirmLabel: 'Delete', variant: 'danger' });
    if (!ok) return;

    try {
      await axios.delete(`${API_BASE_URL}/products/${productId}/`);
      await loadProducts();
      toast.success('Product deleted successfully');
    } catch (error) {
      console.error('Error deleting product:', error);
      toast.error('Failed to delete product');
    }
  };

  const handleImport = async () => {
    if (!importFile) {
      toast.info('Please select a CSV file');
      return;
    }

    const formData = new FormData();
    formData.append('file', importFile);
    formData.append('update_existing', 'true');

    setLoading(true);
    try {
      const response = await axios.post(`${API_BASE_URL}/products/import_csv/`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      setImportResult(response.data);
      await loadProducts();
    } catch (error) {
      console.error('Error importing products:', error);
      setImportResult({
        success: false,
        message: 'Import failed',
        statistics: {
          errors: 1,
          error_details: ['Failed to import file. Please check the format.']
        }
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/products/export_csv_template/`, {
        responseType: 'blob',
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'pesticide_products_template.csv');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading template:', error);
      toast.error('Failed to download template');
    }
  };

  const handleExportProducts = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/products/export_current_products/`, {
        responseType: 'blob',
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'pesticide_products_export.csv');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting products:', error);
      toast.error('Failed to export products');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Pesticide Product Catalog</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Manage your pesticide product database for PUR compliance
          </p>
        </div>
        <Package className="w-12 h-12 text-primary" />
      </div>

      {/* Action Buttons */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4">
        <div className="flex gap-3 flex-wrap">
          <button
            onClick={() => {
              setEditingProduct(null);
              setShowProductModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-hover"
          >
            <Plus className="w-4 h-4" />
            Add Product
          </button>

          <button
            onClick={() => setShowImportModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            <Upload className="w-4 h-4" />
            Import CSV
          </button>

          <button
            onClick={handleDownloadTemplate}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700"
          >
            <FileText className="w-4 h-4" />
            Download Template
          </button>

          <button
            onClick={handleExportProducts}
            className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
          >
            <Download className="w-4 h-4" />
            Export All
          </button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Search */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              <Search className="w-4 h-4 inline mr-1" />
              Search
            </label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Product name, EPA number, manufacturer..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Product Type Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Product Type
            </label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="all">All Types</option>
              <option value="insecticide">Insecticide</option>
              <option value="herbicide">Herbicide</option>
              <option value="fungicide">Fungicide</option>
              <option value="fumigant">Fumigant</option>
              <option value="adjuvant">Adjuvant</option>
              <option value="plant_growth_regulator">Plant Growth Regulator</option>
              <option value="other">Other</option>
            </select>
          </div>

          {/* Restricted Use Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Restricted Use
            </label>
            <select
              value={filterRestrictedUse}
              onChange={(e) => setFilterRestrictedUse(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="all">All Products</option>
              <option value="restricted">Restricted Use Only</option>
              <option value="general">General Use Only</option>
            </select>
          </div>
        </div>

        <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Showing {filteredProducts.length} of {products.length} products
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">Loading products...</div>
        ) : filteredProducts.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            {products.length === 0 ? (
              <>
                <Package className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                <p>No products in catalog yet.</p>
                <p className="text-sm mt-2">
                  Click "Import CSV" to load products or "Add Product" to add manually.
                </p>
              </>
            ) : (
              <p>No products match your search criteria.</p>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">EPA Reg No</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Active Ingredient</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">REI</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">PHI</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {filteredProducts.map((product) => (
                  <tr key={product.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-4 py-3 text-sm font-mono text-gray-900 dark:text-gray-200">
                      {product.epa_registration_number}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div className="font-medium text-gray-900 dark:text-gray-200">{product.product_name}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">{product.manufacturer}</div>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                        product.product_type === 'insecticide' ? 'bg-red-100 text-red-800' :
                        product.product_type === 'herbicide' ? 'bg-green-100 text-green-800' :
                        product.product_type === 'fungicide' ? 'bg-blue-100 text-blue-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {product.product_type || 'N/A'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {product.active_ingredients ? (
                        product.active_ingredients.length > 40 ?
                          product.active_ingredients.substring(0, 40) + '...' :
                          product.active_ingredients
                      ) : 'N/A'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {product.rei_hours ? `${product.rei_hours}h` : 
                       product.rei_days ? `${product.rei_days}d` : 'N/A'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {product.phi_days ? `${product.phi_days}d` : 'N/A'}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div className="flex flex-col gap-1">
                        {product.restricted_use && (
                          <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-orange-100 text-orange-800">
                            <AlertTriangle className="w-3 h-3 mr-1" />
                            RUP
                          </span>
                        )}
                        {product.is_fumigant && (
                          <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-red-100 text-red-800">
                            Fumigant
                          </span>
                        )}
                        {!product.active && (
                          <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-600">
                            Inactive
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setEditingProduct(product);
                            setShowProductModal(true);
                          }}
                          className="text-blue-600 hover:text-blue-800"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteProduct(product.id)}
                          className="text-red-600 hover:text-red-800"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Import Modal */}
      {showImportModal && (
        <ImportModal
          onClose={() => {
            setShowImportModal(false);
            setImportFile(null);
            setImportResult(null);
          }}
          importFile={importFile}
          setImportFile={setImportFile}
          handleImport={handleImport}
          importResult={importResult}
          loading={loading}
        />
      )}

      {/* Product Modal */}
      {showProductModal && (
        <ProductModal
          product={editingProduct}
          onClose={() => {
            setShowProductModal(false);
            setEditingProduct(null);
          }}
          onSave={async () => {
            await loadProducts();
            setShowProductModal(false);
            setEditingProduct(null);
          }}
        />
      )}
    </div>
  );
}

// Import Modal Component
function ImportModal({ onClose, importFile, setImportFile, handleImport, importResult, loading }) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Import Products from CSV</h2>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
              <X className="w-6 h-6" />
            </button>
          </div>

          {!importResult ? (
            <>
              <div className="mb-4">
                <p className="text-sm text-gray-600 mb-4">
                  Upload a CSV file with pesticide product information. The file should include
                  EPA registration numbers, product names, and other details.
                </p>
                
                <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 text-center">
                  <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                  <input
                    type="file"
                    accept=".csv"
                    onChange={(e) => setImportFile(e.target.files[0])}
                    className="hidden"
                    id="csv-upload"
                  />
                  <label
                    htmlFor="csv-upload"
                    className="cursor-pointer text-blue-600 hover:text-blue-800"
                  >
                    Click to select CSV file
                  </label>
                  {importFile && (
                    <div className="mt-2 text-sm text-gray-600">
                      Selected: {importFile.name}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleImport}
                  disabled={!importFile || loading}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400"
                >
                  {loading ? 'Importing...' : 'Import'}
                </button>
                <button
                  onClick={onClose}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-gray-200"
                >
                  Cancel
                </button>
              </div>
            </>
          ) : (
            <>
              <div className={`p-4 rounded-lg mb-4 ${
                importResult.success ? 'bg-primary-light border border-green-200' : 'bg-red-50 border border-red-200'
              }`}>
                <div className="flex items-center gap-2 mb-2">
                  {importResult.success ? (
                    <CheckCircle className="w-6 h-6 text-primary" />
                  ) : (
                    <AlertTriangle className="w-6 h-6 text-red-600" />
                  )}
                  <h3 className={`font-semibold ${
                    importResult.success ? 'text-green-900' : 'text-red-900'
                  }`}>
                    {importResult.message}
                  </h3>
                </div>
                
                {importResult.statistics && (
                  <div className="text-sm mt-2">
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <span className="text-primary">Created: </span>
                        <span className="font-semibold">{importResult.statistics.created}</span>
                      </div>
                      <div>
                        <span className="text-blue-700">Updated: </span>
                        <span className="font-semibold">{importResult.statistics.updated}</span>
                      </div>
                      <div>
                        <span className="text-red-700">Errors: </span>
                        <span className="font-semibold">{importResult.statistics.errors}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {importResult.statistics?.error_details?.length > 0 && (
                <div className="mb-4">
                  <h4 className="font-semibold text-red-900 mb-2">Errors:</h4>
                  <ul className="text-sm text-red-700 bg-red-50 p-3 rounded max-h-40 overflow-y-auto">
                    {importResult.statistics.error_details.map((error, index) => (
                      <li key={index} className="mb-1">• {error}</li>
                    ))}
                  </ul>
                </div>
              )}

              <button
                onClick={onClose}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Close
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Simplified Product Modal (you can expand this with all fields)
function ProductModal({ product, onClose, onSave }) {
  const toast = useToast();
  const [formData, setFormData] = useState(product || {
    epa_registration_number: '',
    product_name: '',
    manufacturer: '',
    active_ingredients: '',
    formulation_type: '',
    restricted_use: false,
    product_type: 'insecticide',
    rei_hours: '',
    phi_days: '',
    active: true,
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      if (product) {
        await axios.put(`${API_BASE_URL}/products/${product.id}/`, formData);
      } else {
        await axios.post(`${API_BASE_URL}/products/`, formData);
      }
      toast.success(`Product ${product ? 'updated' : 'created'} successfully`);
      onSave();
    } catch (error) {
      console.error('Error saving product:', error);
      toast.error('Failed to save product');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit} className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              {product ? 'Edit Product' : 'Add Product'}
            </h2>
            <button type="button" onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="space-y-4">
            {/* EPA Registration Number */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                EPA Registration Number *
              </label>
              <input
                type="text"
                required
                value={formData.epa_registration_number}
                onChange={(e) => setFormData({...formData, epa_registration_number: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 dark:text-gray-200"
                placeholder="e.g., 12345-678"
              />
            </div>

            {/* Product Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Product Name *
              </label>
              <input
                type="text"
                required
                value={formData.product_name}
                onChange={(e) => setFormData({...formData, product_name: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 dark:text-gray-200"
              />
            </div>

            {/* Additional fields... (expand as needed) */}
            
            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                className="flex-1 px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-hover"
              >
                Save Product
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-gray-200"
              >
                Cancel
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ProductManagement;
