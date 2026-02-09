import { useNavigate } from 'react-router-dom';
import { VIEW_TO_PATH } from '../routes';

/**
 * Custom hook that wraps useNavigate with view ID -> URL path translation.
 * Drop-in replacement for the old setCurrentView(viewId) pattern.
 */
export default function useAppNavigate() {
  const navigate = useNavigate();

  return (viewId) => {
    const path = VIEW_TO_PATH[viewId];
    if (path) {
      navigate(path);
    } else {
      console.warn(`Unknown view ID: ${viewId}`);
      navigate('/dashboard');
    }
  };
}
