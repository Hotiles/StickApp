import { useEffect } from 'react';
import { useRoute, matchPath } from './router.jsx';
import { requestPersistence } from '../storage/storage.js';
import HomeView from './HomeView.jsx';
import PatternLibrary from '../patterns/PatternLibrary.jsx';
import PatternView from '../patterns/PatternView.jsx';
import SharedImport from '../patterns/SharedImport.jsx';
import ProjectView from '../projects/ProjectView.jsx';
import FinishedGallery from '../projects/FinishedGallery.jsx';
import ProjectDetails from '../projects/ProjectDetails.jsx';
import Settings from '../settings/Settings.jsx';

export default function App() {
  const path = useRoute();

  useEffect(() => {
    requestPersistence();
  }, []);

  let params;
  if (path === '/') return <HomeView />;
  if (path === '/monster') return <PatternLibrary />;
  if ((params = matchPath('/monster/visa/:id', path))) return <PatternView patternId={params.id} />;
  if ((params = matchPath('/projekt/:id', path))) return <ProjectView projectId={params.id} />;
  if (path === '/fardiga') return <FinishedGallery />;
  if ((params = matchPath('/fardiga/:id', path))) return <ProjectDetails projectId={params.id} />;
  if (path === '/installningar') return <Settings />;
  if (path === '/dela') return <SharedImport />;

  return <HomeView />;
}
