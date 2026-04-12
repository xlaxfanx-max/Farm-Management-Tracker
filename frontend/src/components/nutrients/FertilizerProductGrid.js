import React from 'react';
import { Search, Edit, Trash2, CheckCircle } from 'lucide-react';

const FORM_LABELS = {
  'granular': 'Granular',
  'liquid': 'Liquid',
  'soluble': 'Water Soluble',
  'organic': 'Organic',
  'foliar': 'Foliar',
  'controlled_release': 'Controlled Release',
};

const FertilizerProductGrid = ({
  filteredProducts,
  searchTerm,
  setSearchTerm,
  onEdit,
  onDelete,
  onSeedProducts,
}) => (
  <div className="space-y-6">
    {/* Actions Bar */}
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
      <div className="flex flex-wrap gap-4 items-center justify-between">
        <div className="flex-1 min-w-[200px] max-w-md">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search products..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>
        </div>

        <button
          onClick={onSeedProducts}
          className="px-4 py-2 text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
        >
          Seed Common Products
        </button>
      </div>
    </div>

    {/* Products Grid */}
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {filteredProducts.length === 0 ? (
        <div className="col-span-full text-center py-8 text-gray-500">
          No products found. Click "Seed Common Products" to add standard fertilizers.
        </div>
      ) : (
        filteredProducts.map((product) => (
          <div key={product.id} className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="flex justify-between items-start mb-3">
              <div>
                <h3 className="font-medium text-gray-900 dark:text-white">{product.name}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">{product.manufacturer || 'No manufacturer'}</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => onEdit(product)}
                  className="text-blue-600 hover:text-blue-800"
                  title="Edit"
                >
                  <Edit className="w-4 h-4" />
                </button>
                <button
                  onClick={() => onDelete(product.id)}
                  className="text-red-600 hover:text-red-800"
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex items-center gap-4 mb-3">
              <div className="text-2xl font-bold text-primary">{product.npk_display}</div>
              <span className={`px-2 py-1 text-xs rounded-full ${
                product.is_organic
                  ? 'bg-green-100 text-green-800'
                  : 'bg-gray-100 text-gray-600'
              }`}>
                {product.is_organic ? 'Organic' : FORM_LABELS[product.form] || product.form}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center text-sm">
              <div className="bg-blue-50 rounded p-2">
                <div className="font-medium text-blue-700">{product.nitrogen_pct}%</div>
                <div className="text-xs text-blue-600">Nitrogen</div>
              </div>
              <div className="bg-orange-50 rounded p-2">
                <div className="font-medium text-orange-700">{product.phosphorus_pct}%</div>
                <div className="text-xs text-orange-600">Phosphate</div>
              </div>
              <div className="bg-purple-50 rounded p-2">
                <div className="font-medium text-purple-700">{product.potassium_pct}%</div>
                <div className="text-xs text-purple-600">Potash</div>
              </div>
            </div>

            {product.omri_listed && (
              <div className="mt-3 flex items-center gap-1 text-xs text-primary">
                <CheckCircle className="w-3 h-3" />
                OMRI Listed
              </div>
            )}
          </div>
        ))
      )}
    </div>
  </div>
);

export default FertilizerProductGrid;
