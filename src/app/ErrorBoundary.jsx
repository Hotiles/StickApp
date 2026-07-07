import { Component } from 'react';

/*
 * Sista skyddsnätet: ett renderfel i en vy ska inte lämna en helt vit skärm
 * i en offline-app utan "ladda om sidan"-reflex. Datan ligger tryggt i
 * IndexedDB — det räcker att börja om från startsidan.
 */
export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Ohanterat fel i appen', error, info);
  }

  handleReset = () => {
    window.location.hash = '/';
    window.location.reload();
  };

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="view">
        <div className="empty-state">
          <p>Hoppsan — något gick snett.</p>
          <p className="empty-state-hint">Din data är kvar på enheten. Prova att börja om från startsidan.</p>
          <button className="btn btn-primary" onClick={this.handleReset}>
            Till startsidan
          </button>
        </div>
      </div>
    );
  }
}
