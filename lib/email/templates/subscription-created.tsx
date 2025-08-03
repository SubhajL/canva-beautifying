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

interface SubscriptionCreatedEmailProps {
  userName: string
  planName: 'Basic' | 'Pro' | 'Premium'
  monthlyCredits: number
  amount: number
  billingCycle: 'monthly' | 'yearly'
  nextBillingDate: Date
  invoiceUrl?: string
}

export const SubscriptionCreatedEmail: React.FC<SubscriptionCreatedEmailProps> = ({
  userName,
  planName,
  monthlyCredits,
  amount,
  billingCycle,
  nextBillingDate,
  invoiceUrl,
}) => {
  const previewText = `Welcome to BeautifyAI ${planName}! Your subscription is now active.`

  const planFeatures = {
    Basic: [
      '100 document enhancements per month',
      'Access to Gemini & GPT-4 Mini models',
      'PNG, JPG & PDF export formats',
      'Up to 25MB file size',
      'Batch processing (up to 5 files)',
      'Standard support',
    ],
    Pro: [
      '500 document enhancements per month',
      'Access to premium AI models including Claude',
      'All export formats including Canva',
      'Up to 50MB file size',
      'Batch processing (up to 10 files)',
      'Priority processing & support',
    ],
    Premium: [
      '2000 document enhancements per month',
      'Access to all AI models',
      'All export formats',
      'API access for developers',
      'Unlimited batch processing',
      'Dedicated support & custom training',
    ],
  }

  return (
    <BaseEmailTemplate 
      previewText={previewText}
      footerUnsubscribeUrl="https://beautifyai.com/unsubscribe"
    >
      <Section style={content}>
        <Heading style={heading}>
          Welcome to BeautifyAI {planName}! 🎉
        </Heading>
        
        <Text style={paragraph}>
          Hi {userName},
        </Text>
        
        <Text style={paragraph}>
          Thank you for subscribing to BeautifyAI {planName}! Your subscription is now active 
          and you&apos;re ready to take your document enhancement to the next level.
        </Text>

        <Section style={subscriptionBox}>
          <Text style={subscriptionHeading}>Subscription Details</Text>
          
          <Row style={detailRow}>
            <Column style={detailLabel}>Plan:</Column>
            <Column style={detailValue}>BeautifyAI {planName}</Column>
          </Row>
          
          <Row style={detailRow}>
            <Column style={detailLabel}>Billing:</Column>
            <Column style={detailValue}>
              ${amount}/{billingCycle === 'monthly' ? 'month' : 'year'}
            </Column>
          </Row>
          
          <Row style={detailRow}>
            <Column style={detailLabel}>Monthly Credits:</Column>
            <Column style={detailValue}>{monthlyCredits.toLocaleString()}</Column>
          </Row>
          
          <Row style={detailRow}>
            <Column style={detailLabel}>Next Billing Date:</Column>
            <Column style={detailValue}>
              {nextBillingDate.toLocaleDateString('en-US', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
            </Column>
          </Row>
        </Section>

        <Section style={featuresSection}>
          <Text style={featuresHeading}>Your {planName} Plan Includes:</Text>
          <ul style={featureList}>
            {planFeatures[planName].map((feature, index) => (
              <li key={index} style={featureItem}>
                <span style={checkmark}>✓</span> {feature}
              </li>
            ))}
          </ul>
        </Section>

        <Section style={buttonSection}>
          <Button style={button} href="https://beautifyai.com/app">
            Start Using BeautifyAI {planName}
          </Button>
        </Section>

        {invoiceUrl && (
          <Text style={invoiceText}>
            <Link href={invoiceUrl} style={link}>Download Invoice</Link>
          </Text>
        )}

        <Hr style={divider} />

        <Section style={tipsSection}>
          <Text style={tipsHeading}>💡 Quick Tips to Get Started:</Text>
          <Text style={tipItem}>
            • Try batch processing to enhance multiple documents at once
          </Text>
          <Text style={tipItem}>
            • Experiment with different AI models to find your favorite
          </Text>
          <Text style={tipItem}>
            • Check out our templates gallery for inspiration
          </Text>
        </Section>

        <Text style={paragraph}>
          Need help? Visit our <Link href="https://beautifyai.com/help" style={link}>Help Center</Link> or 
          reply to this email. As a {planName} subscriber, you get priority support!
        </Text>

        <Text style={paragraph}>
          You can manage your subscription anytime from your{' '}
          <Link href="https://beautifyai.com/account/subscription" style={link}>account settings</Link>.
        </Text>

        <Text style={signOff}>
          Thanks for choosing BeautifyAI!<br />
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

const subscriptionBox = {
  backgroundColor: '#f9fafb',
  border: '1px solid #e5e7eb',
  borderRadius: '8px',
  padding: '24px',
  margin: '24px 0',
}

const subscriptionHeading = {
  fontSize: '18px',
  fontWeight: '600',
  color: '#1a1a1a',
  margin: '0 0 16px',
}

const detailRow = {
  paddingBottom: '12px',
}

const detailLabel = {
  width: '40%',
  fontSize: '15px',
  color: '#666',
  fontWeight: '500' as const,
}

const detailValue = {
  width: '60%',
  fontSize: '15px',
  color: '#1a1a1a',
  fontWeight: '600' as const,
}

const featuresSection = {
  margin: '32px 0',
}

const featuresHeading = {
  fontSize: '18px',
  fontWeight: '600',
  color: '#1a1a1a',
  margin: '0 0 16px',
}

const featureList = {
  margin: '0',
  paddingLeft: '0',
  listStyleType: 'none',
}

const featureItem = {
  fontSize: '15px',
  lineHeight: '24px',
  color: '#404040',
  marginBottom: '12px',
  paddingLeft: '28px',
  position: 'relative' as const,
}

const checkmark = {
  color: '#10b981',
  fontWeight: '700' as const,
  position: 'absolute' as const,
  left: '0',
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

const invoiceText = {
  textAlign: 'center' as const,
  fontSize: '14px',
  margin: '0 0 24px',
}

const link = {
  color: '#6366f1',
  textDecoration: 'underline',
}

const divider = {
  borderColor: '#e5e7eb',
  margin: '32px 0',
}

const tipsSection = {
  backgroundColor: '#f0f9ff',
  borderRadius: '8px',
  padding: '20px',
  margin: '24px 0',
}

const tipsHeading = {
  fontSize: '16px',
  fontWeight: '600',
  color: '#1a1a1a',
  margin: '0 0 12px',
}

const tipItem = {
  fontSize: '15px',
  lineHeight: '24px',
  color: '#404040',
  margin: '8px 0',
}

const signOff = {
  fontSize: '16px',
  lineHeight: '26px',
  color: '#404040',
  margin: '24px 0 0',
}

export default SubscriptionCreatedEmail