import Link from 'next/link';
import { ArrowRight, Sparkles } from 'lucide-react';

export function BetaBanner() {
  return (
    <div className="relative overflow-hidden bg-gradient-to-r from-primary to-purple-600 text-white">
      <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center opacity-20" />
      <div className="container mx-auto px-4 py-4 relative">
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 text-center sm:text-left">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            <span className="font-semibold">Limited Time: Join Our Exclusive Beta Program!</span>
          </div>
          <Link 
            href="/beta-program" 
            className="inline-flex items-center gap-2 text-sm font-medium hover:underline underline-offset-4 transition-all hover:gap-3"
          >
            Get Free Premium Access
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}