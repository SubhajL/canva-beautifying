import {
  Body,
  Container,
  Head,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components'
import * as React from 'react'

interface BaseEmailTemplateProps {
  previewText: string
  children: React.ReactNode
  footerUnsubscribeUrl?: string
}

export const BaseEmailTemplate: React.FC<BaseEmailTemplateProps> = ({
  previewText,
  children,
  footerUnsubscribeUrl,
}) => {
  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={header}>
            <Img
              src="https://beautifyai.com/logo.png"
              width="150"
              height="50"
              alt="BeautifyAI"
              style={logo}
            />
          </Section>

          {children}

          <Section style={footer}>
            <Text style={footerText}>
              © {new Date().getFullYear()} BeautifyAI. All rights reserved.
            </Text>
            {footerUnsubscribeUrl && (
              <Text style={footerText}>
                <Link href={footerUnsubscribeUrl} style={footerLink}>
                  Unsubscribe
                </Link>
                {' | '}
                <Link href="https://beautifyai.com/preferences" style={footerLink}>
                  Email Preferences
                </Link>
              </Text>
            )}
            <Text style={footerAddress}>
              BeautifyAI, Inc. | 123 Design Street, San Francisco, CA 94105
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

// Styles
const main = {
  backgroundColor: '#f6f9fc',
  fontFamily:
    '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
}

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '20px 0 48px',
  marginBottom: '64px',
  borderRadius: '8px',
  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
}

const header = {
  padding: '32px 20px 0',
  textAlign: 'center' as const,
}

const logo = {
  margin: '0 auto',
}

const footer = {
  padding: '32px 20px',
  textAlign: 'center' as const,
}

const footerText = {
  margin: '0 0 4px',
  fontSize: '14px',
  lineHeight: '24px',
  color: '#898989',
}

const footerLink = {
  color: '#6366f1',
  textDecoration: 'underline',
}

const footerAddress = {
  margin: '16px 0 0',
  fontSize: '12px',
  lineHeight: '16px',
  color: '#b7b7b7',
}

export default BaseEmailTemplate