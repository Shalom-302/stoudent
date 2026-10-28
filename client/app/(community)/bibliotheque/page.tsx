import type { Metadata } from 'next';
import { Suspense } from 'react';

import { LibraryView } from '@/components/community/library-view';

export const metadata: Metadata = {
  title: 'Bibliothèque BTS · sujets, corrigés, cours et TD',
  description:
    'Sujets d’examen du BTS (Côte d’Ivoire), corrigés, cours et TD classés par filière, matière et session, avec leur source.',
};

export default function LibraryPage() {
  return (
    <Suspense>
      <LibraryView />
    </Suspense>
  );
}
