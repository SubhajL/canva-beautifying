import {
  Button,
  Column,
  Heading,
  Hr,
  Img,
  Row,
  Section,
  Text,
} from '@react-email/components'
import * as React from 'react'
import BaseEmailTemplate from './base-template'

interface EnhancementCompletedEmailProps {
  userName: string
  documentName: string
  enhancementUrl: string
  originalPreviewUrl?: string
  enhancedPreviewUrl?: string
  processingTime: number
  improvementScore: number
}

export const EnhancementCompletedEmail: React.FC<EnhancementCompletedEmailProps> = ({
  userName,
  documentName,
  enhancementUrl,
  originalPreviewUrl,
  enhancedPreviewUrl,
  processingTime,
  improvementScore,
}) => {
  const previewText = `Your document "${documentName}" has been enhanced and is ready to download!`

  return (
    <BaseEmailTemplate 
      previewText={previewText}
      footerUnsubscribeUrl="https://beautifyai.com/unsubscribe"
    >
      <Section style={content}>
        <Heading style={heading}>
          Your document is ready! 🎨
        </Heading>
        
        <Text style={paragraph}>
          Hi {userName},
        </Text>
        
        <Text style={paragraph}>
          Great news! We&apos;ve finished enhancing your document &ldquo;{documentName}&rdquo; and it&apos;s ready for you to download.
        </Text>

        {originalPreviewUrl && enhancedPreviewUrl && (
          <Section style={comparisonSection}>
            <Row>
              <Column style={imageColumn}>
                <Text style={imageLabel}>Before</Text>
                <Img
                  src={originalPreviewUrl}
                  width="250"
                  height="180"
                  alt="Original document"
                  style={previewImage}
                />
              </Column>
              <Column style={imageColumn}>
                <Text style={imageLabel}>After</Text>
                <Img
                  src={enhancedPreviewUrl}
                  width="250"
                  height="180"
                  alt="Enhanced document"
                  style={previewImage}
                />
              </Column>
            </Row>
          </Section>
        )}

        <Section style={statsSection}>
          <Row>
            <Column style={statColumn}>
              <Text style={statValue}>{improvementScore}%</Text>
              <Text style={statLabel}>Improvement Score</Text>
            </Column>
            <Column style={statColumn}>
              <Text style={statValue}>{processingTime}s</Text>
              <Text style={statLabel}>Processing Time</Text>
            </Column>
          </Row>
        </Section>

        <Section style={buttonSection}>
          <Button style={button} href={enhancementUrl}>
            Download Enhanced Document
          </Button>
        </Section>

        <Hr style={divider} />

        <Text style={tipText}>
          <strong>💡 Pro tip:</strong> You can further customize your enhanced document by uploading it to Canva or other design tools.
        </Text>

        <Text style={paragraph}>
          Have questions or feedback? Just reply to this email and we&apos;ll be happy to help!
        </Text>

        <Text style={signOff}>
          Happy designing!<br />
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

const comparisonSection = {
  margin: '32px 0',
}

const imageColumn = {
  width: '50%',
  paddingRight: '8px',
  paddingLeft: '8px',
}

const imageLabel = {
  fontSize: '14px',
  color: '#666',
  textAlign: 'center' as const,
  marginBottom: '8px',
}

const previewImage = {
  borderRadius: '8px',
  border: '1px solid #e5e7eb',
  display: 'block',
  margin: '0 auto',
}

const statsSection = {
  margin: '32px 0',
  backgroundColor: '#f9fafb',
  borderRadius: '8px',
  padding: '24px',
}

const statColumn = {
  width: '50%',
  textAlign: 'center' as const,
}

const statValue = {
  fontSize: '32px',
  fontWeight: '700',
  color: '#6366f1',
  margin: '0',
}

const statLabel = {
  fontSize: '14px',
  color: '#666',
  margin: '4px 0 0',
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

const tipText = {
  fontSize: '15px',
  lineHeight: '24px',
  color: '#525252',
  backgroundColor: '#f0f9ff',
  borderRadius: '8px',
  padding: '16px',
  margin: '24px 0',
}

const signOff = {
  fontSize: '16px',
  lineHeight: '26px',
  color: '#404040',
  margin: '24px 0 0',
}

export default EnhancementCompletedEmail