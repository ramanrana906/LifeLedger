import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';

const apiUrl = process.env.AUTH_API_URL ?? 'http://localhost:3001';

type Params = Promise<{ path: string[] }>;

async function proxy(request: Request, params: Params) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const { path } = await params;
  const url = `${apiUrl}/ledger/${path.join('/')}`;
  const init: RequestInit = {
    method: request.method,
    headers: {
      'Content-Type': 'application/json',
      'X-User-Id': userId,
    },
    cache: 'no-store',
  };

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    init.body = await request.text();
  }

  const response = await fetch(url, init);
  const text = await response.text();

  return new NextResponse(text, {
    status: response.status,
    headers: { 'Content-Type': response.headers.get('Content-Type') ?? 'application/json' },
  });
}

export async function GET(request: Request, context: { params: Params }) {
  return proxy(request, context.params);
}

export async function POST(request: Request, context: { params: Params }) {
  return proxy(request, context.params);
}
