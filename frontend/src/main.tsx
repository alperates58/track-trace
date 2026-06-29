import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

// Unregister any existing service workers and clear cache storage
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(registrations => {
    for (const registration of registrations) {
      registration.unregister().then(success => {
        if (success) console.log('ServiceWorker unregistered successfully');
      });
    }
  });
}

if ('caches' in window) {
  caches.keys().then(keys => {
    for (const key of keys) {
      caches.delete(key).then(success => {
        if (success) console.log(`Cache ${key} deleted successfully`);
      });
    }
  });
}
