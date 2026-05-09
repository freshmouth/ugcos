import { writeFileSync } from 'fs'

async function main() {
  const res = await fetch('https://app.metricool.com/api/swagger.yaml', {
    headers: { 'X-Mc-Auth': process.env.METRICOOL_API_KEY! }
  })
  const yaml = await res.text()
  writeFileSync('scripts/metricool-swagger.yaml', yaml)
  console.log('Status:', res.status)
  console.log('Saved. First 3000 chars:', yaml.slice(0, 3000))
}

main().catch(console.error)
