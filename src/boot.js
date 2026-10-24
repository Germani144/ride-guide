// Shows the version on the loading screen and in the header. A separate file (not inline in
// index.html) so the Content-Security-Policy can allow scripts from this site only.
for (const id of ['splash-version', 'brand-version'])
  document.getElementById(id).textContent = 'v' + self.RIDEGUIDE_VERSION;
