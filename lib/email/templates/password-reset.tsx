import {
  Button,
  Heading,
  Hr,
  Link,
  Section,
  Text,
} from '@react-email/components'
import * as React from 'react'
import BaseEmailTemplate from './base-template'

interface PasswordResetEmailProps {
  userName: string
  resetUrl: string
  userEmail: string
  ipAddress?: string
  userAgent?: string
}

export const PasswordResetEmail: React.FC<PasswordResetEmailProps> = ({
  userName,
  resetUrl,
  userEmail,
  ipAddress,
  userAgent,
}) => {
  const previewText = `Reset your BeautifyAI password`

  return (
    <BaseEmailTemplate previewText={previewText}>
      <Section style={content}>
        <Heading style={heading}>
          Reset Your Password
        </Heading>
        
        <Text style={paragraph}>
          Hi {userName},
        </Text>
        
        <Text style={paragraph}>
          We received a request to reset the password for your BeautifyAI account associated with {userEmail}.
        </Text>

        <Section style={buttonSection}>
          <Button style={button} href={resetUrl}>
            Reset Password
          </Button>
        </Section>

        <Text style={alternativeText}>
          Or copy and paste this link into your browser:
        </Text>
        
        <Text style={linkText}>
          <Link href={resetUrl} style={link}>
            {resetUrl}
          </Link>
        </Text>

        <Hr style={divider} />

        <Section style={securitySection}>
          <Text style={securityHeading}>
            🔒 Security Information
          </Text>
          
          <Text style={securityText}>
            This password reset was requested from:
          </Text>
          
          {ipAddress && (
            <Text style={securityDetail}>
              <strong>IP Address:</strong> {ipAddress}
            </Text>
          )}
          
          {userAgent && (
            <Text style={securityDetail}>
              <strong>Device:</strong> {userAgent}
            </Text>
          )}
          
          <Text style={securityDetail}>
            <strong>Time:</strong> {new Date().toLocaleString('en-US', {
              timeZone: 'America/Los_Angeles',
              dateStyle: 'medium',
              timeStyle: 'short',
            })} PST
          </Text>
        </Section>

        <Text style={warningText}>
          <strong>Didn&apos;t request this?</strong> If you didn&apos;t request a password reset, 
          you can safely ignore this email. Your password won&apos;t be changed unless you 
          click the button above and create a new one.
        </Text>

        <Text style={noteText}>
          This password reset link will expire in 1 hour for security reasons. 
          If you need to reset your password after that, please request a new reset link.
        </Text>

        <Text style={signOff}>
          Stay secure,<br />
          The BeautifyAI Team
        </Text>
      </Section>
    </BaseEmailTemplate>
  )
}

// Styles
const content = {
  padding: '0 20px',
}

const heading = {
  fontSize: '28px',
  fontWeight: '700',
  color: '#1a1a1a',
  textAlign: 'center' as const,
  margin: '30px 0',
}

const paragraph = {
  fontSize: '16px',
  lineHeight: '26px',
  color: '#404040',
  margin: '16px 0',
}

const buttonSection = {
  textAlign: 'center' as const,
  margin: '32px 0',
}

const button = {
  backgroundColor: '#6366f1',
  borderRadius: '8px',
  color: '#fff',
  fontSize: '16px',
  fontWeight: '600',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'inline-block',
  padding: '12px 32px',
}

const alternativeText = {
  fontSize: '14px',
  color: '#666',
  textAlign: 'center' as const,
  margin: '16px 0 8px',
}

const linkText = {
  fontSize: '14px',
  textAlign: 'center' as const,
  margin: '0 0 24px',
  wordBreak: 'break-all' as const,
}

const link = {
  color: '#6366f1',
  textDecoration: 'underline',
}

const divider = {
  borderColor: '#e5e7eb',
  margin: '32px 0',
}

const securitySection = {
  backgroundColor: '#f9fafb',
  borderRadius: '8px',
  padding: '20px',
  margin: '24px 0',
}

const securityHeading = {
  fontSize: '16px',
  fontWeight: '600',
  color: '#1a1a1a',
  margin: '0 0 12px',
}

const securityText = {
  fontSize: '14px',
  color: '#666',
  margin: '0 0 12px',
}

const securityDetail = {
  fontSize: '14px',
  color: '#404040',
  margin: '4px 0',
}

const warningText = {
  fontSize: '15px',
  lineHeight: '24px',
  color: '#dc2626',
  backgroundColor: '#fef2f2',
  borderRadius: '8px',
  padding: '16px',
  margin: '24px 0',
}

const noteText = {
  fontSize: '14px',
  lineHeight: '22px',
  color: '#666',
  fontStyle: 'italic' as const,
  margin: '16px 0',
}

const signOff = {
  fontSize: '16px',
  lineHeight: '26px',
  color: '#404040',
  margin: '24px 0 0',
}

export default PasswordResetEmail