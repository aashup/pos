<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Dashboard</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f4f4f5; min-height: 100vh; }
        header { background: #fff; border-bottom: 1px solid #e4e4e7; padding: 0 24px; height: 52px; display: flex; align-items: center; justify-content: space-between; }
        header span { font-size: 14px; font-weight: 600; color: #18181b; }
        header .user { font-size: 13px; color: #71717a; display: flex; align-items: center; gap: 12px; }
        .logout-btn { background: none; border: 1px solid #e4e4e7; border-radius: 5px; padding: 4px 10px; font-size: 13px; color: #52525b; cursor: pointer; }
        .logout-btn:hover { background: #f4f4f5; }
        main { padding: 40px 24px; max-width: 960px; margin: 0 auto; }
        h2 { font-size: 20px; font-weight: 600; color: #18181b; margin-bottom: 24px; }
        .tools { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 16px; }
        .tool-card { background: #fff; border: 1px solid #e4e4e7; border-radius: 8px; padding: 24px; text-decoration: none; display: flex; flex-direction: column; gap: 8px; transition: border-color .15s, box-shadow .15s; }
        .tool-card:hover { border-color: #a1a1aa; box-shadow: 0 2px 8px rgba(0,0,0,.06); }
        .tool-card .icon { font-size: 22px; }
        .tool-card .name { font-size: 15px; font-weight: 600; color: #18181b; }
        .tool-card .desc { font-size: 13px; color: #71717a; }
    </style>
</head>
<body>
    <header>
        <span>ERP Admin</span>
        <div class="user">
            <span>{{ Auth::guard('web')->user()->email }}</span>
            <form method="POST" action="/api/logout" style="display:inline">
                @csrf
                <button type="submit" class="logout-btn">Logout</button>
            </form>
        </div>
    </header>

    <main>
        <h2>Tools</h2>
        <div class="tools">
            <a href="/api/telescope" class="tool-card">
                <div class="icon">🔭</div>
                <div class="name">Telescope</div>
                <div class="desc">Inspect requests, queries, jobs, and exceptions</div>
            </a>
        </div>
    </main>
</body>
</html>
