/**
 * VAPID key generator for web push notifications.
 *
 * Run once per environment to produce a public/private key pair.
 *
 * Usage:
 *   npx tsx scripts/generate-vapid-keys.ts
 *
 * Output: paste the printed values into `.env.local` (see README of this script
 * for the exact variable names).
 */
import webpush from 'web-push'

const keys = webpush.generateVAPIDKeys()

console.log('VAPID Keys generated successfully.')
console.log('')
console.log('Add the following to your .env.local file:')
console.log('')
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${keys.publicKey}`)
console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}`)
console.log(`VAPID_SUBJECT=mailto:admin@example.com`)
console.log('')
console.log('Reminder:')
console.log('  - Keep VAPID_PRIVATE_KEY secret. Do not commit it.')
console.log('  - Update VAPID_SUBJECT to a real contact email/URL for your org.')
console.log('  - Use the same key pair across deploys; regenerating invalidates')
console.log('    all existing push subscriptions.')
