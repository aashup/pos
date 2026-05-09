<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Login</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f4f4f5; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
        .card { background: #fff; border: 1px solid #e4e4e7; border-radius: 8px; padding: 32px; width: 100%; max-width: 360px; }
        h1 { font-size: 18px; font-weight: 600; color: #18181b; margin-bottom: 24px; }
        label { display: block; font-size: 13px; font-weight: 500; color: #52525b; margin-bottom: 6px; }
        input { width: 100%; padding: 8px 12px; border: 1px solid #d4d4d8; border-radius: 6px; font-size: 14px; color: #18181b; outline: none; transition: border-color .15s; }
        input:focus { border-color: #6366f1; box-shadow: 0 0 0 2px rgba(99,102,241,.15); }
        .field { margin-bottom: 16px; }
        button { width: 100%; padding: 9px; background: #18181b; color: #fff; border: none; border-radius: 6px; font-size: 14px; font-weight: 500; cursor: pointer; transition: background .15s; }
        button:hover { background: #3f3f46; }
        .error { background: #fef2f2; border: 1px solid #fecaca; color: #b91c1c; font-size: 13px; padding: 10px 12px; border-radius: 6px; margin-bottom: 16px; }
    </style>
</head>
<body>
    <div class="card">
        <h1>Sign in</h1>

        @if ($errors->any())
            <div class="error">{{ $errors->first() }}</div>
        @endif

        <form method="POST" action="/api/login">
            @csrf
            <div class="field">
                <label for="email">Email</label>
                <input type="email" id="email" name="email" value="{{ old('email') }}" autofocus required>
            </div>
            <div class="field">
                <label for="password">Password</label>
                <input type="password" id="password" name="password" required>
            </div>
            <button type="submit">Sign in</button>
        </form>
    </div>
</body>
</html>
