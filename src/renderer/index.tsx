import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter as Router } from 'react-router-dom';
import App from './App';

// Create root element
const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Failed to find the root element');

// Create React root
const root = ReactDOM.createRoot(rootElement);

// Render app
root.render(
  <React.StrictMode>
    <Router>
      <App />
    </Router>
  </React.StrictMode>
);
