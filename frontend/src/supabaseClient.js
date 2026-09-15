import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://nmkmzbrhdwqwhciufobu.supabase.co'

const supabaseAnonKey =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ta216YnJoZHdxd2hjaXVmb2J1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYxNzIyNTAsImV4cCI6MjEwMTc0ODI1MH0.oSqVRYdAWfiUpUkk_Pz4btCfter0wvTbLFmy7lCUFGM'

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey
)