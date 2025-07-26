// File: supabase-client.js

const SUPABASE_URL = 'https://iwaouidutblkgaoohqxl.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml3YW91aWR1dGJsa2dhb29ocXhsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMwMDkzMDksImV4cCI6MjA2ODU4NTMwOX0.XJPTJVqUuCa9JURMiesDgny5-hp-yEXNd4YgqDtc2Q';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

/**
 * Handles social sign-in (Google, GitHub, LinkedIn)
 */
async function signInWithSocialProvider(provider) {
  const { data, error } = await supabaseClient.auth.signInWithOAuth({
    provider: provider,
    options: {
      redirectTo: window.location.origin + '/landingpage.html'
    }
  });

  if (error) {
    console.error('Social login error:', error.message);
    alert('Error logging in: ' + error.message);
  }
}

// Make function globally available for the onclick="" attributes.
window.signInWithSocialProvider = signInWithSocialProvider;

// The onAuthStateChange listener has been removed to prevent the redirect loop.
// All redirect logic is now correctly handled by the script on landingpage.html.