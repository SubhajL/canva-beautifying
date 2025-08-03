import { NextRequest, NextResponse } from "next/server"
import { getDownloadUrl } from "@/lib/r2"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      )
    }

    const searchParams = request.nextUrl.searchParams
    const key = searchParams.get("key")
    const filename = searchParams.get("filename")

    if (!key) {
      return NextResponse.json(
        { error: "No file key provided" },
        { status: 400 }
      )
    }

    // Verify user has access to this file
    // Check if the key contains the user's ID
    if (!key.includes(user.id)) {
      return NextResponse.json(
        { error: "Access denied" },
        { status: 403 }
      )
    }

    const url = await getDownloadUrl(key, 3600, filename || undefined)

    return NextResponse.json({
      success: true,
      url,
      expiresIn: 3600,
    })
  } catch (error) {
    console.error("Download error:", error)
    return NextResponse.json(
      { error: "Failed to generate download URL" },
      { status: 500 }
    )
  }
}