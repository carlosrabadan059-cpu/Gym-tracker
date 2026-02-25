import { createClient } from '@supabase/supabase-js';

// WARNING: In a real production app, these should be in environment variables (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY).
// For this demo/prototype, we are hardcoding them as requested to "not change much".
const supabaseUrl = 'https://jqpyqqlkgisykgywilrf.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpxcHlxcWxrZ2lzeWtneXdpbHJmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyNjcyNjMsImV4cCI6MjA4Njg0MzI2M30.HGvZZHYwAj1whHcUDIMu0fwdI9Xzngvl_VXaDs2S0ZU';

export const supabase = createClient(supabaseUrl, supabaseKey);
