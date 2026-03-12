import ReactDOM from 'react-dom/client';
import '/src/components/DebugPanel/styles.css';

function DebugPanel() {
  return (
    <div style={{ padding: '20px', color: 'white' }}>
      <h2>Debug Panel</h2>
      <p>Debug panel functionality</p>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('app')!);
root.render(<DebugPanel />);
