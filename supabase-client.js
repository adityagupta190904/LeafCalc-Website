// File: supabase-client.js

const SUPABASE_URL = 'https://iwaouidutblkgaoohqxl.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml3YW91aWR1dGJsa2dhb29ocXhsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMwMDkzMDksImV4cCI6MjA2ODU4NTMwOX0.XJPT3JVqUuCa9JURMiesDgny5-hp-yEXNd4YgqDtc2Q';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

/**
 * Handles social sign-in (Google, GitHub, LinkedIn)
 */
async function signInWithSocialProvider(provider) {
  const { data, error } = await supabaseClient.auth.signInWithOAuth({
    provider: provider,
    options: {
      // This is correct. It sends the user to the landing page after
      // they sign in with a social provider. The landing page script
      // will then handle the rest.
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

//
// --- THE FIX IS HERE ---
// We have REMOVED the entire supabaseClient.auth.onAuthStateChange(...) listener.
// It was causing the redirect loop and is no longer needed.
// The script on landingpage.html now handles all user checks.
//