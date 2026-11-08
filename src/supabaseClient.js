import { createClient } from '@supabase/supabase-js';

const defaultUrl = 'https://bpmvxayyddberbxxilnb.supabase.co';
const defaultKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJwbXZ4YXl5ZGRiZXJieHhpbG5iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIxODkwMzYsImV4cCI6MjEwNzc2NTAzNn0.RoEaKzoAvA7dOxqXH8ITiN9zevFYljFW0WUKRGvcfbU';

const supabaseUrl = (import.meta.env && import.meta.env.VITE_SUPABASE_URL) || defaultUrl;
const supabaseAnonKey = (import.meta.env && import.meta.env.VITE_SUPABASE_ANON_KEY) || defaultKey;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);


