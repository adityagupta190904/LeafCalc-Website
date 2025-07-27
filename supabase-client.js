// /supabase-client.js
// ------------------------------------------------------------------
// 1.  INITIALISE SUPABASE
// ------------------------------------------------------------------
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL  = 'https://iwaouidutblkgaoohqxl.supabase.co';
const SUPABASE_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml3YW91aWR1dGJsa2dhb29ocXhsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMwMDkzMDksImV4cCI6MjA2ODU4NTMwOX0.XJPTJVqUuCa9JURMiesDgny5-hp-yEXNd4YgqDtc2Q';

export const supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY);

// ------------------------------------------------------------------
// 2.  SOCIAL-LOGIN HANDLER  (used by onclick="signInWithSocialProvider('google')")
// ------------------------------------------------------------------
export async function signInWithSocialProvider(provider) {
  const { error } = await supabaseClient.auth.signInWithOAuth({
    provider,
    options: { redirectTo: `${window.location.origin}/landingpage.html` }
  });
  if (error) {
    console.error('Social login error:', error.message);
    alert('Error logging in: ' + error.message);
  }
}

// Make it globally available for HTML onclick attributes
window.signInWithSocialProvider = signInWithSocialProvider;

// ------------------------------------------------------------------
// 3.  AUTH-STATE OBSERVER  (runs on every page that imports this file)
// ------------------------------------------------------------------
supabaseClient.auth.onAuthStateChange(async (event, session) => {
  const pathname = window.location.pathname;

  // --- CASE 1:  Not logged-in but trying to reach protected pages
  const protectedPaths = [
    '/landingpage.html',
    '/Login/signup_form.html',
    '/Login/user_profile.html'
  ];
  const isProtected = protectedPaths.some(p => pathname.endsWith(p));
  if (isProtected && !session) {
    window.location.replace('/Login/Signin.html');
    return;
  }

  // --- CASE 2:  Landing page (check profile completeness)
  if (pathname.endsWith('/landingpage.html')) {
    if (!session?.user) return; // handled above

    const { data: profile, error } = await supabaseClient
      .from('profiles')
      .select('full_name, company, designation')
      .eq('id', session.user.id)
      .single();

    // If profile row is missing or incomplete, redirect to finish it
    const missingProfile =
      error || !profile?.full_name?.trim() || !profile?.company?.trim() || !profile?.designation?.trim();
    if (missingProfile) {
      window.location.replace('/Login/signup_form.html');
    }
  }
});

// ------------------------------------------------------------------
// 4.  AVATAR-UPLOAD HELPER  (used by user_profile.html)
// ------------------------------------------------------------------
export async function uploadAvatar(file) {
  if (!file) return null;

  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const fileName = `${user.id}/${Date.now()}.${file.name.split('.').pop()}`;
  const { error: upErr } = await supabaseClient.storage
    .from('avatars')
    .upload(fileName, file, { upsert: true });

  if (upErr) throw upErr;

  const { data: { publicUrl } } = supabaseClient.storage
    .from('avatars')
    .getPublicUrl(fileName);

  await supabaseClient.auth.updateUser({ data: { avatar_url: publicUrl } });
  return publicUrl;
}

// ------------------------------------------------------------------
// 5.  SIGN-OUT HELPER  (used by user_profile.html)
// ------------------------------------------------------------------
export async function signOut() {
  await supabaseClient.auth.signOut();
  window.location.replace('/Login/Signin.html');
}