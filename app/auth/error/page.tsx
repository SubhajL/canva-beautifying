'use client'

import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Icons } from '@/components/ui/icons'

export default function AuthErrorPage() {
  const searchParams = useSearchParams()
  const error = searchParams.get('error')
  const errorDescription = searchParams.get('error_description')

  const getErrorMessage = () => {
    if (errorDescription) {
      return decodeURIComponent(errorDescription)
    }

    switch (error) {
      case 'access_denied':
        return 'Access was denied. You may have cancelled the authentication process.'
      case 'unauthorized_client':
        return 'The application is not authorized to use this authentication method.'
      case 'invalid_request':
        return 'The authentication request was invalid. Please try again.'
      case 'unsupported_response_type':
        return 'The authentication method is not supported.'
      case 'server_error':
        return 'An error occurred on the authentication server. Please try again later.'
      case 'temporarily_unavailable':
        return 'The authentication service is temporarily unavailable. Please try again later.'
      default:
        return 'An unexpected error occurred during authentication.'
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <Icons.alertCircle className="mx-auto h-12 w-12 text-destructive" />
          <h1 className="mt-4 text-2xl font-semibold tracking-tight">Authentication Error</h1>
        </div>

        <Alert variant="destructive">
          <Icons.alertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{getErrorMessage()}</AlertDescription>
        </Alert>

        <div className="space-y-3">
          <Link href="/login" className="block">
            <Button className="w-full">Back to Login</Button>
          </Link>
          
          <Link href="/" className="block">
            <Button variant="outline" className="w-full">Go to Homepage</Button>
          </Link>
        </div>

        {error && (
          <p className="text-center text-xs text-muted-foreground">
            Error code: {error}
          </p>
        )}
      </div>
    </div>
  )
}