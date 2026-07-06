import { useEffect, useState } from 'react';

/*
 * Minimal hash-router — hash-baserad så att GitHub Pages (statisk hosting)
 * aldrig behöver server-side-routing.
 */

export function currentPath() {
  const hash = window.location.hash.replace(/^#/, '');
  return hash || '/';
}

export function navigate(path, { replace = false } = {}) {
  const url = `#${path}`;
  if (replace) window.location.replace(url);
  else window.location.hash = path;
}

export function useRoute() {
  const [path, setPath] = useState(currentPath);
  useEffect(() => {
    const onChange = () => setPath(currentPath());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return path;
}

/** Matchar t.ex. matchPath('/projekt/:id', '/projekt/abc') → { id: 'abc' } */
export function matchPath(pattern, path) {
  const patternParts = pattern.split('/').filter(Boolean);
  const pathParts = path.split('/').filter(Boolean);
  if (patternParts.length !== pathParts.length) return null;
  const params = {};
  for (let i = 0; i < patternParts.length; i++) {
    if (patternParts[i].startsWith(':')) {
      params[patternParts[i].slice(1)] = decodeURIComponent(pathParts[i]);
    } else if (patternParts[i] !== pathParts[i]) {
      return null;
    }
  }
  return params;
}
