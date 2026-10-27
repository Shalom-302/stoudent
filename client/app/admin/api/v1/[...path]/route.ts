// Same-origin proxy to the back-office API (SignManager). See lib/server/proxy.ts.
import type { NextRequest } from 'next/server';

import { proxy } from '@/lib/server/proxy';

type Ctx = { params: Promise<{ path: string[] }> };

const handle = async (req: NextRequest, { params }: Ctx) => proxy(req, '/admin/api/v1', (await params).path);

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
export const dynamic = 'force-dynamic';
