; Create destination dir and copy image
Run, powershell.exe -WindowStyle Hidden -Command "New-Item -ItemType Directory -Force -Path 'C:\Users\ezhan\home-cafe\public\menu'; Get-ChildItem -Path 'C:\Users\ezhan\AppData\Roaming\Claude' -Filter '*IMG_1706*' -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1 | ForEach-Object { Copy-Item $_.FullName 'C:\Users\ezhan\home-cafe\public\menu\lychee-matcha.jpg' }"
Sleep, 6000
MsgBox, Done! Check C:\Users\ezhan\home-cafe\public\menu\lychee-matcha.jpg
