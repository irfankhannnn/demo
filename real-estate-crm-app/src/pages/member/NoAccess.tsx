import { ShieldX, LogOut } from 'lucide-react';
import { clearAuthSilently } from '../../utils/authStorage';
import { redirectToLogout } from '../../utils/cognitoAuth';

export default function NoAccess() {

  function handleLogout() {
    clearAuthSilently();
    redirectToLogout();
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-10 border border-slate-100 text-center">
        {/* Icon */}
        <div className="bg-amber-100 w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <ShieldX className="w-10 h-10 text-amber-600" />
        </div>

        {/* Content */}
        <h1 className="text-3xl font-bold text-slate-900 mb-3">No Access</h1>
        <p className="text-slate-600 mb-2">
          You don't have any pending invitations.
        </p>
        <p className="text-slate-500 text-sm mb-8">
          Please ask your agency administrator to send you an invitation. Once they do, log in again and you'll be able to join.
        </p>

        {/* Actions */}
        <button
          onClick={handleLogout}
          className="w-full bg-gradient-to-r from-slate-700 to-slate-800 text-white py-3.5 rounded-xl font-semibold hover:from-slate-800 hover:to-slate-900 transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
        >
          <LogOut className="w-5 h-5" />
          Sign Out
        </button>
      </div>
    </div>
  );
}
