import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  Layers,
  ChevronDown,
  LogOut,
  UserCheck,
  Building2,
  Shield,
  RotateCcw,
} from 'lucide-react';
import { UserRole } from '../types';

export const TopBar: React.FC = () => {
  const { session, activeTenant, setSessionRole, signOut, resetDemoData, navigateTo } = useApp();
  const [menuOpen, setMenuOpen] = useState(false);

  const isPlatformAdmin = session.role === 'platform_admin';

  return (
    <header
      id="app-topbar"
      className="h-16 bg-[#0F172A] border-b border-slate-800 px-4 sm:px-6 flex items-center justify-between text-slate-100 shrink-0 z-30 select-none"
    >
      {/* Left: Brand Logo & Home Link */}
      <div className="flex items-center gap-6">
        <button
          type="button"
          onClick={() => navigateTo(isPlatformAdmin ? '/platform-admin' : '/tenant')}
          className="flex items-center gap-2.5 text-white hover:opacity-90 transition-opacity focus:outline-none"
          title="SocialEngage Admin Console"
        >
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-sm font-bold text-base tracking-tight">
            <Layers className="w-5 h-5" />
          </div>
          <div className="flex flex-col text-left">
            <span className="font-bold text-base tracking-tight leading-none text-white">
              Social<span className="text-blue-400">Engage</span>
            </span>
            <span className="text-[10px] text-slate-400 font-mono uppercase tracking-wider leading-none mt-0.5">
              Listening Platform
            </span>
          </div>
        </button>

        {/* Center: Current Tenant Context (Tenant roles only) */}
        {!isPlatformAdmin && activeTenant && (
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-md bg-slate-800/80 border border-slate-700/60 text-xs">
            <Building2 className="w-3.5 h-3.5 text-blue-400" />
            <span className="font-semibold text-slate-200">{activeTenant.name}</span>
            <span className="text-slate-500 font-mono text-[11px]">({activeTenant.domain})</span>
            <span className="ml-1 text-[10px] px-1.5 py-0.2 bg-slate-700 text-slate-300 rounded font-medium">
              {activeTenant.activeSeats}/{activeTenant.licenseSeats} seats
            </span>
          </div>
        )}
      </div>

      {/* Right: Persona Switcher, User Badge, Sign-out */}
      <div className="flex items-center gap-3">
        {/* Reset Demo Data Pill */}
        <button
          type="button"
          onClick={resetDemoData}
          className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition-colors"
          title="Reset simulation data to defaults"
        >
          <RotateCcw className="w-3 h-3" />
          <span>Reset Demo</span>
        </button>

        {/* Persona quick switch dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex items-center gap-2.5 p-1.5 sm:px-3 sm:py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700/80 border border-slate-700 text-left transition-all"
            aria-expanded={menuOpen}
            aria-haspopup="true"
          >
            {session.avatarUrl ? (
              <img
                src={session.avatarUrl}
                alt={session.name}
                className="w-7 h-7 rounded-full object-cover ring-1 ring-slate-600"
              />
            ) : (
              <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-xs font-semibold text-white">
                {session.name.charAt(0)}
              </div>
            )}
            <div className="hidden sm:flex flex-col text-xs leading-tight">
              <span className="font-medium text-slate-100">{session.name}</span>
              <span className="text-[10px] text-blue-400 capitalize flex items-center gap-1">
                {session.role === 'platform_admin' ? (
                  <>
                    <Shield className="w-2.5 h-2.5" /> Platform Admin
                  </>
                ) : session.role === 'tenant_admin' ? (
                  <>
                    <UserCheck className="w-2.5 h-2.5" /> Tenant Admin
                  </>
                ) : (
                  'Tenant User'
                )}
              </span>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 ml-1" />
          </button>

          {/* Persona / Role Switcher Popover */}
          {menuOpen && (
            <div
              className="absolute right-0 mt-2 w-64 bg-[#1E293B] border border-slate-700 rounded-lg shadow-xl py-2 z-50 animate-in fade-in zoom-in-95 duration-100"
              onMouseLeave={() => setMenuOpen(false)}
            >
              <div className="px-3 py-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-700/70">
                Switch Test Persona
              </div>

              <button
                type="button"
                onClick={() => {
                  setSessionRole('tenant_admin');
                  setMenuOpen(false);
                }}
                className={`w-full text-left px-3 py-2 text-xs flex items-center gap-2.5 transition-colors ${
                  session.role === 'tenant_admin'
                    ? 'bg-blue-600/20 text-blue-300 font-semibold border-l-2 border-blue-500'
                    : 'text-slate-300 hover:bg-slate-700/60'
                }`}
              >
                <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold">
                  SC
                </div>
                <div>
                  <div className="text-slate-200">Sarah Chen (Tenant Admin)</div>
                  <div className="text-[10px] text-slate-400">Acme Global Operations</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setSessionRole('tenant_user');
                  setMenuOpen(false);
                }}
                className={`w-full text-left px-3 py-2 text-xs flex items-center gap-2.5 transition-colors ${
                  session.role === 'tenant_user'
                    ? 'bg-blue-600/20 text-blue-300 font-semibold border-l-2 border-blue-500'
                    : 'text-slate-300 hover:bg-slate-700/60'
                }`}
              >
                <div className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px] font-bold">
                  MV
                </div>
                <div>
                  <div className="text-slate-200">Marcus Vance (Tenant User)</div>
                  <div className="text-[10px] text-slate-400">Acme Global Operations</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setSessionRole('platform_admin');
                  setMenuOpen(false);
                }}
                className={`w-full text-left px-3 py-2 text-xs flex items-center gap-2.5 transition-colors ${
                  session.role === 'platform_admin'
                    ? 'bg-blue-600/20 text-blue-300 font-semibold border-l-2 border-blue-500'
                    : 'text-slate-300 hover:bg-slate-700/60'
                }`}
              >
                <div className="w-6 h-6 rounded-full bg-rose-600 text-white flex items-center justify-center text-[10px] font-bold">
                  AR
                </div>
                <div>
                  <div className="text-slate-200">Alex Rivera (Platform Admin)</div>
                  <div className="text-[10px] text-rose-400">Platform-Wide Registry & Audit</div>
                </div>
              </button>

              <div className="my-1 border-t border-slate-700/70" />

              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  signOut();
                }}
                className="w-full text-left px-3 py-2 text-xs text-rose-400 hover:bg-slate-700/60 flex items-center gap-2 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
