// intake.js — public intake form logic. External file on purpose: the prod CSP
// has no script-src 'unsafe-inline', so inline <script> blocks are blocked.

(function () {
  var token = new URLSearchParams(location.search).get("t") || "";
  var form = document.getElementById("form");
  var invalid = document.getElementById("invalid");
  var thanks = document.getElementById("thanks");
  var errorEl = document.getElementById("error");
  var submitBtn = document.getElementById("submit");
  var heading = document.getElementById("heading");
  var subheading = document.getElementById("subheading");

  function show(el) { el.classList.remove("hidden"); }
  function hide(el) { el.classList.add("hidden"); }

  if (!token) {
    hide(form); show(invalid);
    return;
  }

  // Validate the link + greet with the client's name.
  fetch("/api/intake?t=" + encodeURIComponent(token))
    .then(function (r) { return r.ok ? r.json() : Promise.reject(); })
    .then(function (d) {
      if (d && d.client_name) {
        heading.textContent = "New request — " + d.client_name;
        subheading.textContent = "Tell us what you need and it lands straight in " + d.client_name + "'s production pipeline.";
      }
    })
    .catch(function () { hide(form); show(invalid); });

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    hide(errorEl);
    submitBtn.disabled = true;
    submitBtn.textContent = "Sending…";

    var fd = new FormData(form);
    var payload = { t: token };
    ["submitter_name", "submitter_email", "request_type", "title", "description", "target_date", "links", "website"].forEach(function (k) {
      payload[k] = (fd.get(k) || "").toString();
    });

    fetch("/api/intake", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (res) {
        if (!res.ok) throw new Error((res.d && res.d.error) || "Something went wrong — try again.");
        hide(form); show(thanks);
      })
      .catch(function (err) {
        errorEl.textContent = err.message;
        show(errorEl);
      })
      .finally(function () {
        submitBtn.disabled = false;
        submitBtn.textContent = "Send request";
      });
  });

  document.getElementById("another").addEventListener("click", function () {
    form.reset();
    hide(thanks); show(form);
  });
})();
