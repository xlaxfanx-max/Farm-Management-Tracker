import { useEffect, useState } from 'react';
import { packinghousesAPI, pickHaulEntitiesAPI } from '../../services/api';
import { rows } from './pickhaulUtils';

/** The company's packinghouses, for filters and the entry forms. */
export function useHouses() {
  const [houses, setHouses] = useState([]);
  useEffect(() => {
    let cancelled = false;
    packinghousesAPI
      .getAll()
      .then((res) => {
        if (!cancelled) setHouses(rows(res));
      })
      .catch((err) => console.error('Error loading packinghouses:', err));
    return () => {
      cancelled = true;
    };
  }, []);
  return houses;
}

/** The company's legal entities (JPF, FFLLC, …), for the entry forms. */
export function useEntities() {
  const [entities, setEntities] = useState([]);
  useEffect(() => {
    let cancelled = false;
    pickHaulEntitiesAPI
      .getAll()
      .then((res) => {
        if (!cancelled) setEntities(res.data || []);
      })
      .catch((err) => console.error('Error loading entities:', err));
    return () => {
      cancelled = true;
    };
  }, []);
  return entities;
}
