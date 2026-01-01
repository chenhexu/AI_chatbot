import sys
sys.stdout.reconfigure(encoding="utf-8")
up = "\u0300\u0301\u0302\u0303" * 100
down = "\u0323\u0324\u0325\u0326" * 100
mid = "\u0338\u0337" * 100

print("A" + up + mid + down)









