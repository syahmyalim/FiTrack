function onGoogleSignIn(response) {
  try {
    const payload = JSON.parse(atob(response.credential.split('.')[1]));
    const email = payload.email.toLowerCase();

    if (!CONFIG.ALLOWED_EMAILS.includes(email)) {
      alert('Unauthorised user.');
      return;
    }

    localStorage.setItem('fitTrack_email', email);
    if (window.App && App.boot) App.boot(email);
  } catch (err) {
    console.error(err);
  }
}

function signOut() {
  localStorage.removeItem('fitTrack_email');
  localStorage.removeItem('fitTrack_data');
  location.reload();
}
