import { Link } from 'react-router-dom';

export default function Unauthorized() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="max-w-xl rounded-[32px] bg-white p-10 text-center shadow-2xl">
        <h1 className="text-4xl font-black text-primary">Access denied</h1>
        <p className="mt-4 text-slate-500">
          Your role does not have permission to open this screen. Ask an admin to update your account access if needed.
        </p>
        <Link to="/" className="mt-8 inline-flex rounded-2xl bg-primary px-6 py-3 font-bold text-white">
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
