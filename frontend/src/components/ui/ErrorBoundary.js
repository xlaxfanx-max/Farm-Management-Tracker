import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

/**
 * Error Boundary component that catches JavaScript errors in child components
 * and displays a fallback UI instead of crashing the entire app.
 *
 * Usage:
 *   <ErrorBoundary>
 *     <SomeComponent />
 *   </ErrorBoundary>
 *
 *   <ErrorBoundary level="section" name="Harvest Dashboard">
 *     <HarvestDashboard />
 *   </ErrorBoundary>
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });

    // Log to console in development
    console.error(
      `ErrorBoundary caught error in ${this.props.name || 'component'}:`,
      error,
      errorInfo
    );
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    // If a custom fallback was provided, use it
    if (this.props.fallback) {
      return this.props.fallback;
    }

    const level = this.props.level || 'section';
    const name = this.props.name || 'This section';

    // Full-page error (for app-level boundary)
    if (level === 'app') {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-6">
          <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 text-center">
            <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
              Something went wrong
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              An unexpected error occurred. Your data is safe. Please try refreshing the page.
            </p>
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="mb-6 text-left">
                <summary className="text-sm text-gray-500 cursor-pointer hover:text-gray-700">
                  Error details
                </summary>
                <pre className="mt-2 p-3 bg-red-50 dark:bg-red-900/20 rounded text-xs text-red-800 dark:text-red-300 overflow-auto max-h-48">
                  {this.state.error.toString()}
                  {this.state.errorInfo?.componentStack}
                </pre>
              </details>
            )}
            <div className="flex gap-3 justify-center">
              <button
                onClick={this.handleReset}
                className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Try Again
              </button>
              <button
                onClick={() => window.location.reload()}
                className="inline-flex items-center gap-2 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                Reload Page
              </button>
            </div>
          </div>
        </div>
      );
    }

    // Section-level error (inline within page)
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6 m-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-6 h-6 text-red-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-red-800 dark:text-red-300">
              {name} encountered an error
            </h3>
            <p className="text-sm text-red-600 dark:text-red-400 mt-1">
              This section failed to load. The rest of the app is still working.
            </p>
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="mt-3">
                <summary className="text-xs text-red-500 cursor-pointer hover:text-red-700">
                  Error details
                </summary>
                <pre className="mt-1 p-2 bg-red-100 dark:bg-red-900/30 rounded text-xs text-red-700 dark:text-red-300 overflow-auto max-h-32">
                  {this.state.error.toString()}
                </pre>
              </details>
            )}
            <button
              onClick={this.handleReset}
              className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-red-100 dark:bg-red-800/40 text-red-700 dark:text-red-300 rounded-md hover:bg-red-200 dark:hover:bg-red-800/60 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
