import { generateCSRFToken, setCSRFCookie } from '@/lib/utils/csrf';

export async function CSRFProvider() {
  // Generate and set CSRF token
  const token = generateCSRFToken();
  await setCSRFCookie(token);

  // Inject token into meta tag for client-side access
  return (
    <>
      <meta name="csrf-token" content={token} />
    </>
  );
}