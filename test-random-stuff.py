import sys
sys.stdout.reconfigure(encoding="utf-8")

base = "ก"  # Thai ko kai (center)

# ======================
# SIDEWAYS / ENCLOSING MARKS
# (simulate left/right walls)
# ======================
side_wall = (
    "⃝" * 5 +   # enclosing circle
    "⃞" * 5 +   # enclosing square
    "⃟" * 5    # enclosing diamond
)

# ======================
# UPWARD STACKING
# (these stack ON TOP of the side walls)
# ======================
up_stack = (
    "็" * 10 +           # Thai mai taikhu (very strong)
    "̄̅̍͂͛͒" * 3         # Latin combining above
)

# ======================
# OPTIONAL: DOWNWARD BASE SUPPORT
# ======================
down_stack = (
    "ุ" * 5 +            # Thai below vowel
    "̗̖̠̩̪̰" * 2
)

monster = base + side_wall + up_stack + down_stack

print(monster)