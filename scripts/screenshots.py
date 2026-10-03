#!/usr/bin/env python3
"""Screenshot the key screens with Playwright (Chrome). Usage:
   python3 scripts/screenshots.py [base_url] [out_dir] [filter]
Defaults: http://localhost:3300 and ./docs/screenshots. Start the app first (npm run dev or npm start)."""
import os, sys
from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:3300"
OUT = sys.argv[2] if len(sys.argv) > 2 else "docs/screenshots"
FLT = sys.argv[3] if len(sys.argv) > 3 else ""
DESK, TAB, PHONE = (1440, 900), (1180, 820), (390, 844)

# name, path, viewport, optional list of (action, selector) steps run before the shot
SHOTS = [
    ("01-dashboard", "/dashboard", DESK, []),
    ("02-queue", "/queue", DESK, []),
    ("03-sales", "/sales", DESK, []),
    ("04-kiosk-1-barber", "/kiosk", TAB, []),
    ("04-kiosk-2-haircut", "/kiosk", TAB, [("click", "text=Continue")]),
    ("04-kiosk-3-confirm", "/kiosk", TAB, [("click", "text=Continue"), ("click", "text=Continue")]),
    ("04-kiosk-4-ticket", "/kiosk", TAB, [("click", "text=Continue"), ("click", "text=Continue"), ("click", "text=Get my ticket")]),
    ("04-kiosk-5-in-chair", "/kiosk", TAB, [("click", "text=Continue"), ("click", "text=Continue"), ("click", "text=Get my ticket"), ("click", "text=I’m in the chair")]),
    ("04-kiosk-6-payment", "/kiosk", TAB, [("click", "text=Continue"), ("click", "text=Continue"), ("click", "text=Get my ticket"), ("click", "text=I’m in the chair"), ("click", "text=Confirm haircut is done")]),
    ("04-kiosk-7-feedback", "/kiosk", TAB, [("click", "text=Continue"), ("click", "text=Continue"), ("click", "text=Get my ticket"), ("click", "text=I’m in the chair"), ("click", "text=Confirm haircut is done"), ("click", "text=Paid in cash")]),
    ("05-partner-home", "/partner", PHONE, []),
    ("05-partner-incoming", "/partner/incoming", PHONE, []),
    ("05-partner-scan", "/partner/scan", PHONE, []),
    ("05-partner-scan-verified", "/partner/scan", PHONE, [("click", "text=Simulate scan")]),
    ("05-partner-history", "/partner/history", PHONE, []),
    ("06-customers", "/customers", DESK, []),
    ("07-customer-detail", "/customers/cu-paolo", DESK, []),
    ("08-barbers", "/barbers", DESK, []),
    ("09-vouchers", "/vouchers", DESK, []),
    ("10-messages", "/messages", DESK, []),
    ("11-settings", "/settings", DESK, []),
    ("12-partner-tier-locked", "/sales", DESK, [("tier", "partner")]),
]

os.makedirs(OUT, exist_ok=True)
with sync_playwright() as p:
    exe = os.environ.get("CHROME_PATH", "/usr/bin/google-chrome")
    b = p.chromium.launch(executable_path=exe if os.path.exists(exe) else None, args=["--no-sandbox"])
    for name, path, (w, h), steps in SHOTS:
        if FLT and FLT not in name:
            continue
        ctx = b.new_context(viewport={"width": w, "height": h}, device_scale_factor=1)
        tier = next((v for a, v in steps if a == "tier"), "paid")
        ctx.add_cookies([{"name": "bp_demo_tier", "value": tier, "url": BASE}])
        pg = ctx.new_page()
        pg.goto(BASE + path, wait_until="networkidle")
        for action, sel in steps:
            if action == "click":
                pg.click(sel)
                pg.wait_for_timeout(250)
        pg.evaluate("document.fonts.ready")
        pg.wait_for_timeout(400)
        out = os.path.join(OUT, f"{name}.png")
        pg.screenshot(path=out)
        print(out)
        ctx.close()
    b.close()
