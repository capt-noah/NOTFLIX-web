import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { useLanguage } from '../hooks/useLanguage';
import { SupabaseDB } from '../services/db';

export const AuthModal = () => {
    const { authModalOpen, setAuthModalOpen, addNotification, openProfileGate } = useApp();
    const { t } = useLanguage();
    const [isLogin, setIsLogin] = useState(true);
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    if (!authModalOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        const cleanUsername = username.trim();
        const cleanEmail = email.trim();

        if (!cleanUsername) {
            setError(isLogin ? "Please enter your username or email." : "Please choose a username.");
            setLoading(false);
            return;
        }

        if (!isLogin && !cleanEmail) {
            setError("Please enter a valid email address.");
            setLoading(false);
            return;
        }

        if (!password || password.length < 6) {
            setError("Password must be at least 6 characters.");
            setLoading(false);
            return;
        }

        try {
            if (isLogin) {
                const res = await SupabaseDB.signIn(cleanUsername, password);
                addNotification("Welcome Back", `Signed in successfully.`, "verified_user");
                setAuthModalOpen(false);
                const loggedInUser = res?.user;
                if (loggedInUser) {
                    const profileSelectedKey = `notflix_profile_selected_${loggedInUser.id}`;
                    if (!localStorage.getItem(profileSelectedKey)) {
                        openProfileGate?.('select');
                    }
                }
            } else {
                await SupabaseDB.signUp(cleanUsername, cleanEmail, password);
                addNotification("Account Created", `Welcome to NotFlix, ${cleanUsername}!`, "person_add");
                setAuthModalOpen(false);
                openProfileGate?.('select');
            }
        } catch (err) {
            console.error("Auth error:", err);
            const msg = err.message || "Authentication failed. Please check your credentials.";
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    const resetModalState = () => {
        setAuthModalOpen(false);
        setError(null);
        setUsername('');
        setEmail('');
        setPassword('');
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <div className="glass-panel w-full max-w-md p-8 rounded-2xl relative shadow-2xl border border-white/20 animate-fade-in-up">
                
                {/* Close Button */}
                <button 
                    onClick={resetModalState}
                    className="absolute top-4 right-4 text-white/50 hover:text-white transition-colors"
                >
                    <span className="material-symbols-outlined">close</span>
                </button>

                {/* Header */}
                <div className="text-center mb-6">
                    <h2 className="text-3xl font-black text-white mb-2 font-display">
                        {isLogin ? (t.auth?.signIn || "Sign In") : (t.auth?.joinNotflix || "Create Account")}
                    </h2>
                    <p className="text-white/60 text-xs">
                        {isLogin 
                            ? "Sign in with your username or email to sync your watchlist." 
                            : "Create your NotFlix account. Instant access without email verification!"}
                    </p>
                </div>

                {/* Mode Tabs */}
                <div className="flex p-1 bg-white/5 rounded-full border border-white/10 mb-6">
                    <button
                        type="button"
                        onClick={() => { setIsLogin(true); setError(null); }}
                        className={`flex-1 py-2 text-xs font-bold rounded-full transition-all ${isLogin ? 'bg-primary-container text-white shadow-lg shadow-primary-container/30' : 'text-white/60 hover:text-white'}`}
                    >
                        {t.auth?.signIn || "Sign In"}
                    </button>
                    <button
                        type="button"
                        onClick={() => { setIsLogin(false); setError(null); }}
                        className={`flex-1 py-2 text-xs font-bold rounded-full transition-all ${!isLogin ? 'bg-primary-container text-white shadow-lg shadow-primary-container/30' : 'text-white/60 hover:text-white'}`}
                    >
                        {t.auth?.createAccount || "Create Account"}
                    </button>
                </div>

                {/* Error Banner */}
                {error && (
                    <div className="mb-5 p-3.5 bg-red-500/20 border border-red-500/50 rounded-lg flex items-center gap-2.5 text-red-200 text-xs animate-fade-in">
                        <span className="material-symbols-outlined shrink-0 text-sm">error</span>
                        <p>{error}</p>
                    </div>
                )}

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Username or Login Identifier Field */}
                    <div className="space-y-1.5">
                        <div className="flex justify-between items-center">
                            <label className="text-xs font-bold text-white/80 uppercase tracking-wider">
                                {isLogin ? "Username or Email" : "Username"}
                            </label>
                            <span className="text-[10px] text-primary-container font-medium">Instant Access</span>
                        </div>
                        <div className="relative flex items-center">
                            <span className="material-symbols-outlined absolute left-3.5 text-white/40 text-lg pointer-events-none">
                                person
                            </span>
                            <input 
                                type="text" 
                                required
                                autoFocus
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="w-full bg-black/40 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white text-sm focus:outline-none focus:border-primary-container focus:ring-1 focus:ring-primary-container transition-all"
                                placeholder={isLogin ? "Enter username or email" : "Choose your username"}
                            />
                        </div>
                    </div>

                    {/* Email Field (Only for Sign Up) */}
                    {!isLogin && (
                        <div className="space-y-1.5 animate-fade-in">
                            <label className="text-xs font-bold text-white/80 uppercase tracking-wider">
                                Email Address
                            </label>
                            <div className="relative flex items-center">
                                <span className="material-symbols-outlined absolute left-3.5 text-white/40 text-lg pointer-events-none">
                                    mail
                                </span>
                                <input 
                                    type="email" 
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full bg-black/40 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white text-sm focus:outline-none focus:border-primary-container focus:ring-1 focus:ring-primary-container transition-all"
                                    placeholder="Enter your email (e.g. you@example.com)"
                                />
                            </div>
                        </div>
                    )}

                    {/* Password Field */}
                    <div className="space-y-1.5">
                        <div className="flex justify-between items-center">
                            <label className="text-xs font-bold text-white/80 uppercase tracking-wider">
                                {t.auth?.password || "Password"}
                            </label>
                            {!isLogin && <span className="text-[10px] text-white/40">Min. 6 chars</span>}
                        </div>
                        <div className="relative flex items-center">
                            <span className="material-symbols-outlined absolute left-3.5 text-white/40 text-lg pointer-events-none">
                                lock
                            </span>
                            <input 
                                type={showPassword ? "text" : "password"} 
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full bg-black/40 border border-white/10 rounded-xl pl-10 pr-11 py-3 text-white text-sm focus:outline-none focus:border-primary-container focus:ring-1 focus:ring-primary-container transition-all"
                                placeholder="Enter your password"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3.5 text-white/40 hover:text-white transition-colors"
                            >
                                <span className="material-symbols-outlined text-lg">
                                    {showPassword ? "visibility_off" : "visibility"}
                                </span>
                            </button>
                        </div>
                    </div>

                    {/* Submit CTA */}
                    <button 
                        type="submit" 
                        disabled={loading || !username.trim() || (!isLogin && !email.trim()) || !password}
                        className="w-full btn-primary py-3.5 rounded-xl font-black text-sm tracking-wide shadow-lg shadow-primary-container/30 transition-all hover:-translate-y-0.5 active:scale-95 disabled:opacity-50 disabled:pointer-events-none flex justify-center items-center gap-2 mt-2"
                    >
                        {loading && <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></span>}
                        {isLogin ? (t.auth?.signIn || "Sign In to NotFlix") : "Create Account & Start Watching"}
                    </button>
                </form>

                {/* Footer Switcher */}
                <div className="mt-6 text-center border-t border-white/10 pt-4">
                    <p className="text-white/50 text-xs">
                        {isLogin ? "New to NotFlix?" : "Already have an account?"}
                        <button 
                            type="button"
                            onClick={() => { 
                                setIsLogin(!isLogin); 
                                setError(null); 
                            }}
                            className="ml-2 text-primary-container font-bold hover:underline"
                        >
                            {isLogin ? "Create an account" : "Sign In"}
                        </button>
                    </p>
                </div>
            </div>
        </div>
    );
};
