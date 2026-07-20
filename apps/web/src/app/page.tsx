import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { LedgerDashboard } from './ledger-dashboard';
import { authOptions } from '@/lib/auth';

export default async function Home() {
  const session = await getServerSession(authOptions);

  if (!session) redirect('/login');

  return <LedgerDashboard name={session.user?.name ?? session.user?.email} />;
}
