'use client';

import { useEffect } from 'react';

// The storefront scripts are plain DOM scripts that write state (bag count,
// wishlist state) the server cannot know about. Loading them after hydration
// keeps React from mistaking those writes for a hydration mismatch.
let started = false;

export default function DeferredScripts({ sources }: { sources: string[] }) {
  useEffect(() => {
    if (started) return;
    started = true;

    const load = (index: number) => {
      if (index >= sources.length) return;
      const script = document.createElement('script');
      script.src = sources[index];
      script.async = false;
      script.onload = () => load(index + 1);
      script.onerror = () => load(index + 1);
      document.body.appendChild(script);
    };

    load(0);
  }, [sources]);

  return null;
}
