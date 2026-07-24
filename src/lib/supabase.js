import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
    'https://oohalynqrikeqccnvroa.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9vaGFseW5xcmlrZXFjY252cm9hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxNTMwMDksImV4cCI6MjA5MDcyOTAwOX0.oLZ-vdk1ljtTpT34AwDSuvV56bk79uF26kvuRp5OoaM'
);