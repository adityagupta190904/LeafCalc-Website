// /supabase-client.js
// ------------------------------------------------------------------
// 1.  INITIALISE SUPABASE
// ------------------------------------------------------------------
const SUPABASE_URL  = 'https://iwaouidutblkgaoohqxl.supabase.co';
const SUPABASE_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml3YW91aWR1dGJsa2dhb29ocXhsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMwMDkzMDksImV4cCI6MjA2ODU4NTMwOX0.XJPTJVqUuCa9JURMiesDgny5-hp-yEXNd4YgqDtc2Q';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

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
  // give the cookie a moment to settle
  if (event === 'INITIAL_SESSION') {
    const { data: { session: fresh } } = await supabaseClient.auth.getSession();
    if (!fresh) return;  // really no session

    const pathname = window.location.pathname;

    // first-time user?
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('id')
      .eq('id', fresh.user.id)
      .single();

    if (!profile && !pathname.endsWith('/Login/signup_form.html')) {
      window.location.replace('/Login/signup_form.html');
    } else if (profile && pathname.endsWith('/Login/Signin.html')) {
      window.location.replace('/landingpage.html');
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