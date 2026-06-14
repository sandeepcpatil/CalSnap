# CalSnap — Project Context for Claude

## Stack
- Mobile: React Native (Expo SDK 51), TypeScript, Zustand, React Native Paper
- Backend: Node.js + Express, port 4000
- Database: Supabase (PostgreSQL) — URL in backend/.env
- AI: OpenAI GPT-4o Vision
- Payments: Razorpay (INR — ₹150/month, ₹1200/year)
- Admin: Vite + React + Tailwind

## Key Rules
- ALWAYS check scan_count server-side in /api/analyze-food — never trust client
- ALWAYS verify Razorpay webhook signatures before updating subscription status
- Use Supabase service role key (backend only) for admin operations — never expose it to mobile
- Use RLS on all tables — users can only access their own rows
- Images: compress to max 1024px before uploading (expo-image-manipulator)
- State management: Zustand only — no Redux, no Context for global state

## Folder Structure
calsnap/
├── mobile/     # Expo app
├── backend/    # Express API
└── admin/      # Vite admin panel

## Current Phase
→ See TASKS.md for current progress

## Run Commands
- Backend: cd backend && npm run dev (port 4000)
- Mobile: cd mobile && npx expo start
- Admin: cd admin && npm run dev (port 5173)