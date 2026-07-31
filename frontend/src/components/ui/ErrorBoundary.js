import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import Button from './Button';

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
        <div className="min-h-screen flex items-center justify-center bg-surface p-6">
          <div className="max-w-md w-full bg-surface-raised rounded-card border border-border shadow-lg p-8 text-center">
            <AlertTriangle className="w-16 h-16 text-danger mx-auto mb-4" />
            <h1 className="font-display text-page-title text-heading mb-2">
              Something went wrong
            </h1>
            <p className="text-text-secondary mb-6">
              An unexpected error occurred. Your data is safe — try refreshing the page.
            </p>
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="mb-6 text-left">
                <summary className="text-sm text-text-secondary cursor-pointer hover:text-text">
                  Error details
                </summary>
                <pre className="mt-2 p-3 bg-danger-bg rounded-button font-mono text-xs text-danger overflow-auto max-h-48">
                  {this.state.error.toString()}
                  {this.state.errorInfo?.componentStack}
                </pre>
              </details>
            )}
            <div className="flex gap-3 justify-center">
              <Button variant="primary" icon={RefreshCw} onClick={this.handleReset}>
                Try again
              </Button>
              <Button variant="secondary" onClick={() => window.location.reload()}>
                Reload page
              </Button>
            </div>
          </div>
        </div>
      );
    }

    // Section-level error (inline within page)
    return (
      <div className="bg-danger-bg border border-danger/25 rounded-card p-6 m-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-6 h-6 text-danger flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="text-sm text-danger">
              {name} encountered an error
            </h3>
            <p className="text-sm text-bark-700 mt-1">
              This section failed to load. The rest of the app is still working.
            </p>
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="mt-3">
                <summary className="text-xs text-danger cursor-pointer hover:text-danger">
                  Error details
                </summary>
                <pre className="mt-1 p-2 bg-danger-bg rounded-button font-mono text-xs text-danger overflow-auto max-h-32">
                  {this.state.error.toString()}
                </pre>
              </details>
            )}
            <Button
              variant="secondary"
              size="sm"
              icon={RefreshCw}
              onClick={this.handleReset}
              className="mt-3"
            >
              Retry
            </Button>
          </div>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
