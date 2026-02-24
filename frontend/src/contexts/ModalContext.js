import React, { createContext, useContext, useReducer, useCallback, useRef, useMemo } from 'react';

// Create context
const ModalContext = createContext(null);

// =============================================================================
// MODAL DEFINITIONS
// =============================================================================
// Each key defines a modal type with its default (closed) state and an opener
// function that maps open() arguments to state properties.

const MODAL_DEFS = {
  farm: {
    defaults: { isOpen: false, data: null },
    opener: (farm = null) => ({ data: farm }),
  },
  field: {
    defaults: { isOpen: false, data: null, preselectedFarmId: null },
    opener: (field = null, preselectedFarmId = null) => ({ data: field, preselectedFarmId }),
  },
  application: {
    defaults: { isOpen: false, data: null },
    opener: (application = null) => ({ data: application }),
  },
  waterSource: {
    defaults: { isOpen: false, data: null },
    opener: (waterSource = null) => ({ data: waterSource }),
  },
  waterTest: {
    defaults: { isOpen: false, data: null, selectedWaterSource: null },
    opener: (waterTest = null, waterSource = null) => ({ data: waterTest, selectedWaterSource: waterSource }),
  },
  well: {
    defaults: { isOpen: false, data: null },
    opener: (well = null) => ({ data: well }),
  },
  wellReading: {
    defaults: { isOpen: false, wellId: null, wellName: null, reading: null },
    opener: (wellId, wellName, reading = null) => ({ wellId, wellName, reading }),
  },
  wellSource: {
    defaults: { isOpen: false, data: null },
    opener: (wellSource = null) => ({ data: wellSource }),
  },
  harvest: {
    defaults: { isOpen: false, data: null, preselectedFieldId: null },
    opener: (harvest = null, preselectedFieldId = null) => ({ data: harvest, preselectedFieldId }),
  },
  harvestLoad: {
    defaults: { isOpen: false, harvestId: null, data: null },
    opener: (harvestId, load = null) => ({ harvestId, data: load }),
  },
  harvestLabor: {
    defaults: { isOpen: false, harvestId: null, data: null },
    opener: (harvestId, labor = null) => ({ harvestId, data: labor }),
  },
  buyer: {
    defaults: { isOpen: false },
    opener: () => ({}),
  },
  laborContractor: {
    defaults: { isOpen: false },
    opener: () => ({}),
  },
  nutrientApp: {
    defaults: { isOpen: false, data: null },
    opener: (application = null) => ({ data: application }),
  },
  fertilizerProduct: {
    defaults: { isOpen: false, data: null },
    opener: (product = null) => ({ data: product }),
  },
  quickHarvest: {
    defaults: { isOpen: false },
    opener: () => ({}),
  },
  batchReading: {
    defaults: { isOpen: false, wells: [] },
    opener: (wells = []) => ({ wells }),
  },
};

// =============================================================================
// REDUCER
// =============================================================================

// Build initial state from definitions
const initialState = Object.fromEntries(
  Object.entries(MODAL_DEFS).map(([key, { defaults }]) => [key, defaults])
);

function modalReducer(state, action) {
  switch (action.type) {
    case 'OPEN':
      return { ...state, [action.modal]: { ...action.payload, isOpen: true } };
    case 'CLOSE':
      return { ...state, [action.modal]: MODAL_DEFS[action.modal].defaults };
    default:
      return state;
  }
}

// =============================================================================
// HELPER: capitalize first letter for property name generation
// =============================================================================
function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// =============================================================================
// MODAL PROVIDER COMPONENT
// =============================================================================

export function ModalProvider({ children }) {
  const [modals, dispatch] = useReducer(modalReducer, initialState);

  // ============================================================================
  // REFRESH CALLBACKS REGISTRY
  // ============================================================================
  const refreshCallbacks = useRef({
    harvests: null,
    nutrients: null,
    buyers: null,
    contractors: null,
  });

  const registerRefreshCallback = useCallback((type, callback) => {
    refreshCallbacks.current[type] = callback;
  }, []);

  const unregisterRefreshCallback = useCallback((type) => {
    refreshCallbacks.current[type] = null;
  }, []);

  const triggerRefresh = useCallback((types) => {
    const typesArray = Array.isArray(types) ? types : [types];
    typesArray.forEach(type => {
      if (refreshCallbacks.current[type]) {
        refreshCallbacks.current[type]();
      }
    });
  }, []);

  // ============================================================================
  // GENERATE OPEN/CLOSE ACTIONS (stable refs — dispatch never changes)
  // ============================================================================
  const actions = useMemo(() => {
    const a = {};
    for (const [key, def] of Object.entries(MODAL_DEFS)) {
      const cap = capitalize(key);
      a[`open${cap}Modal`] = (...args) =>
        dispatch({ type: 'OPEN', modal: key, payload: def.opener(...args) });
      a[`close${cap}Modal`] = () =>
        dispatch({ type: 'CLOSE', modal: key });
    }
    // Generic close by type name
    a.closeModal = (modalType) => {
      if (MODAL_DEFS[modalType]) {
        dispatch({ type: 'CLOSE', modal: modalType });
      } else {
        console.warn(`Unknown modal type: ${modalType}`);
      }
    };
    return a;
  }, []);

  // ============================================================================
  // CONTEXT VALUE
  // ============================================================================
  const value = useMemo(() => {
    // Spread modal states as e.g. farmModal, fieldModal, etc.
    const ctx = { ...actions };
    for (const key of Object.keys(MODAL_DEFS)) {
      ctx[`${key}Modal`] = modals[key];
    }
    ctx.registerRefreshCallback = registerRefreshCallback;
    ctx.unregisterRefreshCallback = unregisterRefreshCallback;
    ctx.triggerRefresh = triggerRefresh;
    return ctx;
  }, [modals, actions, registerRefreshCallback, unregisterRefreshCallback, triggerRefresh]);

  return (
    <ModalContext.Provider value={value}>
      {children}
    </ModalContext.Provider>
  );
}

// =============================================================================
// CUSTOM HOOK
// =============================================================================

export function useModal() {
  const context = useContext(ModalContext);
  if (!context) {
    throw new Error('useModal must be used within a ModalProvider');
  }
  return context;
}

export default ModalContext;
