import React, { useEffect } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './store/authContext';
import { AppRoutes } from './routes/AppRoutes';
import { supabase } from './utils/supabase';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 1000 * 60, // 1 minute
    },
  },
});

export const App: React.FC = () => {
  useEffect(() => {
    // Supabase client initialized for Campus Core ERP backend database & storage
    if (supabase) {
      console.log('[Campus Core ERP] Supabase backend client active:', import.meta.env.VITE_SUPABASE_URL);
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;
