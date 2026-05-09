<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class WebAuthController extends Controller
{
    public function showLogin()
    {
        if (Auth::guard('web')->check()) {
            return redirect('/api/home');
        }

        return view('welcome');
    }

    public function home()
    {
        return view('home');
    }

    public function login(Request $request)
    {
        $credentials = $request->validate([
            'email' => 'required|email',
            'password' => 'required|string',
        ]);

        $allowed = array_map('trim', explode(',', env('TELESCOPE_ALLOWED_EMAILS', '')));

        if (! in_array($credentials['email'], $allowed)) {
            return back()->withErrors(['email' => 'Access denied.'])->withInput();
        }

        if (! Auth::guard('web')->attempt($credentials, true)) {
            return back()->withErrors(['email' => 'Invalid credentials.'])->withInput();
        }

        $request->session()->regenerate();

        return redirect('/api/home');
    }

    public function logout(Request $request)
    {
        Auth::guard('web')->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return redirect('/api');
    }
}
