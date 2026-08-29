import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { ErrorBoundary } from './components/ErrorBoundary';
import { EmptyState } from './components/EmptyState';
import Devices from './pages/Devices';
import Enquiries from './pages/Enquiries';
import Overview from './pages/Overview';
import Reels from './pages/Reels';
import Rules from './pages/Rules';
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
            <Route path="reels" element={<Reels />} />
            <Route path="enquiries" element={<Enquiries />} />
            <Route path="threads" element={<Threads />} />
            <Route path="rules" element={<Rules />} />
            <Route path="devices" element={<Devices />} />
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
