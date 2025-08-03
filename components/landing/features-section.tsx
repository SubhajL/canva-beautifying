"use client"

import React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  Palette, 
  Type, 
  Layout, 
  Image, 
  Zap,
  Target,
  BookOpen,
  Users,
  Clock,
  Shield,
  Download
} from 'lucide-react'

const features = [
  {
    icon: Palette,
    title: 'Smart Color Optimization',
    description: 'AI analyzes and enhances color harmony to make your designs more visually appealing and professional.',
    badge: 'Color Theory',
    color: 'text-purple-600'
  },
  {
    icon: Type,
    title: 'Typography Enhancement',
    description: 'Automatically adjusts fonts, sizes, and spacing for optimal readability and visual hierarchy.',
    badge: 'Typography',
    color: 'text-blue-600'
  },
  {
    icon: Layout,
    title: 'Layout Restructuring',
    description: 'Intelligent layout adjustments ensure perfect balance and alignment in your educational materials.',
    badge: 'Composition',
    color: 'text-green-600'
  },
  {
    icon: Image,
    title: 'AI-Generated Assets',
    description: 'Creates custom backgrounds and decorative elements that match your content perfectly.',
    badge: 'DALL-E 3',
    color: 'text-pink-600'
  },
  {
    icon: Target,
    title: 'Age-Appropriate Design',
    description: 'Tailors visual elements to match the cognitive level of your target audience.',
    badge: 'Educational',
    color: 'text-orange-600'
  },
  {
    icon: BookOpen,
    title: 'Subject Matter Analysis',
    description: 'Understands your content and applies design principles specific to the subject matter.',
    badge: 'Context-Aware',
    color: 'text-indigo-600'
  }
]

const benefits = [
  {
    icon: Clock,
    title: 'Save Hours of Design Time',
    description: 'Transform documents in under 30 seconds'
  },
  {
    icon: Users,
    title: 'Engage Your Students',
    description: 'Boost engagement scores by up to 85%'
  },
  {
    icon: Shield,
    title: 'Enterprise-Grade Security',
    description: 'Your data is encrypted and never shared'
  },
  {
    icon: Download,
    title: 'Multiple Export Formats',
    description: 'Export as PNG, JPG, PDF, or Canva-ready'
  }
]

export function FeaturesSection() {
  return (
    <section id="features" className="py-20 bg-white">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-3xl text-center mb-16">
          <Badge variant="secondary" className="mb-4">
            <Zap className="mr-1 h-3 w-3" />
            Powered by Advanced AI
          </Badge>
          <h2 className="mb-4 text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
            Everything You Need to Create{' '}
            <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              Stunning Educational Content
            </span>
          </h2>
          <p className="text-xl text-gray-600">
            Our AI analyzes every aspect of your design and applies professional design principles
            to create materials that truly engage and educate.
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3 mb-16">
          {features.map((feature, index) => (
            <Card key={index} variant="feature" className="group">
              <CardHeader>
                <div className="mb-4 inline-flex rounded-lg bg-gray-50 p-3 group-hover:bg-primary/10 transition-colors">
                  <feature.icon className={`h-6 w-6 ${feature.color}`} />
                </div>
                <CardTitle className="mb-2">{feature.title}</CardTitle>
                <Badge variant="outline" className="mb-3">{feature.badge}</Badge>
              </CardHeader>
              <CardContent>
                <CardDescription>{feature.description}</CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="rounded-2xl bg-gradient-to-r from-primary/10 to-secondary/10 p-12">
          <h3 className="mb-8 text-center text-2xl font-bold text-gray-900">
            Why Educators Love BeautifyAI
          </h3>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {benefits.map((benefit, index) => (
              <div key={index} className="text-center">
                <div className="mb-4 inline-flex rounded-full bg-white p-3 shadow-lg">
                  <benefit.icon className="h-6 w-6 text-primary" />
                </div>
                <h4 className="mb-2 font-semibold text-gray-900">{benefit.title}</h4>
                <p className="text-sm text-gray-600">{benefit.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}