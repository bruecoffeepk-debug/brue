import { Suspense } from 'react';
import LoginForm from './LoginForm';

// Opt out of prerendering — login reads ?next= from the URL and is session-aware.
export const dynamic = 'force-dynamic';

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
