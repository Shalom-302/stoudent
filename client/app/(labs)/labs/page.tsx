'use client';

import { useQuery } from '@tanstack/react-query';

import { LabCard } from '@/components/labs/lab-card';
import { Skeleton } from '@/components/ui/skeleton';
import { labService } from '@/services/labs';

export default function LabsPage() {
  const labs = useQuery({ queryKey: ['labs'], queryFn: labService.list });

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight text-ink-900">Laboratoires</h1>
      <p className="mt-1 text-sm text-ink-500">
        SignalLab est la première brique. D’autres laboratoires RIT suivront.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {labs.isLoading
          ? [0, 1].map((key) => <Skeleton key={key} className="h-56" />)
          : labs.data?.map((lab) => <LabCard key={lab.slug} lab={lab} />)}
      </div>
    </div>
  );
}
