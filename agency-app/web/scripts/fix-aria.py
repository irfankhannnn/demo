import re
from pathlib import Path

SRC = Path(r'D:\reality_flow_crm\nabi-app-git-bkp\real-estate-crm-app\src')

LABELS = {
    'RefreshCw': 'Refresh data', 'X': 'Close', 'Plus': 'Add',
    'Eye': 'View details', 'Edit3': 'Edit', 'Trash2': 'Delete',
    'Search': 'Search', 'Filter': 'Filter', 'ChevronRight': 'Next',
    'ChevronLeft': 'Previous', 'ChevronUp': 'Expand', 'ChevronDown': 'Collapse',
    'ChevronsUpDown': 'Sort', 'Download': 'Download', 'Upload': 'Upload',
    'Copy': 'Copy', 'Share': 'Share', 'Maximize': 'Maximize',
    'Minimize': 'Minimize', 'Play': 'Play', 'Pause': 'Pause',
    'Volume2': 'Volume', 'VolumeX': 'Mute', 'Mic': 'Microphone',
    'Bell': 'Notifications', 'Settings': 'Settings', 'Menu': 'Menu',
    'MoreHorizontal': 'More options', 'MoreVertical': 'More options',
    'LogOut': 'Log out', 'ArrowLeft': 'Go back', 'ArrowRight': 'Next',
    'ArrowUp': 'Up', 'ArrowDown': 'Down', 'Save': 'Save',
    'Phone': 'Call', 'Mail': 'Email', 'MessageSquare': 'Message',
    'Calendar': 'Calendar', 'MapPin': 'Location', 'Home': 'Home',
    'Building2': 'Properties', 'User': 'Profile', 'Users': 'Users',
    'Key': 'Tenants', 'FileText': 'Documents', 'Check': 'Check',
    'CheckCircle': 'Confirm', 'AlertCircle': 'Alert', 'Info': 'Information',
    'HelpCircle': 'Help', 'Send': 'Send', 'Printer': 'Print',
    'Camera': 'Camera', 'ImageIcon': 'Image', 'VideoIcon': 'Video',
    'ZoomIn': 'Zoom in', 'ZoomOut': 'Zoom out', 'RotateCw': 'Rotate',
    'Star': 'Star', 'Heart': 'Like', 'Flag': 'Flag',
    'Bookmark': 'Bookmark', 'Pin': 'Pin', 'Link': 'Link',
    'Unlink': 'Unlink', 'ExternalLink': 'Open link', 'Paperclip': 'Attach',
    'QrCode': 'QR code', 'Barcode': 'Barcode', 'Fingerprint': 'Fingerprint',
    'Lock': 'Lock', 'Unlock': 'Unlock', 'Shield': 'Security',
    'ShieldCheck': 'Secure', 'Server': 'Server', 'Database': 'Database',
    'Cloud': 'Cloud', 'CloudOff': 'Cloud offline', 'Wifi': 'WiFi',
    'WifiOff': 'WiFi off', 'Bluetooth': 'Bluetooth', 'Monitor': 'Monitor',
    'Smartphone': 'Phone', 'Tablet': 'Tablet', 'Laptop': 'Laptop',
    'Keyboard': 'Keyboard', 'Mouse': 'Mouse', 'Headphones': 'Headphones',
    'Speaker': 'Speaker', 'Tv': 'TV', 'Battery': 'Battery',
    'BatteryCharging': 'Charging', 'Plug': 'Plug', 'Zap': 'Zap',
    'Power': 'Power', 'Sun': 'Sun', 'Moon': 'Moon',
    'Sunrise': 'Sunrise', 'Sunset': 'Sunset', 'Cloudy': 'Cloudy',
    'Wind': 'Wind', 'Droplet': 'Droplet', 'Thermometer': 'Temperature',
    'Snowflake': 'Snow', 'Flame': 'Flame', 'Tornado': 'Tornado',
    'Anchor': 'Anchor', 'Sailboat': 'Sailboat', 'Ship': 'Ship',
    'Plane': 'Plane', 'Rocket': 'Rocket', 'Satellite': 'Satellite',
    'Telescope': 'Telescope', 'Microscope': 'Microscope', 'Magnet': 'Magnet',
    'Atom': 'Atom', 'Brain': 'Brain', 'Dna': 'DNA',
    'Flask': 'Flask', 'TestTube': 'Test tube', 'Stethoscope': 'Stethoscope',
    'Syringe': 'Syringe', 'Pill': 'Pill', 'Bandage': 'Bandage',
    'Activity': 'Activity', 'Accessibility': 'Accessibility', 'Baby': 'Baby',
    'PersonStanding': 'Person', 'Hammer': 'Hammer', 'Wrench': 'Wrench',
    'Paintbrush': 'Paintbrush', 'Palette': 'Palette', 'Pencil': 'Pencil',
    'Pen': 'Pen', 'Highlighter': 'Highlighter', 'Eraser': 'Eraser',
    'Scissors': 'Scissors', 'Ruler': 'Ruler', 'Compass': 'Compass',
    'Square': 'Square', 'Circle': 'Circle', 'Triangle': 'Triangle',
    'Hexagon': 'Hexagon', 'Octagon': 'Octagon', 'Diamond': 'Diamond',
    'Crown': 'Crown', 'Medal': 'Medal', 'Trophy': 'Trophy',
    'Award': 'Award', 'Ribbon': 'Ribbon', 'Badge': 'Badge',
    'BadgeCheck': 'Verified', 'ThumbsUp': 'Like', 'ThumbsDown': 'Dislike',
    'Smile': 'Smile', 'Frown': 'Frown', 'Meh': 'Meh',
    'Angry': 'Angry', 'Laugh': 'Laugh', 'Annoyed': 'Annoyed',
    'AlertTriangle': 'Warning', 'AlertOctagon': 'Alert', 'Minus': 'Minus',
    'MinusCircle': 'Remove', 'PlusCircle': 'Add', 'Divide': 'Divide',
    'Percent': 'Percent', 'Dollar': 'Dollar', 'Euro': 'Euro',
    'Pound': 'Pound', 'Coins': 'Coins', 'CreditCard': 'Credit card',
    'Wallet': 'Wallet', 'Banknote': 'Banknote', 'Receipt': 'Receipt',
    'Invoice': 'Invoice', 'Package': 'Package', 'Box': 'Box',
    'Archive': 'Archive', 'Inbox': 'Inbox', 'Mail': 'Email',
    'At': 'At', 'Hash': 'Hash', 'Mention': 'Mention',
    'Reply': 'Reply', 'ReplyAll': 'Reply all', 'Forward': 'Forward',
    'Share2': 'Share', 'UserPlus': 'Add user', 'UserMinus': 'Remove user',
    'UserCheck': 'User check', 'UserX': 'Remove user', 'UserCog': 'User settings',
    'UsersRound': 'Users', 'Contact': 'Contact', 'Contact2': 'Contact',
    'AddressBook': 'Address book', 'Book': 'Book', 'BookOpen': 'Book',
    'Library': 'Library', 'Newspaper': 'Newspaper', 'File': 'File',
    'FilePlus': 'Add file', 'FileMinus': 'Remove file', 'FileCheck': 'File checked',
    'FileX': 'Remove file', 'FileCode': 'Code file', 'FileJson': 'JSON file',
    'FileSpreadsheet': 'Spreadsheet', 'FileArchive': 'Archive', 'FileAudio': 'Audio file',
    'FileVideo': 'Video file', 'FileImage': 'Image file', 'FilePen': 'Edit file',
    'Folder': 'Folder', 'FolderPlus': 'Add folder', 'FolderMinus': 'Remove folder',
    'FolderOpen': 'Open folder', 'FolderTree': 'Folder tree', 'Folders': 'Folders',
    'Image': 'Image', 'Images': 'Images', 'PictureInPicture': 'Picture in picture',
    'Video': 'Video', 'Film': 'Film', 'Clapperboard': 'Clapperboard',
    'MonitorPlay': 'Monitor play', 'Radio': 'Radio', 'Podcast': 'Podcast',
    'Cast': 'Cast', 'Airplay': 'AirPlay', 'Chromecast': 'Chromecast',
    'BluetoothOff': 'Bluetooth off', 'BluetoothConnected': 'Bluetooth connected',
    'BluetoothSearching': 'Bluetooth searching', 'Usb': 'USB', 'Hdmi': 'HDMI',
    'MonitorOff': 'Monitor off', 'MonitorSmartphone': 'Screen mirroring',
    'BatteryFull': 'Full battery', 'BatteryLow': 'Low battery',
    'BatteryMedium': 'Medium battery', 'BatteryWarning': 'Battery warning',
    'BatteryCharging': 'Charging', 'PlugZap': 'Plug zap', 'PowerOff': 'Power off',
    'ZapOff': 'Zap off', 'FlameKindling': 'Kindling', 'Candle': 'Candle',
    'Lightbulb': 'Lightbulb', 'LightbulbOff': 'Lightbulb off',
    'Flashlight': 'Flashlight', 'SunDim': 'Dim', 'SunMedium': 'Medium brightness',
    'SunMoon': 'Theme', 'MoonStar': 'Night', 'Stars': 'Stars',
    'CloudFog': 'Fog', 'CloudHail': 'Hail', 'CloudDrizzle': 'Drizzle',
    'CloudSun': 'Partly sunny', 'CloudMoon': 'Partly cloudy night',
    'Droplets': 'Droplets', 'ThermometerSun': 'Hot',
    'ThermometerSnowflake': 'Cold', 'Sprout': 'Sprout',
    'TreePine': 'Pine tree', 'TreeDeciduous': 'Tree', 'Flower': 'Flower',
    'Flower2': 'Flower', 'Leaf': 'Leaf', 'Feather': 'Feather',
    'LifeBuoy': 'Life buoy', 'BugOff': 'Bug off', 'Shell': 'Shell',
    'Turtle': 'Turtle', 'Rabbit': 'Rabbit', 'Cat': 'Cat',
    'Dog': 'Dog', 'Bone': 'Bone', 'PawPrint': 'Paw print',
    'Beef': 'Beef', 'Carrot': 'Carrot', 'Apple': 'Apple',
    'Cherry': 'Cherry', 'Citrus': 'Citrus', 'Grape': 'Grape',
    'Lemon': 'Lemon', 'Banana': 'Banana', 'Wheat': 'Wheat',
    'Coffee': 'Coffee', 'CupSoda': 'Soda', 'Milk': 'Milk',
    'Beer': 'Beer', 'Wine': 'Wine', 'Cocktail': 'Cocktail',
    'GlassWater': 'Water', 'IceCream': 'Ice cream', 'Candy': 'Candy',
    'Cookie': 'Cookie', 'Pizza': 'Pizza', 'Soup': 'Soup',
    'Salad': 'Salad', 'Sandwich': 'Sandwich', 'Screwdriver': 'Screwdriver',
    'Nut': 'Nut', 'Bolt': 'Bolt', 'Screw': 'Screw',
    'Axe': 'Axe', 'Pickaxe': 'Pickaxe', 'Shovel': 'Shovel',
    'Drill': 'Drill', 'Saw': 'Saw',
}

# Additional context-aware labels for specific files
FILE_CONTEXT = {
    'LogoutConfirmModal.tsx': {'X': 'Close logout confirmation'},
    'Toast.tsx': {'X': 'Dismiss notification'},
    'FullscreenMediaViewer.tsx': {'X': 'Close viewer', 'ZoomIn': 'Zoom in', 'ZoomOut': 'Zoom out'},
    'LeadDrawer.tsx': {'X': 'Close lead details'},
    'KhataDrawer.tsx': {'X': 'Close khata details'},
    'NotificationCenter.tsx': {'X': 'Dismiss notification'},
    'ScheduleMeetingModal.tsx': {'X': 'Close meeting scheduler'},
    'MeetingRescheduleModal.tsx': {'X': 'Close rescheduler'},
    'MeetingHistoryModal.tsx': {'X': 'Close meeting history'},
    'CreateOwnerModal.tsx': {'X': 'Close modal'},
    'CreateTenantModal.tsx': {'X': 'Close modal'},
    'AddPropertyModal.tsx': {'X': 'Close modal'},
    'SettlementModal.tsx': {'X': 'Close settlement'},
    'SearchableSelect.tsx': {'X': 'Clear selection'},
    'DocumentUploadSection.tsx': {'Trash2': 'Remove document', 'X': 'Remove document'},
    'MediaUploadSection.tsx': {'Trash2': 'Remove media', 'X': 'Remove media'},
    'PDFUploadSection.tsx': {'Trash2': 'Remove PDF', 'X': 'Remove PDF'},
    'GlassDataTable.tsx': {'Eye': 'View details', 'Edit3': 'Edit item', 'Trash2': 'Delete item'},
}

def process_file(file_path):
    content = file_path.read_text('utf-8')
    original = content
    changes = 0
    fname = file_path.name
    
    # Pattern: <button ...> followed by optional whitespace/newlines, then <IconName className=... /> or similar, then optional whitespace/newlines, then </button>
    # We need to be careful to only match icon-only buttons (no text content)
    
    # Simpler approach: find all <button> tags, check their content
    btn_pattern = re.compile(r'(<button\s+[^>]*?)>(.*?)</button>', re.DOTALL)
    
    def replacer(match):
        nonlocal changes
        open_tag = match.group(1)
        inner = match.group(2)
        
        # Skip if already has aria-label
        if 'aria-label' in open_tag:
            return match.group(0)
        
        # Check if button has icon-only content
        # Remove all icon self-closing tags
        cleaned = re.sub(r'<[A-Z][a-zA-Z]+(?:\s+[^>]*)?\/>\s*', '', inner)
        # Remove whitespace
        cleaned = re.sub(r'\s', '', cleaned)
        
        if len(cleaned) > 0:
            return match.group(0)  # Has text content, skip
        
        # Find the icon name
        icon_match = re.search(r'<([A-Z][a-zA-Z]+)', inner)
        if not icon_match:
            return match.group(0)
        icon_name = icon_match.group(1)
        
        # Get label
        label = None
        if fname in FILE_CONTEXT and icon_name in FILE_CONTEXT[fname]:
            label = FILE_CONTEXT[fname][icon_name]
        elif icon_name in LABELS:
            label = LABELS[icon_name]
        else:
            return match.group(0)  # Unknown icon, skip
        
        changes += 1
        return f'{open_tag} aria-label="{label}">{inner}</button>'
    
    new_content = btn_pattern.sub(replacer, content)
    
    if new_content != original:
        file_path.write_text(new_content, 'utf-8')
        print(f'Updated {fname}: {changes} aria-label(s) added')
        return changes
    return 0

total = 0
for f in SRC.rglob('*.tsx'):
    total += process_file(f)

print(f'\nTotal aria-labels added: {total}')
