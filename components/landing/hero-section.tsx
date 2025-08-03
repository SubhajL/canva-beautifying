"use client"

import React from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowRight, Sparkles, Zap } from 'lucide-react'

export function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-white to-gray-50 pb-20 pt-32">
      <div className="absolute inset-0 bg-grid-slate-100 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.5))]" />
      
      <div className="container relative mx-auto px-4">
        <div className="mx-auto max-w-4xl text-center">
          <Badge variant="secondary" className="mb-4">
            <Sparkles className="mr-1 h-3 w-3" />
            AI-Powered Design Enhancement
          </Badge>
          
          <h1 className="mb-6 text-5xl font-bold tracking-tight text-gray-900 sm:text-6xl md:text-7xl">
            Transform Your{' '}
            <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              Canva Designs
            </span>{' '}
            with AI Magic
          </h1>
          
          <p className="mb-10 text-xl text-gray-600 sm:text-2xl">
            Upload your educational materials and watch as our AI enhances them to be more engaging, 
            professional, and age-appropriate. Perfect for teachers, educators, and content creators.
          </p>
          
          <div className="flex flex-col gap-4 sm:flex-row sm:justify-center">
            <Link href="/beta-program">
              <Button size="xl" variant="gradient" className="group">
                <Sparkles className="mr-2 h-5 w-5" />
                Join Beta Program
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Button>
            </Link>
            <Link href="#features">
              <Button size="xl" variant="outline">
                <Zap className="mr-2 h-5 w-5" />
                See How It Works
              </Button>
            </Link>
          </div>
          
          <div className="mt-10 flex items-center justify-center gap-8 text-sm text-gray-500">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-green-500" />
              <span>100% Free to Start</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-green-500" />
              <span>No Credit Card Required</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-green-500" />
              <span>AI-Powered Results</span>
            </div>
          </div>
        </div>
        
        <div className="mx-auto mt-16 max-w-5xl">
          <div className="relative rounded-xl bg-gradient-to-r from-primary/10 to-secondary/10 p-2">
            <div className="rounded-lg bg-white p-8 shadow-2xl">
              <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900">Before Enhancement</h3>
                  <div className="aspect-[4/3] rounded-lg bg-gray-100 flex items-center justify-center">
                    <span className="text-gray-400">Original Design</span>
                  </div>
                </div>
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900">After AI Enhancement</h3>
                  <div className="aspect-[4/3] rounded-lg bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
                    <span className="text-primary">Enhanced Design</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}