"use client"

import React from 'react'
import { Badge } from '@/components/ui/badge'
import { Upload, Cpu, Download, FileCheck } from 'lucide-react'

const steps = [
  {
    number: '01',
    icon: Upload,
    title: 'Upload Your Design',
    description: 'Drag and drop your Canva export or paste a Canva URL. We support PNG, JPG, and PDF formats up to 50MB.',
    color: 'from-blue-500 to-blue-600',
  },
  {
    number: '02',
    icon: Cpu,
    title: 'AI Analysis & Enhancement',
    description: 'Our AI analyzes layout, colors, typography, and content to create the perfect enhancement strategy.',
    color: 'from-purple-500 to-purple-600',
  },
  {
    number: '03',
    icon: FileCheck,
    title: 'Review & Customize',
    description: 'Preview your enhanced design with before/after comparison. Fine-tune any aspects you want.',
    color: 'from-emerald-500 to-emerald-600',
  },
  {
    number: '04',
    icon: Download,
    title: 'Download & Use',
    description: 'Export in your preferred format and use your professionally enhanced educational materials.',
    color: 'from-amber-500 to-amber-600',
  },
]

export function HowItWorksSection() {
  return (
    <section className="py-20 bg-white">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-3xl text-center mb-16">
          <Badge variant="secondary" className="mb-4">
            Simple Process
          </Badge>
          <h2 className="mb-4 text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
            Transform Your Designs in{' '}
            <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              4 Simple Steps
            </span>
          </h2>
          <p className="text-xl text-gray-600">
            No design skills required. Our AI handles everything for you.
          </p>
        </div>

        <div className="mx-auto max-w-5xl">
          <div className="grid gap-12 md:grid-cols-2 lg:grid-cols-4">
            {steps.map((step, index) => (
              <div key={index} className="relative text-center group">
                {index < steps.length - 1 && (
                  <div className="hidden lg:block absolute top-16 left-[60%] w-full h-0.5 bg-gradient-to-r from-gray-300 to-transparent" />
                )}
                
                <div className="mb-6 relative">
                  <div className={`mx-auto h-32 w-32 rounded-full bg-gradient-to-r ${step.color} p-1 shadow-lg group-hover:shadow-xl transition-shadow`}>
                    <div className="flex h-full w-full items-center justify-center rounded-full bg-white">
                      <step.icon className="h-12 w-12 text-gray-700" />
                    </div>
                  </div>
                  <span className="absolute -top-2 -right-2 text-4xl font-bold text-gray-200">
                    {step.number}
                  </span>
                </div>
                
                <h3 className="mb-2 text-xl font-semibold text-gray-900">{step.title}</h3>
                <p className="text-gray-600">{step.description}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-16 text-center">
          <p className="text-lg text-gray-600 mb-8">
            Join thousands of educators who are already creating better educational content
          </p>
          <div className="flex justify-center gap-8">
            <div className="text-center">
              <p className="text-4xl font-bold text-primary">50K+</p>
              <p className="text-sm text-gray-600">Documents Enhanced</p>
            </div>
            <div className="text-center">
              <p className="text-4xl font-bold text-secondary">95%</p>
              <p className="text-sm text-gray-600">Satisfaction Rate</p>
            </div>
            <div className="text-center">
              <p className="text-4xl font-bold text-accent">&lt; 30s</p>
              <p className="text-sm text-gray-600">Average Process Time</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}