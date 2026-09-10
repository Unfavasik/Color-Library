from PIL import Image
Image.open('public/color-mix-hero.png').convert('RGB').save('public/color-mix-hero.webp', 'WEBP', quality=84, method=6)
print('Converted public/color-mix-hero.png -> public/color-mix-hero.webp')
