// Supabase configuration variables
const SUPABASE_URL = "https://ylqiiopkxaivtgynlldd.supabase.co";
const SUPABASE_PUBLIC_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlscWlpb3BreGFpdnRneW5sbGRkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ0NTg0MjEsImV4cCI6MjEwMDAzNDQyMX0.L0L7Wea5-fwqniLgAKx8G2aq3l7VllD33NrV2CffZHE";

// Initialize the global client using the v2 constructor pattern
var supabase;
if (typeof window.supabase !== 'undefined' && typeof window.supabase.createClient === 'function') {
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLIC_ANON_KEY);
    window.supabase = supabase;
} else {
    console.error("Supabase CDN script not loaded.");
}