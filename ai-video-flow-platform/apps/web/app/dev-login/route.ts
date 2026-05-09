import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient as createAdminClient } from '@supabase/supabase-js'

export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV !== 'development') {
    return new NextResponse('Not found', { status: 404 })
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // 1. Generate a magic link token for the owner email
  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: 'espeliers@live.com',
  })

  if (linkError || !linkData?.properties?.hashed_token) {
    return new NextResponse(
      `<pre style="color:red;padding:24px">generateLink error:\n${linkError?.message ?? 'no hashed_token'}</pre>`,
      { status: 500, headers: { 'Content-Type': 'text/html' } }
    )
  }

  // 2. Build the redirect response first so we can attach cookies to it
  const redirectTo = new URL('/dashboard', request.url)
  const response = NextResponse.redirect(redirectTo)

  // 3. Create SSR client that writes session cookies directly onto our redirect response
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  // 4. Verify the OTP server-side — this calls setAll with the session tokens
  const { error: verifyError } = await supabase.auth.verifyOtp({
    type: 'magiclink',
    token_hash: linkData.properties.hashed_token,
  })

  if (verifyError) {
    return new NextResponse(
      `<pre style="color:red;padding:24px">verifyOtp error:\n${verifyError.message}</pre>`,
      { status: 500, headers: { 'Content-Type': 'text/html' } }
    )
  }

  // 5. Return the redirect with session cookies already set
  //    Browser goes straight to /dashboard, middleware sees the cookies, access granted
  return response
}
