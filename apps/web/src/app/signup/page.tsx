import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { AuthCard } from '../login/auth-card';
import { authOptions } from '@/lib/auth';

export default async function SignupPage() {
  const session = await getServerSession(authOptions);
  if (session) redirect('/');

  return <AuthCard initialMode="signup" />;
}
