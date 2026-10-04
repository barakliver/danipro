import re, sys, pathlib
sb = pathlib.Path(sys.argv[1]); spec = pathlib.Path(sys.argv[2]).read_text()
parts = re.split(r'^@@(\S+)\n', spec, flags=re.M)[1:]
blocks = dict(zip(parts[0::2], parts[1::2]))
s = sb.read_text()
s = s.replace('.mov —', '.mp4 —')
i = s.index('## Decisions')
s = s[:i] + blocks['VIDEO_DIRECTION'].strip() + '\n\n' + s[i:]
frames = re.split(r'(?=^## Frame \d+)', s, flags=re.M)
out = [frames[0]]
for fr in frames[1:]:
    n = re.match(r'## Frame (\d+)', fr).group(1)
    out.append(fr.rstrip('\n') + '\n\n' + blocks[n].strip() + '\n\n')
sb.write_text(''.join(out).rstrip('\n') + '\n')
print('ok', sb)
