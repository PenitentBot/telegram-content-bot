import logging
import urllib.parse
import json
import os
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import Application, CommandHandler, MessageHandler, CallbackQueryHandler, filters, ContextTypes
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Setup logging
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)
logger = logging.getLogger(__name__)

# Get config from environment
WEBSITE_URL = os.getenv('WEBSITE_URL', 'https://get-your-content.netlify.app')
TELEGRAM_BOT_TOKEN = os.getenv('TELEGRAM_BOT_TOKEN')

if not TELEGRAM_BOT_TOKEN:
    logger.error("❌ TELEGRAM_BOT_TOKEN not found in environment variables")
    exit(1)

# Load sites database
def load_sites_database():
    db_path = os.path.join(os.path.dirname(__file__), '..', 'database', 'sites.json')
    with open(db_path, 'r', encoding='utf-8') as f:
        return json.load(f)

SITES_DATABASE = load_sites_database()

# Category mapping with emojis
CATEGORY_MAP = {
    'live_action': '🎬 Live Action',
    'cartoon': '📺 Cartoon',
    'anime': '🎌 Anime',
    'games': '🎮 Games',
    'desi_webseries': '🔞 Desi Series',
    'hentai': '🔞 Hentai',
    'jav': '🔞 JAV',
    'onlyfans_leak': '🔞 OnlyFans',
    'adult': '🔞 Adult'
}

# Adult categories that require 18+ verification
ADULT_CATEGORIES = {
    'hentai', 'jav', 'adult', 'onlyfans_leak', 'desi_webseries'
}

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Send a message when /start is issued."""
    welcome_text = (
        '🎯 <b>Welcome to Content Finder!</b>\n\n'
        '🔍 <i>Your ultimate content search bot</i>\n\n'
        '📌 <b>How to use:</b>\n'
        '1️⃣ Type any search query\n'
        '2️⃣ Choose a category\n'
        '3️⃣ Get results instantly!\n\n'
        '💡 <b>Try searching:</b>\n'
        '• Movies: Avengers, The Matrix\n'
        '• Shows: Breaking Bad, Stranger Things\n'
        '• Games: GTA 5, Cyberpunk 2077\n'
        '• Anime: Naruto, One Piece\n\n'
        '⚡ <b>Fast • Accurate • Easy</b>\n'
        '━━━━━━━━━━━━━━━━━━'
    )
    await update.message.reply_text(welcome_text, parse_mode='HTML')
    logger.info(f"User {update.effective_user.id} started the bot")

async def handle_search(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle user search query with better UI."""
    query = update.message.text.strip()

    if len(query) < 2:
        await update.message.reply_text("❌ Please enter at least 2 characters to search")
        return

    # Save query in context
    context.user_data['search_query'] = query

    # Create category buttons - NO BOOKS OR MUSIC
    keyboard = [
        [
            InlineKeyboardButton("🎬 Live Action", callback_data='cat_live_action'),
            InlineKeyboardButton("📺 Cartoon", callback_data='cat_cartoon')
        ],
        [
            InlineKeyboardButton("🎌 Anime", callback_data='cat_anime'),
            InlineKeyboardButton("🎮 Games", callback_data='cat_games')
        ],
        [
            InlineKeyboardButton("🔞 Desi Series", callback_data='cat_desi_webseries'),
            InlineKeyboardButton("🔞 Hentai", callback_data='cat_hentai')
        ],
        [
            InlineKeyboardButton("🔞 JAV", callback_data='cat_jav'),
            InlineKeyboardButton("🔞 OnlyFans", callback_data='cat_onlyfans_leak')
        ],
        [
            InlineKeyboardButton("🔞 Adult", callback_data='cat_adult')
        ]
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)

    await update.message.reply_text(
        f'🔍 <b>Search Query:</b> <code>{query}</code>\n\n'
        f'━━━━━━━━━━━━━━━━━━\n'
        f'📂 <b>Select Category:</b>\n'
        f'━━━━━━━━━━━━━━━━━━',
        reply_markup=reply_markup,
        parse_mode='HTML'
    )
    logger.info(f"User {update.effective_user.id} searched for: {query}")

async def category_callback(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle category selection."""
    query_data = update.callback_query.data
    search_query = context.user_data.get('search_query', 'Unknown')

    # Parse category
    category = query_data.replace('cat_', '')

    # Get default subcategory
    subcategory_map = {
        'live_action': 'movies',
        'cartoon': 'movies',
        'anime': 'movies',
        'games': 'classic',
        'desi_webseries': 'movies',
        'hentai': 'movies',
        'jav': 'actress',
        'onlyfans_leak': 'creator',
        'adult': 'movies'
    }

    subcategory = subcategory_map.get(category, 'movies')

    # Send searching message
    searching_msg = await update.callback_query.edit_message_text(
        f'🔄 <b>Searching...</b>\n\n'
        f'🔍 Query: <code>{search_query}</code>\n'
        f'📂 Category: <b>{CATEGORY_MAP.get(category, category)}</b>\n\n'
        f'⏳ Preparing results...\n'
        f'━━━━━━━━━━━━━━━━━━',
        parse_mode='HTML'
    )

    try:
        # Get sites for this category
        category_data = SITES_DATABASE.get(category, {})

        if not category_data:
            await searching_msg.edit_text(
                f'❌ <b>Category not found:</b> {category}',
                parse_mode='HTML'
            )
            return

        # Get subcategory data
        sub_data = category_data.get(subcategory, {})
        legal_sites = sub_data.get('legal', [])
        illegal_sites = sub_data.get('illegal', [])
        adult_sites = sub_data.get('adult', [])

        # Count total results
        total_results = len(legal_sites) + len(illegal_sites) + len(adult_sites)

        if total_results == 0:
            await searching_msg.edit_text(
                f'😕 <b>No sources found</b>\n\n'
                f'🔍 <b>Query:</b> <code>{search_query}</code>\n'
                f'📂 <b>Category:</b> {CATEGORY_MAP.get(category, category)}\n\n'
                f'💡 Try a different category.\n'
                f'━━━━━━━━━━━━━━━━━━',
                parse_mode='HTML'
            )
            return

        # Build website link
        is_adult = category in ADULT_CATEGORIES
        encoded_query = urllib.parse.quote(search_query)
        website_link = (
            f"{WEBSITE_URL}?q={encoded_query}&category={category}"
            f"&subcategory={subcategory}&adult={str(is_adult).lower()}"
        )

        # Create results message
        results_text = (
            f'✅ <b>Found {total_results} Source(s)</b>\n\n'
            f'🔍 <b>Query:</b> <code>{search_query}</code>\n'
            f'📂 <b>Category:</b> {CATEGORY_MAP.get(category, category)}\n'
            f'━━━━━━━━━━━━━━━━━━\n\n'
            f'📊 <b>Results Breakdown:</b>\n'
            f'  ✅ Legal: {len(legal_sites)}\n'
            f'  ⚠️ Illegal: {len(illegal_sites)}\n'
        )

        if is_adult and adult_sites:
            results_text += f'  🔞 Adult: {len(adult_sites)}\n'

        results_text += (
            f'\n━━━━━━━━━━━━━━━━━━\n'
            f'👇 Click below to view results'
        )

        # Create button
        keyboard = [[InlineKeyboardButton("🔗 View Full Results", url=website_link)]]
        reply_markup = InlineKeyboardMarkup(keyboard)

        # Update message
        await searching_msg.edit_text(
            results_text,
            reply_markup=reply_markup,
            parse_mode='HTML'
        )

        logger.info(f"User {update.effective_user.id} got {total_results} results for: {search_query} in {category}")

    except Exception as e:
        logger.error(f"Error during search: {str(e)}")
        await searching_msg.edit_text(
            f'❌ <b>Error during search:</b>\n'
            f'<code>{str(e)}</code>',
            parse_mode='HTML'
        )

def main() -> None:
    """Start the bot."""
    logger.info("🚀 Starting bot...")

    # Create the Application
    application = Application.builder().token(TELEGRAM_BOT_TOKEN).build()

    # Add handlers
    application.add_handler(CommandHandler("start", start))
    application.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_search))
    application.add_handler(CallbackQueryHandler(category_callback))

    # Run the bot
    logger.info("✅ Bot is polling...")
    application.run_polling(allowed_updates=Update.ALL_TYPES)

if __name__ == '__main__':
    main()
