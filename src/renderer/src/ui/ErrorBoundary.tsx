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

  render(): React.ReactNode {
    if (this.state.error !== null) {
      return (
        <div className="error-fallback">
          <h1>{this.props.label ?? 'Something went wrong'}</h1>
          <pre>{this.state.error.message}</pre>
        </div>
      )
    }
    return this.props.children
  }
}
