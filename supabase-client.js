// File: supabase-client.js
// --- COPY AND PASTE THIS ENTIRE CORRECTED CODE ---

const SUPABASE_URL = 'https://iwaouidutblkgaoohqxl.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml3YW91aWR1dGJsa2dhb29ocXhsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMwMDkzMDksImV4cCI6MjA2ODU4NTMwOX0.XJPT3JVqUuCa9JURMiesDgny5-hp-yEXNd4YgqDtc2Q';

// The fix is here: we create 'supabaseClient' from the global 'supabase' object.
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// === START: DEVELOPMENT MOCK USER BLOCK ===
// This block simulates a logged-in user so you don't have to sign in every time.
// To disable this and go back to real authentication, just comment out this whole block.

  const MOCK_USER_ID = '840ee35f-03b4-4591-8e66-4129e8ae5ac3'; // <-- IMPORTANT: PASTE YOUR ID

if (MOCK_USER_ID && !MOCK_USER_ID.includes('PASTE')) {
    console.warn('%c MOCK USER MODE IS ON ', 'background: #53d22c; color: #fff; font-weight: bold; padding: 4px;');

    const mockUser = {
        id: MOCK_USER_ID,
        email: 'dev-user@example.com',
        user_metadata: {
            // Add any other metadata you need for testing
            full_name: 'Dev Test User',
            avatar_url: null 
        }
    };
    
    // This is the magic part: We override the real function with our fake one.
    supabaseClient.auth.getUser = async () => {
        return { data: { user: mockUser }, error: null };
    };
}   
// === END: DEVELOPMENT MOCK USER BLOCK ===

/**
 * Handles signing in with a social provider (e.g., 'google', 'github').
 * @param {'google' | 'linkedin' | 'github'} provider The social provider to sign in with.
 */
async function signInWithSocialProvider(provider) {
  // We don't need to do anything with the 'data' object here,
  // as Supabase handles the redirect automatically.
  const { error } = await supabaseClient.auth.signInWithOAuth({
    provider: provider,
  });

  if (error) {
    console.error('Error signing in with ' + provider + ':', error.message);
    alert('Error signing in: ' + error.message);
  }
  // If successful, Supabase automatically redirects the user to the provider's
  // authentication page. After authentication, the user is redirected back to your app.
}

// === THIS IS THE KEY CHANGE ===
// Make the function globally accessible by attaching it to the `window` object.
// This allows the `onclick` attribute in your HTML to find and call this function.
window.signInWithSocialProvider = signInWithSocialProvider;

// Handle auth state changes
supabaseClient.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_IN') {
    // Check if it's the first sign-in
    if (session.user.created_at === session.user.last_sign_in_at) {
        window.location.href = 'signup_form.html';
    } else {
        window.location.href = 'landingpage.html';
    }
  } else if (event === 'SIGNED_OUT') {
    window.location.href = 'Signin.html';
  }
});
