import { NextRequest, NextResponse } from "next/server"
import { uploadFile } from "@/lib/r2"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const maxDuration = 60

const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB
const ALLOWED_FILE_TYPES = ["image/png", "image/jpeg", "image/jpg", "application/pdf"]

export async function POST(request: NextRequest) {
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

    const formData = await request.formData()
    const file = formData.get("file") as File
    const userId = user.id

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      )
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File size exceeds 50MB limit" },
        { status: 400 }
      )
    }

    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Only PNG, JPG, and PDF files are allowed" },
        { status: 400 }
      )
    }

    const result = await uploadFile({
      file,
      userId,
      filename: file.name,
      folder: "ORIGINAL",
      contentType: file.type,
    })

    // Store upload information in database
    const { data: enhancement, error: dbError } = await supabase
      .from('enhancements')
      .insert({
        user_id: userId,
        original_url: result.url,
        status: 'uploaded',
        analysis_data: {
          filename: file.name,
          size: file.size,
          type: file.type,
          uploadedAt: new Date().toISOString()
        }
      })
      .select()
      .single()

    if (dbError) {
      console.error("Database error:", dbError)
      // Don't fail the upload, just log the error
    }

    return NextResponse.json({
      success: true,
      key: result.key,
      url: result.url,
      filename: file.name,
      size: file.size,
      type: file.type,
      enhancementId: enhancement?.id
    })
  } catch (error) {
    console.error("Upload error:", error)
    return NextResponse.json(
      { error: "Failed to upload file" },
      { status: 500 }
    )
  }
}