import { lazy, Suspense, useEffect } from 'react';
import { useRoute, matchPath } from './router.jsx';
import { requestPersistence } from '../storage/storage.js';
import HomeView from './HomeView.jsx';

// Startvyn laddas direkt; övriga vyer code-splittas så att startbunten
// hålls liten (särskilt pdf.js ska inte betalas förrän ett mönster öppnas).
const PatternLibrary = lazy(() => import('../patterns/PatternLibrary.jsx'));
const PatternView = lazy(() => import('../patterns/PatternView.jsx'));
const SharedImport = lazy(() => import('../patterns/SharedImport.jsx'));
const ProjectView = lazy(() => import('../projects/ProjectView.jsx'));
const FinishedGallery = lazy(() => import('../projects/FinishedGallery.jsx'));
const ProjectDetails = lazy(() => import('../projects/ProjectDetails.jsx'));
const Settings = lazy(() => import('../settings/Settings.jsx'));
const GaugeCalculator = lazy(() => import('../tools/GaugeCalculator.jsx'));
const Measurements = lazy(() => import('../tools/Measurements.jsx'));
const YarnStash = lazy(() => import('../tools/YarnStash.jsx'));
const Stats = lazy(() => import('../tools/Stats.jsx'));

export default function App() {
  const path = useRoute();

  useEffect(() => {
    requestPersistence();
  }, []);

  return (
    <Suspense fallback={<div className="view loading-view">Laddar …</div>}>
      <Route path={path} />
    </Suspense>
  );
}

function Route({ path }) {
  let params;
  if (path === '/') return <HomeView />;
  if (path === '/monster') return <PatternLibrary />;
  if ((params = matchPath('/monster/visa/:id', path))) return <PatternView patternId={params.id} />;
  if ((params = matchPath('/projekt/:id', path))) return <ProjectView projectId={params.id} />;
  if (path === '/fardiga') return <FinishedGallery />;
  if ((params = matchPath('/fardiga/:id', path))) return <ProjectDetails projectId={params.id} />;
  if (path === '/installningar') return <Settings />;
  if (path === '/masktathet') return <GaugeCalculator />;
  if (path === '/matt') return <Measurements />;
  if (path === '/garn') return <YarnStash />;
  if (path === '/statistik') return <Stats />;
  if (path === '/dela') return <SharedImport />;

  return <HomeView />;
}
