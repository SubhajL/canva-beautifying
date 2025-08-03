"use client"

import React from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ArrowRight, Sparkles } from 'lucide-react'

export function CTASection() {
  return (
    <section className="py-20 bg-gradient-to-r from-primary to-secondary">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mb-6 inline-flex rounded-full bg-white/20 p-3">
            <Sparkles className="h-8 w-8 text-white" />
          </div>
          
          <h2 className="mb-4 text-4xl font-bold tracking-tight text-white sm:text-5xl">
            Ready to Transform Your Educational Content?
          </h2>
          
          <p className="mb-8 text-xl text-white/90">
            Join thousands of educators who are creating more engaging materials with AI.
            Start your free trial today - no credit card required.
          </p>
          
          <div className="flex flex-col gap-4 sm:flex-row sm:justify-center">
            <Link href="/signup">
              <Button size="xl" variant="default" className="bg-white text-primary hover:bg-gray-100 group">
                Start Your Free Trial
                <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
              </Button>
            </Link>
            <Link href="/demo">
              <Button size="xl" variant="outline" className="border-white text-white hover:bg-white/10">
                Watch Demo
              </Button>
            </Link>
          </div>
          
          <p className="mt-6 text-sm text-white/70">
            Free plan includes 10 enhancements per month. Upgrade anytime.
          </p>
        </div>
      </div>
    </section>
  )
}