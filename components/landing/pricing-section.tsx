"use client"

import React from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Check, X, Sparkles } from 'lucide-react'

const plans = [
  {
    name: 'Free',
    price: '$0',
    period: 'forever',
    description: 'Perfect for trying out BeautifyAI',
    features: [
      { text: '10 enhancements per month', included: true },
      { text: 'Basic AI models', included: true },
      { text: 'Standard processing', included: true },
      { text: 'PNG & JPG export', included: true },
      { text: 'Email support', included: true },
      { text: 'Advanced AI models', included: false },
      { text: 'Priority processing', included: false },
      { text: 'Bulk processing', included: false },
    ],
    cta: 'Start Free',
    variant: 'outline' as const,
  },
  {
    name: 'Basic',
    price: '$9',
    period: '/month',
    description: 'Great for individual educators',
    popular: true,
    features: [
      { text: '100 enhancements per month', included: true },
      { text: 'Advanced AI models', included: true },
      { text: 'Faster processing', included: true },
      { text: 'All export formats', included: true },
      { text: 'Priority email support', included: true },
      { text: 'Batch processing (5 files)', included: true },
      { text: 'Custom branding', included: false },
      { text: 'API access', included: false },
    ],
    cta: 'Get Started',
    variant: 'gradient' as const,
  },
  {
    name: 'Pro',
    price: '$29',
    period: '/month',
    description: 'For power users and teams',
    features: [
      { text: '500 enhancements per month', included: true },
      { text: 'Premium AI models (GPT-4, Claude)', included: true },
      { text: 'Priority processing', included: true },
      { text: 'All export formats + Canva', included: true },
      { text: 'Live chat support', included: true },
      { text: 'Batch processing (10 files)', included: true },
      { text: 'Custom branding', included: true },
      { text: 'Advanced analytics', included: true },
    ],
    cta: 'Go Pro',
    variant: 'default' as const,
  },
  {
    name: 'Premium',
    price: '$99',
    period: '/month',
    description: 'For schools and organizations',
    features: [
      { text: 'Unlimited enhancements', included: true },
      { text: 'All AI models + exclusive access', included: true },
      { text: 'Instant processing', included: true },
      { text: 'Custom export formats', included: true },
      { text: 'Dedicated support', included: true },
      { text: 'Unlimited batch processing', included: true },
      { text: 'White-label options', included: true },
      { text: 'API access & webhooks', included: true },
    ],
    cta: 'Contact Sales',
    variant: 'default' as const,
  },
]

export function PricingSection() {
  return (
    <section id="pricing" className="py-20 bg-gray-50">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-3xl text-center mb-16">
          <Badge variant="secondary" className="mb-4">
            <Sparkles className="mr-1 h-3 w-3" />
            Simple, Transparent Pricing
          </Badge>
          <h2 className="mb-4 text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
            Choose the Perfect Plan for{' '}
            <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              Your Needs
            </span>
          </h2>
          <p className="text-xl text-gray-600">
            Start free and upgrade as you grow. No hidden fees, cancel anytime.
          </p>
        </div>

        {/* Beta Program CTA */}
        <div className="mb-12 mx-auto max-w-4xl">
          <Card className="relative overflow-hidden border-2 border-primary bg-gradient-to-r from-primary/5 to-purple-600/5">
            <div className="absolute top-0 right-0 -mt-4 -mr-4 h-24 w-24 rounded-full bg-primary/10 blur-2xl" />
            <CardContent className="p-8">
              <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="text-center md:text-left">
                  <Badge className="mb-2">LIMITED TIME OFFER</Badge>
                  <h3 className="text-2xl font-bold mb-2">Join Our Beta Program</h3>
                  <p className="text-muted-foreground">
                    Get free access to all Premium features for 3 months. 
                    Only 500 spots available!
                  </p>
                </div>
                <Link href="/beta-program">
                  <Button size="lg" variant="gradient" className="whitespace-nowrap">
                    Join Beta Program
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-8 lg:grid-cols-4">
          {plans.map((plan, index) => (
            <Card 
              key={index} 
              variant="pricing" 
              className={plan.popular ? 'relative border-primary shadow-xl' : ''}
            >
              {plan.popular && (
                <div className="absolute -top-5 left-0 right-0 mx-auto w-fit">
                  <Badge variant="default" className="px-3 py-1">
                    Most Popular
                  </Badge>
                </div>
              )}
              
              <CardHeader className="pb-8">
                <CardTitle className="text-2xl">{plan.name}</CardTitle>
                <CardDescription>{plan.description}</CardDescription>
                <div className="mt-4">
                  <span className="text-4xl font-bold">{plan.price}</span>
                  <span className="text-gray-600">{plan.period}</span>
                </div>
              </CardHeader>
              
              <CardContent className="pb-8">
                <ul className="space-y-3">
                  {plan.features.map((feature, featureIndex) => (
                    <li key={featureIndex} className="flex items-start gap-3">
                      {feature.included ? (
                        <Check className="h-5 w-5 text-green-600 flex-shrink-0" />
                      ) : (
                        <X className="h-5 w-5 text-gray-300 flex-shrink-0" />
                      )}
                      <span className={feature.included ? 'text-gray-700' : 'text-gray-400'}>
                        {feature.text}
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              
              <CardFooter>
                <Link href="/signup" className="w-full">
                  <Button 
                    variant={plan.variant} 
                    size="lg" 
                    className="w-full"
                  >
                    {plan.cta}
                  </Button>
                </Link>
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}