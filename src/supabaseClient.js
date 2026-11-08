import { createClient } from '@supabase/supabase-js';

const defaultUrl = 'https://hnjktcmhfansbyuihdyk.supabase.co';
const defaultKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhuamt0Y21oZmFuc2J5dWloZHlrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQxMzUxNjMsImV4cCI6MjEwOTcxMTE2M30.k-dXyIcbXtN3NNwJGzD94kPnaC_ZtYKXA4npyqXhZb8';

let supabaseUrl = (import.meta.env && import.meta.env.VITE_SUPABASE_URL) || defaultUrl;
// Pastikan tidak pernah menggunakan database lama (bpmvxayyddberbxxilnb)
if (!supabaseUrl || supabaseUrl.indexOf('bpmvxayyddberbxxilnb') !== -1) {
  supabaseUrl = defaultUrl;
}

let supabaseAnonKey = (import.meta.env && import.meta.env.VITE_SUPABASE_ANON_KEY) || defaultKey;
if (!supabaseAnonKey || supabaseUrl === defaultUrl) {
  supabaseAnonKey = defaultKey;
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);


