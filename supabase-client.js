// File: supabase-client.js

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const SUPABASE_URL = 'https://iwaouidutblkgaoohqxl.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml3YW91aWR1dGJsa2dhb29ocXhsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMwMDkzMDksImV4cCI6MjA2ODU4NTMwOX0.XJPTJVqUuCa9JURMiesDgny5-hp-yEXNd4YgqDtc2Q';

// Create a single Supabase client for interacting with your database
export const supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY);

/**
 * Social login handler
 * @param {'google' | 'github' | 'linkedin'} provider - The OAuth provider.
 */
export async function signInWithSocialProvider(provider) {
  const { error } = await supabaseClient.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: `${window.location.origin}/landingpage.html`,
    },
  });

  if (error) {
    console.error('Social login error:', error.message);
    alert('Error logging in: ' + error.message);
  }
}

// Make the function globally available for onclick="" attributes.
window.signInWithSocialProvider = signInWithSocialProvider;