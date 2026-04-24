import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { v2 as cloudinary } from 'cloudinary'

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await request.formData()
  const file = formData.get('file') as File | null
  const projectId = formData.get('project_id') as string | null

  if (!file || !projectId) {
    return NextResponse.json({ error: 'file and project_id are required' }, { status: 400 })
  }

  const { data: project } = await supabase
    .from('projects')
    .select('id, cloudinary_folder')
    .eq('id', projectId)
    .eq('user_id', user.id)
    .single()

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 403 })
  }

  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)
  const folder = `${project.cloudinary_folder}products`

  const result = await new Promise<{ secure_url: string; public_id: string }>((resolve, reject) => {
    cloudinary.uploader.upload_stream(
      { folder, resource_type: 'image' },
      (error, result) => {
        if (error || !result) return reject(error)
        resolve({ secure_url: result.secure_url, public_id: result.public_id })
      }
    ).end(buffer)
  })

  await supabase.from('product_images').insert({
    project_id: projectId,
    user_id: user.id,
    url: result.secure_url,
    public_id: result.public_id,
  })

  return NextResponse.json({ url: result.secure_url, public_id: result.public_id })
}
