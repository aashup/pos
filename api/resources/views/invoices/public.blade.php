<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{{ $ogTitle }}</title>

    {{-- Open Graph tags --}}
    <meta property="og:type"        content="website" />
    <meta property="og:title"       content="{{ $ogTitle }}" />
    <meta property="og:description" content="{{ $ogDescription }}" />
    <meta property="og:url"         content="{{ $shareUrl }}" />
    <meta name="description"        content="{{ $ogDescription }}" />
    <meta name="twitter:card"        content="summary" />
    <meta name="twitter:title"       content="{{ $ogTitle }}" />
    <meta name="twitter:description" content="{{ $ogDescription }}" />

    {{-- Tell service worker / CDN not to cache this page --}}
    <meta http-equiv="Cache-Control" content="no-store" />

    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }

        body {
            background: #f3f4f6;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            min-height: 100vh;
            padding: 16px 12px 32px;
        }

        .wrapper {
            max-width: 480px;
            margin: 0 auto;
        }

        .card {
            background: #fff;
            border-radius: 12px;
            box-shadow: 0 2px 12px rgba(0,0,0,.1);
            overflow: hidden;
            display: flex;
            justify-content: center;
            padding: 12px 0;
        }

        #invoice-frame {
            border: none;
            display: block;
            /* explicit width matches paper size; height set by resizeFrame() */
            width: {{ $paperSize === '3inch' ? '320px' : '240px' }};
            min-height: 300px;
        }

        .page-footer {
            text-align: center;
            margin-top: 14px;
            font-size: 11px;
            color: #9ca3af;
        }

        @media print {
            body, .wrapper { background: #fff; padding: 0; }
            .page-footer { display: none; }
            .card { box-shadow: none; border-radius: 0; padding: 0; }
            #invoice-frame { width: 100% !important; }
        }
    </style>
</head>
<body>
<div class="wrapper">

    <div class="card">
        <iframe id="invoice-frame"
                srcdoc="{!! htmlspecialchars($invoiceHtml, ENT_QUOTES, 'UTF-8') !!}"
                scrolling="no"
                onload="resizeFrame(this)">
        </iframe>
    </div>

    <div class="page-footer">
        {{ $company->name ?? '' }} &nbsp;·&nbsp; Powered by ERP
    </div>

</div>

<script>
    function resizeFrame(frame) {
        // Use a small delay so the browser finishes laying out the srcdoc content
        setTimeout(function () {
            try {
                var doc = frame.contentDocument || frame.contentWindow.document;
                var h = Math.max(
                    doc.body.scrollHeight,
                    doc.body.offsetHeight,
                    doc.documentElement.scrollHeight,
                    doc.documentElement.offsetHeight
                );
                if (h > 0) frame.style.height = h + 'px';
            } catch (e) {}
        }, 50);
    }
</script>
</body>
</html>
