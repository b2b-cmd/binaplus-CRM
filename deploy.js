import SftpClient from 'ssh2-sftp-client'
import path from 'path'
import 'dotenv/config'

// Deploys dist/ to the Bina server over SFTP + writes a SPA .htaccess.
// Adapted from vitrue-training/deploy.js.
const REMOTE_DIR = process.env.SFTP_REMOTE_DIR || '/home/bina-plus/htdocs/ai.bina-plus.co.il'

const sftp = new SftpClient()

async function deploy() {
  console.log('Connecting to SFTP…')
  await sftp.connect({
    host: process.env.SFTP_HOST || '46.225.19.194',
    port: parseInt(process.env.SFTP_PORT || '22'),
    username: process.env.SFTP_USER || 'bina-plus',
    password: process.env.SFTP_PASS,
  })

  try { await sftp.stat(REMOTE_DIR) } catch { await sftp.mkdir(REMOTE_DIR, true) }

  console.log('Uploading dist/ →', REMOTE_DIR)
  await sftp.uploadDir(path.resolve('./dist'), REMOTE_DIR)

  const htaccess = `RewriteEngine On
RewriteBase /app/
RewriteRule ^index\\.html$ - [L]
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule . /app/index.html [L]

Header set X-Content-Type-Options "nosniff"
Header set X-Frame-Options "SAMEORIGIN"
`
  await sftp.put(Buffer.from(htaccess), REMOTE_DIR + '/.htaccess')
  console.log('Deploy complete.')
  await sftp.end()
}

deploy().catch(err => { console.error('Deploy failed:', err.message); sftp.end(); process.exit(1) })
