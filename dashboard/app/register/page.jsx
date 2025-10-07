'use client';
import { useState } from 'react';
import { useAuth } from '@/src/context/AuthContext';
import Link from 'next/link';

export default function RegisterPage() {
  const { register } = useAuth();
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      await register(email, password, phone || undefined);
    } catch (e) {
      setErr(e.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container min-h-screen grid place-items-center">
      <div className="card w-full max-w-4xl overflow-hidden grid md:grid-cols-2">
        <form onSubmit={submit} className="p-8 space-y-6">
          <div className="text-center">
            <h1 className="text-2xl font-bold">Create your account</h1>
            <p className="text-neutral-500">Join in a minute</p>
          </div>
          {err && <div className="text-sm text-red-600 bg-red-50 border border-red-200 p-2 rounded">{err}</div>}
          <div>
            <label className="block text-sm mb-1" htmlFor="email">Email</label>
            <input id="email" type="email" className="input" placeholder="m@example.com" required value={email} onChange={(e)=>setEmail(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm mb-1" htmlFor="phone">Phone (optional)</label>
            <input id="phone" type="tel" className="input" placeholder="01xxxxxxxxx" value={phone} onChange={(e)=>setPhone(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm mb-1" htmlFor="password">Password</label>
            <input id="password" type="password" className="input" required value={password} onChange={(e)=>setPassword(e.target.value)} />
          </div>
          <button disabled={loading} className="btn w-full">{loading ? 'Creating…' : 'Create account'}</button>
          <div className="text-center text-sm">
            Already have an account? <Link className="underline" href="/login">Login</Link>
          </div>
        </form>
        <div className="hidden md:block bg-[url('/login.png')] bg-cover bg-center min-h-[320px]" />
      </div>
    </div>
  );
}