import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function createSession() {
  const email = 'espeliers@live.com'

  const { data: { users } } = await supabase.auth.admin.listUsers()
  const user = users.find(u => u.email === email)

  if (!user) {
    console.error('User not found:', email)
    process.exit(1)
  }

  const { data, error } = await supabase.auth.admin.generateLink({
    type: 'magiclink',
    email,
    options: {
      redirectTo: 'http://localhost:3000/auth/callback',
    },
  })

  if (error) {
    console.error('Error:', error)
    process.exit(1)
  }

  console.log('\n✅ Click this link to login instantly:')
  console.log(data.properties.action_link)
  console.log('\nThis link works immediately — no email needed.')
}

createSession()
