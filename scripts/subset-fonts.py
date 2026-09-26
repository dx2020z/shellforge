"""
把 Noto Serif SC / Noto Sans SC 可变字体子集化为 woff2。

字符集 = ASCII + 常用标点 + GB2312 一级汉字（3755 个）+ 源码里出现的所有字符。
玩家输入的生僻字会回落到系统字体，排版不受影响。

用法：python3 scripts/subset-fonts.py（原始字体放在 assets-src/fonts/，不入库）
"""
import pathlib, re, sys
from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / 'assets-src' / 'fonts'
OUT = ROOT / 'public' / 'fonts'

def gb2312_level1():
    chars = []
    for hi in range(0xB0, 0xD8):
        for lo in range(0xA1, 0xFF):
            if hi == 0xD7 and lo > 0xF9:
                break
            try:
                chars.append(bytes([hi, lo]).decode('gb2312'))
            except UnicodeDecodeError:
                pass
    return ''.join(chars)

def source_chars():
    text = []
    for path in list((ROOT / 'src').rglob('*')) + list((ROOT / 'docs').glob('*.md')):
        if path.suffix in {'.ts', '.tsx', '.css', '.md', '.json'}:
            text.append(path.read_text(encoding='utf-8', errors='ignore'))
    return ''.join(text)

ASCII = ''.join(chr(c) for c in range(0x20, 0x7F))
PUNCT = '，。、；：？！…—～·「」『』《》〈〉（）【】〔〕“”‘’％＋－×÷＝＜＞°№←→↑↓○●◆◇□■△▲☆★♪♫　'
chars = set(ASCII + PUNCT + gb2312_level1() + source_chars())
chars = ''.join(sorted(c for c in chars if ord(c) >= 0x20))

# (源文件, 输出名, 保留的字重范围)
JOBS = [
    ('NotoSerifSC-VF.ttf', 'noto-serif-sc', (600, 900)),
    ('NotoSansSC-VF.ttf', 'noto-sans-sc', (400, 700)),
]

OUT.mkdir(parents=True, exist_ok=True)
for source, name, (lo, hi) in JOBS:
    font = TTFont(SRC / source, lazy=False)
    options = subset.Options()
    options.flavor = 'woff2'
    options.layout_features = ['*']
    options.name_IDs = ['*']
    options.notdef_outline = True
    options.hinting = False
    options.desubroutinize = True
    subsetter = subset.Subsetter(options)
    subsetter.populate(text=chars)
    subsetter.subset(font)
    # 先子集化再裁字重轴，避免 gvar 延迟加载的已知问题。
    font = instancer.instantiateVariableFont(font, {'wght': (lo, hi)})
    target = OUT / f'{name}.woff2'
    font.flavor = 'woff2'
    font.save(target)
    print(f'{target.name}: {target.stat().st_size / 1024 / 1024:.2f} MB, {len(chars)} 字符, wght {lo}-{hi}')
