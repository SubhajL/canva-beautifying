import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { validateCanvaUrl, parseCanvaUrl } from '@/lib/canva/utils';
import { uploadFile } from '@/lib/r2';
import { nanoid } from 'nanoid';
import { CanvaOAuth } from '@/lib/canva/oauth';
import { CanvaAPIClient } from '@/lib/canva/api-client';
import { isCanvaAPIConfigured, CANVA_API_CONFIG } from '@/lib/canva/api-config';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { url, mode = 'auto' } = body; // mode: 'api' | 'manual' | 'auto'

    // Validate the URL
    if (!url || !validateCanvaUrl(url)) {
      return NextResponse.json(
        { error: 'Invalid Canva URL' },
        { status: 400 }
      );
    }

    // Parse the URL to get design info
    const canvaInfo = parseCanvaUrl(url);
    if (!canvaInfo) {
      return NextResponse.json(
        { error: 'Could not parse Canva URL' },
        { status: 400 }
      );
    }

    // Get the design ID from the URL
    const designId = CanvaAPIClient.parseDesignId(url);
    if (!designId) {
      return NextResponse.json(
        { error: 'Could not extract design ID from URL' },
        { status: 400 }
      );
    }

    // Check if API is configured and user wants to use it
    const useAPI = mode === 'api' || (mode === 'auto' && isCanvaAPIConfigured());

    if (useAPI) {
      // Try to get stored Canva token
      const token = await CanvaOAuth.getStoredToken(user.id);

      if (!token) {
        // Return OAuth URL for user to authenticate
        const state = Buffer.from(JSON.stringify({ 
          userId: user.id, 
          returnUrl: url 
        })).toString('base64');
        
        const authUrl = CanvaOAuth.getAuthorizationUrl(state);

        return NextResponse.json({
          success: false,
          requiresAuth: true,
          authUrl,
          message: 'Please connect your Canva account to use API import'
        });
      }

      try {
        // Use Canva API to export the design
        const client = new CanvaAPIClient(token);

        // Start export job
        const exportResponse = await client.exportDesign(designId, {
          format: CANVA_API_CONFIG.export.defaultFormat,
          quality: 'print',
        });

        // Wait for export to complete
        const exportUrls = await client.waitForExport(
          designId,
          exportResponse.job.id
        );

        if (!exportUrls || exportUrls.length === 0) {
          throw new Error('No export URLs returned');
        }

        // Download the exported file
        const downloadResponse = await fetch(exportUrls[0]);
        if (!downloadResponse.ok) {
          throw new Error('Failed to download exported file');
        }

        const buffer = await downloadResponse.arrayBuffer();
        
        // Upload to R2
        const filename = `${nanoid()}.${CANVA_API_CONFIG.export.defaultFormat}`;
        const { key: fileKey } = await uploadFile({
          file: Buffer.from(buffer),
          userId: user.id,
          filename,
          folder: 'ORIGINAL',
          contentType: `image/${CANVA_API_CONFIG.export.defaultFormat}`
        });

        // Create database record
        const { data: document, error: dbError } = await supabase
          .from('documents')
          .insert({
            user_id: user.id,
            title: `Canva Import - ${designId}`,
            file_path: fileKey,
            file_type: `image/${CANVA_API_CONFIG.export.defaultFormat}`,
            file_size: buffer.byteLength,
            status: 'uploaded',
            metadata: {
              source: 'canva',
              canvaUrl: url,
              designId,
              importMethod: 'api',
            },
          })
          .select()
          .single();

        if (dbError) {
          throw new Error(`Database error: ${dbError.message}`);
        }

        // Log successful import
        await logCanvaImportAttempt(user.id, url, designId, 'success');

        return NextResponse.json({
          success: true,
          method: 'api',
          document,
          message: 'Design imported successfully via Canva API'
        });
      } catch (apiError) {
        console.error('Canva API error:', apiError);
        
        // Log failed API attempt
        await logCanvaImportAttempt(user.id, url, designId, 'api_failed');
        
        // If API fails and fallback is enabled, return manual instructions
        if (CANVA_API_CONFIG.features.fallbackToManual) {
          return getManualInstructions(canvaInfo);
        }

        return NextResponse.json(
          { 
            error: 'Failed to export design via API',
            details: apiError instanceof Error ? apiError.message : 'Unknown error'
          },
          { status: 500 }
        );
      }
    }

    // Log manual attempt
    await logCanvaImportAttempt(user.id, url, designId, 'manual_required');

    // Return manual download instructions
    return getManualInstructions(canvaInfo);
  } catch (error) {
    console.error('Canva import error:', error);
    return NextResponse.json(
      { error: 'Failed to process Canva URL' },
      { status: 500 }
    );
  }
}

function getManualInstructions(canvaInfo: any) {
  return NextResponse.json({
    success: false,
    method: 'manual',
    alternativeAction: 'manual_upload_required',
    instructions: {
      steps: [
        'Open your design in Canva',
        'Click the "Share" button in the top right',
        'Select "Download"',
        'Choose your preferred format (PNG recommended for best quality)',
        'Click "Download" to save the file',
        'Upload the downloaded file using the standard upload interface'
      ],
      tips: [
        'For best results, use PNG format at the highest quality',
        'If your design has multiple pages, download as PDF',
        'Make sure all fonts and images are properly loaded before downloading'
      ]
    },
    designInfo: canvaInfo
  });
}

/**
 * Log Canva import attempts for analytics and history
 */
async function logCanvaImportAttempt(
  userId: string, 
  url: string, 
  designId: string,
  status: 'success' | 'api_failed' | 'manual_required' = 'manual_required'
): Promise<void> {
  const supabase = await createClient();
  
  try {
    await supabase
      .from('canva_import_logs')
      .insert({
        user_id: userId,
        url,
        design_id: designId,
        status,
        timestamp: new Date().toISOString(),
      });
  } catch (error) {
    console.error('Failed to log Canva import:', error);
  }
}

/**
 * OAuth callback endpoint
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  // This is now handled by /api/canva/callback/route.ts
  // Redirect to the proper callback URL
  const callbackUrl = new URL('/api/canva/callback', request.url);
  callbackUrl.search = searchParams.toString();
  
  return NextResponse.redirect(callbackUrl);
}