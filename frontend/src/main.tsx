import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { SHOP_NAME } from './config';
import './styles.css';

document.title = SHOP_NAME;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
