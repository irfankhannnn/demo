// Set required environment variables for tests before modules are imported.
process.env.BEDROCK_MODEL_ID = process.env.BEDROCK_MODEL_ID || 'anthropic.claude-3-haiku-20240307-v1:0';
process.env.GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
process.env.GEMINI_CLASSIFIER_MODEL = process.env.GEMINI_CLASSIFIER_MODEL || 'gemini-2.5-flash';
process.env.DEFAULT_COUNTRY_CODE = process.env.DEFAULT_COUNTRY_CODE || '+91';
