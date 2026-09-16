#!/usr/bin/env python3
"""
RealtyFlow Instagram Posts - Automated Export Script
Converts HTML posts to PNG images using Selenium + Chrome

Requirements:
- pip install selenium pillow
- Download ChromeDriver: https://chromedriver.chromium.org/
"""

import os
import sys
from pathlib import Path
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from PIL import Image
import time

# Configuration
SCRIPT_DIR = Path(__file__).parent
HTML_FILE = SCRIPT_DIR / "realtyflow-instagram-production.html"
OUTPUT_DIR = SCRIPT_DIR / "exports"
CHROMEDRIVER_PATH = "chromedriver"  # Update if ChromeDriver not in PATH

# Post selectors
POSTS = {
    "1": {"selector": ".post-1", "filename": "1_light_pain.png"},
    "2": {"selector": ".post-2", "filename": "2_light_solution.png"},
    "3": {"selector": ".post-3", "filename": "3_light_feature.png"},
    "4": {"selector": ".post-4", "filename": "4_light_proof.png"},
    "5": {"selector": ".post-5", "filename": "5_light_comparison.png"},
}

def setup_driver():
    """Initialize Chrome WebDriver"""
    options = webdriver.ChromeOptions()
    options.add_argument('--window-size=1100,1100')
    options.add_argument('--start-maximized')
    options.add_argument('--disable-blink-features=AutomationControlled')

    try:
        service = Service(CHROMEDRIVER_PATH)
        driver = webdriver.Chrome(service=service, options=options)
    except Exception as e:
        print(f"❌ Error: Could not find ChromeDriver at {CHROMEDRIVER_PATH}")
        print(f"Download from: https://chromedriver.chromium.org/")
        print(f"Place in PATH or specify full path in script")
        sys.exit(1)

    return driver

def export_posts():
    """Export each Instagram post as PNG"""

    # Check if HTML file exists
    if not HTML_FILE.exists():
        print(f"❌ HTML file not found: {HTML_FILE}")
        sys.exit(1)

    # Create output directory
    OUTPUT_DIR.mkdir(exist_ok=True)

    print("🚀 Starting Instagram Posts Export...")
    print(f"📂 Output directory: {OUTPUT_DIR}")

    # Initialize driver
    driver = setup_driver()

    try:
        # Open HTML file
        file_url = f"file:///{HTML_FILE.absolute()}".replace("\\", "/")
        print(f"📄 Loading: {file_url}")
        driver.get(file_url)

        # Wait for page load
        time.sleep(2)

        # Export each post
        for post_num, post_info in POSTS.items():
            print(f"\n📸 Exporting Post {post_num}...")

            # Find post element
            selector = post_info["selector"]
            post_element = WebDriverWait(driver, 10).until(
                EC.presence_of_element_located((By.CSS_SELECTOR, selector))
            )

            # Set viewport to 1080x1080
            driver.execute_script(f"""
                let elem = document.querySelector('{selector}');
                elem.style.width = '1080px';
                elem.style.height = '1080px';
            """)

            time.sleep(0.5)

            # Take screenshot
            screenshot_path = OUTPUT_DIR / f"post_{post_num}_screenshot.png"
            post_element.screenshot(str(screenshot_path))

            # Crop to exact 1080x1080
            crop_to_square(screenshot_path, OUTPUT_DIR / post_info["filename"])

            print(f"✅ Saved: {post_info['filename']}")

        print(f"\n🎉 Export Complete!")
        print(f"📁 Files saved to: {OUTPUT_DIR}")
        print(f"\nNext steps:")
        print(f"1. Go to: {OUTPUT_DIR}")
        print(f"2. Upload each PNG to Instagram")
        print(f"3. Use captions from INSTAGRAM-POSTS-GUIDE.md")

    except Exception as e:
        print(f"❌ Error during export: {e}")
        sys.exit(1)

    finally:
        driver.quit()

def crop_to_square(input_path, output_path):
    """Crop image to exact 1080x1080 square"""
    try:
        img = Image.open(input_path)
        width, height = img.size

        # Calculate crop box
        size = min(width, height)
        left = (width - size) // 2
        top = (height - size) // 2
        right = left + size
        bottom = top + size

        # Crop and resize to 1080x1080
        cropped = img.crop((left, top, right, bottom))
        resized = cropped.resize((1080, 1080), Image.Resampling.LANCZOS)

        # Save
        resized.save(output_path, quality=95)

        # Clean up screenshot
        input_path.unlink()

    except Exception as e:
        print(f"❌ Error processing image: {e}")

def main():
    """Main entry point"""
    print("""
    ╔════════════════════════════════════════════════════════╗
    ║   RealtyFlow Instagram Posts - Automated Exporter     ║
    ║                                                        ║
    ║   Creates 1080x1080px PNG files from HTML posts       ║
    ╚════════════════════════════════════════════════════════╝
    """)

    # Check dependencies
    try:
        from selenium import webdriver
        from PIL import Image
    except ImportError:
        print("❌ Missing dependencies!")
        print("\nInstall required packages:")
        print("pip install selenium pillow")
        sys.exit(1)

    # Run export
    export_posts()

if __name__ == "__main__":
    main()
