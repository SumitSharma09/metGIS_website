import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { SnackbarProvider } from 'notistack';
import { store } from '@/app/store';
import { ThemeProviderWrapper } from '@/theme/ThemeProviderWrapper';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <Provider store={store}>
        <ThemeProviderWrapper>
          <LocalizationProvider dateAdapter={AdapterDayjs}>
            <SnackbarProvider maxSnack={3} anchorOrigin={{ vertical: 'top', horizontal: 'right' }}>
              <App />
            </SnackbarProvider>
          </LocalizationProvider>
        </ThemeProviderWrapper>
      </Provider>
    </ErrorBoundary>
  </React.StrictMode>
);
