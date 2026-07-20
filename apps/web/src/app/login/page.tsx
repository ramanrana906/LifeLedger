import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { AuthCard } from './auth-card';
import { authOptions } from '@/lib/auth';

export default async function LoginPage() {
  const session = await getServerSession(authOptions);
  if (session) redirect('/');

  return <AuthCard initialMode="signin" />;
}
