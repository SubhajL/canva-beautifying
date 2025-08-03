import {
  Button,
  Column,
  Heading,
  Hr,
  Link,
  Row,
  Section,
  Text,
} from '@react-email/components'
import * as React from 'react'
import BaseEmailTemplate from './base-template'

interface WelcomeEmailProps {
  userName: string
  userTier: 'free' | 'basic' | 'pro' | 'premium'
  monthlyCredits: number
}

export const WelcomeEmail: React.FC<WelcomeEmailProps> = ({
  userName,
  userTier,
  _monthlyCredits,
}) => {
  const previewText = `Welcome to BeautifyAI! Start enhancing your documents with AI.`

  const tierFeatures = {
    free: [
      '10 document enhancements per month',
      'Basic AI model (Gemini 2.0 Flash)',
      'PNG & JPG export formats',
      'Up to 10MB file size',
    ],
    basic: [
      '100 document enhancements per month',
      'Access to Gemini & GPT-4 Mini',
      'PNG, JPG & PDF export formats',
      'Up to 25MB file size',
      'Batch processing (up to 5 files)',
    ],
    pro: [
      '500 document enhancements per month',
      'Access to premium AI models',
      'All export formats including Canva',
      'Up to 50MB file size',
      'Batch processing (up to 10 files)',
      'Priority processing',
    ],
    premium: [
      '2000 document enhancements per month',
      'Access to all AI models',
      'All export formats',
      'API access',
      'Unlimited batch processing',
      'Highest priority processing',
    ],
  }

  return (
    <BaseEmailTemplate 
      previewText={previewText}
      footerUnsubscribeUrl="https://beautifyai.com/unsubscribe"
    >
      <Section style={content}>
        <Heading style={heading}>
          Welcome to BeautifyAI! 🎨
        </Heading>
        
        <Text style={paragraph}>
          Hi {userName},
        </Text>
        
        <Text style={paragraph}>
          Welcome aboard! We&apos;re thrilled to have you join the BeautifyAI community. 
          You&apos;re all set to start transforming your documents with the power of AI.
        </Text>

        <Section style={tierSection}>
          <Text style={tierHeading}>
            Your {userTier.charAt(0).toUpperCase() + userTier.slice(1)} Plan includes:
          </Text>
          <ul style={featureList}>
            {tierFeatures[userTier].map((feature, index) => (
              <li key={index} style={featureItem}>{feature}</li>
            ))}
          </ul>
        </Section>

        <Section style={buttonSection}>
          <Button style={button} href="https://beautifyai.com/app">
            Start Enhancing Documents
          </Button>
        </Section>

        <Hr style={divider} />

        <Section style={stepsSection}>
          <Text style={stepsHeading}>Getting Started is Easy:</Text>
          
          <Row style={stepRow}>
            <Column style={stepNumber}>1</Column>
            <Column style={stepContent}>
              <Text style={stepTitle}>Upload Your Document</Text>
              <Text style={stepDescription}>
                Drag and drop or click to upload your worksheet, presentation, or marketing material.
              </Text>
            </Column>
          </Row>

          <Row style={stepRow}>
            <Column style={stepNumber}>2</Column>
            <Column style={stepContent}>
              <Text style={stepTitle}>AI Analysis & Enhancement</Text>
              <Text style={stepDescription}>
                Our AI analyzes your document and automatically enhances layout, colors, and typography.
              </Text>
            </Column>
          </Row>

          <Row style={stepRow}>
            <Column style={stepNumber}>3</Column>
            <Column style={stepContent}>
              <Text style={stepTitle}>Download & Use</Text>
              <Text style={stepDescription}>
                Download your enhanced document in your preferred format and use it anywhere.
              </Text>
            </Column>
          </Row>
        </Section>

        <Section style={resourcesSection}>
          <Text style={resourcesHeading}>Helpful Resources:</Text>
          <Text style={paragraph}>
            • <Link href="https://beautifyai.com/docs/getting-started" style={link}>Getting Started Guide</Link><br />
            • <Link href="https://beautifyai.com/docs/best-practices" style={link}>Best Practices for Document Enhancement</Link><br />
            • <Link href="https://beautifyai.com/templates" style={link}>Browse Template Gallery</Link>
          </Text>
        </Section>

        <Text style={paragraph}>
          Questions? Just reply to this email or check out our{' '}
          <Link href="https://beautifyai.com/help" style={link}>Help Center</Link>.
        </Text>

        <Text style={signOff}>
          Happy enhancing!<br />
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

const tierSection = {
  backgroundColor: '#f9fafb',
  borderRadius: '8px',
  padding: '24px',
  margin: '24px 0',
}

const tierHeading = {
  fontSize: '18px',
  fontWeight: '600',
  color: '#1a1a1a',
  margin: '0 0 16px',
}

const featureList = {
  margin: '0',
  paddingLeft: '24px',
}

const featureItem = {
  fontSize: '15px',
  lineHeight: '24px',
  color: '#404040',
  marginBottom: '8px',
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

const divider = {
  borderColor: '#e5e7eb',
  margin: '32px 0',
}

const stepsSection = {
  margin: '32px 0',
}

const stepsHeading = {
  fontSize: '20px',
  fontWeight: '600',
  color: '#1a1a1a',
  margin: '0 0 24px',
}

const stepRow = {
  marginBottom: '24px',
}

const stepNumber = {
  width: '48px',
  fontSize: '24px',
  fontWeight: '700',
  color: '#6366f1',
  textAlign: 'center' as const,
  backgroundColor: '#ede9fe',
  borderRadius: '50%',
  height: '48px',
  lineHeight: '48px',
}

const stepContent = {
  paddingLeft: '16px',
  verticalAlign: 'top' as const,
}

const stepTitle = {
  fontSize: '16px',
  fontWeight: '600',
  color: '#1a1a1a',
  margin: '0 0 4px',
}

const stepDescription = {
  fontSize: '15px',
  lineHeight: '22px',
  color: '#666',
  margin: '0',
}

const resourcesSection = {
  backgroundColor: '#f0f9ff',
  borderRadius: '8px',
  padding: '20px',
  margin: '24px 0',
}

const resourcesHeading = {
  fontSize: '16px',
  fontWeight: '600',
  color: '#1a1a1a',
  margin: '0 0 12px',
}

const link = {
  color: '#6366f1',
  textDecoration: 'underline',
}

const signOff = {
  fontSize: '16px',
  lineHeight: '26px',
  color: '#404040',
  margin: '24px 0 0',
}

export default WelcomeEmail