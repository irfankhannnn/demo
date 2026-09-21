import { lazy } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/contexts/AuthContext';
import { CityProvider } from '@/contexts/CityContext';
import { ToastProvider } from '@/contexts/ToastContext';
import { AppShell } from '@/components/layout/AppShell';
import { isApiError } from '@/services/api';

const Home = lazy(() => import('@/pages/Home'));
const Search = lazy(() => import('@/pages/Search'));
const PropertyDetail = lazy(() => import('@/pages/PropertyDetail'));
const Agency = lazy(() => import('@/pages/Agency'));
const AuthCallback = lazy(() => import('@/pages/AuthCallback'));
const NotFound = lazy(() => import('@/pages/NotFound'));
const Saved = lazy(() => import('@/pages/me/Saved'));
const Searches = lazy(() => import('@/pages/me/Searches'));
const Enquiries = lazy(() => import('@/pages/me/Enquiries'));
const Thread = lazy(() => import('@/pages/me/Thread'));
const Profile = lazy(() => import('@/pages/me/Profile'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (count, err) => !(isApiError(err) && (err.status === 401 || err.status === 403 || err.status === 404)) && count < 2,
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  },
});

const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      { path: '/', element: <Home /> },
      { path: '/search', element: <Search /> },
      { path: '/p/:slug/:propertyId', element: <PropertyDetail /> },
      { path: '/agency/:slug', element: <Agency /> },
      { path: '/auth/callback', element: <AuthCallback /> },
      { path: '/me/saved', element: <Saved /> },
      { path: '/me/searches', element: <Searches /> },
      { path: '/me/enquiries', element: <Enquiries /> },
      { path: '/me/enquiries/:threadId', element: <Thread /> },
      { path: '/me/profile', element: <Profile /> },
      { path: '*', element: <NotFound /> },
    ],
  },
]);

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <AuthProvider>
          <CityProvider>
            <RouterProvider router={router} />
          </CityProvider>
        </AuthProvider>
      </ToastProvider>
    </QueryClientProvider>
  );
}
