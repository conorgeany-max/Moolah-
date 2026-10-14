import { Component, type ReactNode } from 'react'

/** Last-resort screen if a render error slips through. Data is untouched, so reloading is safe. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="min-h-dvh grid place-items-center px-6 pt-safe pb-safe text-center">
        <div className="max-w-[360px]">
          <h1 className="text-[24px] font-bold">Something went wrong</h1>
          <p className="text-muted mt-2 text-[15px] leading-relaxed">Your training data is safe on this device. Going back to the home screen usually fixes this.</p>
          <p className="text-faint mt-3 text-[12.5px] break-words">{this.state.error.message}</p>
          <button
            type="button"
            className="press mt-6 h-14 px-6 rounded-[18px] bg-accent text-accent-ink font-semibold w-full"
            onClick={() => {
              window.location.hash = '#/'
              window.location.reload()
            }}
          >
            Back to home
          </button>
        </div>
      </div>
    )
  }
}
