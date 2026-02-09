import json
import sys

try:
    import pymorphy2
except Exception as e:
    print(json.dumps({"lemmas": []}, ensure_ascii=False))
    sys.exit(0)

morph = pymorphy2.MorphAnalyzer()

payload = json.load(sys.stdin)
tokens = payload.get("tokens", [])
lemmas = []

for token in tokens:
    if not token:
        continue
    try:
        parsed = morph.parse(token)
        if parsed:
            lemmas.append(parsed[0].normal_form)
        else:
            lemmas.append(token)
    except Exception:
        lemmas.append(token)

print(json.dumps({"lemmas": lemmas}, ensure_ascii=False))
