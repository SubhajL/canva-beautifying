import { BetaMessageCenter } from "@/components/beta/BetaMessageCenter"

export default function BetaAnnouncementsPage() {
  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <div className="mb-8">
        <h1 className="mb-2 text-3xl font-bold">Beta Program Updates</h1>
        <p className="text-muted-foreground">
          Stay informed about the latest features, updates, and announcements
          for the Canva Beautifying beta program.
        </p>
      </div>

      <BetaMessageCenter />
    </div>
  )
}
