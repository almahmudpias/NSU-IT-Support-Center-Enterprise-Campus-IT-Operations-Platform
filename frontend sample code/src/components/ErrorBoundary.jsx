import { Component, useCallback } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { homePathFor } from '../lib/rbac';

/**
 * Route-level error boundary — prevents full-app white screen.
 * Renders a recoverable fallback with Back / Home / Retry (no full reload).
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info?.componentStack);
    this.setState({ errorInfo: info });
  }

  componentDidUpdate(prevProps) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null, errorInfo: null });
    }
  }

  clearError = () => {
    this.setState({ error: null, errorInfo: null });
  };

  handleBack = () => {
    this.clearError();
    const { onBack, homeTo } = this.props;
    if (typeof onBack === 'function') {
      onBack();
      return;
    }
    if (typeof window !== 'undefined' && window.history.length > 1) {
      window.history.back();
    } else if (homeTo && typeof window !== 'undefined') {
      window.history.pushState(null, '', homeTo);
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  };

  handleRetry = () => {
    this.clearError();
    if (typeof this.props.onRetry === 'function') {
      this.props.onRetry();
    }
  };

  render() {
    if (this.state.error) {
      const home = this.props.homeTo || '/dashboard';
      const message =
        this.state.error?.message ||
        'Something went wrong while loading this page.';
      return (
        <div className="flex-1 min-h-[50vh] flex flex-col items-center justify-center gap-4 p-8 bg-[#0B0F19] text-center">
          <div className="w-14 h-14 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-300 text-xl font-black">
            !
          </div>
          <div>
            <h2 className="text-lg font-black text-white mb-1">Page could not be displayed</h2>
            <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">{message}</p>
          </div>
          <div className="flex flex-wrap gap-2 justify-center mt-2">
            <button
              type="button"
              onClick={this.handleBack}
              className="h-10 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold"
            >
              ← Return
            </button>
            <Link
              to={home}
              onClick={this.clearError}
              className="h-10 px-4 rounded-lg border border-[#374151] text-slate-300 text-xs font-bold hover:bg-[#1F2937] flex items-center"
            >
              Go home
            </Link>
            <button
              type="button"
              onClick={this.handleRetry}
              className="h-10 px-4 rounded-lg border border-[#374151] text-slate-400 text-xs font-bold hover:bg-[#1F2937]"
            >
              Try again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

/**
 * Wraps route content with ErrorBoundary that resets on every location change
 * and uses role-aware home + React Router navigate(-1) for Back.
 */
export function RouteErrorBoundary({ children, homeTo }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const home = homeTo || homePathFor(user) || '/dashboard';

  const onBack = useCallback(() => {
    // React Router history index when available
    const idx = window.history.state?.idx;
    if (typeof idx === 'number' && idx > 0) {
      navigate(-1);
      return;
    }
    navigate(home);
  }, [navigate, home]);

  const resetKey = `${location.pathname}|${location.search}|${location.key || ''}`;

  return (
    <ErrorBoundary homeTo={home} resetKey={resetKey} onBack={onBack}>
      {children}
    </ErrorBoundary>
  );
}
