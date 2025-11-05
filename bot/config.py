import os
from dotenv import load_dotenv

load_dotenv()

TELEGRAM_BOT_TOKEN = os.getenv('TELEGRAM_BOT_TOKEN')
WEBSITE_URL = os.getenv('WEBSITE_URL')

if not TELEGRAM_BOT_TOKEN:
    raise ValueError("❌ TELEGRAM_BOT_TOKEN not found in .env")
if not WEBSITE_URL:
    raise ValueError("❌ WEBSITE_URL not found in .env")

print("✅ Config loaded!")
