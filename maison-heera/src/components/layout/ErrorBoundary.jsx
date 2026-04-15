import React from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, Home, RefreshCw } from 'lucide-react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({
      error: error,
      errorInfo: errorInfo,
    });
    // In a professional app, log this to Sentry or Datadog here:
    console.error('Fatal crash intercepted by Global Error Boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-screen w-screen flex-col items-center justify-center bg-stone-950 p-6 text-stone-50 font-sans">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="w-full max-w-lg rounded-[2rem] border border-stone-800 bg-stone-900 mx-auto p-10 text-center shadow-2xl"
          >
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-rose-500/10">
              <AlertTriangle className="h-10 w-10 text-rose-500" />
            </div>
            <h1 className="mb-4 font-serif text-3xl md:text-4xl">System Malfunction</h1>
            <p className="mb-8 text-sm leading-7 text-stone-400">
              Our servers encountered an unexpected failure trying to display this page. We've automatically logged the trace to our engineering team.
            </p>

            <div className="mb-8 rounded-xl bg-black/50 p-4 text-left font-mono text-[10px] text-stone-500 overflow-x-auto">
              <span className="text-rose-500/80 mb-2 block font-semibold">{this.state.error?.toString()}</span>
              {this.state.errorInfo?.componentStack?.slice(0, 300)}...
            </div>

            <div className="flex flex-col gap-4 sm:flex-row justify-center">
              <button
                onClick={() => window.location.reload()}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-stone-700 hover:border-stone-500 transition-colors bg-stone-800 px-6 py-3 text-xs font-semibold uppercase tracking-[0.25em] text-white"
              >
                <RefreshCw size={14} /> Refresh Page
              </button>
              <button
                onClick={() => { window.location.href = '/' }}
                className="inline-flex items-center justify-center border border-white bg-white hover:bg-stone-300 transition-colors gap-2 rounded-full px-6 py-3 text-xs font-semibold uppercase tracking-[0.25em] text-stone-950"
              >
                <Home size={14} /> Return Home
              </button>
            </div>
          </motion.div>
        </div>
      );
    }

    return this.props.children;
  }
}
