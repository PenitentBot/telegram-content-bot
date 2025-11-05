from telegram.ext import Application, CommandHandler, ContextTypes
from telegram import Update
import os
from dotenv import load_dotenv

load_dotenv()
TOKEN = os.getenv('TELEGRAM_BOT_TOKEN')

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    print(f"✅ GOT MESSAGE: {update.message.text}")
    await update.message.reply_text("✅ Bot is working!")

app = Application.builder().token(TOKEN).build()
app.add_handler(CommandHandler("start", start))
app.run_polling()
