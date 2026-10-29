# Dinner Planner 🍽️
Static site (index.html, style.css, app.js) + one serverless function (api/menu.js).

## Try locally (no setup)
Open index.html in a browser. Menu edits are saved on your device only (local mode).

## Deploy on Vercel
1. Push this folder to a GitHub repo (or run `npx vercel` inside it).
2. In Vercel: Add New → Project → import the repo → Deploy.
3. Project → Storage (or Marketplace) → Upstash Redis → create free DB → Connect to this project.
4. Project → Settings → Environment Variables → add ADMIN_PASSWORD = your secret password.
5. Deployments → Redeploy. Open the site → ⚙ Admin → enter your password.
.
