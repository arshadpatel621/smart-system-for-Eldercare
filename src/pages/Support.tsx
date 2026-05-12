export default function Support() {
  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header>
        <h1 className="text-4xl font-bold text-primary">Support</h1>
        <p className="text-slate-500">Help for login, elder assignment, Firebase setup, and emergency workflow testing.</p>
      </header>

      <section className="grid gap-6 md:grid-cols-2">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-2xl font-bold text-primary">If login fails</h2>
          <div className="mt-4 space-y-3 text-sm text-slate-600">
            <div className="rounded-2xl bg-slate-50 p-4">Enable Email/Password in Firebase Authentication.</div>
            <div className="rounded-2xl bg-slate-50 p-4">Enable Google sign-in and add `localhost` in authorized domains.</div>
            <div className="rounded-2xl bg-slate-50 p-4">Make sure the signed-in user has a `users/{'{uid}'}` profile document.</div>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-2xl font-bold text-primary">If data screens fail</h2>
          <div className="mt-4 space-y-3 text-sm text-slate-600">
            <div className="rounded-2xl bg-slate-50 p-4">Create Firestore Database and deploy `firestore.rules`.</div>
            <div className="rounded-2xl bg-slate-50 p-4">The account role and `elderId` must match the elder record being loaded.</div>
            <div className="rounded-2xl bg-slate-50 p-4">Use the retry banner if Firestore temporarily fails.</div>
          </div>
        </div>
      </section>
    </div>
  );
}
