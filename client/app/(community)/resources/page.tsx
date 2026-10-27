import { redirect } from 'next/navigation';

/** Resources are closed for now; see components/community/resources-view.tsx. */
export default function ResourcesPage() {
  redirect('/questions');
}
