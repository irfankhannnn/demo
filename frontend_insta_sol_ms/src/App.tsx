import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { ErrorBoundary } from './components/ErrorBoundary';
import { EmptyState } from './components/EmptyState';
import Accounts from './pages/Accounts';
import Enquiries from './pages/Enquiries';
import Overview from './pages/Overview';
import Reels from './pages/Reels';
import Rules from './pages/Rules';
import ThreadDetail from './pages/ThreadDetail';
import Threads from './pages/Threads';

/**
 * `basename` must match `base` in vite.config.ts — the app is mounted on the
 * `/insta/*` CloudFront behavior, not at the root of the domain.
 */
export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter basename="/insta">
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<Overview />} />
            <Route path="accounts" element={<Accounts />} />
            <Route path="reels" element={<Reels />} />
            <Route path="enquiries" element={<Enquiries />} />
            <Route path="threads" element={<Threads />} />
            <Route path="threads/:threadId" element={<ThreadDetail />} />
            <Route path="rules" element={<Rules />} />
            {/* The old laptop-pairing screen; bookmarks land on its replacement. */}
            <Route path="devices" element={<Navigate to="/accounts" replace />} />
            <Route
              path="*"
              element={
                <EmptyState
                  title="That page does not exist"
                  description="Pick a screen from the menu to carry on."
                />
              }
            />
          </Route>
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
