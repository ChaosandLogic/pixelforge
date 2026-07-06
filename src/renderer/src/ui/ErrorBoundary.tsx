import React from 'react'

interface ErrorBoundaryProps {
  children: React.ReactNode
  label?: string
}

interface ErrorBoundaryState {
  error: Error | null
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('[renderer] UI crashed:', error, info.componentStack)
  }

  render(): React.ReactNode {
    if (this.state.error !== null) {
      return (
        <div className="error-fallback">
          <h1>{this.props.label ?? 'Something went wrong'}</h1>
          <pre>{this.state.error.message}</pre>
          <button className="tool-btn primary" type="button" onClick={() => window.location.reload()}>
            Reload
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
