import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://bxvzygsapszhizjekrtw.supabase.co'
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ4dnp5Z3NhcHN6aGl6amVrcnR3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxODczODksImV4cCI6MjA4OTc2MzM4OX0.sUl84joN_RBeHNbVI-upyKqt38p6Meaqn6xcDiCcxoY'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON)

export type Profile = {
  id: string
  email: string
  role: 'user' | 'admin'
  gemini_key: string
  created_at: string
}

export type Recording = {
  id: string
  user_id: string
  name: string
  notes: Array<{note:number;time:number;type:'on'|'off'}>
  duration_ms: number
  created_at: string
}

export type AISong = {
  id: string
  user_id: string
  name: string
  song_data: object
  created_at: string
}
