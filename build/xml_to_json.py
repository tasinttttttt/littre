#!/usr/bin/env python3
"""
xml_to_json.py — Convert XMLittré XML files to JSON for the Littré PWA.

Usage:
    python build/xml_to_json.py --input ./xmlittre-data --output ./public/data

Produces:
    - index.json: all headwords grouped by letter, sorted
    - A.json through Z.json: full entries per letter, keyed by normalized headword

Output shape per entry:
{
  "mot": "A",
  "sens": [
    { "num": "1", "prononciation": "â", "nature": "s. m.", "html": "..." },
    { "num": "2", "prononciation": "a", "nature": "...", "html": "..." }
  ]
}
"""

import datetime
import argparse
import json
import os
import xml.etree.ElementTree as ET
from collections import defaultdict, OrderedDict
from helpers import normalise, get_letter


def xml_to_html(element: ET.Element) -> str:
    """Convert an XMLittré element tree to HTML."""
    tag = element.tag
    text = element.text or ''
    children_html = ''.join(xml_to_html(child) for child in element)
    tail = element.tail or ''

    if tag == 'entete':
        parts = [text] if text else []
        for child in element:
            child_text = child.text or ''
            grandchildren = ''.join(xml_to_html(gc) for gc in child)
            child_tail = child.tail or ''
            parts.append(f'<span class="entry-{child.tag}">{child_text}{grandchildren}</span>{child_tail}')
        return f'<div class="entry-entete">{"".join(parts)}</div>{tail}'

    if tag == 'prononciation':
        return f'<span class="entry-prononciation">{text}</span>{tail}'

    if tag == 'nature':
        return f'<span class="entry-nature">{text}</span>{tail}'

    if tag == 'cit':
        aut = element.get('aut', '')
        ref = element.get('ref', '')
        inner = text + children_html
        footer = ''
        if aut and ref:
            footer = f' <cite><span class="cit-aut">{aut}</span> <span class="cit-ref">{ref}</span></cite>'
        elif aut:
            footer = f' <cite><span class="cit-aut">{aut}</span></cite>'
        elif ref:
            footer = f' <cite><span class="cit-ref">{ref}</span></cite>'
        return f'<blockquote class="entry-citation">{inner}{footer}</blockquote>{tail}'

    if tag == 'rubrique':
        name = element.get('nom', '')
        heading = f'<h3 class="entry-rubrique-title">{name}</h3>' if name else ''
        return f'<div class="entry-rubrique">{heading}{text}{children_html}</div>{tail}'

    if tag == 'indent':
        return f'<div class="entry-indent">{text}{children_html}</div>{tail}'

    if tag == 'variante':
        num = element.get('num', '')
        prefix = f'<span class="entry-num">{num}. </span>' if num else ''
        return f'<div class="entry-variante">{prefix}{text}{children_html}</div>{tail}'

    if tag == 'i':
        lang = element.get('lang', '')
        lang_attr = f' lang="{lang}"' if lang else ''
        return f'<i{lang_attr}>{text}{children_html}</i>{tail}'

    if tag == 'a':
        ref = element.get('ref', '')
        href = f'href="#{ref}"' if ref else ''
        return f'<a class="entry-ref" {href}>{text}{children_html}</a>{tail}'

    if tag == 'semantique':
        stype = element.get('type', '')
        cls = f' class="entry-{stype}"' if stype else ''
        return f'<span{cls}>{text}{children_html}</span>{tail}'

    if tag == 'corps':
        return f'{text}{children_html}{tail}'

    if tag == 'entete':
        return f'<div class="entry-entete">{text}{children_html}</div>{tail}'

    return f'{text}{children_html}{tail}'


def parse_sens(entree: ET.Element) -> dict | None:
    terme = entree.get('terme', '').strip()
    if not terme:
        return None

    num = entree.get('sens', None)

    entete = entree.find('entete')
    entete_html = ''
    if entete is not None:
        entete_html = xml_to_html(entete)

    corps = entree.find('corps')
    html = ''
    if corps is not None:
        html = xml_to_html(corps)

    return {
        'num': num,
        'mot': terme.upper(),
        'entete': entete_html,
        'html': html,
    }


def process_xml_file(filepath: str) -> dict:
    """Parse an XML file and return {terme: [sens_dict, ...]}."""
    try:
        tree = ET.parse(filepath)
        root = tree.getroot()
    except ET.ParseError as e:
        print(f"Warning: Could not parse {filepath}: {e}")
        return {}

    entries = defaultdict(list)
    for entree in root.findall('.//entree'):
        sens = parse_sens(entree)
        if sens:
            terme = entree.get('terme', '').strip()
            entries[terme].append(sens)

    return dict(entries)


def main():
    parser = argparse.ArgumentParser(description='Convert XMLittré XML to JSON')
    parser.add_argument('--input', required=True, help='Path to XMLittré data directory')
    parser.add_argument('--output', required=True, help='Path to output directory')
    args = parser.parse_args()

    input_dir = args.input
    output_dir = args.output
    os.makedirs(output_dir, exist_ok=True)

    index = defaultdict(list)
    letter_data = defaultdict(dict)

    xml_files = sorted([
        f for f in os.listdir(input_dir)
        if f.endswith('.xml')
    ])

    if not xml_files:
        print(f"No XML files found in {input_dir}")
        return

    print(f"Processing {len(xml_files)} XML files...")

    for xml_file in xml_files:
        filepath = os.path.join(input_dir, xml_file)
        file_entries = process_xml_file(filepath)

        for terme, sens_list in file_entries.items():
            norm = normalise(terme)
            letter = get_letter(terme)

            if norm not in index[letter]:
                index[letter].append(terme.upper())

            if norm in letter_data[letter]:
                letter_data[letter][norm]['sens'].extend(sens_list)
            else:
                letter_data[letter][norm] = {
                    'mot': terme.upper(),
                    'sens': sens_list,
                }

    print("Sorting index...")
    sorted_index = {}
    for letter in sorted(index.keys()):
        sorted_index[letter] = sorted(index[letter], key=lambda w: normalise(w))

    print(f"Writing index.json ({len(sorted_index)} letters)...")
    version = datetime.datetime.now(datetime.timezone.utc).isoformat()
    sorted_index['__version__'] = version
    with open(os.path.join(output_dir, 'index.json'), 'w', encoding='utf-8') as f:
        json.dump(sorted_index, f, ensure_ascii=False, indent=2)

    total_entries = 0
    for letter in sorted(letter_data.keys()):
        data = letter_data[letter]
        filepath = os.path.join(output_dir, f'{letter}.json')
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        sens_count = sum(len(v['sens']) for v in data.values())
        total_entries += sens_count
        print(f"  {letter}.json: {len(data)} entries, {sens_count} meanings")

    print(f"\nDone! {total_entries} total meanings across {sum(len(d) for d in letter_data.values())} entries written to {output_dir}")


if __name__ == '__main__':
    main()
