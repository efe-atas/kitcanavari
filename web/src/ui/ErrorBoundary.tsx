import { Component, type ComponentChildren } from 'preact'

interface Props {
  onReset: () => void
  children: ComponentChildren
}

/** Shows what broke instead of a blank page, with a way out (reset the saved schedule). */
export class ErrorBoundary extends Component<Props, { error: Error | null }> {
  state = { error: null as Error | null }

  componentDidCatch(error: Error) {
    console.error(error)
    this.setState({ error })
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div class="banner banner-error" role="alert">
        <p>Something went wrong / Bir şeyler ters gitti: {this.state.error.message}</p>
        <button type="button" class="button" onClick={() => { this.props.onReset(); this.setState({ error: null }) }}>
          Reset saved schedule / Kayıtlı programı sıfırla
        </button>
      </div>
    )
  }
}
