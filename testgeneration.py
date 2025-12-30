from google import genai
from PIL import Image

client = genai.Client()

response = client.models.generate_content(
    model="gemini-2.5-flash-image",
    contents="Create a picture of a futuristic banana with neon lights in a cyberpunk city.",
)

for part in response.parts:
    if part.inline_data:
        image = part.as_image()
        image.show()