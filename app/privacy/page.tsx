export default function PrivacyPage() {
  return (
    <main className="document">
      <h1>Privacy Policy</h1>
      <p>Last updated: June 22, 2026</p>

      <h2>Overview</h2>
      <p>
        WHOOP AI Assistant is a private personal tool that connects to a WHOOP account to help summarize recovery,
        sleep, strain, workout, and related health and fitness data.
      </p>

      <h2>Data Used</h2>
      <p>
        The app may access WHOOP profile, recovery, cycle, sleep, workout, heart rate variability, resting heart rate,
        and related activity data after the user grants permission through WHOOP OAuth.
      </p>

      <h2>How Data Is Used</h2>
      <p>
        Data is used only to provide personal summaries, trends, training readiness guidance, and AI-assisted answers
        about the connected WHOOP data.
      </p>

      <h2>Sharing</h2>
      <p>
        Data is not sold. Data is not shared with third parties except service providers needed to operate the app,
        such as hosting, database, and AI processing providers.
      </p>

      <h2>Security</h2>
      <p>
        OAuth tokens are intended to be stored server-side only. Client secrets are never placed in browser or mobile
        app code.
      </p>

      <h2>Disconnecting</h2>
      <p>
        The user may revoke access from WHOOP or by disconnecting the integration once that feature is enabled in the
        app.
      </p>

      <h2>Medical Disclaimer</h2>
      <p>
        This app does not provide medical advice, diagnosis, or treatment. It is for personal wellness reflection and
        training guidance only.
      </p>
    </main>
  );
}
