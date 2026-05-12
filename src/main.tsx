import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import { AuthProvider } from './context/AuthContext.tsx'
import { EldercareProvider } from './context/EldercareContext.tsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <AuthProvider>
    <EldercareProvider>
      <App />
    </EldercareProvider>
  </AuthProvider>,
)
