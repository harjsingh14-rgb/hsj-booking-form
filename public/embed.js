/* HSJ booking form embed.
   Paste on the landing page where the form should appear:
   <div id="hsj-booking"></div>
   <script src="https://YOUR-FORM-ADDRESS/embed.js" async></script>
*/
(function () {
  var script = document.currentScript || document.querySelector('script[src*="embed.js"]');
  var origin = new URL(script.src).origin;
  var mount = document.getElementById('hsj-booking');
  if (!mount) return;
  // Pass ad click and campaign details through to the form. No personal data.
  var keep = ['fbclid', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
  var from = new URLSearchParams(location.search), to = new URLSearchParams();
  keep.forEach(function (k) { if (from.get(k)) to.set(k, from.get(k)); });
  to.set('page', location.origin + location.pathname);
  var frame = document.createElement('iframe');
  frame.src = origin + '/?' + to.toString();
  frame.title = 'Book your call';
  frame.style.cssText = 'width:100%;border:0;min-height:560px;display:block;';
  frame.setAttribute('scrolling', 'no');
  mount.appendChild(frame);
  window.addEventListener('message', function (e) {
    if (e.origin !== origin || !e.data) return;
    if (e.data.type === 'hsj-booking-height' && e.data.height) frame.style.height = Math.ceil(e.data.height) + 4 + 'px';
    if (e.data.type === 'hsj-booking-booked') {
      // Browser pixel event, de-duplicated against the server event by the shared event id.
      if (typeof window.fbq === 'function') window.fbq('track', 'Schedule', {}, { eventID: e.data.eventId });
      if (e.data.redirect && /^https:\/\//.test(e.data.redirect)) window.location.href = e.data.redirect;
    }
  });
})();
